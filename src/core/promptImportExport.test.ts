import { describe, expect, it } from 'vitest';
import {
  createExportPayload,
  generateExportFilename,
  parseBetterDeepSeekJson,
  parseCsv,
  parseMarkdown,
} from './promptImportExport';

describe('promptImportExport', () => {
  describe('createExportPayload', () => {
    it('generates valid JSON', () => {
      const json = createExportPayload([]);
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe('better-deepseek.prompts.v1');
      expect(parsed.prompts).toEqual([]);
      expect(parsed.exportedAt).toBeGreaterThan(0);
    });
  });

  describe('generateExportFilename', () => {
    it('returns expected format', () => {
      const name = generateExportFilename();
      expect(name).toMatch(/^better-deepseek-prompts-\d{4}-\d{2}-\d{2}\.json$/);
    });
  });

  describe('parseBetterDeepSeekJson', () => {
    it('parses valid export JSON', () => {
      const json = JSON.stringify({
        version: 'better-deepseek.prompts.v1',
        exportedAt: 12345,
        prompts: [
          { id: '1', title: 'Test', description: 'D', content: 'C', tags: ['t'], source: 'user', usageCount: 0, createdAt: 1, updatedAt: 1, favorite: false },
        ],
      });

      const pack = parseBetterDeepSeekJson(json);
      expect(pack.items).toHaveLength(1);
      expect(pack.items[0].title).toBe('Test');
    });

    it('parses array format', () => {
      const json = JSON.stringify([
        { id: '1', title: 'A', content: 'B', tags: [], source: 'user', usageCount: 0, createdAt: 1, updatedAt: 1, description: '', favorite: false },
      ]);

      const pack = parseBetterDeepSeekJson(json);
      expect(pack.items).toHaveLength(1);
      expect(pack.items[0].content).toBe('B');
    });

    it('filters risky content', () => {
      const json = JSON.stringify({
        version: 'x',
        exportedAt: 0,
        prompts: [
          { id: '1', title: 'Jailbreak test', description: '', content: 'hack', tags: [], source: 'user', usageCount: 0, createdAt: 1, updatedAt: 1, favorite: false },
          { id: '2', title: 'Safe', description: '', content: 'safe', tags: [], source: 'user', usageCount: 0, createdAt: 1, updatedAt: 1, favorite: false },
        ],
      });

      const pack = parseBetterDeepSeekJson(json);
      expect(pack.items).toHaveLength(1);
      expect(pack.items[0].title).toBe('Safe');
    });

    it('throws on invalid JSON', () => {
      expect(() => parseBetterDeepSeekJson('{invalid}')).toThrow();
    });
  });

  describe('parseCsv', () => {
    it('parses simple CSV', () => {
      const csv = 'title,description,content,tags\na name,desc,body text,tag1;tag2';
      const pack = parseCsv(csv);
      expect(pack.items).toHaveLength(1);
      expect(pack.items[0].title).toBe('a name');
      expect(pack.items[0].content).toBe('body text');
      expect(pack.items[0].tags).toEqual(['tag1', 'tag2']);
    });

    it('throws on missing title column', () => {
      expect(() => parseCsv('x,y\n1,2')).toThrow();
    });

    it('filters risky content', () => {
      const csv = 'title,content\ndanger,jailbreak hack\nsafe,hello';
      const pack = parseCsv(csv);
      expect(pack.items).toHaveLength(1);
    });
  });

  describe('parseMarkdown', () => {
    it('parses markdown with sections', () => {
      const md = [
        '## My Prompt',
        'This is a description.',
        'tags: writing, ai',
        'This is the content.',
      ].join('\n');

      const pack = parseMarkdown(md);
      expect(pack.items.length).toBeGreaterThanOrEqual(1);
      expect(pack.items[0].title).toBe('My Prompt');
      expect(pack.items[0].tags).toContain('writing');
    });

    it('filters risky markdown', () => {
      const md = '## Safe\nsafe content\n## Bad\njailbreak hack';
      const pack = parseMarkdown(md);
      expect(pack.items.find((i) => i.title === 'Bad')).toBeUndefined();
      expect(pack.items.find((i) => i.title === 'Safe')).toBeDefined();
    });
  });
});
