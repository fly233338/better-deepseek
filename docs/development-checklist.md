# Development Checklist

## Content Entrypoint Split

- Status: Implemented.
- Summary: `src/content/index.ts` is now a small bootstrap. The main content app lives in `src/content/app.ts`, and sidebar constants/icon factories live in `src/content/folderSidebar.ts`.
- Key files: `src/content/index.ts`, `src/content/app.ts`, `src/content/folderSidebar.ts`, `src/core/runtimeMessages.ts`.
- Verification: `npm run typecheck`, `npm test`, `npm run build`.

## Extension Action Popup

- Status: Implemented.
- Summary: Added a minimal MV3 popup escape hatch for enabling/disabling Better DeepSeek, opening/closing folders, opening/closing the prompt library, exporting/importing backups, resetting UI state, and copying diagnostics.
- Key files: `public/manifest.json`, `src/popup.html`, `src/popup/index.ts`, `src/popup/index.css`, `src/core/extensionSettings.ts`, `src/core/runtimeMessages.ts`, `vite.config.ts`.
- Verification: `npm run typecheck`, `npm test`, `npm run build`.

## Quote Reply Bar Polish

- Status: Implemented.
- Summary: The quote reply preview above the DeepSeek composer now uses a softer gray visual style, fluid width, better side alignment with the composer content area, and more comfortable top/bottom spacing.
- Key files: `src/content/styles.css`.
- Verification: `npm run typecheck`, `npm test`, `npm run build`.
