export function findComposerInput(): HTMLTextAreaElement | HTMLElement | null {
  const root = document.getElementById('root');
  if (!root) return null;

  const textareas = root.querySelectorAll<HTMLTextAreaElement>('textarea');
  for (const ta of textareas) {
    const rect = ta.getBoundingClientRect();
    if (rect.bottom > window.innerHeight * 0.4 && rect.width > 200) {
      return ta;
    }
  }

  for (const el of root.querySelectorAll<HTMLElement>('[contenteditable="true"]')) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom > window.innerHeight * 0.4 && rect.width > 200) {
      return el;
    }
  }

  return null;
}

export function fillComposerText(
  input: HTMLTextAreaElement | HTMLElement | null,
  text: string,
): boolean {
  if (!input) return false;

  if (input instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    if (setter) {
      setter.call(input, text);
    } else {
      input.value = text;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if ((input as HTMLElement).contentEditable === 'true') {
    (input as HTMLElement).textContent = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  return false;
}
