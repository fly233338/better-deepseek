# Development Checklist

## Folder Management Core

- Status: implemented and extended.
- Key files: `src/core/folderStore.ts`, `src/core/types.ts`, `src/core/storage.ts`.
- Behavior: creates root folders and one level of subfolders, renames/deletes folders, moves conversations, pins folders, stores folder colors, and persists folder data.
- Verification: `npm run test` covers folder creation, move dedupe, recursive deletion, immutability, nesting limit, pinned folder ordering, and folder color storage.

## DeepSeek Web Adapter

- Status: implemented and extended.
- Key files: `src/deepseek/adapter.ts`, `src/content/index.ts`.
- Behavior: extracts `/chat/s/{id}` conversations from DeepSeek links, finds the native sidebar insertion target before the history section, finds native history row containers for hiding, enhances native history anchors for drag-and-drop, and navigates by native click or URL fallback.
- Verification: `npm run test` covers URL parsing, anchor extraction, deduplication, sidebar insertion-target selection, and native row container selection. Real logged-in DeepSeek DOM still needs manual validation.

## Voyager-Style Sidebar UI

- Status: implemented and simplified.
- Key files: `src/content/index.ts`, `src/content/styles.css`.
- Behavior: renders a Voyager-inspired folder toolbar, rounded icon buttons, folder rows, light blue/white conversation pills, and folder-colored accents for filed conversations. Cloud sync and account/avatar controls are intentionally not shown in the current version.
- Verification: `npm run build` verifies CSS and content script bundling.

## Folder Search

- Status: implemented.
- Key files: `src/content/index.ts`, `src/content/styles.css`.
- Behavior: the folder header includes a debounced search field that filters folder names and filed conversation titles without modifying stored data.
- Verification: `npm run typecheck` and `npm run build` verify the render path.

## Conversation Reorder

- Status: implemented.
- Key files: `src/core/folderStore.ts`, `src/content/index.ts`, `src/content/styles.css`.
- Behavior: filed conversations can be dragged before or after another filed conversation. The store reindexes source and target folders after same-folder reorder or cross-folder moves.
- Verification: `npm run test` covers same-folder reorder and cross-folder insertion with normalized `sortIndex` values.

## Folder Reorder

- Status: implemented.
- Key files: `src/core/folderStore.ts`, `src/content/index.ts`, `src/content/styles.css`.
- Behavior: dragging a folder to the top or bottom edge of another folder row reorders it relative to that row. Dropping in the middle keeps the existing "move into folder" behavior.
- Verification: `npm run test` covers same-parent folder reorder and cross-parent insertion with normalized `sortIndex` values.

## Sidebar Settings

- Status: implemented.
- Key files: `src/content/index.ts`, `src/content/styles.css`, `src/core/folderStore.ts`, `src/core/types.ts`.
- Behavior: the settings button opens a local dialog with the "hide native history rows after filing" toggle plus per-feature toggles for pinning, colors, search, import/export, reorder, and multi-select. Settings persist with folder data.
- Verification: `npm run test` covers settings default merging and disabled pinned ordering; `npm run typecheck` verifies settings wiring.

## Multi-Select Batch Actions

- Status: implemented behind a setting toggle.
- Key files: `src/core/folderStore.ts`, `src/content/index.ts`, `src/content/styles.css`.
- Behavior: when enabled, filed conversations and native DeepSeek history rows get checkboxes. Selected conversations can be moved into a chosen folder; selected filed conversations can be removed from Better DeepSeek folders without deleting the original DeepSeek chats.
- Verification: `npm run test` covers batched conversation add/remove store behavior; `npm run typecheck` and `npm run build` verify UI wiring.

## Hide Foldered Native History Rows

- Status: implemented and moved behind settings.
- Key files: `src/core/folderStore.ts`, `src/content/index.ts`, `src/deepseek/adapter.ts`.
- Behavior: conversations added to any Better DeepSeek folder are hidden from the native DeepSeek history list when enabled in settings; removing the folder reference makes the native row visible again.
- Verification: `npm run test` covers the conversation-id collection and native row container detection.

## Folder Import

- Status: implemented.
- Key files: `src/core/folderImportExport.ts`, `src/content/index.ts`.
- Behavior: settings includes JSON import. Imports validate `better-deepseek.folders.v1`, merge new folders/conversations into existing data, preserve current settings, and save a session backup before applying changes.
- Verification: `npm run test` covers payload validation, merge behavior, and backup load/save.

## Folder Export

- Status: implemented.
- Key files: `src/core/folderImportExport.ts`, `src/content/index.ts`.
- Behavior: settings includes an export button that downloads `better-deepseek.folders.v1` JSON containing folders, folder contents, and settings.
- Verification: `npm run test` covers payload and filename generation.

## Extension Build

- Status: implemented initial version.
- Key files: `public/manifest.json`, `vite.config.ts`, `src/content/styles.css`.
- Behavior: builds an MV3 extension with `content.js`, `style.css`, and manifest output in `dist`.
- Verification: run `npm run typecheck`, `npm run test`, and `npm run build`.
