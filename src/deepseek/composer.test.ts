import { describe, expect, it, vi } from 'vitest';
import { fillComposerText } from './composer';

describe('fillComposerText', () => {
  it('fills textarea value and dispatches events', () => {
    const ta = document.createElement('textarea');
    ta.value = 'old';

    const inputSpy = vi.fn();
    const changeSpy = vi.fn();
    ta.addEventListener('input', inputSpy);
    ta.addEventListener('change', changeSpy);

    const ok = fillComposerText(ta, 'new text');
    expect(ok).toBe(true);
    expect(ta.value).toBe('new text');
    expect(inputSpy).toHaveBeenCalled();
    expect(changeSpy).toHaveBeenCalled();
  });

  it('fills contenteditable and dispatches events', () => {
    const div = document.createElement('div');
    div.contentEditable = 'true';
    div.textContent = 'old';

    const inputSpy = vi.fn();
    const changeSpy = vi.fn();
    div.addEventListener('input', inputSpy);
    div.addEventListener('change', changeSpy);

    const ok = fillComposerText(div, 'new text');
    expect(ok).toBe(true);
    expect(div.textContent).toBe('new text');
    expect(inputSpy).toHaveBeenCalled();
    expect(changeSpy).toHaveBeenCalled();
  });

  it('returns false for null element', () => {
    const ok = fillComposerText(null, 'text');
    expect(ok).toBe(false);
  });

  it('returns false for unsupported element', () => {
    const span = document.createElement('span');
    span.textContent = 'old';
    const ok = fillComposerText(span, 'text');
    expect(ok).toBe(false);
  });
});
