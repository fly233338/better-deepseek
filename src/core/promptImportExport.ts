import type { PromptItem, PromptSourceItem, PromptSourcePack } from './promptTypes';
import { computeFingerprint, isRiskPrompt } from './promptStore';

const EXPORT_VERSION = 'better-deepseek.prompts.v1';

interface ExportPayload {
  version: string;
  exportedAt: number;
  prompts: PromptItem[];
}

export function createExportPayload(prompts: PromptItem[]): string {
  const payload: ExportPayload = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    prompts,
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadJson(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateExportFilename(): string {
  const now = new Date().toISOString().slice(0, 10);
  return `better-deepseek-prompts-${now}.json`;
}

export function parseBetterDeepSeekJson(json: string): PromptSourcePack {
  const parsed = JSON.parse(json) as unknown;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('无效的 JSON 格式');
  }

  const obj = parsed as Record<string, unknown>;
  let items: PromptSourceItem[] = [];

  if (Array.isArray(obj.prompts)) {
    items = (obj.prompts as PromptItem[]).map((p) => promptToSourceItem(p));
  } else if (Array.isArray(parsed)) {
    items = (parsed as PromptItem[]).map((p) => promptToSourceItem(p));
  } else {
    throw new Error('不支持的文件格式');
  }

  const filtered = items.filter((item) => !isRiskPrompt(item));

  return { name: '导入预览', items: filtered };
}

export function parseCsv(content: string): PromptSourcePack {
  const lines = content.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV 至少需要标题行和数据行');

  const header = parseCsvLine(lines[0]);
  const titleIdx = header.indexOf('title');
  const descIdx = header.indexOf('description');
  const contentIdx = header.indexOf('content');
  const tagsIdx = header.indexOf('tags');

  if (titleIdx === -1 || contentIdx === -1) {
    throw new Error('CSV 缺少 title 或 content 列');
  }

  const items: PromptSourceItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length <= Math.max(titleIdx, contentIdx)) continue;

    const title = row[titleIdx]?.trim();
    const description = descIdx >= 0 ? row[descIdx]?.trim() ?? '' : '';
    const content = row[contentIdx]?.trim();
    const tags = tagsIdx >= 0 ? row[tagsIdx]?.split(';').map((t) => t.trim()).filter(Boolean) ?? [] : [];

    if (!title || !content) continue;

    const item: PromptSourceItem = {
      title,
      description,
      content,
      tags,
      fingerprint: computeFingerprint(title, content),
      sourceName: 'CSV 导入',
    };

    if (!isRiskPrompt(item)) items.push(item);
  }

  return { name: 'CSV 导入预览', items };
}

export function parseMarkdown(content: string): PromptSourcePack {
  const prompts = content.split(/^#{1,3}\s+/m).filter(Boolean);
  const items: PromptSourceItem[] = [];

  for (const block of prompts) {
    const lines = block.trim().split('\n');
    const title = lines[0]?.replace(/^#+\s*/, '').trim();
    const body = lines.slice(1).join('\n').trim();

    if (!title || !body) continue;

    const descLines: string[] = [];
    const contentLines: string[] = [];
    const tags: string[] = [];
    let inContent = false;
    let inTags = false;

    for (const line of lines.slice(1)) {
      if (/^tags?\s*:/i.test(line)) {
        inTags = true;
        const tagStr = line.replace(/^tags?\s*:/i, '').trim();
        if (tagStr) tags.push(...tagStr.split(/[,;]/).map((t) => t.trim()).filter(Boolean));
        continue;
      }
      if (inTags) {
        if (line.trim()) tags.push(...line.split(/[,;]/).map((t) => t.trim()).filter(Boolean));
        else inTags = false;
        continue;
      }
      if (line.startsWith('---') && !inContent) { inContent = true; continue; }
      if (inContent) contentLines.push(line);
      else descLines.push(line);
    }

    const item: PromptSourceItem = {
      title,
      description: descLines.join(' ').trim(),
      content: contentLines.join('\n').trim() || body,
      tags,
      fingerprint: computeFingerprint(title, contentLines.join('\n').trim() || body),
      sourceName: 'Markdown 导入',
    };

    if (!isRiskPrompt(item)) items.push(item);
  }

  return { name: 'Markdown 导入预览', items };
}

export function readJsonFile(file: File): Promise<string> {
  return readTextFile(file);
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

function promptToSourceItem(prompt: PromptItem): PromptSourceItem {
  return {
    title: prompt.title,
    description: prompt.description,
    content: prompt.content,
    tags: prompt.tags,
    fingerprint: prompt.fingerprint ?? computeFingerprint(prompt.title, prompt.content),
    sourceName: 'Better DeepSeek 导入',
  };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
