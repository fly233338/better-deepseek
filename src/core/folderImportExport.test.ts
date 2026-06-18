import { describe, expect, it } from 'vitest';

import {
  FOLDER_EXPORT_FORMAT,
  createFolderExportPayload,
  generateFolderExportFilename,
  isFolderExportPayload,
  loadImportBackup,
  mergeFolderImport,
  saveImportBackup,
} from './folderImportExport';
import type { FolderData } from './types';

describe('folder import/export helpers', () => {
  it('creates a versioned export payload with folder data and settings', () => {
    const data: FolderData = {
      folders: [],
      folderContents: {},
      settings: { hideEnabled: false },
    };

    expect(createFolderExportPayload(data, '2026-01-02T03:04:05.000Z')).toEqual({
      format: FOLDER_EXPORT_FORMAT,
      exportedAt: '2026-01-02T03:04:05.000Z',
      data,
    });
  });

  it('generates stable export filenames', () => {
    expect(generateFolderExportFilename(new Date('2026-01-02T03:04:05'))).toBe(
      'better-deepseek-folders-20260102-030405.json',
    );
  });

  it('validates folder export payloads', () => {
    const payload = createFolderExportPayload({
      folders: [],
      folderContents: {},
      settings: { hideEnabled: true },
    });

    expect(isFolderExportPayload(payload)).toBe(true);
    expect(isFolderExportPayload({ ...payload, format: 'unknown' })).toBe(false);
  });

  it('merges imports without overwriting existing data or settings', () => {
    const current: FolderData = {
      folders: [{ id: 'work', name: 'Work', parentId: null, isExpanded: true, createdAt: 1, updatedAt: 1, sortIndex: 0 }],
      folderContents: {
        work: [{ conversationId: 'a', title: 'A', url: '/chat/s/a', addedAt: 1, updatedAt: 1, sortIndex: 0 }],
      },
      settings: { hideEnabled: false },
    };
    const imported = createFolderExportPayload({
      folders: [
        { id: 'work', name: 'Work duplicate', parentId: null, isExpanded: true, createdAt: 2, updatedAt: 2, sortIndex: 0 },
        { id: 'life', name: 'Life', parentId: null, isExpanded: true, createdAt: 2, updatedAt: 2, sortIndex: 1 },
      ],
      folderContents: {
        work: [
          { conversationId: 'a', title: 'A duplicate', url: '/chat/s/a', addedAt: 2, updatedAt: 2, sortIndex: 0 },
          { conversationId: 'b', title: 'B', url: '/chat/s/b', addedAt: 2, updatedAt: 2, sortIndex: 1 },
        ],
      },
      settings: { hideEnabled: true },
    });

    const result = mergeFolderImport(current, imported);

    expect(result.stats).toEqual({
      foldersImported: 1,
      conversationsImported: 1,
      duplicateFoldersSkipped: 1,
      duplicateConversationsSkipped: 1,
    });
    expect(result.data.folders.map((folder) => folder.id)).toEqual(['work', 'life']);
    expect(result.data.folderContents.work.map((conversation) => conversation.conversationId)).toEqual(['a', 'b']);
    expect(result.data.settings).toEqual({ hideEnabled: false });
  });

  it('saves and loads import backups', () => {
    const data: FolderData = {
      folders: [],
      folderContents: {},
      settings: { hideEnabled: false },
    };

    saveImportBackup(data);

    expect(loadImportBackup()).toEqual(data);
  });
});
