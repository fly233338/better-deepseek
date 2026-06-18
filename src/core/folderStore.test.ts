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

  it('reorders folders within the same parent', () => {
    const store = new FolderStore();
    store.createFolder('First');
    const second = store.createFolder('Second');
    const third = store.createFolder('Third');

    store.moveFolderToPosition(third.id, null, second.id, 'before');

    expect(store.foldersByParent(null).map((folder) => folder.name)).toEqual([
      'First',
      'Third',
      'Second',
    ]);
    expect(store.foldersByParent(null).map((folder) => folder.sortIndex)).toEqual([0, 1, 2]);
  });

  it('moves folders between parents at a target position', () => {
    const store = new FolderStore();
    const parent = store.createFolder('Parent');
    const target = store.createFolder('Target');
    const childA = store.createFolder('Child A', parent.id);
    store.createFolder('Child B', parent.id);

    store.moveFolderToPosition(childA.id, null, target.id, 'after');

    expect(store.foldersByParent(parent.id).map((folder) => folder.name)).toEqual(['Child B']);
    expect(store.foldersByParent(parent.id).map((folder) => folder.sortIndex)).toEqual([0]);
    expect(store.foldersByParent(null).map((folder) => folder.name)).toEqual([
      'Parent',
      'Target',
      'Child A',
    ]);
    expect(store.foldersByParent(null).map((folder) => folder.sortIndex)).toEqual([0, 1, 2]);
  });

  it('stores folder colors', () => {
    const store = new FolderStore();
    const folder = store.createFolder('Colored');

    store.setFolderColor(folder.id, '#74a8ff');

    expect(store.snapshot().folders[0]).toMatchObject({
      id: folder.id,
      color: '#74a8ff',
    });
  });

  it('reorders conversations within a folder', () => {
    const store = new FolderStore();
    const folder = store.createFolder('Ordered');

    store.addConversation(folder.id, conversation('a'));
    store.addConversation(folder.id, conversation('b'));
    store.addConversation(folder.id, conversation('c'));

    store.moveConversationToPosition(
      folder.id,
      folder.id,
      conversation('c'),
      'a',
      'before',
    );

    expect(store.conversations(folder.id).map((item) => item.conversationId)).toEqual([
      'c',
      'a',
      'b',
    ]);
    expect(store.conversations(folder.id).map((item) => item.sortIndex)).toEqual([0, 1, 2]);
  });

  it('moves conversations between folders at a target position', () => {
    const store = new FolderStore();
    const source = store.createFolder('Source');
    const target = store.createFolder('Target');

    store.addConversation(source.id, conversation('a'));
    store.addConversation(source.id, conversation('b'));
    store.addConversation(target.id, conversation('x'));
    store.addConversation(target.id, conversation('y'));

    store.moveConversationToPosition(
      source.id,
      target.id,
      conversation('a'),
      'y',
      'after',
    );

    expect(store.conversations(source.id).map((item) => item.conversationId)).toEqual(['b']);
    expect(store.conversations(source.id).map((item) => item.sortIndex)).toEqual([0]);
    expect(store.conversations(target.id).map((item) => item.conversationId)).toEqual([
      'x',
      'y',
      'a',
    ]);
    expect(store.conversations(target.id).map((item) => item.sortIndex)).toEqual([0, 1, 2]);
  });
});
