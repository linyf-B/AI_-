import React from 'react';
import { MindMapGenerator } from './components/MindMapGenerator';

const App: React.FC = () => {
  return (
    <div className="h-screen w-full bg-slate-50 font-sans text-gray-900">
       <MindMapGenerator />
    </div>
  );
};

export default App;