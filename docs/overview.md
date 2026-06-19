# Better DeepSeek Overview

Better DeepSeek is a Manifest V3 extension for `chat.deepseek.com`. It injects local folder management into the DeepSeek sidebar, provides a prompt library panel, and exposes a small popup escape hatch for recovery and backup workflows.

## Architecture

- `public/manifest.json` declares the content script and extension action popup.
- `src/content/index.ts` bootstraps the content app, respects the extension-level enabled flag, and handles typed popup messages.
- `src/content/app.ts` owns the injected folder UI, native conversation enhancement, custom modals, persistence scheduling, and theme/locale synchronization.
- `src/content/folderSidebar.ts` contains shared sidebar constants, color tokens, and icon factories.
- `src/content/promptPanel.ts` owns the prompt library drawer and prompt CRUD/import/export flows.
- `src/popup/index.ts` owns the minimal popup controls: enable/disable, folder and prompt-library visibility, backup import/export, UI reset, and diagnostics copy.
- `src/core/*` contains UI-independent storage, folder, prompt, import/export, extension setting, and runtime message logic.

## Data Flow

- Folder state loads from `chrome.storage.local` through `ExtensionFolderStorage`, is managed by `FolderStore`, and is saved after debounced UI changes.
- Prompt state loads through `PromptStorage`, is managed by `PromptStore`, and is saved after prompt library changes.
- Extension-level settings such as the global enabled flag are stored separately by `extensionSettings.ts`.
- The popup imports and exports the same folder backup JSON format as the content settings dialog, then asks an active DeepSeek page to reload data when possible.
- Theme and locale are detected at runtime and applied to injected surfaces; user-visible UI text uses `t(locale, key)`.

## Roadmap

- Continue extracting `src/content/app.ts` into feature modules before larger Timeline/export/snippet work.
- Localize built-in prompt seed data without translating user-owned or imported content.
- Probe real DeepSeek DOM variants after login and tighten selectors where needed.
