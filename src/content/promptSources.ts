import type { PromptSourceItem, PromptSourcePack } from '../core/promptTypes';
import { computeFingerprint, isRiskPrompt } from '../core/promptStore';

type SourceId = 'deepseek-official' | 'github-deepseek';

interface SourceDef {
  id: SourceId;
  name: string;
  url: string;
}

const SOURCES: SourceDef[] = [
  {
    id: 'deepseek-official',
    name: 'DeepSeek 官方精选',
    url: 'https://api-docs.deepseek.com/prompt-library',
  },
  {
    id: 'github-deepseek',
    name: 'GitHub DeepSeek Prompts 精选',
    url: 'https://raw.githubusercontent.com/langgptai/awesome-deepseek-prompts/main/README.md',
  },
];

const SNAPSHOT: Record<SourceId, PromptSourceItem[]> = {
  'deepseek-official': [
    {
      title: '代码生成',
      description: '根据需求描述生成代码实现',
      content: '请用 {{语言}} 编写一个函数，实现以下功能：\n\n{{需求描述}}\n\n要求：\n- 包含适当的错误处理\n- 添加类型注解\n- 代码清晰可读',
      tags: ['编程', '生成'],
      fingerprint: 'deepseek:code-gen:v1',
      sourceName: 'DeepSeek 官方精选',
      sourceUrl: 'https://api-docs.deepseek.com/prompt-library',
    },
    {
      title: '文本摘要',
      description: '将长文本压缩为简洁摘要',
      content: '请为以下内容生成摘要，控制在 {{字数}} 字以内：\n\n{{文本}}',
      tags: ['总结', '效率'],
      fingerprint: 'deepseek:summary:v1',
      sourceName: 'DeepSeek 官方精选',
      sourceUrl: 'https://api-docs.deepseek.com/prompt-library',
    },
    {
      title: 'SQL 生成',
      description: '将自然语言转换为 SQL 查询',
      content: '请将以下需求转换为 {{数据库类型}} 的 SQL 语句：\n\n{{需求}}\n\n表结构：\n{{表结构}}',
      tags: ['编程', 'SQL'],
      fingerprint: 'deepseek:sql:v1',
      sourceName: 'DeepSeek 官方精选',
      sourceUrl: 'https://api-docs.deepseek.com/prompt-library',
    },
  ],
  'github-deepseek': [
    {
      title: '系统提示词 — 编程助手',
      description: '适用于 DeepSeek 的编程助手系统提示词',
      content: '你是一个专业的 {{语言/领域}} 开发者。请遵循以下准则：\n\n1. 代码优先：尽量输出可直接运行的完整代码\n2. 解释在后：代码后附上关键逻辑的说明\n3. 遵循 {{语言/领域}} 最佳实践\n\n用户需求：{{需求}}',
      tags: ['编程', '角色'],
      fingerprint: 'github:code-assist:v1',
      sourceName: 'GitHub DeepSeek Prompts 精选',
      sourceUrl: 'https://github.com/langgptai/awesome-deepseek-prompts',
    },
    {
      title: '逐步推理',
      description: '使用思维链进行复杂推理',
      content: '请一步一步地思考以下问题，展示你的推理过程：\n\n{{问题}}\n\n请按照以下格式输出：\n1. 问题分析\n2. 已知条件\n3. 推理步骤\n4. 最终答案',
      tags: ['推理', '思考'],
      fingerprint: 'github:cot:v1',
      sourceName: 'GitHub DeepSeek Prompts 精选',
      sourceUrl: 'https://github.com/langgptai/awesome-deepseek-prompts',
    },
    {
      title: '写作风格模仿',
      description: '模仿指定风格的写作',
      content: '请用 {{风格}} 的风格写一段关于 {{主题}} 的文字，字数约 {{字数}}。参考以下风格特征：\n\n{{风格特征}}',
      tags: ['写作', '创意'],
      fingerprint: 'github:style-mimic:v1',
      sourceName: 'GitHub DeepSeek Prompts 精选',
      sourceUrl: 'https://github.com/langgptai/awesome-deepseek-prompts',
    },
  ],
};

export interface SourceEntry {
  id: SourceId;
  name: string;
  items: PromptSourceItem[];
}

export function getSourceList(): SourceDef[] {
  return [...SOURCES];
}

export async function loadSource(sourceId: SourceId): Promise<PromptSourcePack> {
  const def = SOURCES.find((s) => s.id === sourceId);
  if (!def) throw new Error('未知来源');

  try {
    const resp = await fetch(def.url, { signal: AbortSignal.timeout(8000) });
    if (resp.ok) {
      const text = await resp.text();
      const parsed = parseRemoteSource(def, text);
      if (parsed.items.length > 0) return parsed;
    }
  } catch {
    console.warn(`[BetterDeepSeek] 来源刷新失败，使用本地快照: ${def.name}`);
  }

  return loadSnapshot(sourceId);
}

function loadSnapshot(sourceId: SourceId): PromptSourcePack {
  const items = SNAPSHOT[sourceId] ?? [];
  return {
    name: SOURCES.find((s) => s.id === sourceId)?.name ?? '未知来源',
    items: items.filter((item) => !isRiskPrompt(item)),
  };
}

function parseRemoteSource(def: SourceDef, text: string): PromptSourcePack {
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) {
      return { name: def.name, items: json.filter((item) => !isRiskPrompt(item)) };
    }
  } catch {
    // not JSON, try parsing as markdown
  }

  const prompts = extractMarkdownPrompts(text, def.name);
  return {
    name: def.name,
    items: prompts.filter((item) => !isRiskPrompt(item)),
  };
}

function extractMarkdownPrompts(text: string, sourceName: string): PromptSourceItem[] {
  const items: PromptSourceItem[] = [];
  const sections = text.split(/^#{2,3}\s+/m);

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const title = lines[0]?.trim();
    if (!title) continue;

    let content = '';
    let description = '';
    const tags: string[] = [];

    for (const line of lines.slice(1)) {
      const tagMatch = line.match(/^[-*]\s*(?:标签|tags?|category|领域)\s*[:：]\s*(.+)/i);
      if (tagMatch) {
        tags.push(...tagMatch[1].split(/[,;]/).map((t) => t.trim()).filter(Boolean));
        continue;
      }
      content += line + '\n';
      if (description.length < 80) description += line + ' ';
    }

    const trimmedDesc = description.trim().slice(0, 200);
    const trimmedContent = content.trim();

    if (trimmedContent.length < 10) continue;

    const item: PromptSourceItem = {
      title,
      description: trimmedDesc,
      content: trimmedContent,
      tags,
      fingerprint: computeFingerprint(title, trimmedContent),
      sourceName,
    };

    if (!isRiskPrompt(item)) items.push(item);
  }

  return items;
}
