import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectLocale, normalizeLocale, observeLocaleChanges, t } from './i18n';

afterEach(() => {
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('data-locale');
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('i18n locale detection', () => {
  it('maps Chinese and English languages to supported locales', () => {
    expect(normalizeLocale('zh-CN')).toBe('zh-CN');
    expect(normalizeLocale('zh-Hans')).toBe('zh-CN');
    expect(normalizeLocale('en-US')).toBe('en-US');
    expect(normalizeLocale('fr-FR')).toBe('en-US');
  });

  it('prefers DeepSeek document language signals', () => {
    document.documentElement.lang = 'zh-CN';
    expect(detectLocale()).toBe('zh-CN');

    document.documentElement.lang = 'fr-FR';
    expect(detectLocale()).toBe('en-US');
  });

  it('falls back to navigator language', () => {
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['zh-Hans-CN'],
    });
    expect(detectLocale()).toBe('zh-CN');
  });

  it('formats message parameters', () => {
    expect(t('en-US', 'selection.count', { count: 3 })).toBe('3 selected');
    expect(t('zh-CN', 'selection.count', { count: 3 })).toBe('已选 3');
  });

  it('observes document language changes', async () => {
    const listener = vi.fn();
    const stop = observeLocaleChanges(listener);

    document.documentElement.lang = 'zh-CN';
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(listener).toHaveBeenCalledWith('zh-CN');
    stop();
  });
});
