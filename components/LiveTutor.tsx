import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Video, VideoOff, Phone, Activity } from 'lucide-react';
import { createPcmBlob, decode, decodeAudioData, blobToBase64 } from '../utils/audioUtils';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';
const FRAME_RATE = 2; // Frames per second for video streaming
const JPEG_QUALITY = 0.5;

export const LiveTutor: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [status, setStatus] = useState<string>('准备开始会话');
  const [error, setError] = useState<string | null>(null);

  // Refs for audio/video handling
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<Promise<any> | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  
  // Refs for audio context and processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const cleanupSession = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    if (sessionRef.current) {
      sessionRef.current.then(session => {
        try {
          session.close();
        } catch (e) {
          console.error("Error closing session", e);
        }
      });
      sessionRef.current = null;
    }

    // Stop audio sources
    sourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) {}
    });
    sourcesRef.current.clear();

    // Close contexts
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }

    setIsActive(false);
    setStatus('会话已结束');
  }, []);

  const startSession = async () => {
    try {
      setStatus('初始化中...');
      setError(null);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Setup Audio Contexts
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const inputContext = new AudioContextClass({ sampleRate: 16000 });
      const outputContext = new AudioContextClass({ sampleRate: 24000 });
      
      inputContextRef.current = inputContext;
      audioContextRef.current = outputContext;
      nextStartTimeRef.current = 0;

      const outputNode = outputContext.createGain();
      outputNode.connect(outputContext.destination);

      // Get User Media (Audio + Video)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: 640, height: 480 } 
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Connect to Live API
      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            setStatus('已连接。请说“你好”！');
            setIsActive(true);

            // Setup Audio Input Processing
            const source = inputContext.createMediaStreamSource(stream);
            const scriptProcessor = inputContext.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (isMuted) return; // Simple mute logic
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
               const ctx = audioContextRef.current;
               if (!ctx) return;

               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
               
               const audioBuffer = await decodeAudioData(
                 decode(base64Audio),
                 ctx,
                 24000,
                 1
               );

               const source = ctx.createBufferSource();
               source.buffer = audioBuffer;
               source.connect(outputNode);
               source.addEventListener('ended', () => {
                 sourcesRef.current.delete(source);
               });

               source.start(nextStartTimeRef.current);
               nextStartTimeRef.current += audioBuffer.duration;
               sourcesRef.current.add(source);
            }

            // Handle Interruptions
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(source => source.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            setStatus('已断开连接');
            setIsActive(false);
          },
          onerror: (e) => {
            console.error(e);
            setError('发生连接错误。');
            cleanupSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          // Localized system instruction
          systemInstruction: "你是一位专业、耐心且鼓舞人心的导师。你可以通过视频看到学生向你展示的内容。请用中文与学生互动，解释要简洁并具有互动性。",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        }
      });

      sessionRef.current = sessionPromise;

      // Start Video Streaming Loop
      frameIntervalRef.current = window.setInterval(() => {
        if (!isVideoEnabled || !videoRef.current || !canvasRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(async (blob) => {
          if (blob && sessionRef.current) {
            const base64Data = await blobToBase64(blob);
            sessionRef.current.then(session => {
              session.sendRealtimeInput({
                media: { data: base64Data, mimeType: 'image/jpeg' }
              });
            });
          }
        }, 'image/jpeg', JPEG_QUALITY);

      }, 1000 / FRAME_RATE);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "无法启动会话");
      setIsActive(false);
    }
  };

  useEffect(() => {
    return () => {
      cleanupSession();
    };
  }, [cleanupSession]);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
      {/* Video / Visualizer Area */}
      <div className="flex-1 bg-gray-900 relative flex items-center justify-center overflow-hidden group">
        <video 
          ref={videoRef} 
          className={`h-full w-full object-cover transition-opacity duration-300 ${isVideoEnabled ? 'opacity-100' : 'opacity-0'}`}
          muted 
          playsInline 
        />
        {!isVideoEnabled && (
           <div className="absolute inset-0 flex items-center justify-center text-white/50">
             <div className="text-center">
               <VideoOff className="w-16 h-16 mx-auto mb-4" />
               <p>摄像头已禁用</p>
             </div>
           </div>
        )}
        
        {/* Status Overlay */}
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2">
           <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
           <span className="text-white text-xs font-medium">{status}</span>
        </div>

        {error && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg text-sm max-w-md text-center">
            {error}
          </div>
        )}
        
        {/* Hidden Canvas for Frame Processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="bg-gray-50 border-t border-gray-200 p-6">
        <div className="flex items-center justify-center gap-6">
           <button 
            onClick={() => setIsMuted(!isMuted)}
            disabled={!isActive}
            className={`p-4 rounded-full transition-all ${isMuted ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} disabled:opacity-50`}
           >
             {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
           </button>

           <button 
             onClick={isActive ? cleanupSession : startSession}
             className={`p-6 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 ${isActive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
           >
             {isActive ? <Phone size={32} /> : <Activity size={32} />}
           </button>

           <button 
             onClick={() => setIsVideoEnabled(!isVideoEnabled)}
             disabled={!isActive}
             className={`p-4 rounded-full transition-all ${!isVideoEnabled ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} disabled:opacity-50`}
           >
             {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
           </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          由 Gemini 2.5 Live API 提供支持
        </p>
      </div>
    </div>
  );
};