import { createId } from './id';
import type { PromptData, PromptFilter, PromptId, PromptItem, PromptSourceItem } from './promptTypes';

const BUILTIN_PROMPT_VERSION = 2;
const BUILTIN_TITLE_ALIASES = new Map([
  ['角色', '角色扮演'],
]);
const BUILTIN_PROMPTS: Omit<PromptItem, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>[] = [
  {
    title: '提问优化器',
    description: '把模糊问题改写成更容易得到高质量回答的 Prompt',
    content: [
      '请帮我优化下面这个问题，让它更清晰、更具体、更适合交给 AI 回答。',
      '',
      '要求：',
      '1. 先指出原问题中缺失的信息或可能的歧义。',
      '2. 给出一个可直接复制使用的优化版 Prompt。',
      '3. 如果有必要，补充 2-3 个可选追问。',
      '',
      '原问题：',
      '{{问题}}',
    ].join('\n'),
    tags: ['效率', '提问'],
    favorite: true,
    source: 'builtin',
  },
  {
    title: '写作润色',
    description: '在不改变原意的前提下，让文本更清楚、更自然',
    content: [
      '请润色下面的文本。',
      '',
      '目标风格：{{目标风格}}',
      '读者对象：{{读者对象}}',
      '',
      '要求：',
      '1. 保持原意，不凭空增加事实。',
      '2. 修正语病、重复和不自然表达。',
      '3. 输出润色后的版本，并简要说明主要修改点。',
      '',
      '原文：',
      '{{文本}}',
    ].join('\n'),
    tags: ['写作', '效率'],
    favorite: true,
    source: 'builtin',
  },
  {
    title: '中英互译',
    description: '翻译文本，并保留语气、格式和专有名词一致性',
    content: [
      '请将下面内容翻译为{{目标语言}}。',
      '',
      '要求：',
      '1. 保留原文格式、列表和代码块。',
      '2. 专有名词先按通用译法处理，不确定时保留原文。',
      '3. 语气保持{{语气}}。',
      '',
      '原文：',
      '{{原文}}',
    ].join('\n'),
    tags: ['翻译', '写作'],
    favorite: true,
    source: 'builtin',
  },
  {
    title: '代码审查',
    description: '审查代码的正确性、可维护性、性能和安全风险',
    content: [
      '请以资深工程师的方式审查下面的代码。',
      '',
      '背景/目标：{{背景}}',
      '',
      '请按优先级输出：',
      '1. 可能导致错误或回归的问题。',
      '2. 安全、性能或边界条件风险。',
      '3. 可维护性改进建议。',
      '4. 建议补充的测试用例。',
      '',
      '代码：',
      '```',
      '{{代码}}',
      '```',
    ].join('\n'),
    tags: ['编程', '审查'],
    favorite: true,
    source: 'builtin',
  },
  {
    title: '学习导师',
    description: '用循序渐进的方式讲清一个概念，并带练习',
    content: [
      '请扮演一位耐心的学习导师，帮助我理解：{{概念}}。',
      '',
      '我的水平：{{当前水平}}',
      '',
      '请按这个结构回答：',
      '1. 一句话解释。',
      '2. 用生活类比解释。',
      '3. 关键概念拆解。',
      '4. 常见误区。',
      '5. 给我 3 道由浅入深的小练习，并附参考答案。',
    ].join('\n'),
    tags: ['学习', '解释'],
    favorite: true,
    source: 'builtin',
  },
  {
    title: '总结提炼',
    description: '把长文本压缩成可行动的重点和待办',
    content: [
      '请总结下面内容。',
      '',
      '输出格式：',
      '1. 3-5 条核心结论。',
      '2. 重要事实/数据。',
      '3. 可执行待办。',
      '4. 仍不确定或需要追问的信息。',
      '',
      '内容：',
      '{{内容}}',
    ].join('\n'),
    tags: ['效率', '总结'],
    favorite: false,
    source: 'builtin',
  },
  {
    title: '深度分析',
    description: '从背景、利弊、风险和方案多角度分析问题',
    content: [
      '请对下面问题做一次结构化深度分析。',
      '',
      '问题：{{问题}}',
      '',
      '请包含：',
      '1. 背景和关键约束。',
      '2. 主要利益相关方。',
      '3. 支持与反对观点。',
      '4. 潜在风险和反例。',
      '5. 2-3 个可选方案及取舍。',
      '6. 你的建议和判断依据。',
    ].join('\n'),
    tags: ['分析', '决策'],
    favorite: false,
    source: 'builtin',
  },
  {
    title: '头脑风暴',
    description: '围绕一个主题生成多方向创意，并筛选可执行方案',
    content: [
      '请围绕“{{主题}}”进行头脑风暴。',
      '',
      '要求：',
      '1. 先给出 12 个不同方向的点子。',
      '2. 每个点子用一句话说明价值。',
      '3. 按“新颖度/可行性/成本”简单打分。',
      '4. 最后推荐最值得尝试的 3 个方案。',
    ].join('\n'),
    tags: ['创意', '方案'],
    favorite: false,
    source: 'builtin',
  },
  {
    title: '角色',
    description: '生成可用于角色扮演或长期对话的角色设定',
    content: [
      '请帮我创建一个可用于 AI 角色扮演的角色卡。',
      '',
      '角色方向：{{角色方向}}',
      '互动风格：{{互动风格}}',
      '',
      '请输出：',
      '1. 角色名称。',
      '2. 身份背景。',
      '3. 性格特点和说话习惯。',
      '4. 知识边界和行为禁忌。',
      '5. 开场白。',
      '6. 可直接作为系统提示词使用的完整角色设定。',
    ].join('\n'),
    tags: ['角色', '创意'],
    favorite: false,
    source: 'builtin',
  },
  {
    title: '周报与汇报',
    description: '把零散工作记录整理成清晰的汇报材料',
    content: [
      '请把下面的工作记录整理成{{汇报类型}}。',
      '',
      '受众：{{受众}}',
      '',
      '要求：',
      '1. 突出成果和影响，而不是流水账。',
      '2. 问题和风险要客观具体。',
      '3. 下一步计划要可执行。',
      '4. 语气专业、简洁。',
      '',
      '工作记录：',
      '{{工作记录}}',
    ].join('\n'),
    tags: ['办公', '写作'],
    favorite: false,
    source: 'builtin',
  },
  {
    title: '方案对比',
    description: '比较多个选项并给出推荐决策',
    content: [
      '请帮我比较以下几个方案，并给出推荐。',
      '',
      '目标：{{目标}}',
      '候选方案：{{候选方案}}',
      '约束条件：{{约束条件}}',
      '',
      '请输出：',
      '1. 对比维度。',
      '2. 表格化比较。',
      '3. 每个方案的主要风险。',
      '4. 推荐方案和理由。',
      '5. 如果信息不足，需要我补充什么。',
    ].join('\n'),
    tags: ['决策', '分析'],
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

  addFromSource(item: PromptSourceItem, favorite = false): PromptItem | null {
    if (this.hasFingerprint(item.fingerprint)) return null;

    const now = Date.now();
    const prompt: PromptItem = {
      id: createId('prompt'),
      title: item.title,
      description: item.description,
      content: item.content,
      tags: item.tags,
      favorite,
      source: 'imported',
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      fingerprint: item.fingerprint,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
    };
    this.data.prompts.push(prompt);
    return { ...prompt };
  }

  hasFingerprint(fp: string): boolean {
    return this.data.prompts.some((p) => p.fingerprint === fp);
  }

  findByFingerprint(fp: string): PromptItem | undefined {
    return this.data.prompts.find((p) => p.fingerprint === fp);
  }

  seedBuiltins(): PromptItem[] {
    if ((this.data.builtinVersion ?? 0) >= BUILTIN_PROMPT_VERSION) return [];

    const now = Date.now();
    if (this.data.seededAt) {
      const upgraded = this.upgradeBuiltins(now);
      this.data.builtinVersion = BUILTIN_PROMPT_VERSION;
      return upgraded;
    }

    const builtins: PromptItem[] = BUILTIN_PROMPTS.map((p, i) => ({
      ...p,
      id: createId('prompt'),
      createdAt: now + i,
      updatedAt: now + i,
      usageCount: 0,
    }));

    this.data.prompts.push(...builtins);
    this.data.seededAt = now;
    this.data.builtinVersion = BUILTIN_PROMPT_VERSION;
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
    else if (filter === 'imported') result = result.filter((p) => p.source === 'imported');

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
      title: fields.title.trim() || '新提示词',
      description: fields.description.trim(),
      content: fields.content.trim(),
      tags: fields.tags.filter(Boolean),
      favorite: fields.favorite ?? false,
      source: 'user',
      fingerprint: computeFingerprint(fields.title, fields.content),
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
      sourceName: undefined,
      sourceUrl: undefined,
      fingerprint: computeFingerprint(`${original.title} (副本)`, original.content),
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

  private upgradeBuiltins(now: number): PromptItem[] {
    const upgraded: PromptItem[] = [];
    const existingBuiltins = new Map(
      this.data.prompts
        .filter((prompt) => prompt.source === 'builtin')
        .map((prompt) => [prompt.title, prompt]),
    );

    for (const [index, builtin] of BUILTIN_PROMPTS.entries()) {
      const alias = BUILTIN_TITLE_ALIASES.get(builtin.title);
      const existing = existingBuiltins.get(builtin.title) ?? (alias ? existingBuiltins.get(alias) : undefined);
      if (existing) {
        existing.title = builtin.title;
        existing.description = builtin.description;
        existing.content = builtin.content;
        existing.tags = [...builtin.tags];
        existing.favorite = existing.favorite || builtin.favorite;
        existing.updatedAt = now + index;
        upgraded.push({ ...existing });
      } else {
        const prompt: PromptItem = {
          ...builtin,
          id: createId('prompt'),
          createdAt: now + index,
          updatedAt: now + index,
          usageCount: 0,
        };
        this.data.prompts.push(prompt);
        upgraded.push({ ...prompt });
      }
    }

    return upgraded;
  }
}

function clonePromptData(data: PromptData): PromptData {
  return {
    prompts: data.prompts.map((p) => ({ ...p })),
    seededAt: data.seededAt,
    builtinVersion: data.builtinVersion,
  };
}

export function computeFingerprint(title: string, content: string): string {
  const t = title.trim().toLowerCase().replace(/\s+/g, ' ');
  const c = content.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${t}::${c}`;
}

const RISK_KEYWORDS = [
  'jailbreak', '越狱', 'dan ', 'nsfw', '露骨', '色情',
  '违法', 'illegal', 'hack', 'exploit', '暴力',
];

export function isRiskPrompt(item: { title: string; description: string; content: string; tags: string[] }): boolean {
  const combined = `${item.title} ${item.description} ${item.content} ${item.tags.join(' ')}`.toLowerCase();
  return RISK_KEYWORDS.some((kw) => combined.includes(kw));
}
