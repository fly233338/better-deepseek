# Better DeepSeek Overview

Better DeepSeek is a Manifest V3 content-script extension for `chat.deepseek.com`. It injects local folder management into the DeepSeek sidebar and provides a prompt library panel with import, export, and source browsing.

## Architecture

- `src/content/index.ts` is the main content-script coordinator. It mounts the folder UI, enhances native DeepSeek conversation rows, opens custom modal dialogs, persists folder data, and keeps plugin theme state synchronized with the host page.
- `src/content/promptPanel.ts` owns the prompt library drawer, prompt editing, variable filling, import/source browsing, and prompt-specific custom dialogs.
- `src/content/theme.ts` detects the current DeepSeek light/dark appearance and applies `bd-theme-light` or `bd-theme-dark` classes to injected Better DeepSeek surfaces.
- `src/content/i18n.ts` detects the current DeepSeek/browser language, normalizes it to `zh-CN` or `en-US`, and provides UI message formatting.
- `src/deepseek/adapter.ts` contains DOM discovery and navigation helpers for the DeepSeek web app.
- `src/core/*` contains storage, folder, prompt, import/export, and pure data logic.

## Data Flow

- Folder state is loaded from `chrome.storage.local` through `ExtensionFolderStorage`, then managed by `FolderStore` and saved back after debounced UI changes.
- Prompt state is loaded through `PromptStorage`, managed by `PromptStore`, and saved after prompt library changes.
- Theme state is not persisted. It is derived from DeepSeek page signals, computed host background color, or `prefers-color-scheme`, then applied to open plugin surfaces.
- Locale state is not persisted. It follows DeepSeek document language signals first, falls back to browser languages, and defaults unsupported languages to English.
- Folder and prompt import/export use local JSON files; prompt source browsing may fetch source data and falls back to bundled prompt data when needed.

## Module Boundaries

- Content modules may inspect and mutate the page DOM.
- Core modules should remain UI-independent and testable without DeepSeek DOM.
- DeepSeek adapter logic should capture host-page structure assumptions; feature code should call the adapter instead of duplicating page traversal.
- Theme detection belongs in `src/content/theme.ts`; UI modules should only apply or consume its resolved `ThemeMode`.
- Locale detection and UI strings belong in `src/content/i18n.ts`; content UI modules should use message keys instead of hard-coded user-facing strings.

## Roadmap

- Completed: DeepSeek-linked light/dark theme support for injected folder UI, prompt library, source view, and custom modals.
- Completed: Chinese/English UI support that follows DeepSeek language signals and defaults unsupported languages to English.
- Next: Localize built-in prompt seed data without translating user-owned or imported content.
- Later: Polish README and release notes after a broader version milestone.
