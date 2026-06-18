import type { FolderData } from './types';

export const FOLDER_EXPORT_FORMAT = 'better-deepseek.folders.v1';

export interface FolderExportPayload {
  format: typeof FOLDER_EXPORT_FORMAT;
  exportedAt: string;
  data: FolderData;
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
