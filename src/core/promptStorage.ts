import type { PromptData } from './promptTypes';

const STORAGE_KEY = 'betterDeepSeek.promptData.v1';

const emptyPromptData = (): PromptData => ({
  prompts: [],
});

function isPromptData(value: unknown): value is PromptData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PromptData>;
  return Array.isArray(candidate.prompts);
}

export class PromptStorage {
  async load(): Promise<PromptData> {
    if (hasChromeStorage()) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return isPromptData(result[STORAGE_KEY]) ? result[STORAGE_KEY] : emptyPromptData();
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPromptData();

    try {
      const parsed = JSON.parse(raw) as unknown;
      return isPromptData(parsed) ? parsed : emptyPromptData();
    } catch {
      return emptyPromptData();
    }
  }

  async save(data: PromptData): Promise<void> {
    if (hasChromeStorage()) {
      await chrome.storage.local.set({ [STORAGE_KEY]: data });
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}
