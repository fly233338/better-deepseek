import { describe, expect, it, vi } from 'vitest';

import { FolderStore } from './folderStore';
import type { ConversationReference, FolderData } from './types';

function conversation(id: string, title = id): ConversationReference {
  return {
    conversationId: id,
    title,
    url: `https://chat.deepseek.com/chat/s/${id}`,
    addedAt: 1,
    updatedAt: 1,
    sortIndex: 0,
  };
}

describe('FolderStore', () => {
  it('creates root folders and subfolders', () => {
    const store = new FolderStore();

    const root = store.createFolder('工作');
    const child = store.createFolder('客户', root.id);

    expect(store.foldersByParent(null).map((folder) => folder.name)).toEqual(['工作']);
    expect(store.foldersByParent(root.id).map((folder) => folder.name)).toEqual(['客户']);
    expect(child.parentId).toBe(root.id);
  });

  it('keeps a conversation in one folder when moved', () => {
    const store = new FolderStore();
    const first = store.createFolder('A');
    const second = store.createFolder('B');

    store.addConversation(first.id, conversation('abc', '旧位置'));
    store.addConversation(second.id, conversation('abc', '新位置'));

    expect(store.conversations(first.id)).toHaveLength(0);
    expect(store.conversations(second.id)).toMatchObject([{ conversationId: 'abc', title: '新位置' }]);
  });

  it('deletes child folders and contents with the parent folder', () => {
    const store = new FolderStore();
    const root = store.createFolder('Root');
    const child = store.createFolder('Child', root.id);
    store.addConversation(child.id, conversation('abc'));

    store.deleteFolder(root.id);

    expect(store.snapshot()).toEqual({ folders: [], folderContents: {} });
  });

  it('does not mutate constructor input', () => {
    const data: FolderData = { folders: [], folderContents: {} };
    const store = new FolderStore(data);

    store.createFolder('独立');

    expect(data.folders).toEqual([]);
  });

  it('limits nesting to two levels', () => {
    vi.spyOn(Date, 'now').mockReturnValue(100);
    const store = new FolderStore();
    const root = store.createFolder('Root');
    const child = store.createFolder('Child', root.id);

    expect(() => store.createFolder('Too deep', child.id)).toThrow('最多支持两级文件夹');
  });
});
