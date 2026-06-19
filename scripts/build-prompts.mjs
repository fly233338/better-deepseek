import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function computeFingerprint(title, content) {
  const t = title.trim().toLowerCase().replace(/\s+/g, ' ');
  const c = content.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${t}::${c}`;
}

function parseAwesomeMd(content) {
  const prompts = [];
  const sections = content.split(/^##\s+/m).filter(Boolean);

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const category = lines[0]?.trim();
    if (!category) continue;

    const body = lines.slice(1).join('\n');
    const blocks = body.split(/^###\s+/m).filter(Boolean);

    for (const block of blocks) {
      const blockLines = block.trim().split('\n');
      const title = blockLines[0]?.trim();
      if (!title) continue;

      let description = '';
      let content = '';
      let inCode = false;
      let inTagLine = false;
      const tags = [];

      for (const line of blockLines.slice(1)) {
        const trimmed = line.trim();

        if (inTagLine) {
          const tagText = trimmed.replace(/^tags?\s*[:：]\s*/gi, '').trim();
          if (tagText) tags.push(...tagText.split(/[;；,，]/).map((t) => t.trim().replace(/[*-]/g, '').trim()).filter(Boolean));
          inTagLine = false;
          continue;
        }

        if (/^tags?\s*[:：]/i.test(trimmed)) {
          inTagLine = true;
          const tagText = trimmed.replace(/^tags?\s*[:：]\s*/gi, '').trim();
          if (tagText) tags.push(...tagText.split(/[;；,，]/).map((t) => t.trim().replace(/[*-]/g, '').trim()).filter(Boolean));
          continue;
        }

        if (/^```text/i.test(trimmed)) { inCode = true; continue; }
        if (trimmed === '```' && inCode) { inCode = false; continue; }

        if (trimmed === '---') continue;

        if (inCode) {
          content += (content ? '\n' : '') + trimmed;
        } else if (trimmed && !/^tags?\s*[:：]/i.test(trimmed)) {
          if (!description) description = trimmed;
        }
      }

      const fingerprint = computeFingerprint(title, content);

      prompts.push({
        title,
        description: description || title,
        content,
        tags: tags.length > 0 ? tags : [category],
        category,
        version: 1,
        updatedAt: new Date().toISOString().slice(0, 10),
        fingerprint,
      });
    }
  }

  return prompts;
}

export function build() {
  const mdPath = join(root, 'docs', 'prompts', 'awesome-deepseek-prompts.md');
  const jsonPath = join(root, 'data', 'prompts', 'index.json');

  const md = readFileSync(mdPath, 'utf-8');
  const prompts = parseAwesomeMd(md);

  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(prompts, null, 2) + '\n', 'utf-8');

  console.log(`Generated ${jsonPath} with ${prompts.length} prompts`);
}

// Run directly
build();
