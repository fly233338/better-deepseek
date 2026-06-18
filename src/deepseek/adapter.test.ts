import { describe, expect, it } from 'vitest';

import {
  conversationFromAnchor,
  extractConversationId,
  findConversationAnchors,
  findFolderInsertionTarget,
  findNativeConversationContainer,
  isDeepSeekChatUrl,
} from './adapter';

describe('deepseek adapter', () => {
  it('detects DeepSeek conversation urls', () => {
    expect(isDeepSeekChatUrl('https://chat.deepseek.com/chat/s/123')).toBe(true);
    expect(isDeepSeekChatUrl('https://chat.deepseek.com/')).toBe(false);
  });

  it('extracts conversation ids from absolute and relative urls', () => {
    expect(extractConversationId('https://chat.deepseek.com/chat/s/abc?x=1')).toBe('abc');
    expect(extractConversationId('/chat/s/def')).toBe('def');
  });

  it('builds a conversation reference from a sidebar anchor', () => {
    document.body.innerHTML = '<a href="https://chat.deepseek.com/chat/s/abc">Plan</a>';
    const anchor = document.querySelector('a');

    expect(conversationFromAnchor(anchor as HTMLAnchorElement)).toMatchObject({
      conversationId: 'abc',
      title: 'Plan',
      url: 'https://chat.deepseek.com/chat/s/abc',
    });
  });

  it('deduplicates repeated conversation anchors', () => {
    document.body.innerHTML = `
      <a href="https://chat.deepseek.com/chat/s/a">A</a>
      <a href="https://chat.deepseek.com/chat/s/a">A duplicate</a>
      <a href="https://chat.deepseek.com/chat/s/b">B</a>
    `;

    expect(findConversationAnchors().map((anchor) => anchor.textContent)).toEqual(['A', 'B']);
  });

  it('finds an insertion target before the native history section', () => {
    document.body.innerHTML = `
      <aside>
        <button>New chat</button>
        <section data-testid="history">
          <a href="https://chat.deepseek.com/chat/s/a">A</a>
          <a href="https://chat.deepseek.com/chat/s/b">B</a>
        </section>
      </aside>
    `;

    const target = findFolderInsertionTarget();

    expect(target?.sidebar.tagName).toBe('ASIDE');
    expect((target?.before as HTMLElement | null)?.getAttribute('data-testid')).toBe('history');
  });

  it('finds the native row container for a conversation anchor', () => {
    document.body.innerHTML = `
      <aside>
        <section>
          <div class="row" data-row="a"><a href="https://chat.deepseek.com/chat/s/a">A</a></div>
          <div class="row" data-row="b"><a href="https://chat.deepseek.com/chat/s/b">B</a></div>
        </section>
      </aside>
    `;

    const anchor = document.querySelector<HTMLAnchorElement>('a[href$="/a"]');
    const row = findNativeConversationContainer(anchor as HTMLAnchorElement);

    expect(row.getAttribute('data-row')).toBe('a');
  });
});
