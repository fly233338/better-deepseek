import { createId } from './id';
import type { ConversationReference, Folder, FolderData, FolderId, FolderSettings } from './types';

const MAX_DEPTH = 1;
const DEFAULT_SETTINGS: FolderSettings = { hideEnabled: true };

export class FolderStore {
  private data: FolderData;

  constructor(data?: FolderData) {
    this.data = data ? cloneData(data) : { folders: [], folderContents: {}, settings: DEFAULT_SETTINGS };
  }

  snapshot(): FolderData {
    return cloneData(this.data);
  }

  createFolder(name: string, parentId: FolderId | null = null): Folder {
    const safeName = name.trim() || '新文件夹';
    if (parentId && this.getDepth(parentId) >= MAX_DEPTH) {
      throw new Error('最多支持两级文件夹');
    }

    const now = Date.now();
    const siblingCount = this.data.folders.filter((folder) => folder.parentId === parentId).length;
    const folder: Folder = {
      id: createId('folder'),
      name: safeName,
      parentId,
      isExpanded: true,
      createdAt: now,
      updatedAt: now,
      sortIndex: siblingCount,
    };

    this.data.folders.push(folder);
    this.data.folderContents[folder.id] = [];
    return { ...folder };
  }

  renameFolder(folderId: FolderId, name: string): void {
    const folder = this.requireFolder(folderId);
    folder.name = name.trim() || folder.name;
    folder.updatedAt = Date.now();
  }

  deleteFolder(folderId: FolderId): void {
    const idsToDelete = new Set<FolderId>([folderId]);
    for (const folder of this.data.folders) {
      if (folder.parentId === folderId) idsToDelete.add(folder.id);
    }

    this.data.folders = this.data.folders.filter((folder) => !idsToDelete.has(folder.id));
    for (const id of idsToDelete) {
      delete this.data.folderContents[id];
    }
  }

  toggleFolder(folderId: FolderId): void {
    const folder = this.requireFolder(folderId);
    folder.isExpanded = !folder.isExpanded;
    folder.updatedAt = Date.now();
  }

  togglePinned(folderId: FolderId): void {
    const folder = this.requireFolder(folderId);
    folder.pinned = !folder.pinned;
    folder.updatedAt = Date.now();
  }

  setFolderColor(folderId: FolderId, color: string | undefined): void {
    const folder = this.requireFolder(folderId);
    folder.color = color;
    folder.updatedAt = Date.now();
  }

  moveFolder(folderId: FolderId, parentId: FolderId | null): void {
    if (folderId === parentId) return;
    const folder = this.requireFolder(folderId);
    const sourceParentId = folder.parentId;
    if (parentId && this.getDepth(parentId) >= MAX_DEPTH) {
      throw new Error('最多支持两级文件夹');
    }
    if (this.data.folders.some((candidate) => candidate.parentId === folderId && parentId)) {
      throw new Error('带子文件夹的文件夹只能移动到根层级');
    }

    folder.parentId = parentId;
    folder.sortIndex = this.data.folders.filter(
      (candidate) => candidate.parentId === parentId && candidate.id !== folderId,
    ).length;
    folder.updatedAt = Date.now();
    this.reindexFolders(sourceParentId);
    this.reindexFolders(parentId);
  }

  moveFolderToPosition(
    folderId: FolderId,
    targetParentId: FolderId | null,
    targetFolderId: FolderId,
    placement: 'before' | 'after',
  ): void {
    if (folderId === targetFolderId || folderId === targetParentId) return;

    const folder = this.requireFolder(folderId);
    const target = this.requireFolder(targetFolderId);
    if (target.parentId !== targetParentId) {
      throw new Error('Target folder parent mismatch');
    }
    if (targetParentId && this.getDepth(targetParentId) >= MAX_DEPTH) {
      throw new Error('Max folder depth is two levels');
    }
    if (this.data.folders.some((candidate) => candidate.parentId === folderId && targetParentId)) {
      throw new Error('Folders with children can only move to the root level');
    }

    const sourceParentId = folder.parentId;
    folder.parentId = targetParentId;
    folder.updatedAt = Date.now();

    const siblings = this.sortedFoldersByParent(targetParentId).filter(
      (candidate) => candidate.id !== folderId,
    );
    const targetIndex = siblings.findIndex((candidate) => candidate.id === targetFolderId);
    const insertIndex =
      targetIndex === -1 ? siblings.length : targetIndex + (placement === 'after' ? 1 : 0);
    siblings.splice(insertIndex, 0, folder);
    siblings.forEach((candidate, index) => {
      candidate.sortIndex = index;
    });

    if (sourceParentId !== targetParentId) {
      this.reindexFolders(sourceParentId);
    }
  }

  addConversation(folderId: FolderId, conversation: ConversationReference): void {
    this.requireFolder(folderId);
    const now = Date.now();
    this.removeConversationEverywhere(conversation.conversationId);
    const contents = this.data.folderContents[folderId] ?? [];
    contents.push({
      ...conversation,
      addedAt: conversation.addedAt || now,
      updatedAt: now,
      sortIndex: contents.length,
    });
    this.data.folderContents[folderId] = contents;
  }

