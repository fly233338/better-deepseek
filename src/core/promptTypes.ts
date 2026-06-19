export type PromptId = string;

export interface PromptItem {
  id: PromptId;
  title: string;
  description: string;
  content: string;
  tags: string[];
  favorite: boolean;
  source: 'builtin' | 'user' | 'imported';
  sourceName?: string;
  sourceUrl?: string;
  fingerprint?: string;
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

export type PromptFilter = 'all' | 'favorites' | 'builtin' | 'user' | 'imported' | string;

export interface PromptSourceItem {
  title: string;
  description: string;
  content: string;
  tags: string[];
  fingerprint: string;
  sourceName: string;
  sourceUrl?: string;
  favorite?: boolean;
}

export interface PromptSourcePack {
  name: string;
  items: PromptSourceItem[];
  risks?: PromptSourceItem[];
}
