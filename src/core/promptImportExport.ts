import type { PromptData, PromptItem, PromptSourceItem, PromptSourcePack } from './promptTypes';
import { computeFingerprint, isRiskPrompt } from './promptStore';

const EXPORT_VERSION = 'better-deepseek.prompts.v2';

interface ExportPayload {
  version: string;
  exportedAt: number;
  builtinVersion?: number;
  prompts: PromptItem[];
}

export function createExportPayload(data: PromptData): string {
  const payload: ExportPayload = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    builtinVersion: data.builtinVersion,
    prompts: data.prompts,
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

  const risks: PromptSourceItem[] = [];
  const safe: PromptSourceItem[] = [];
  for (const item of items) {
    if (isRiskPrompt(item)) risks.push(item);
    else safe.push(item);
  }

  return { name: '导入预览', items: safe, risks };
}

export function parseCsv(content: string): PromptSourcePack {
  const text = stripBom(content);
  const lines = text.trim().split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error('CSV 至少需要标题行和数据行');

  const header = parseCsvLine(lines[0]);
  const titleIdx = header.indexOf('title');
  const descIdx = header.indexOf('description');
  const contentIdx = header.indexOf('content');
  const tagsIdx = header.indexOf('tags');

  if (titleIdx === -1 || contentIdx === -1) {
    throw new Error('CSV 缺少 title 或 content 列');
  }

  const maxCol = Math.max(titleIdx, contentIdx, descIdx, tagsIdx);
  const items: PromptSourceItem[] = [];
  const risks: PromptSourceItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < maxCol + 1) continue;

    const title = row[titleIdx]?.trim();
    const description = descIdx >= 0 && descIdx < row.length ? (row[descIdx]?.trim() ?? '') : '';
    const content = row[contentIdx]?.trim();
    const tags = tagsIdx >= 0 && tagsIdx < row.length
      ? (row[tagsIdx]?.split(/[;；]/).map((t) => t.trim()).filter(Boolean) ?? [])
      : [];

    if (!title || !content) continue;

    const item: PromptSourceItem = {
      title,
      description,
      content,
      tags,
      fingerprint: computeFingerprint(title, content),
      sourceName: 'CSV 导入',
    };

    if (isRiskPrompt(item)) risks.push(item);
    else items.push(item);
  }

  return { name: 'CSV 导入预览', items, risks };
}

export function parseMarkdown(content: string): PromptSourcePack {
  const text = stripBom(content);
  const sections = text.split(/^#{1,3}\s+/m).filter(Boolean);
  const items: PromptSourceItem[] = [];
  const risks: PromptSourceItem[] = [];

  for (const block of sections) {
    const lines = block.trim().split('\n');
    const title = lines[0]?.replace(/^#+\s*/, '').trim();
    const body = lines.slice(1).join('\n').trim();

    if (!title || !body) continue;

    const descLines: string[] = [];
    const contentLines: string[] = [];
    const tags: string[] = [];
    let inContent = false;
    let inTags = false;
    let inCodeBlock = false;

    for (const line of lines.slice(1)) {
      if (/^```/.test(line)) { inCodeBlock = !inCodeBlock; if (!inContent) contentLines.push(line); else contentLines.push(line); continue; }
      if (inCodeBlock) { if (!inContent) contentLines.push(line); else contentLines.push(line); continue; }

      if (/^(tags?|标签)\s*[:：]/i.test(line)) {
        inTags = true;
        const tagStr = line.replace(/^(tags?|标签)\s*[:：]/i, '').trim();
        if (tagStr) tags.push(...tagStr.split(/[,;，；]/).map((t) => t.trim()).filter(Boolean));
        continue;
      }
      if (inTags) {
        if (line.trim()) tags.push(...line.split(/[,;，；]/).map((t) => t.trim()).filter(Boolean));
        else inTags = false;
        continue;
      }

      if (/^(description|描述)\s*[:：]/i.test(line)) {
        const descStr = line.replace(/^(description|描述)\s*[:：]/i, '').trim();
        if (descStr) descLines.push(descStr);
        continue;
      }

      if (/^-{3,}$/.test(line.trim()) && !inContent) { inContent = true; continue; }
      if (inContent) contentLines.push(line);
      else descLines.push(line);
    }

    const description = descLines.join(' ').trim();
    const content = contentLines.join('\n').trim() || body;

    const item: PromptSourceItem = {
      title,
      description,
      content,
      tags,
      fingerprint: computeFingerprint(title, content),
      sourceName: 'Markdown 导入',
    };

    if (isRiskPrompt(item)) risks.push(item);
    else items.push(item);
  }

  return { name: 'Markdown 导入预览', items, risks };
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
    favorite: prompt.favorite,
  };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}
