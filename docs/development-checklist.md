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

- Status: implemented.
- Key files: `src/content/index.ts`, `src/content/styles.css`.
- Behavior: renders a Voyager-inspired folder toolbar, rounded icon buttons, folder rows, light blue/white conversation pills, and a green left accent for foldered conversations.
- Verification: `npm run build` verifies CSS and content script bundling.

## Hide Foldered Native History Rows

- Status: implemented.
- Key files: `src/core/folderStore.ts`, `src/content/index.ts`, `src/deepseek/adapter.ts`.
- Behavior: conversations added to any Better DeepSeek folder are hidden from the native DeepSeek history list; removing the folder reference makes the native row visible again.
- Verification: `npm run test` covers the conversation-id collection and native row container detection.

## Extension Build

- Status: implemented initial version.
- Key files: `public/manifest.json`, `vite.config.ts`, `src/content/styles.css`.
- Behavior: builds an MV3 extension with `content.js`, `style.css`, and manifest output in `dist`.
- Verification: run `npm run typecheck`, `npm run test`, and `npm run build`.
