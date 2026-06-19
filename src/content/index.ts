import './styles.css';

import { loadExtensionSettings, saveExtensionSettings } from '../core/extensionSettings';
import type { RuntimeMessage, RuntimeStatus } from '../core/runtimeMessages';
import { BetterDeepSeekFolders } from './app';

const app = new BetterDeepSeekFolders();
let extensionEnabled = true;

registerRuntimeMessages();
void bootstrap();

async function bootstrap(): Promise<void> {
  const settings = await loadExtensionSettings();
  extensionEnabled = settings.enabled;
  if (extensionEnabled) await app.mount();
}

function registerRuntimeMessages(): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

  chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    void handleRuntimeMessage(message)
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return true;
  });
}

async function handleRuntimeMessage(message: RuntimeMessage): Promise<RuntimeStatus> {
  switch (message.type) {
    case 'bd:getStatus':
      return runtimeStatus();
    case 'bd:setEnabled':
      extensionEnabled = message.enabled;
      await saveExtensionSettings({ enabled: extensionEnabled });
      if (extensionEnabled) await app.mount();
      else app.unmount();
      return runtimeStatus();
    case 'bd:setFoldersOpen':
      app.setFoldersOpen(message.open);
      return runtimeStatus();
    case 'bd:setPromptLibraryOpen':
      app.setPromptLibraryOpen(message.open);
      return runtimeStatus();
    case 'bd:reloadData':
      await app.reloadData();
      return runtimeStatus();
    case 'bd:resetUi':
      app.resetUiState();
      return runtimeStatus();
  }
}

function runtimeStatus(): RuntimeStatus {
  return {
    enabled: extensionEnabled,
    mounted: app.isMounted(),
    foldersOpen: app.foldersOpen(),
    promptLibraryOpen: app.promptLibraryOpen(),
  };
}
