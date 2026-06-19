import { describe, expect, it } from 'vitest';
import { computeFingerprint, isRiskPrompt, PromptStore } from './promptStore';
import type { PromptSourceItem } from './promptTypes';

function emptyStore(): PromptStore {
  return new PromptStore({ prompts: [] });
}

describe('PromptStore fingerprint', () => {
  it('computeFingerprint normalizes whitespace and lowercases', () => {
    const a = computeFingerprint('Hello World', 'Some Content');
    const b = computeFingerprint('hello world', 'some content');
    const c = computeFingerprint('  hello  world ', '\nsome content\n');

    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('different content produces different fingerprints', () => {
    const a = computeFingerprint('TitleA', 'ContentA');
    const b = computeFingerprint('TitleB', 'ContentB');
    expect(a).not.toBe(b);
  });
});

describe('PromptStore risk filter', () => {
  it('flags jailbreak keywords', () => {
    expect(isRiskPrompt({ title: 'Jailbreak prompt', description: '', content: '', tags: [] })).toBe(true);
  });

  it('flags nsfw keywords', () => {
    expect(isRiskPrompt({ title: 'My prompt', description: 'nsfw content', content: '', tags: [] })).toBe(true);
  });

  it('passes safe content', () => {
    expect(isRiskPrompt({ title: 'Code Review', description: 'Review code', content: 'Check the code', tags: ['code'] })).toBe(false);
  });
});

describe('PromptStore source import', () => {
  it('addFromSource creates prompt with imported source', () => {
    const store = emptyStore();
    const item: PromptSourceItem = {
      title: 'Imported',
      description: 'desc',
      content: 'Hello',
      tags: ['a'],
      fingerprint: 'abc123',
      sourceName: 'GitHub',
    };

    const result = store.addFromSource(item);
    expect(result).not.toBeNull();
    expect(result!.source).toBe('imported');
    expect(result!.sourceName).toBe('GitHub');
    expect(result!.fingerprint).toBe('abc123');
  });

  it('addFromSource skips duplicates by fingerprint', () => {
    const store = emptyStore();
    const item: PromptSourceItem = {
      title: 'Dup', description: '', content: 'Hello', tags: [],
      fingerprint: 'dup123', sourceName: 'X',
    };

    store.addFromSource(item);
    const dup = store.addFromSource(item);
    expect(dup).toBeNull();
  });

  it('hasFingerprint works correctly', () => {
    const store = emptyStore();
    store.addFromSource({
      title: 'X', description: '', content: '', tags: [],
      fingerprint: 'fp', sourceName: 'X',
    });
    expect(store.hasFingerprint('fp')).toBe(true);
    expect(store.hasFingerprint('nonexistent')).toBe(false);
  });

  it('addFromSource with favorite', () => {
    const store = emptyStore();
    const result = store.addFromSource({
      title: 'Fav', description: '', content: '', tags: [],
      fingerprint: 'fav1', sourceName: 'X',
    }, true);
    expect(result!.favorite).toBe(true);
  });
});

describe('PromptItem.create computes fingerprint', () => {
  it('create adds fingerprint', () => {
    const store = emptyStore();
    const prompt = store.create({ title: 'T', description: '', content: 'C', tags: [] });
    expect(prompt.fingerprint).toBe(computeFingerprint('T', 'C'));
  });
});
