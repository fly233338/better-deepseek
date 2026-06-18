import { describe, expect, it } from 'vitest';

import {
  FOLDER_EXPORT_FORMAT,
  createFolderExportPayload,
  generateFolderExportFilename,
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
});
