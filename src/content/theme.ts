import { findSidebar } from '../deepseek/adapter';

export type ThemeMode = 'light' | 'dark';

const LIGHT_CLASS = 'bd-theme-light';
const DARK_CLASS = 'bd-theme-dark';
const DARK_HINTS = new Set(['dark', 'night', 'black']);
const LIGHT_HINTS = new Set(['light', 'day', 'white']);
const THEME_ATTRS = ['data-theme', 'data-color-mode', 'data-mode', 'data-bs-theme', 'theme'];

export function detectThemeMode(doc: Document = document): ThemeMode {
  return detectExplicitTheme(doc)
    ?? detectThemeFromBackground(themeBackgroundCandidates(doc))
    ?? detectPreferredColorScheme(doc)
    ?? 'light';
}

export function detectExplicitTheme(doc: Document = document): ThemeMode | null {
  for (const element of [doc.documentElement, doc.body]) {
    if (!element) continue;

    const attrTheme = themeFromAttributes(element);
    if (attrTheme) return attrTheme;

    const classTheme = themeFromTokens(Array.from(element.classList));
    if (classTheme) return classTheme;

    const computedTheme = themeFromColorScheme(getComputedStyle(element).colorScheme);
    if (computedTheme) return computedTheme;
  }

  return null;
}

export function detectThemeFromBackground(elements: Array<Element | null | undefined>): ThemeMode | null {
  for (const element of elements) {
    if (!element) continue;
    const color = parseCssColor(getComputedStyle(element).backgroundColor);
    if (!color || color.a === 0) continue;
    return relativeLuminance(color) < 0.32 ? 'dark' : 'light';
  }

  return null;
}

export function applyThemeClass(element: Element | null | undefined, mode: ThemeMode): void {
  if (!element) return;
  element.classList.toggle(LIGHT_CLASS, mode === 'light');
  element.classList.toggle(DARK_CLASS, mode === 'dark');
}

export function observeThemeChanges(onChange: (mode: ThemeMode) => void): () => void {
  const emit = () => onChange(detectThemeMode());
  const observer = new MutationObserver(emit);
  const observerConfig: MutationObserverInit = {
    attributes: true,
    attributeFilter: ['class', 'style', ...THEME_ATTRS],
  };

  observer.observe(document.documentElement, observerConfig);
  if (document.body) observer.observe(document.body, observerConfig);
  const sidebar = findSidebar();
  if (sidebar) observer.observe(sidebar, observerConfig);

  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener?.('change', emit);

  return () => {
    observer.disconnect();
    media?.removeEventListener?.('change', emit);
  };
}

function themeBackgroundCandidates(doc: Document): Element[] {
  const candidates: Array<Element | null> = [
    findSidebar(),
    doc.querySelector('aside'),
    doc.querySelector('nav'),
    doc.body,
    doc.documentElement,
  ];
  return candidates.filter((element): element is Element => Boolean(element));
}

function themeFromAttributes(element: Element): ThemeMode | null {
  for (const attr of THEME_ATTRS) {
    const value = element.getAttribute(attr);
    if (!value) continue;
    const theme = themeFromTokens(tokenize(value));
    if (theme) return theme;
  }

  return null;
}

function themeFromTokens(tokens: string[]): ThemeMode | null {
  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (DARK_HINTS.has(normalized) || normalized.endsWith('-dark') || normalized.startsWith('dark-')) {
      return 'dark';
    }
    if (LIGHT_HINTS.has(normalized) || normalized.endsWith('-light') || normalized.startsWith('light-')) {
      return 'light';
    }
  }

  return null;
}

function themeFromColorScheme(value: string): ThemeMode | null {
  const tokens = tokenize(value);
  if (tokens[0] === 'dark') return 'dark';
  if (tokens[0] === 'light') return 'light';
  return null;
}

function detectPreferredColorScheme(doc: Document): ThemeMode | null {
  const media = doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  return media?.matches ? 'dark' : null;
}

function tokenize(value: string): string[] {
  return value.split(/[\s_]+/).map((part) => part.trim()).filter(Boolean);
}

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseCssColor(value: string): RgbaColor | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'transparent') return null;

  const rgb = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(',').map((part) => part.trim());
    const [r, g, b] = parts.slice(0, 3).map(Number);
    if ([r, g, b].some(Number.isNaN)) return null;
    const a = parts[3] === undefined ? 1 : Number(parts[3]);
    return { r, g, b, a: Number.isNaN(a) ? 1 : a };
  }

  const hex = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hex) return null;

  const raw = hex[1].length === 3
    ? hex[1].split('').map((part) => part + part).join('')
    : hex[1];
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
    a: 1,
  };
}

function relativeLuminance(color: RgbaColor): number {
  const [r, g, b] = [color.r, color.g, color.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
