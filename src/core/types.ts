export type FolderId = string;
export type ConversationId = string;

export interface Folder {
  id: FolderId;
  name: string;
  parentId: FolderId | null;
  isExpanded: boolean;
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
  sortIndex: number;
}

export interface ConversationReference {
  conversationId: ConversationId;
  title: string;
  url: string;
  addedAt: number;
  updatedAt: number;
  sortIndex: number;
}

export interface FolderSettings {
  hideEnabled: boolean;
}

export interface FolderData {
  folders: Folder[];
  folderContents: Record<FolderId, ConversationReference[]>;
  settings?: FolderSettings;
}

export interface ConversationDragPayload {
  type: 'conversation';
  conversation: ConversationReference;
  sourceFolderId?: FolderId;
}

export interface FolderDragPayload {
  type: 'folder';
  folderId: FolderId;
}

export type DragPayload = ConversationDragPayload | FolderDragPayload;