  moveConversation(
    sourceFolderId: FolderId | undefined,
    targetFolderId: FolderId,
    conversation: ConversationReference,
  ): void {
    if (sourceFolderId) {
      this.data.folderContents[sourceFolderId] = (
        this.data.folderContents[sourceFolderId] ?? []
      ).filter((item) => item.conversationId !== conversation.conversationId);
    }
    this.addConversation(targetFolderId, conversation);
  }

  moveConversationToPosition(
    sourceFolderId: FolderId | undefined,
    targetFolderId: FolderId,
    conversation: ConversationReference,
    targetConversationId: string,
    placement: 'before' | 'after',
  ): void {
    this.requireFolder(targetFolderId);

    if (sourceFolderId) {
      this.data.folderContents[sourceFolderId] = (
        this.data.folderContents[sourceFolderId] ?? []
      ).filter((item) => item.conversationId !== conversation.conversationId);
      this.reindexFolderContents(sourceFolderId);
    } else {
      this.removeConversationEverywhere(conversation.conversationId);
    }

    const contents = this.data.folderContents[targetFolderId] ?? [];
    const targetIndex = contents.findIndex((item) => item.conversationId === targetConversationId);
    const insertIndex =
      targetIndex === -1 ? contents.length : targetIndex + (placement === 'after' ? 1 : 0);
    const now = Date.now();

    contents.splice(insertIndex, 0, {
      ...conversation,
      addedAt: conversation.addedAt || now,
      updatedAt: now,
      sortIndex: insertIndex,
    });
    this.data.folderContents[targetFolderId] = contents;
    this.reindexFolderContents(targetFolderId);
  }

  removeConversation(folderId: FolderId, conversationId: string): void {
    this.data.folderContents[folderId] = (this.data.folderContents[folderId] ?? []).filter(
      (item) => item.conversationId !== conversationId,
    );
    this.reindexFolderContents(folderId);
  }

  foldersByParent(parentId: FolderId | null): Folder[] {
    return this.sortedFoldersByParent(parentId).map((folder) => ({ ...folder }));
  }

  conversations(folderId: FolderId): ConversationReference[] {
    return [...(this.data.folderContents[folderId] ?? [])].sort(
      (a, b) => a.sortIndex - b.sortIndex || b.updatedAt - a.updatedAt,
    );
  }

  conversationIdsInFolders(): Set<string> {
    const ids = new Set<string>();

    for (const conversations of Object.values(this.data.folderContents)) {
      for (const conversation of conversations) {
        ids.add(conversation.conversationId);
      }
    }

    return ids;
  }

  getSettings(): FolderSettings {
    return { ...DEFAULT_SETTINGS, ...this.data.settings };
  }

  setSettings(settings: FolderSettings): void {
    this.data.settings = { ...settings };
  }

  private removeConversationEverywhere(conversationId: string): void {
    for (const folderId of Object.keys(this.data.folderContents)) {
      this.data.folderContents[folderId] = this.data.folderContents[folderId].filter(
        (item) => item.conversationId !== conversationId,
      );
      this.reindexFolderContents(folderId);
    }
  }

  private reindexFolderContents(folderId: FolderId): void {
    this.data.folderContents[folderId] = (this.data.folderContents[folderId] ?? []).map(
      (conversation, index) => ({
        ...conversation,
        sortIndex: index,
      }),
    );
  }

  private reindexFolders(parentId: FolderId | null): void {
    this.sortedFoldersByParent(parentId).forEach((folder, index) => {
      folder.sortIndex = index;
    });
  }

  private sortedFoldersByParent(parentId: FolderId | null): Folder[] {
    return this.data.folders
      .filter((folder) => folder.parentId === parentId)
      .sort((a, b) => {
        const pinnedOrder = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
        return pinnedOrder || a.sortIndex - b.sortIndex || a.createdAt - b.createdAt;
      });
  }

  private requireFolder(folderId: FolderId): Folder {
    const folder = this.data.folders.find((item) => item.id === folderId);
    if (!folder) throw new Error(`Folder not found: ${folderId}`);
    return folder;
  }

  private getDepth(folderId: FolderId): number {
    let depth = 0;
    let current = this.data.folders.find((folder) => folder.id === folderId);

    while (current?.parentId) {
      depth += 1;
      current = this.data.folders.find((folder) => folder.id === current?.parentId);
    }

    return depth;
  }
}

function cloneData(data: FolderData): FolderData {
  return {
    folders: data.folders.map((folder) => ({ ...folder })),
    folderContents: Object.fromEntries(
      Object.entries(data.folderContents).map(([folderId, conversations]) => [
        folderId,
        conversations.map((conversation) => ({ ...conversation })),
      ]),
    ),
    settings: data.settings ? { ...data.settings } : { ...DEFAULT_SETTINGS },
  };
}
