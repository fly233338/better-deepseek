# Better DeepSeek Overview

Better DeepSeek is currently a Manifest V3 browser extension that injects local folder management into `https://chat.deepseek.com/*`.

## Architecture

- `public/manifest.json` declares the extension surface and loads one content script on DeepSeek web.
- `src/content/index.ts` owns the injected UI, drag-and-drop behavior, native history-row enhancement, and page mutation observation.
- `src/deepseek/adapter.ts` isolates DeepSeek-specific URL parsing, sidebar insertion-target detection, native conversation extraction, and navigation.
- `src/core/folderStore.ts` owns folder and conversation mutations as pure TypeScript state logic.
- `src/core/storage.ts` persists folder data to `chrome.storage.local`, with `localStorage` fallback for non-extension test/dev contexts.

## Data Flow

1. The content script loads `FolderData` from storage.
2. `FolderStore` mutates folders and conversation references in memory.
3. The injected panel waits for DeepSeek's native sidebar and renders before the history section with a Voyager-inspired folder toolbar and tree layout.
4. Dragging a DeepSeek history anchor or an existing folder conversation emits a typed drag payload.
5. Dropping onto a folder moves the conversation reference, schedules a storage save, and hides the matching native DeepSeek history row outside the folder tree.

## Current Scope

- Root folders and one level of subfolders.
- Add current conversation to a folder.
- Drag native DeepSeek history conversations into folders.
- Move conversations between folders.
- Reorder filed conversations by dragging them before or after another filed conversation.
- Reorder folders by dragging to the top or bottom edge of another folder row; dropping in the middle still moves into that folder.
- Pin frequently used folders to the top of their sibling group.
- Assign preset colors to folders; folder icons and filed conversation accent bars use the folder color.
- Search folder names and filed conversation titles from the folder header without changing stored data.
- Export and import `better-deepseek.folders.v1` JSON from settings; imports merge by default and keep an import-before backup for restore.
- Click folder conversations to navigate back to the original DeepSeek chat.
- No floating fallback: the folder panel embeds into the DeepSeek sidebar once a reliable sidebar target exists.
- Voyager-inspired sidebar styling with a light blue/white DeepSeek palette, rounded icon buttons, folder rows, and selected conversation pills.
- Settings dialog in the sidebar header. The "hide native history rows after filing" behavior is controlled there instead of taking space in the main toolbar.
- Hide native history rows once their conversations are collected into a Better DeepSeek folder when the setting is enabled; removing the folder reference reveals them again.

## Reference Policy

`gemini-voyager` is copied locally under `.codex/reference/gemini-voyager` for architectural reference only and is ignored by Git. Its GPL-3.0 source is not copied into the MIT-licensed Better DeepSeek implementation.

## Roadmap

- Probe real DeepSeek DOM variants after login and tighten selectors where needed.
- Add full multi-select for history and filed conversations.
- Add account isolation if DeepSeek exposes multiple account contexts in the URL or page state.
