import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyThemeClass, detectExplicitTheme, detectThemeFromBackground, detectThemeMode } from './theme';

afterEach(() => {
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
  document.body.className = '';
  document.body.removeAttribute('data-theme');
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('theme detection', () => {
  it('reads explicit dark and light theme hints', () => {
    document.documentElement.dataset.theme = 'dark';
    expect(detectExplicitTheme()).toBe('dark');

    document.documentElement.dataset.theme = 'light';
    expect(detectExplicitTheme()).toBe('light');

    document.documentElement.removeAttribute('data-theme');
    document.body.className = 'app-dark';
    expect(detectExplicitTheme()).toBe('dark');
  });

  it('detects theme from computed background brightness', () => {
    const dark = document.createElement('div');
    dark.style.backgroundColor = 'rgb(15, 23, 42)';
    const light = document.createElement('div');
    light.style.backgroundColor = 'rgb(255, 255, 255)';
    document.body.append(dark, light);

    expect(detectThemeFromBackground([dark])).toBe('dark');
    expect(detectThemeFromBackground([light])).toBe('light');
  });

  it('falls back to prefers-color-scheme', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    expect(detectThemeMode()).toBe('dark');
  });

  it('applies only the active Better DeepSeek theme class', () => {
    const element = document.createElement('div');
    applyThemeClass(element, 'dark');
    expect(element.classList.contains('bd-theme-dark')).toBe(true);
    expect(element.classList.contains('bd-theme-light')).toBe(false);

    applyThemeClass(element, 'light');
    expect(element.classList.contains('bd-theme-light')).toBe(true);
    expect(element.classList.contains('bd-theme-dark')).toBe(false);
  });
});
