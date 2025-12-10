import React from 'react';

export interface MindMapNode {
  id: string;
  label: string;
  description?: string;
  children: MindMapNode[];
  isExpanded: boolean;
  isLoading?: boolean;
}

export type LayoutDirection = 'vertical' | 'horizontal';

export interface Template {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  promptPrefix: string;
}

export enum ImageSize {
  SIZE_1K = '1K',
  SIZE_2K = '2K',
  SIZE_4K = '4K',
}

// Augment window to include aistudio (legacy support, though not strictly needed for MindMap if we don't use paid features, but good to keep)
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}