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

    const root = store.createFolder('Work');
    const child = store.createFolder('Client', root.id);

    expect(store.foldersByParent(null).map((folder) => folder.name)).toEqual(['Work']);
    expect(store.foldersByParent(root.id).map((folder) => folder.name)).toEqual(['Client']);
    expect(child.parentId).toBe(root.id);
  });

  it('keeps a conversation in one folder when moved', () => {
    const store = new FolderStore();
    const first = store.createFolder('A');
    const second = store.createFolder('B');

    store.addConversation(first.id, conversation('abc', 'Old folder'));
    store.addConversation(second.id, conversation('abc', 'New folder'));

    expect(store.conversations(first.id)).toHaveLength(0);
    expect(store.conversations(second.id)).toMatchObject([
      { conversationId: 'abc', title: 'New folder' },
    ]);
  });

  it('deletes child folders and contents with the parent folder', () => {
    const store = new FolderStore();
    const root = store.createFolder('Root');
    const child = store.createFolder('Child', root.id);
    store.addConversation(child.id, conversation('abc'));

    store.deleteFolder(root.id);

    expect(store.snapshot()).toEqual({
      folders: [],
      folderContents: {},
      settings: { hideEnabled: true },
    });
  });

  it('does not mutate constructor input', () => {
    const data: FolderData = { folders: [], folderContents: {} };
    const store = new FolderStore(data);

    store.createFolder('Standalone');

    expect(data.folders).toEqual([]);
  });

  it('limits nesting to two levels', () => {
    vi.spyOn(Date, 'now').mockReturnValue(100);
    const store = new FolderStore();
    const root = store.createFolder('Root');
    const child = store.createFolder('Child', root.id);

    expect(() => store.createFolder('Too deep', child.id)).toThrow();
  });

  it('lists conversation ids already placed in folders', () => {
    const store = new FolderStore();
    const first = store.createFolder('A');
    const second = store.createFolder('B');

    store.addConversation(first.id, conversation('abc'));
    store.addConversation(second.id, conversation('def'));

    expect(Array.from(store.conversationIdsInFolders()).sort()).toEqual(['abc', 'def']);
  });

  it('persists folder settings in snapshots', () => {
    const store = new FolderStore();

    store.setSettings({ hideEnabled: false });

    expect(store.getSettings()).toEqual({ hideEnabled: false });
    expect(store.snapshot().settings).toEqual({ hideEnabled: false });
  });

  it('sorts pinned folders before unpinned folders within the same parent', () => {
    const store = new FolderStore();
    store.createFolder('First');
    const second = store.createFolder('Second');
    const parent = store.createFolder('Parent');
    store.createFolder('Child A', parent.id);
    const childB = store.createFolder('Child B', parent.id);

    store.togglePinned(second.id);
    store.togglePinned(childB.id);

    expect(store.foldersByParent(null).map((folder) => folder.name)).toEqual([
      'Second',
      'First',
      'Parent',
    ]);
    expect(store.foldersByParent(parent.id).map((folder) => folder.name)).toEqual([
      'Child B',
      'Child A',
    ]);
  });
});
