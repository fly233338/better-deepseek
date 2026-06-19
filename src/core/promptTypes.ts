export type PromptId = string;

export interface PromptItem {
  id: PromptId;
  title: string;
  description: string;
  content: string;
  tags: string[];
  favorite: boolean;
  source: 'builtin' | 'user';
  createdAt: number;
  updatedAt: number;
  usageCount: number;
  lastUsedAt?: number;
}

export interface PromptData {
  prompts: PromptItem[];
  seededAt?: number;
  builtinVersion?: number;
}

export type PromptFilter = 'all' | 'favorites' | 'builtin' | 'user' | string;
