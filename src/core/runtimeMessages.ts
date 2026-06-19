export type RuntimeMessage =
  | { type: 'bd:getStatus' }
  | { type: 'bd:setEnabled'; enabled: boolean }
  | { type: 'bd:setFoldersOpen'; open: boolean }
  | { type: 'bd:setPromptLibraryOpen'; open: boolean }
  | { type: 'bd:reloadData' }
  | { type: 'bd:resetUi' };

export interface RuntimeStatus {
  enabled: boolean;
  mounted: boolean;
  foldersOpen: boolean;
  promptLibraryOpen: boolean;
}
