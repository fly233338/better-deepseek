import type { FolderData } from './types';

export const FOLDER_EXPORT_FORMAT = 'better-deepseek.folders.v1';
export const FOLDER_IMPORT_BACKUP_KEY = 'betterDeepSeek.folderImportBackup.v1';

export interface FolderExportPayload {
  format: typeof FOLDER_EXPORT_FORMAT;
  exportedAt: string;
  data: FolderData;
}

export interface FolderImportStats {
  foldersImported: number;
  conversationsImported: number;
  duplicateFoldersSkipped: number;
  duplicateConversationsSkipped: number;
}

export function createFolderExportPayload(data: FolderData, exportedAt = new Date().toISOString()): FolderExportPayload {
  return {
    format: FOLDER_EXPORT_FORMAT,
    exportedAt,
    data,
  };
}

export function generateFolderExportFilename(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const date = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('');
  const time = [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('');

  return `better-deepseek-folders-${date}-${time}.json`;
}

export function downloadJson(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function readJsonFile(file: File): Promise<unknown> {
  return JSON.parse(await file.text()) as unknown;
}

export function isFolderExportPayload(value: unknown): value is FolderExportPayload {
  if (!value || typeof value !== 'object') return false;

  const payload = value as Partial<FolderExportPayload>;
  return (
    payload.format === FOLDER_EXPORT_FORMAT &&
    typeof payload.exportedAt === 'string' &&
    isFolderData(payload.data)
  );
}

export function mergeFolderImport(
  current: FolderData,
  payload: FolderExportPayload,
): { data: FolderData; stats: FolderImportStats } {
  const currentFolderIds = new Set(current.folders.map((folder) => folder.id));
  const importedFolders = [];
  let duplicateFoldersSkipped = 0;

  for (const folder of payload.data.folders) {
    if (currentFolderIds.has(folder.id)) {
      duplicateFoldersSkipped += 1;
    } else {
      importedFolders.push({ ...folder });
    }
  }

  const folderContents = cloneFolderContents(current.folderContents);
  let conversationsImported = 0;
  let duplicateConversationsSkipped = 0;

  for (const [folderId, conversations] of Object.entries(payload.data.folderContents)) {
    const target = folderContents[folderId] ?? [];
    const existingConversationIds = new Set(target.map((conversation) => conversation.conversationId));

    for (const conversation of conversations) {
      if (existingConversationIds.has(conversation.conversationId)) {
        duplicateConversationsSkipped += 1;
      } else {
        target.push({ ...conversation });
        existingConversationIds.add(conversation.conversationId);
        conversationsImported += 1;
      }
    }

    folderContents[folderId] = target;
  }

  return {
    data: {
      folders: [...current.folders.map((folder) => ({ ...folder })), ...importedFolders],
      folderContents,
      settings: current.settings ? { ...current.settings } : payload.data.settings,
    },
    stats: {
      foldersImported: importedFolders.length,
      conversationsImported,
      duplicateFoldersSkipped,
      duplicateConversationsSkipped,
    },
  };
}

export function saveImportBackup(data: FolderData): void {
  sessionStorage.setItem(FOLDER_IMPORT_BACKUP_KEY, JSON.stringify(data));
}

export function loadImportBackup(): FolderData | null {
  const raw = sessionStorage.getItem(FOLDER_IMPORT_BACKUP_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isFolderData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isFolderData(value: unknown): value is FolderData {
  if (!value || typeof value !== 'object') return false;

  const data = value as Partial<FolderData>;
  return Array.isArray(data.folders) && Boolean(data.folderContents) && typeof data.folderContents === 'object';
}

function cloneFolderContents(folderContents: FolderData['folderContents']): FolderData['folderContents'] {
  return Object.fromEntries(
    Object.entries(folderContents).map(([folderId, conversations]) => [
      folderId,
      conversations.map((conversation) => ({ ...conversation })),
    ]),
  );
}
