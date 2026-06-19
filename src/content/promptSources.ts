import type { PromptSourceItem, PromptSourcePack } from '../core/promptTypes';
import { isRiskPrompt } from '../core/promptStore';

interface SourceMeta {
  id: string;
  name: string;
  dataUrl: string;
  homepage: string;
  description: string;
}

const SOURCE: SourceMeta = {
  id: 'better-deepseek',
  name: 'BDS 提示词仓库',
  dataUrl: 'https://raw.githubusercontent.com/fly233338/better-deepseek/main/data/prompts/index.json',
  homepage: 'https://github.com/fly233338/better-deepseek/tree/main/docs/prompts',
  description: 'Better DeepSeek 官方维护的提示词集合',
};

const CACHE_KEY = 'betterDeepSeek.sourceCache.v1';

interface SourceCache {
  sourceId: string;
  updatedAt: number;
  items: PromptSourceItem[];
}

export function getSourceList(): SourceMeta[] {
  return [SOURCE];
}

export async function loadSource(): Promise<PromptSourcePack> {
  const cached = await loadCache(SOURCE.id);
  if (cached) {
    const safe = cached.filter((item) => !isRiskPrompt(item));
    const risks = cached.filter((item) => isRiskPrompt(item));
    return { name: SOURCE.name, items: safe, risks };
  }

  return { name: SOURCE.name, items: [], risks: [] };
}

export async function refreshSource(): Promise<PromptSourcePack> {
  try {
    const resp = await fetch(SOURCE.dataUrl, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json() as unknown;
    if (!Array.isArray(json)) throw new Error('数据格式错误');

    const items = parsePromptItems(json);
    await saveCache(SOURCE.id, items);

    const safe = items.filter((item) => !isRiskPrompt(item));
    const risks = items.filter((item) => isRiskPrompt(item));
    return { name: SOURCE.name, items: safe, risks };
  } catch (err) {
    throw err;
  }
}

/* ======== internals ======== */

function parsePromptItems(json: unknown[]): PromptSourceItem[] {
  return json.map((entry) => {
    const obj = entry as Record<string, unknown>;
    return {
      title: String(obj.title ?? ''),
      description: String(obj.description ?? ''),
      content: String(obj.content ?? ''),
      tags: Array.isArray(obj.tags) ? obj.tags.map(String).filter(Boolean) : [],
      fingerprint: String(obj.fingerprint ?? ''),
      sourceName: SOURCE.name,
      sourceUrl: SOURCE.homepage,
    };
  });
}

async function loadCache(sourceId: string): Promise<PromptSourceItem[] | null> {
  const result = await getStorage().get(CACHE_KEY);
  const cache = result[CACHE_KEY] as Record<string, SourceCache> | undefined;
  if (!cache?.[sourceId]) return null;
  return cache[sourceId].items;
}

async function saveCache(sourceId: string, items: PromptSourceItem[]): Promise<void> {
  const result = await getStorage().get(CACHE_KEY);
  const cache = (result[CACHE_KEY] as Record<string, SourceCache> | undefined) ?? {};
  cache[sourceId] = { sourceId, updatedAt: Date.now(), items };
  await getStorage().set({ [CACHE_KEY]: cache });
}

function getStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return {
      get: (key: string) => chrome.storage.local.get(key) as Promise<Record<string, unknown>>,
      set: (items: Record<string, unknown>) => chrome.storage.local.set(items),
    };
  }
  const storage = {
    get: async (key: string): Promise<Record<string, unknown>> => {
      const raw = localStorage.getItem(key);
      return raw ? { [key]: JSON.parse(raw) } : {};
    },
    set: async (items: Record<string, unknown>): Promise<void> => {
      for (const [k, v] of Object.entries(items)) {
        localStorage.setItem(k, JSON.stringify(v));
      }
    },
  };
  return storage;
}
