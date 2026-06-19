import type { FolderData, FolderFeatureSettings } from './types';

const STORAGE_KEY = 'betterDeepSeek.folderData.v1';
const DEFAULT_FEATURES: FolderFeatureSettings = {
  pinFolders: true,
  folderColors: true,
  folderSearch: true,
  folderExport: true,
  folderImport: true,
  conversationReorder: true,
  folderReorder: true,
  multiSelect: false,
};

export interface FolderStorage {
  load(): Promise<FolderData>;
  save(data: FolderData): Promise<void>;
}

const emptyFolderData = (): FolderData => ({
  folders: [],
  folderContents: {},
  pinnedConversations: [],
  settings: {
    hideEnabled: true,
    foldersExpanded: true,
    chatsExpanded: true,
    pinnedExpanded: true,
    features: DEFAULT_FEATURES,
  },
});

function isFolderData(value: unknown): value is FolderData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FolderData>;
  return Array.isArray(candidate.folders) && typeof candidate.folderContents === 'object';
}

export class ExtensionFolderStorage implements FolderStorage {
  async load(): Promise<FolderData> {
    if (hasChromeStorage()) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return isFolderData(result[STORAGE_KEY]) ? result[STORAGE_KEY] : emptyFolderData();
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyFolderData();

    try {
      const parsed = JSON.parse(raw) as unknown;
      return isFolderData(parsed) ? parsed : emptyFolderData();
    } catch {
      return emptyFolderData();
    }
  }

  async save(data: FolderData): Promise<void> {
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
