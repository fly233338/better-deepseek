# Better DeepSeek Overview

Better DeepSeek is currently a Manifest V3 browser extension that injects local folder management into `https://chat.deepseek.com/*`.

## Architecture

- `public/manifest.json` declares the extension surface and loads one content script on DeepSeek web.
- `src/content/index.ts` owns the injected UI, drag-and-drop behavior, native history-row enhancement, and page mutation observation.
- `src/deepseek/adapter.ts` isolates DeepSeek-specific URL parsing, sidebar detection, native conversation extraction, and navigation.
- `src/core/folderStore.ts` owns folder and conversation mutations as pure TypeScript state logic.
- `src/core/storage.ts` persists folder data to `chrome.storage.local`, with `localStorage` fallback for non-extension test/dev contexts.

## Data Flow

1. The content script loads `FolderData` from storage.
2. `FolderStore` mutates folders and conversation references in memory.
3. The injected panel renders from `FolderStore.snapshot()`.
4. Dragging a DeepSeek history anchor or an existing folder conversation emits a typed drag payload.
5. Dropping onto a folder moves the conversation reference and schedules a storage save.

## Current Scope

- Root folders and one level of subfolders.
- Add current conversation to a folder.
- Drag native DeepSeek history conversations into folders.
- Move conversations between folders.
- Click folder conversations to navigate back to the original DeepSeek chat.

## Reference Policy

`gemini-voyager` is copied locally under `.codex/reference/gemini-voyager` for architectural reference only and is ignored by Git. Its GPL-3.0 source is not copied into the MIT-licensed Better DeepSeek implementation.

## Roadmap

- Probe real DeepSeek DOM variants after login and tighten selectors where needed.
- Add import/export for `FolderData`.
- Add a popup/options page for settings.
- Add account isolation if DeepSeek exposes multiple account contexts in the URL or page state.
