export type FolderId = string;
export type ConversationId = string;

export interface Folder {
  id: FolderId;
  name: string;
  parentId: FolderId | null;
  isExpanded: boolean;
  pinned?: boolean;
  color?: string;
  createdAt: number;
  updatedAt: number;
  sortIndex: number;
}

export interface ConversationReference {
  conversationId: ConversationId;
  title: string;
  url: string;
  pinned?: boolean;
  addedAt: number;
  updatedAt: number;
  sortIndex: number;
}

export interface FolderFeatureSettings {
  pinFolders: boolean;
  folderColors: boolean;
  folderSearch: boolean;
  folderExport: boolean;
  folderImport: boolean;
  conversationReorder: boolean;
  folderReorder: boolean;
  multiSelect: boolean;
}

export interface FolderSettings {
  hideEnabled: boolean;
  foldersExpanded?: boolean;
  chatsExpanded?: boolean;
  pinnedExpanded?: boolean;
  features?: FolderFeatureSettings;
}

export interface FolderData {
  folders: Folder[];
  folderContents: Record<FolderId, ConversationReference[]>;
  pinnedConversations?: ConversationReference[];
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
