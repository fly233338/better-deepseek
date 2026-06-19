export interface ExtensionSettings {
  enabled: boolean;
}

const SETTINGS_KEY = 'betterDeepSeek.extensionSettings.v1';

const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  enabled: true,
};

export async function loadExtensionSettings(): Promise<ExtensionSettings> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return normalizeSettings(result[SETTINGS_KEY]);
  }

  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_EXTENSION_SETTINGS;

  try {
    return normalizeSettings(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_EXTENSION_SETTINGS;
  }
}

export async function saveExtensionSettings(settings: ExtensionSettings): Promise<void> {
  const normalized = normalizeSettings(settings);
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: normalized });
    return;
  }

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
}

function normalizeSettings(value: unknown): ExtensionSettings {
  if (!value || typeof value !== 'object') return DEFAULT_EXTENSION_SETTINGS;

  const candidate = value as Partial<ExtensionSettings>;
  return {
    enabled: candidate.enabled !== false,
  };
}

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}
