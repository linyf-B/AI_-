import React, { useState, useRef } from 'react';
import { editImage } from '../services/aiService';
import { Loader2, Upload, Wand2, ArrowRight } from 'lucide-react';
import { blobToBase64 } from '../utils/audioUtils';

export const ImageEditor: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResultImage(null);
    }
  };

  const handleEdit = async () => {
    if (!prompt || !selectedFile) return;

    setLoading(true);
    setError(null);

    try {
      const base64 = await blobToBase64(selectedFile);
      const response = await editImage(prompt, base64, selectedFile.type);

      let imageUrl = null;
      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                break;
            }
        }
      }

      if (imageUrl) {
        setResultImage(imageUrl);
      } else {
        // Fallback for text-only response (error or explanation)
        const text = response.text;
        if (text) setError(`模型返回了文本而非图像: ${text}`);
        else setError("未生成图像。");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "编辑图像失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto h-full p-4 flex flex-col lg:flex-row gap-6">
      {/* Controls */}
      <div className="w-full lg:w-1/3 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
           <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Wand2 className="text-purple-600" />
            AI 编辑器
           </h2>
           
           <div className="space-y-6">
             <div 
               onClick={() => fileInputRef.current?.click()}
               className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
             >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange}
                />
                <Upload className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 font-medium">
                  {selectedFile ? selectedFile.name : "点击上传源图片"}
                </p>
             </div>

             <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">指令</label>
                <textarea
                  className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                  rows={4}
                  placeholder="例如：将背景改为教室，移除那只猫..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
             </div>

             <button
               onClick={handleEdit}
               disabled={!selectedFile || !prompt || loading}
               className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
             >
                {loading ? <Loader2 className="animate-spin" /> : "应用编辑"}
             </button>
           </div>
        </div>
        
        {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
            {error}
            </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
         <div className="flex items-center justify-between mb-4">
           <h3 className="font-semibold text-gray-700">预览</h3>
         </div>

         <div className="flex-1 flex flex-col md:flex-row gap-4 items-center justify-center min-h-[400px]">
            {/* Original */}
            <div className="flex-1 w-full h-full bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden relative">
               {previewUrl ? (
                 <img src={previewUrl} className="max-w-full max-h-[400px] object-contain" alt="Original" />
               ) : (
                 <p className="text-gray-400 text-sm">未选择图片</p>
               )}
               <span className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">原图</span>
            </div>

            {/* Arrow */}
            {resultImage && (
               <div className="hidden md:block text-gray-400">
                  <ArrowRight size={24} />
               </div>
            )}

            {/* Result */}
            {resultImage && (
              <div className="flex-1 w-full h-full bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden relative">
                 <img src={resultImage} className="max-w-full max-h-[400px] object-contain" alt="Edited" />
                 <span className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded">编辑后</span>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};