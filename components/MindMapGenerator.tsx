import React, { useState, useRef, useEffect } from 'react';
import { expandMindMapNode } from '../services/aiService';
import { MindMapNode, LayoutDirection, Template } from '../types';
import { 
  Network, Plus, Loader2, ZoomIn, ZoomOut, RotateCcw, 
  Layout, ArrowDown, ArrowRight, BookOpen, Briefcase, 
  Lightbulb, Target, HelpCircle, X 
} from 'lucide-react';

// --- Templates Configuration ---
const TEMPLATES: Template[] = [
  {
    id: 'reading',
    title: '读书笔记',
    description: '快速拆解书籍核心观点与章节脉络',
    icon: <BookOpen className="text-blue-500" />,
    promptPrefix: '书籍：《[书名]》的核心章节与关键洞见'
  },
  {
    id: 'project',
    title: '项目规划',
    description: '制定项目实施路径、里程碑与资源分配',
    icon: <Briefcase className="text-purple-500" />,
    promptPrefix: '项目：[项目名称] 的实施阶段与关键任务'
  },
  {
    id: 'brainstorm',
    title: '头脑风暴',
    description: '针对特定主题进行多维度的发散思考',
    icon: <Lightbulb className="text-yellow-500" />,
    promptPrefix: '主题：[主题] 的创新思路与发散维度'
  },
  {
    id: 'swot',
    title: 'SWOT 分析',
    description: '分析优势、劣势、机会与威胁',
    icon: <Target className="text-red-500" />,
    promptPrefix: '分析对象：[对象] 的 SWOT 分析（优势、劣势、机会、威胁）'
  }
];

// --- Helper Functions ---

const findPath = (node: MindMapNode, targetId: string, currentPath: string[] = []): string[] | null => {
  if (node.id === targetId) {
    // Return path excluding the current node itself, as we usually want the ancestry
    return currentPath;
  }
  if (node.children) {
    for (const child of node.children) {
      const path = findPath(child, targetId, [...currentPath, node.label]);
      if (path) return path;
    }
  }
  return null;
};

// --- Sub-components ---

const GuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <HelpCircle className="text-blue-600" /> 使用指南
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
          <X size={20} />
        </button>
      </div>
      <div className="space-y-4 text-gray-600">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold">1</div>
          <div>
            <p className="font-medium text-gray-800">无限层级生成</p>
            <p className="text-sm mt-1">AI 能够理解节点路径。当你点击深层节点时，它会基于之前的上下文继续生成，避免知识偏离。</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 font-bold">2</div>
          <div>
            <p className="font-medium text-gray-800">双倍生成速度</p>
            <p className="text-sm mt-1">为了帮助你更快建立知识网络，每次点击我们都会尝试一次性生成两层结构（父子节点）。</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 font-bold">3</div>
          <div>
            <p className="font-medium text-gray-800">自由画布</p>
            <p className="text-sm mt-1">画布现已优化，支持向任意方向无限扩展。无论思维导图多大，都可以通过滚动条完整查看。</p>
          </div>
        </div>
      </div>
      <button onClick={onClose} className="mt-6 w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors">
        开始探索
      </button>
    </div>
  </div>
);

