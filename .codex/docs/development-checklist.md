# Development Checklist

## DeepSeek-linked dark appearance

- Status: Implemented.
- Summary: Better DeepSeek now follows the DeepSeek web app's current light or dark appearance. The sidebar folder UI, prompt library drawer, source browsing view, variable form, and all custom modals receive the same theme class.
- Key files:
  - `src/content/theme.ts`
  - `src/content/index.ts`
  - `src/content/promptPanel.ts`
  - `src/content/styles.css`
  - `src/content/theme.test.ts`
- Validation:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Manual checks:
  - Verify DeepSeek light mode keeps the existing light visual style.
  - Verify DeepSeek dark mode uses dark surfaces, readable text, visible borders, and clear hover/selected states.
  - Switch DeepSeek appearance while the page is open and confirm Better DeepSeek updates without refresh.
  - Check folder colors, selected conversations, drag targets, multi-select toolbar, prompt source view, and variable/custom dialog surfaces.

## DeepSeek-linked Chinese/English UI

- Status: Implemented.
- Summary: Better DeepSeek now follows DeepSeek page language signals for Chinese and English UI. Unsupported languages fall back to English. The extension manifest also has English and Chinese locale metadata.
- Key files:
  - `src/content/i18n.ts`
  - `src/content/index.ts`
  - `src/content/promptPanel.ts`
  - `src/content/i18n.test.ts`
  - `public/manifest.json`
  - `public/_locales/*/messages.json`
- Validation:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Manual checks:
  - Set DeepSeek/html language to Chinese and verify folder UI, prompt library, source view, and modals show Chinese.
  - Set DeepSeek/html language to English and verify the same surfaces show English.
  - Set DeepSeek/html language to a non-Chinese/non-English locale and verify Better DeepSeek falls back to English.
  - Confirm user-owned folder names, chat titles, imported prompts, and existing prompt content are not auto-translated.

## Content Entrypoint Split

- Status: Implemented.
- Summary: The content script entrypoint is now a small bootstrap that loads extension settings and handles popup messages. The large content app moved to `src/content/app.ts`, while sidebar constants and icon factories moved to `src/content/folderSidebar.ts`.
- Key files:
  - `src/content/index.ts`
  - `src/content/app.ts`
  - `src/content/folderSidebar.ts`
  - `src/core/runtimeMessages.ts`
- Validation:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

## Extension Action Popup

- Status: Implemented.
- Summary: The MV3 manifest now exposes a minimal popup escape hatch. Users can enable or disable Better DeepSeek, open or close the folder section, open or close the prompt library, export and import folder backups, reset UI state, and copy diagnostics.
- Key files:
  - `public/manifest.json`
  - `src/popup.html`
  - `src/popup/index.ts`
  - `src/popup/index.css`
  - `src/core/extensionSettings.ts`
  - `src/core/runtimeMessages.ts`
  - `vite.config.ts`
- Validation:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

## Quote Reply Bar Polish

- Status: Implemented.
- Summary: The quote reply preview above the DeepSeek composer now uses a softer gray visual style, fluid width, better side alignment with the composer content area, and more comfortable top/bottom spacing.
- Key files:
  - `src/content/styles.css`
- Validation:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
