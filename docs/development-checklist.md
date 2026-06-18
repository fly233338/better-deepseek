# Development Checklist

## Folder Management Core

- Status: implemented initial version.
- Key files: `src/core/folderStore.ts`, `src/core/types.ts`, `src/core/storage.ts`.
- Behavior: creates root folders and one level of subfolders, renames/deletes folders, moves conversations, persists folder data.
- Verification: `npm run test` covers folder creation, move dedupe, recursive deletion, immutability, and nesting limit.

## DeepSeek Web Adapter

- Status: implemented initial version.
- Key files: `src/deepseek/adapter.ts`, `src/content/index.ts`.
- Behavior: extracts `/chat/s/{id}` conversations from DeepSeek links, finds a likely sidebar, enhances native history anchors for drag-and-drop, and navigates by native click or URL fallback.
- Verification: `npm run test` covers URL parsing, anchor extraction, and deduplication. Real logged-in DeepSeek DOM still needs manual validation.

## Extension Build

- Status: implemented initial version.
- Key files: `public/manifest.json`, `vite.config.ts`, `src/content/styles.css`.
- Behavior: builds an MV3 extension with `content.js`, `style.css`, and manifest output in `dist`.
- Verification: run `npm run typecheck`, `npm run test`, and `npm run build`.