const TreeNode: React.FC<{ 
  node: MindMapNode; 
  onExpand: (node: MindMapNode) => void;
  depth: number;
  direction: LayoutDirection;
}> = ({ node, onExpand, depth, direction }) => {
  const hasChildren = node.children && node.children.length > 0;
  
  // Dynamic styling based on depth
  const colors = [
    'bg-slate-900 border-slate-900 text-white shadow-xl ring-4 ring-slate-100',
    'bg-white border-blue-500 text-blue-900 shadow-md hover:border-blue-700 hover:shadow-lg',
    'bg-white border-indigo-400 text-indigo-900 shadow-sm hover:border-indigo-600 hover:shadow-md',
    'bg-white border-violet-300 text-violet-900 shadow-sm hover:border-violet-500',
    'bg-white border-fuchsia-300 text-fuchsia-900 shadow-sm hover:border-fuchsia-500',
    'bg-white border-pink-300 text-pink-900 shadow-sm hover:border-pink-500',
  ];
  // Cycle colors for deeper levels
  const colorClass = depth === 0 ? colors[0] : colors[Math.min(depth, colors.length - 1)];

  return (
    <div className={`flex ${direction === 'vertical' ? 'flex-col items-center' : 'flex-row items-center'}`}>
      <div 
        onClick={(e) => {
          e.stopPropagation();
          onExpand(node);
        }}
        className={`
          relative z-10 cursor-pointer transition-all duration-300 transform 
          hover:scale-105 active:scale-95
          px-5 py-3 rounded-xl border-2 min-w-[120px] max-w-[240px] text-center
          flex flex-col items-center justify-center
          ${colorClass}
          ${node.isLoading ? 'opacity-80 ring-2 ring-blue-400 animate-pulse' : ''}
          ${direction === 'horizontal' ? 'my-2 mx-6' : 'mx-4 my-6'}
        `}
      >
        <div className="font-bold text-sm md:text-base leading-tight flex items-center gap-2 justify-center w-full">
          <span>{node.label}</span>
          {node.isLoading && <Loader2 size={14} className="animate-spin flex-shrink-0" />}
          {!node.isLoading && !hasChildren && (
             <div className="w-5 h-5 rounded-full bg-current opacity-10 flex items-center justify-center flex-shrink-0 group-hover:opacity-20 transition-opacity">
               <Plus size={12} strokeWidth={3} />
             </div>
          )}
        </div>
        {node.description && (
          <div className={`text-xs mt-1.5 leading-snug line-clamp-2 ${depth === 0 ? 'text-slate-300' : 'text-gray-500'}`}>
            {node.description}
          </div>
        )}
      </div>

      {/* Connections */}
      {hasChildren && node.isExpanded && (
        <div className={`flex ${direction === 'vertical' ? 'flex-col items-center' : 'flex-row items-center'} relative`}>
          
          {/* Main stem from parent */}
          <div className={`bg-gray-300 absolute
            ${direction === 'vertical' 
              ? 'w-0.5 h-6 -top-6 left-1/2 -translate-x-1/2' 
              : 'h-0.5 w-6 -left-6 top-1/2 -translate-y-1/2'
            }`} 
          />

          <div className={`flex ${direction === 'vertical' ? 'flex-row pt-6' : 'flex-col pl-6'} relative`}>
            {/* Connector Bar across children */}
            {node.children.length > 1 && (
               <div className={`bg-gray-300 absolute
                 ${direction === 'vertical'
                   ? 'h-px top-0 left-0 right-0 mx-auto w-[calc(100%-4rem)]' // Adjusted for wider spacing
                   : 'w-px left-0 top-0 bottom-0 my-auto h-[calc(100%-2rem)]' 
                 }`} 
               />
            )}

            {node.children.map((child) => (
              <div key={child.id} className="relative">
                 {/* Stem to each child */}
                 <div className={`bg-gray-300 absolute
                   ${direction === 'vertical'
                     ? 'w-0.5 h-6 -top-6 left-1/2 -translate-x-1/2'
                     : 'h-0.5 w-6 -left-6 top-1/2 -translate-y-1/2'
                   }`} 
                 />
                 <TreeNode node={child} onExpand={onExpand} depth={depth + 1} direction={direction} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main Component ---

export const MindMapGenerator: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [rootNode, setRootNode] = useState<MindMapNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [direction, setDirection] = useState<LayoutDirection>('horizontal');
  const [showGuide, setShowGuide] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  
  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCreate = async (inputTopic: string = topic, contextPrefix: string = '') => {
    const finalTopic = inputTopic.trim();
    if (!finalTopic) return;
    
    const displayLabel = inputTopic.replace(/\[.*?\]/g, '').trim() || inputTopic; 

    setLoading(true);
    setTopic(finalTopic);
    
    const root: MindMapNode = {
      id: 'root',
      label: displayLabel.length > 15 ? displayLabel.substring(0, 15) + '...' : displayLabel,
      description: contextPrefix ? 'AI 智图生成' : '核心主题',
      children: [],
      isExpanded: true,
      isLoading: true
    };
    setRootNode(root);

    try {
      // For root node, we have no ancestry path yet
      const childrenRaw = await expandMindMapNode(finalTopic, []); 
      
      const newChildren: MindMapNode[] = childrenRaw.map((c, idx) => ({
        id: `root-${idx}`,
        label: c.label,
        description: c.description,
        isExpanded: true, // Auto expand first level
        children: c.children ? c.children.map((gc, gcIdx) => ({
             id: `root-${idx}-${gcIdx}`,
             label: gc.label,
             description: gc.description,
             children: [],
             isExpanded: false
        })) : []
      }));

      setRootNode(prev => prev ? { ...prev, children: newChildren, isLoading: false } : null);
    } catch (e) {
      console.error(e);
      setRootNode(prev => prev ? { ...prev, isLoading: false } : null);
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (tpl: Template) => {
    setTopic(tpl.promptPrefix);
    inputRef.current?.focus();
  };

  const handleNodeClick = async (clickedNode: MindMapNode) => {
    // 1. Toggle expansion if children exist
    if (clickedNode.children && clickedNode.children.length > 0) {
       const toggleNode = (node: MindMapNode): MindMapNode => {
         if (node.id === clickedNode.id) return { ...node, isExpanded: !node.isExpanded };
         if (node.children) return { ...node, children: node.children.map(toggleNode) };
         return node;
       };
       setRootNode(prev => prev ? toggleNode(prev) : null);
       return;
    }

    // 2. If no children, set loading and fetch
    const setLoadingState = (node: MindMapNode, isLoading: boolean): MindMapNode => {
      if (node.id === clickedNode.id) return { ...node, isLoading };
      if (node.children) return { ...node, children: node.children.map(n => setLoadingState(n, isLoading)) };
      return node;
    };
    setRootNode(prev => prev ? setLoadingState(prev, true) : null);

    try {
      // Find path for context-aware generation
      const path = rootNode ? findPath(rootNode, clickedNode.id) : [];
      
      const childrenRaw = await expandMindMapNode(clickedNode.label, path || []);
      
      const populateChildren = (node: MindMapNode): MindMapNode => {
        if (node.id === clickedNode.id) {
           const newChildren: MindMapNode[] = childrenRaw.map((c, idx) => ({
              id: `${node.id}-${idx}`,
              label: c.label,
              description: c.description,
              isExpanded: false, // Don't auto-expand deep nodes to keep UI clean initially, user can click to see grand-children
              children: c.children ? c.children.map((gc, gcIdx) => ({
                  id: `${node.id}-${idx}-${gcIdx}`,
                  label: gc.label,
                  description: gc.description,
                  children: [],
                  isExpanded: false
              })) : []
           }));
           return { ...node, children: newChildren, isExpanded: true, isLoading: false };
        }
        if (node.children) {
           return { ...node, children: node.children.map(populateChildren) };
        }
        return node;
      };

      setRootNode(prev => prev ? populateChildren(prev) : null);
    } catch (e) {
      console.error(e);
      setRootNode(prev => prev ? setLoadingState(prev, false) : null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden">
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}

      {/* Top Bar */}
      <div className="bg-white px-6 py-4 border-b border-gray-200 shadow-sm flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Network size={24} />
          </div>
          <div>
            <h1 className="font-bold text-xl text-gray-900 tracking-tight">智图 AI</h1>
          </div>
        </div>

        {rootNode && (
             <div className="hidden md:flex flex-1 max-w-xl mx-8 relative group">
               <input
                 type="text"
                 value={topic}
                 onChange={(e) => setTopic(e.target.value)}
                 className="w-full pl-4 pr-12 py-2.5 rounded-full border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
               />
               <button 
                onClick={() => handleCreate()}
                className="absolute right-2 top-2 p-1 bg-white rounded-full text-blue-600 hover:bg-blue-50"
               >
                 <RotateCcw size={16} />
               </button>
             </div>
        )}

        <div className="flex items-center gap-2">
           {rootNode && (
             <button 
               onClick={() => setDirection(d => d === 'vertical' ? 'horizontal' : 'vertical')}
               className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
             >
               {direction === 'vertical' ? <ArrowRight size={18} /> : <ArrowDown size={18} />}
               <span className="hidden sm:inline">{direction === 'vertical' ? '切至水平' : '切至垂直'}</span>
             </button>
           )}
           <button 
             onClick={() => setShowGuide(true)}
             className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
           >
             <HelpCircle size={22} />
           </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative bg-slate-50 overflow-hidden flex flex-col">
        
        {/* Floating Tools */}
        {rootNode && (
          <div className="absolute bottom-6 left-6 z-30 flex gap-2">
              <div className="bg-white shadow-lg border border-gray-200 rounded-xl p-1.5 flex flex-col gap-1">
                <button onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="p-2 hover:bg-gray-50 rounded-lg text-gray-600"><ZoomIn size={20} /></button>
                <div className="h-px bg-gray-200 w-full" />
                <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.2))} className="p-2 hover:bg-gray-50 rounded-lg text-gray-600"><ZoomOut size={20} /></button>
              </div>
              <button 
                onClick={() => { setRootNode(null); setTopic(''); }} 
                className="bg-white shadow-lg border border-gray-200 text-red-500 p-3 rounded-xl hover:bg-red-50 transition-colors"
                title="清空画布"
              >
                <RotateCcw size={20} />
              </button>
          </div>
        )}

        {/* Scrollable Canvas Container */}
        {/* KEY FIX: flex + m-auto allows content to center when small, but scroll correctly when large */}
        <div className="flex-1 overflow-auto flex w-full h-full custom-scrollbar">
           {rootNode ? (
             <div className="m-auto min-w-fit min-h-fit p-[50vh]">
                <div 
                   className="transition-transform origin-center"
                   style={{ transform: `scale(${zoom})` }}
                >
                   <TreeNode node={rootNode} onExpand={handleNodeClick} depth={0} direction={direction} />
                </div>
             </div>
           ) : (
             <div className="m-auto w-full max-w-4xl flex flex-col items-center p-8">
                <div className="text-center mb-12">
                   <h2 className="text-4xl font-extrabold text-gray-900 mb-4">你想探索什么知识？</h2>
                   <p className="text-lg text-gray-500">输入任何主题，智图 AI 帮你拆解思维，构建知识网络。</p>
                </div>

                <div className="w-full max-w-2xl relative mb-16">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                     <Network className="text-blue-500" size={24} />
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="输入关键词，例如：量子力学、短视频运营、咖啡制作..."
                    className="w-full pl-14 pr-32 py-5 text-lg rounded-2xl border-2 border-gray-200 shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  />
                  <button 
                    onClick={() => handleCreate()}
                    disabled={!topic || loading}
                    className="absolute right-3 top-2.5 bottom-2.5 bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                     {loading ? <Loader2 className="animate-spin" /> : "开始生成"}
                  </button>
                </div>

                <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {TEMPLATES.map((tpl) => (
                    <button 
                      key={tpl.id}
                      onClick={() => applyTemplate(tpl)}
                      className="group bg-white p-5 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left flex flex-col gap-3"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-white border border-gray-100 group-hover:border-gray-200 flex items-center justify-center transition-colors">
                        {tpl.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">{tpl.title}</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">{tpl.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};