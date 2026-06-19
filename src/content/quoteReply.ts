import { findComposerInput } from '../deepseek/composer';
import { t, type AppLocale } from './i18n';
import { applyThemeClass, type ThemeMode } from './theme';

const FLOATING_BTN_CLASS = 'bd-quote-btn';
const QUOTE_BAR_CLASS = 'bd-quote-bar';
const QUOTE_ATTR = 'data-bd-quote';

let currentQuoteText = '';
let floatingBtn: HTMLButtonElement | null = null;
let quoteBar: HTMLElement | null = null;
let currentLocale: AppLocale = 'en-US';

function isInsideExtension(el: Node): boolean {
  let current: Node | null = el;
  while (current) {
    if (current instanceof HTMLElement) {
      if (
        current.closest('.bd-folder-root') ||
        current.closest('.bd-prompt-panel') ||
        current.closest('.bd-dialog-overlay') ||
        current.classList.contains(QUOTE_BAR_CLASS) ||
        current.classList.contains(FLOATING_BTN_CLASS)
      ) {
        return true;
      }
    }
    current = current.parentNode;
  }
  return false;
}

function isInChatArea(el: Node): boolean {
  const root = document.getElementById('root');
  if (!root) return false;
  let current: Node | null = el;
  while (current) {
    if (current === root) return true;
    current = current.parentNode;
  }
  return false;
}

function isInComposerArea(el: Node): boolean {
  const input = findComposerInput();
  if (!input) return false;
  return input.contains(el instanceof Node ? el : null);
}

function removeFloatingBtn(): void {
  floatingBtn?.remove();
  floatingBtn = null;
}

function removeQuoteBar(): void {
  quoteBar?.remove();
  quoteBar = null;
}

function clearQuote(): void {
  currentQuoteText = '';
  removeQuoteBar();
}

function injectQuoteToComposer(): boolean {
  if (!currentQuoteText) return false;

  const input = findComposerInput();
  if (!input || !(input instanceof HTMLTextAreaElement)) return false;

  const quote = currentQuoteText.trim();
  if (!quote) return false;

  const header = t(currentLocale, 'quote.header');
  const quoted = quote
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => `> ${l}`)
    .join('\n');
  const userText = input.value.trim();
  const final = userText
    ? `${header}\n---\n${quoted}\n---\n${userText}`
    : `${header}\n---\n${quoted}`;

  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  if (setter) {
    setter.call(input, final);
  } else {
    input.value = final;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));

  clearQuote();
  return true;
}

function getPreview(text: string): string {
  const lines = text.trim().split('\n').slice(0, 2);
  const preview = lines.join(' ') || text.trim().slice(0, 60);
  return preview ? `${preview}...` : '';
}

function createQuoteBar(locale: AppLocale, theme: ThemeMode, text: string): HTMLElement {
  removeQuoteBar();

  const bar = document.createElement('div');
  bar.className = QUOTE_BAR_CLASS;
  bar.setAttribute(QUOTE_ATTR, '');
  applyThemeClass(bar, theme);

  const icon = document.createElement('span');
  icon.className = 'bd-quote-bar-icon';
  icon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>';

  const preview = document.createElement('span');
  preview.className = 'bd-quote-bar-preview';
  preview.textContent = getPreview(text);

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'bd-quote-bar-dismiss';
  dismissBtn.type = 'button';
  dismissBtn.title = t(locale, 'quote.remove');
  dismissBtn.textContent = '×';
  dismissBtn.addEventListener('click', clearQuote);

  bar.append(icon, preview, dismissBtn);

  const input = findComposerInput();
  if (input) {
    input.parentElement?.insertBefore(bar, input);
  }

  quoteBar = bar;
  return bar;
}

function createFloatingBtn(locale: AppLocale, theme: ThemeMode, selection: Selection): void {
  removeFloatingBtn();

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (!rect.width && !rect.height) return;

  const btn = document.createElement('button');
  btn.className = FLOATING_BTN_CLASS;
  btn.type = 'button';
  applyThemeClass(btn, theme);

  const label = document.createElement('span');
  label.className = 'bd-quote-btn-label';
  label.textContent = t(locale, 'quote.action');

  const arrow = document.createElement('span');
  arrow.className = 'bd-quote-btn-arrow';
  arrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

  btn.append(label, arrow);

  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  btn.style.top = `${rect.bottom + scrollY + 4}px`;
  btn.style.left = `${Math.min(rect.left + scrollX, window.innerWidth - 160)}px`;

  btn.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  btn.addEventListener('click', () => {
    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    currentQuoteText = selectedText;
    createQuoteBar(locale, theme, selectedText);
    removeFloatingBtn();
  });

  document.body.append(btn);
  floatingBtn = btn;
}

function handleSelection(locale: AppLocale, theme: ThemeMode): void {
  removeFloatingBtn();

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return;

  const selectedText = selection.toString().trim();
  if (!selectedText || selectedText.length < 3) return;

  const container = selection.getRangeAt(0).commonAncestorContainer;
  if (!container) return;
  if (isInsideExtension(container)) return;
  if (isInComposerArea(container)) return;
  if (!isInChatArea(container)) return;

  createFloatingBtn(locale, theme, selection);
}

function handleClickOutside(event: MouseEvent): void {
  if (!floatingBtn) return;
  const target = event.target as Node;
  if (target && !floatingBtn.contains(target)) {
    removeFloatingBtn();
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey) return;
  if (!currentQuoteText) return;

  const input = findComposerInput();
  if (!input || !(input instanceof HTMLTextAreaElement)) return;
  if (document.activeElement !== input) return;

  injectQuoteToComposer();
}

export function mountQuoteReply(locale: AppLocale, theme: ThemeMode): void {
  currentLocale = locale;
  document.addEventListener('mouseup', () => {
    setTimeout(() => handleSelection(locale, theme), 10);
  });

  document.addEventListener('mousedown', handleClickOutside);
  document.addEventListener('keydown', handleKeydown, true);
}

export function updateQuoteReplyLocale(locale: AppLocale): void {
  currentLocale = locale;
  if (quoteBar) {
    const dismissBtn = quoteBar.querySelector('.bd-quote-bar-dismiss') as HTMLButtonElement | null;
    if (dismissBtn) dismissBtn.title = t(locale, 'quote.remove');
  }
  if (floatingBtn) {
    const label = floatingBtn.querySelector('.bd-quote-btn-label');
    if (label) label.textContent = t(locale, 'quote.action');
  }
}

export function updateQuoteReplyTheme(theme: ThemeMode): void {
  if (floatingBtn) applyThemeClass(floatingBtn, theme);
  if (quoteBar) applyThemeClass(quoteBar, theme);
}

export function unmountQuoteReply(): void {
  removeFloatingBtn();
  clearQuote();
}
