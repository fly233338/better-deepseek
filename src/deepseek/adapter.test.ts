import { describe, expect, it } from 'vitest';

import {
  conversationFromAnchor,
  extractConversationId,
  findConversationAnchors,
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
    document.body.innerHTML = '<a href="https://chat.deepseek.com/chat/s/abc">  方案讨论  </a>';
    const anchor = document.querySelector('a');

    expect(conversationFromAnchor(anchor as HTMLAnchorElement)).toMatchObject({
      conversationId: 'abc',
      title: '方案讨论',
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
});
