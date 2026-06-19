import { createId } from './id';
import type { PromptData, PromptFilter, PromptId, PromptItem } from './promptTypes';

const BUILTIN_PROMPTS: Omit<PromptItem, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>[] = [
  {
    title: '写作润色',
    description: '优化文字表达，修正语法错误，提升可读性',
    content: '请润色以下文字，修正语法错误，提升表达流畅度，保持原意不变：\n\n{{文本}}',
    tags: ['写作'],
    favorite: true,
    source: 'builtin',
  },
  {
    title: '中英互译',
    description: '中文和英文互相翻译',
    content: '请将以下文字翻译为{{目标语言}}：\n\n{{原文}}',
    tags: ['翻译'],
    favorite: true,
    source: 'builtin',
  },
  {
    title: '代码审查',
    description: '审查代码质量、安全性和性能',
    content: '请审查以下代码，关注安全性、性能和可维护性，给出具体改进建议：\n\n```\n{{代码}}\n```',
    tags: ['编程'],
    favorite: true,
    source: 'builtin',
  },
  {
    title: '学习导师',
    description: '用费曼学习法解释任意概念',
    content: '请用费曼学习法解释"{{概念}}"，用最简单的语言让一个初学者也能理解。',
    tags: ['学习'],
    favorite: true,
    source: 'builtin',
  },
  {
    title: '总结提炼',
    description: '将长文本总结为要点',
    content: '请将以下内容总结为3-5个要点，每个要点不超过两行：\n\n{{内容}}',
    tags: ['效率'],
    favorite: false,
    source: 'builtin',
  },
  {
    title: '角色扮演',
    description: '设定角色卡，进行角色扮演对话',
    content: '你将扮演{{角色名称}}。以下是你的设定：\n\n{{角色设定}}\n\n现在请以这个角色的身份回复：{{用户输入}}',
    tags: ['创意'],
    favorite: false,
    source: 'builtin',
  },
  {
    title: '头脑风暴',
    description: '围绕主题生成创意点子',
    content: '请围绕"{{主题}}"进行头脑风暴，从不同角度提出至少10个创意点子。',
    tags: ['创意'],
    favorite: false,
    source: 'builtin',
  },
  {
    title: '深度分析',
    description: '多角度深度分析问题',
    content: '请对以下问题从多角度进行深度分析（背景、现状、影响、建议）：\n\n{{问题}}',
    tags: ['分析'],
    favorite: false,
    source: 'builtin',
  },
];

export class PromptStore {
  readonly data: PromptData;

  constructor(data?: PromptData) {
    this.data = data ? clonePromptData(data) : { prompts: [] };
  }

  snapshot(): PromptData {
    return clonePromptData(this.data);
  }

  seedBuiltins(): PromptItem[] {
    if (this.data.seededAt) return [];

    const now = Date.now();
    const builtins: PromptItem[] = BUILTIN_PROMPTS.map((p, i) => ({
      ...p,
      id: createId('prompt'),
      createdAt: now + i,
      updatedAt: now + i,
      usageCount: 0,
    }));

    this.data.prompts.push(...builtins);
    this.data.seededAt = now;
    return builtins;
  }

  prompts(order: 'updated' | 'usage' | 'title' = 'updated'): PromptItem[] {
    return [...this.data.prompts].sort((a, b) => {
      if (order === 'usage') return (b.usageCount - a.usageCount) || (b.updatedAt - a.updatedAt);
      if (order === 'title') return a.title.localeCompare(b.title);
      return b.updatedAt - a.updatedAt;
    });
  }

  filteredPrompts(filter: PromptFilter, query: string, tag?: string): PromptItem[] {
    let result = this.prompts('updated');

    if (filter === 'favorites') result = result.filter((p) => p.favorite);
    else if (filter === 'builtin') result = result.filter((p) => p.source === 'builtin');
    else if (filter === 'user') result = result.filter((p) => p.source === 'user');

    if (tag) result = result.filter((p) => p.tags.includes(tag));

    if (query) {
      const lower = query.toLocaleLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLocaleLowerCase().includes(lower) ||
          p.description.toLocaleLowerCase().includes(lower) ||
          p.content.toLocaleLowerCase().includes(lower) ||
          p.tags.some((t) => t.toLocaleLowerCase().includes(lower)),
      );
    }

    return result;
  }

  allTags(): string[] {
    const tagSet = new Set<string>();
    for (const p of this.data.prompts) {
      for (const t of p.tags) tagSet.add(t);
    }
    return [...tagSet].sort();
  }

  get(id: PromptId): PromptItem | undefined {
    return this.data.prompts.find((p) => p.id === id);
  }

  create(
    fields: Pick<PromptItem, 'title' | 'description' | 'content' | 'tags'> & Partial<Pick<PromptItem, 'favorite'>>,
  ): PromptItem {
    const now = Date.now();
    const prompt: PromptItem = {
      id: createId('prompt'),
      title: fields.title.trim() || '新 Prompt',
      description: fields.description.trim(),
      content: fields.content.trim(),
      tags: fields.tags.filter(Boolean),
      favorite: fields.favorite ?? false,
      source: 'user',
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
    };
    this.data.prompts.push(prompt);
    return { ...prompt };
  }

  update(id: PromptId, fields: Partial<Pick<PromptItem, 'title' | 'description' | 'content' | 'tags' | 'favorite'>>): PromptItem | null {
    const prompt = this.get(id);
    if (!prompt) return null;

    if (fields.title !== undefined) prompt.title = fields.title.trim() || prompt.title;
    if (fields.description !== undefined) prompt.description = fields.description.trim();
    if (fields.content !== undefined) prompt.content = fields.content.trim();
    if (fields.tags !== undefined) prompt.tags = fields.tags.filter(Boolean);
    if (fields.favorite !== undefined) prompt.favorite = fields.favorite;
    prompt.updatedAt = Date.now();

    return { ...prompt };
  }

  delete(id: PromptId): boolean {
    const index = this.data.prompts.findIndex((p) => p.id === id);
    if (index === -1) return false;
    this.data.prompts.splice(index, 1);
    return true;
  }

  duplicate(id: PromptId): PromptItem | null {
    const original = this.get(id);
    if (!original) return null;

    const now = Date.now();
    const copy: PromptItem = {
      ...original,
      id: createId('prompt'),
      title: `${original.title} (副本)`,
      source: 'user',
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      lastUsedAt: undefined,
    };
    this.data.prompts.push(copy);
    return { ...copy };
  }

  toggleFavorite(id: PromptId): PromptItem | null {
    const prompt = this.get(id);
    if (!prompt) return null;
    prompt.favorite = !prompt.favorite;
    prompt.updatedAt = Date.now();
    return { ...prompt };
  }

  recordUsage(id: PromptId): void {
    const prompt = this.get(id);
    if (!prompt) return;
    prompt.usageCount += 1;
    prompt.lastUsedAt = Date.now();
  }
}

function clonePromptData(data: PromptData): PromptData {
  return {
    prompts: data.prompts.map((p) => ({ ...p })),
    seededAt: data.seededAt,
  };
}
