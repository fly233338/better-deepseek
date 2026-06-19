import { describe, expect, it } from 'vitest';
import { PromptStore } from './promptStore';
import type { PromptData } from './promptTypes';

function emptyData(): PromptData {
  return { prompts: [] };
}

function storeWithData(data?: PromptData): PromptStore {
  return new PromptStore(data ?? emptyData());
}

describe('PromptStore', () => {
  describe('seed builtins', () => {
    it('seeds built-in prompts on first load', () => {
      const store = storeWithData();
      const builtins = store.seedBuiltins();

      expect(builtins.length).toEqual(5);
      expect(store.snapshot().seededAt).toBeGreaterThan(0);
    });

    it('does not seed twice', () => {
      const store = storeWithData();
      store.seedBuiltins();
      const second = store.seedBuiltins();

      expect(second).toEqual([]);
    });

    it('does not seed if data already has the current built-in version', () => {
      const store = storeWithData({ prompts: [], seededAt: 12345, builtinVersion: 3 });
      const result = store.seedBuiltins();

      expect(result).toEqual([]);
    });

    it('upgrades old built-in prompt data', () => {
      const store = storeWithData({
        seededAt: 12345,
        prompts: [
          {
            id: 'prompt-old',
            title: '写作润色',
            description: 'old',
            content: 'old',
            tags: ['old'],
            favorite: false,
            source: 'builtin',
            createdAt: 1,
            updatedAt: 1,
            usageCount: 3,
          },
        ],
      });

      const upgraded = store.seedBuiltins();
      const writing = store.prompts().find((prompt) => prompt.title === '写作润色');

      expect(upgraded.length).toBeGreaterThanOrEqual(5);
      expect(writing).toMatchObject({
        id: 'prompt-old',
        source: 'builtin',
        usageCount: 3,
      });
      expect(writing?.content).toContain('目标风格');
      expect(store.snapshot().builtinVersion).toBe(3);
    });

    it('built-in prompts have correct fields', () => {
      const store = storeWithData();
      const builtins = store.seedBuiltins();

      for (const prompt of builtins) {
        expect(prompt.id).toBeTruthy();
        expect(prompt.title).toBeTruthy();
        expect(prompt.content).toBeTruthy();
        expect(prompt.source).toBe('builtin');
        expect(prompt.usageCount).toBe(0);
      }
    });
  });

  describe('CRUD', () => {
    it('creates a prompt', () => {
      const store = storeWithData();
      const prompt = store.create({
        title: 'Test',
        description: 'A test prompt',
        content: 'Hello {{name}}',
        tags: ['test'],
      });

      expect(prompt.id).toBeTruthy();
      expect(prompt.title).toBe('Test');
      expect(prompt.source).toBe('user');
      expect(prompt.usageCount).toBe(0);

      const all = store.prompts();
      expect(all).toHaveLength(1);
    });

    it('updates a prompt', () => {
      const store = storeWithData();
      const created = store.create({ title: 'Old', description: '', content: '', tags: [] });

      const updated = store.update(created.id, {
        title: 'New',
        description: 'Updated',
        favorite: true,
        tags: ['a', 'b'],
      });

      expect(updated?.title).toBe('New');
      expect(updated?.favorite).toBe(true);
      expect(updated?.tags).toEqual(['a', 'b']);
    });

    it('deletes a prompt', () => {
      const store = storeWithData();
      const created = store.create({ title: 'X', description: '', content: '', tags: [] });

      expect(store.delete(created.id)).toBe(true);
      expect(store.prompts()).toHaveLength(0);
    });

    it('returns false for delete of unknown id', () => {
      const store = storeWithData();
      expect(store.delete('nonexistent')).toBe(false);
    });

    it('duplicates a prompt', () => {
      const store = storeWithData();
      const created = store.create({ title: 'Original', description: '', content: 'Test', tags: ['t'] });

      const duplicate = store.duplicate(created.id);
      expect(duplicate).not.toBeNull();
      expect(duplicate!.id).not.toBe(created.id);
      expect(duplicate!.title).toBe('Original (副本)');
      expect(duplicate!.content).toBe('Test');
      expect(duplicate!.source).toBe('user');
      expect(duplicate!.usageCount).toBe(0);
    });

    it('returns null for duplicate of unknown id', () => {
      const store = storeWithData();
      expect(store.duplicate('nope')).toBeNull();
    });
  });

  describe('favorite', () => {
    it('toggles favorite', () => {
      const store = storeWithData();
      const created = store.create({ title: 'Fav', description: '', content: '', tags: [] });

      const toggled = store.toggleFavorite(created.id);
      expect(toggled?.favorite).toBe(true);

      const toggledAgain = store.toggleFavorite(created.id);
      expect(toggledAgain?.favorite).toBe(false);
    });
  });

  describe('search and filter', () => {
    it('filters by title search', () => {
      const store = storeWithData();
      store.create({ title: 'Hello World', description: '', content: 'Nothing', tags: [] });
      store.create({ title: 'Goodbye', description: 'hello there', content: 'more', tags: [] });
      store.create({ title: 'Another', description: '', content: 'hello content', tags: [] });

      const results = store.filteredPrompts('all', 'hello');
      expect(results).toHaveLength(3);
    });

    it('filters by favorites', () => {
      const store = storeWithData();
      store.create({ title: 'A', description: '', content: '', tags: [] });
      const b = store.create({ title: 'B', description: '', content: '', tags: [] });
      store.toggleFavorite(b.id);

      const results = store.filteredPrompts('favorites', '');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('B');
    });

    it('filters by tag', () => {
      const store = storeWithData();
      store.create({ title: 'A', description: '', content: '', tags: ['javascript'] });
      store.create({ title: 'B', description: '', content: '', tags: ['python'] });

      const results = store.filteredPrompts('all', '', 'javascript');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('A');
    });
  });

  describe('usage tracking', () => {
    it('records usage', () => {
      const store = storeWithData();
      const created = store.create({ title: 'U', description: '', content: '', tags: [] });

      store.recordUsage(created.id);
      store.recordUsage(created.id);

      const updated = store.get(created.id);
      expect(updated?.usageCount).toBe(2);
      expect(updated?.lastUsedAt).toBeGreaterThan(0);
    });
  });

  describe('allTags', () => {
    it('returns unique sorted tags', () => {
      const store = storeWithData();
      store.create({ title: 'A', description: '', content: '', tags: ['b', 'a'] });
      store.create({ title: 'B', description: '', content: '', tags: ['c', 'a'] });

      expect(store.allTags()).toEqual(['a', 'b', 'c']);
    });
  });
});
