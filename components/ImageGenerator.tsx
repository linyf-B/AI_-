import React, { useState } from 'react';
import { generateImage } from '../services/aiService';
import { ImageSize } from '../types';
import { Loader2, Download, Image as ImageIcon } from 'lucide-react';

export const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<ImageSize>(ImageSize.SIZE_1K);
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt) return;

    try {
      // Check for API Key first for Paid features
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await window.aistudio.openSelectKey();
            // We assume success after the dialog logic
        }
      }

      setLoading(true);
      setError(null);
      setGeneratedImage(null);

      const response = await generateImage(prompt, size);
      
      // Parse response
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
        setGeneratedImage(imageUrl);
      } else {
        setError("回复中未包含图像。");
      }

    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes("Requested entity was not found")) {
         setError("API 密钥问题。请尝试重新选择项目。");
         if (window.aistudio) {
             try { await window.aistudio.openSelectKey(); } catch(e) {}
         }
      } else {
         setError(err.message || "生成图像失败。");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col gap-6 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <ImageIcon className="text-blue-600" />
          专业教材生成器
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
              rows={3}
              placeholder="例如：详细的人类心脏图解，带标签，写实风格..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">分辨率</label>
              <select 
                value={size} 
                onChange={(e) => setSize(e.target.value as ImageSize)}
                className="w-full p-2.5 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value={ImageSize.SIZE_1K}>1K (标准)</option>
                <option value={ImageSize.SIZE_2K}>2K (高清)</option>
                <option value={ImageSize.SIZE_4K}>4K (超清)</option>
              </select>
            </div>
            <div className="flex-none pt-6">
                <button
                  onClick={handleGenerate}
                  disabled={loading || !prompt}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : "生成教材"}
                </button>
            </div>
          </div>
          <p className="text-xs text-gray-500">
             使用 Gemini 3 Pro Image。需要通过 AI Studio 的付费项目。
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      {generatedImage && (
        <div className="flex-1 min-h-0 bg-gray-100 rounded-2xl flex items-center justify-center p-4 border border-gray-200 relative group overflow-hidden">
          <img 
            src={generatedImage} 
            alt="生成结果" 
            className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
          />
          <a 
            href={generatedImage} 
            download={`generated-material-${Date.now()}.png`}
            className="absolute bottom-6 right-6 bg-white/90 hover:bg-white text-gray-800 p-3 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0"
          >
            <Download size={24} />
          </a>
        </div>
      )}
      
      {!generatedImage && !loading && !error && (
        <div className="flex-1 min-h-0 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
           <ImageIcon size={48} className="mb-4 opacity-50" />
           <p>输入提示词以生成教育材料</p>
        </div>
      )}
    </div>
  );
};