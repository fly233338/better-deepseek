# Development Checklist

## Folder Management Core

- Status: implemented initial version.
- Key files: `src/core/folderStore.ts`, `src/core/types.ts`, `src/core/storage.ts`.
- Behavior: creates root folders and one level of subfolders, renames/deletes folders, moves conversations, persists folder data.
- Verification: `npm run test` covers folder creation, move dedupe, recursive deletion, immutability, and nesting limit.

## DeepSeek Web Adapter

- Status: implemented and extended.
- Key files: `src/deepseek/adapter.ts`, `src/content/index.ts`.
- Behavior: extracts `/chat/s/{id}` conversations from DeepSeek links, finds the native sidebar insertion target before the history section, finds native history row containers for hiding, enhances native history anchors for drag-and-drop, and navigates by native click or URL fallback.
- Verification: `npm run test` covers URL parsing, anchor extraction, deduplication, sidebar insertion-target selection, and native row container selection. Real logged-in DeepSeek DOM still needs manual validation.

## Voyager-Style Sidebar UI

- Status: implemented and simplified.
- Key files: `src/content/index.ts`, `src/content/styles.css`.
- Behavior: renders a Voyager-inspired folder toolbar, rounded icon buttons, folder rows, light blue/white conversation pills, and a green left accent for foldered conversations. Cloud sync and account/avatar controls are intentionally not shown in the current version.
- Verification: `npm run build` verifies CSS and content script bundling.

## Sidebar Settings

- Status: implemented.
- Key files: `src/content/index.ts`, `src/content/styles.css`, `src/core/folderStore.ts`, `src/core/types.ts`.
- Behavior: the settings button opens a local dialog with the "hide native history rows after filing" toggle. The setting persists with folder data.
- Verification: `npm run typecheck` verifies settings wiring.

## Hide Foldered Native History Rows

- Status: implemented and moved behind settings.
- Key files: `src/core/folderStore.ts`, `src/content/index.ts`, `src/deepseek/adapter.ts`.
- Behavior: conversations added to any Better DeepSeek folder are hidden from the native DeepSeek history list when enabled in settings; removing the folder reference makes the native row visible again.
- Verification: `npm run test` covers the conversation-id collection and native row container detection.

## Folder Import

- Status: not implemented.
- Key files: none yet.
- Behavior: there is currently no import/export UI or parser in Better DeepSeek. The old top-level folder icon was only a new-folder shortcut, not an import command.
- Verification: `rg "import|export" src` confirms there is no folder import/export implementation.

## Extension Build

- Status: implemented initial version.
- Key files: `public/manifest.json`, `vite.config.ts`, `src/content/styles.css`.
- Behavior: builds an MV3 extension with `content.js`, `style.css`, and manifest output in `dist`.
- Verification: run `npm run typecheck`, `npm run test`, and `npm run build`.
