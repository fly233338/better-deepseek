import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountTableToolbar } from './tableToolbar';

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

describe('table toolbar', () => {
  let cleanup: (() => void) | undefined;
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('copies the current table content instead of the initially scanned rows', async () => {
    const root = document.getElementById('root');
    if (!root) throw new Error('missing root');
    root.innerHTML = `
      <table>
        <tr><th>Name</th><th>Value</th></tr>
      </table>
    `;

    cleanup = mountTableToolbar('en-US', 'light');
    await nextFrame();

    const table = root.querySelector('table');
    if (!table) throw new Error('missing table');
    table.insertAdjacentHTML('beforeend', '<tr><td>Alpha</td><td>One</td></tr><tr><td>Beta</td><td>Two</td></tr>');

    const host = document.querySelector<HTMLElement>('.bd-table-widget');
    const copyMarkdown = host?.shadowRoot?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[0];
    copyMarkdown?.click();

    expect(writeText).toHaveBeenCalledWith([
      '| Name | Value |',
      '| --- | --- |',
      '| Alpha | One |',
      '| Beta | Two |',
    ].join('\n'));
  });
});
