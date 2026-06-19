import '../content/styles.css';
import './index.css';

import { createFolderExportPayload, downloadJson, generateFolderExportFilename, isFolderExportPayload, mergeFolderImport, readJsonFile } from '../core/folderImportExport';
import { loadExtensionSettings, saveExtensionSettings } from '../core/extensionSettings';
import type { RuntimeMessage, RuntimeStatus } from '../core/runtimeMessages';
import { ExtensionFolderStorage } from '../core/storage';
import { detectLocale, t, type AppLocale, type MessageKey } from '../content/i18n';
import { applyThemeClass, detectThemeMode } from '../content/theme';

const storage = new ExtensionFolderStorage();
const locale = detectLocale();
const root = document.getElementById('app');
let status: RuntimeStatus | null = null;
let enabled = true;

applyThemeClass(document.body, detectThemeMode());
void render();

async function render(message?: string): Promise<void> {
  if (!root) return;

  enabled = (await loadExtensionSettings()).enabled;
  status = await sendToActiveDeepSeekTab({ type: 'bd:getStatus' });
  const effectiveEnabled = status?.enabled ?? enabled;
  const canControlPage = Boolean(status?.mounted || status?.enabled);

  root.innerHTML = '';
  const shell = document.createElement('section');
  shell.className = 'bd-popup';

  const header = document.createElement('header');
  header.className = 'bd-popup-header';

  const title = document.createElement('h1');
  title.className = 'bd-popup-title';
  title.textContent = tr('popup.title');

  const pill = document.createElement('span');
  pill.className = 'bd-popup-pill';
  pill.classList.toggle('bd-popup-pill-active', effectiveEnabled);
  pill.textContent = effectiveEnabled ? tr('popup.enabled') : tr('popup.disabled');
  header.append(title, pill);

  const controls = document.createElement('div');
  controls.className = 'bd-popup-grid';
  controls.append(
    button(effectiveEnabled ? tr('popup.disable') : tr('popup.enable'), () => setEnabled(!effectiveEnabled), true),
    button(status?.foldersOpen ? tr('popup.toggleFoldersOff') : tr('popup.openFolders'), () => setFoldersOpen(!status?.foldersOpen), false, !effectiveEnabled || !canControlPage),
    button(status?.promptLibraryOpen ? tr('popup.togglePromptLibraryOff') : tr('popup.openPromptLibrary'), () => setPromptLibraryOpen(!status?.promptLibraryOpen), false, !effectiveEnabled || !canControlPage),
    button(tr('popup.exportBackup'), exportBackup),
    button(tr('popup.importBackup'), () => fileInput.click()),
    button(tr('popup.resetUi'), resetUi, false, false, 'bd-popup-danger'),
    button(tr('popup.copyDiagnostics'), copyDiagnostics),
  );

  const statusLine = document.createElement('div');
  statusLine.className = 'bd-popup-status';
  if (message) statusLine.textContent = message;
  else if (!status) statusLine.textContent = tr('popup.noDeepSeekTab');
  else statusLine.textContent = tr('popup.reloadPageHint');

  shell.append(header, controls, statusLine, fileInput);
  root.append(shell);
}

const fileInput = document.createElement('input');
fileInput.className = 'bd-popup-file';
fileInput.type = 'file';
fileInput.accept = 'application/json,.json';
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file) return;

  try {
    const parsed = await readJsonFile(file);
    if (!isFolderExportPayload(parsed)) {
      await render(tr('error.importFolderInvalid'));
      return;
    }

    const current = await storage.load();
    const result = mergeFolderImport(current, parsed);
    await storage.save(result.data);
    await sendToActiveDeepSeekTab({ type: 'bd:reloadData' });
    await render(tr('status.importComplete', {
      folders: result.stats.foldersImported,
      conversations: result.stats.conversationsImported,
    }));
  } catch {
    await render(tr('error.importInvalidJson'));
  }
});

function button(
  label: string,
  onClick: () => void | Promise<void>,
  primary = false,
  disabled = false,
  extraClass = '',
): HTMLButtonElement {
  const element = document.createElement('button');
  element.className = ['bd-popup-button', primary ? 'bd-popup-primary' : '', extraClass].filter(Boolean).join(' ');
  element.type = 'button';
  element.textContent = label;
  element.disabled = disabled;
  element.addEventListener('click', () => {
    void onClick();
  });
  return element;
}

async function setEnabled(next: boolean): Promise<void> {
  enabled = next;
  await saveExtensionSettings({ enabled });
  await sendToActiveDeepSeekTab({ type: 'bd:setEnabled', enabled });
  await render(tr('popup.saved'));
}

async function setFoldersOpen(open: boolean): Promise<void> {
  await sendToActiveDeepSeekTab({ type: 'bd:setFoldersOpen', open });
  await render(tr('popup.saved'));
}

async function setPromptLibraryOpen(open: boolean): Promise<void> {
  await sendToActiveDeepSeekTab({ type: 'bd:setPromptLibraryOpen', open });
  await render(tr('popup.saved'));
}

async function exportBackup(): Promise<void> {
  downloadJson(createFolderExportPayload(await storage.load()), generateFolderExportFilename());
  await render(tr('popup.saved'));
}

async function resetUi(): Promise<void> {
  const data = await storage.load();
  await storage.save({
    ...data,
    settings: {
      ...data.settings,
      hideEnabled: true,
      foldersExpanded: true,
      pinnedExpanded: true,
    },
  });
  await sendToActiveDeepSeekTab({ type: 'bd:resetUi' });
  await render(tr('popup.resetDone'));
}

async function copyDiagnostics(): Promise<void> {
  const tab = await activeDeepSeekTab();
  const manifest = chrome.runtime.getManifest();
  const lines = [
    `${tr('popup.title')} ${tr('popup.diagnosticVersion')}: ${manifest.version}`,
    `${tr('popup.diagnosticEnabled')}: ${formatBoolean(status?.enabled ?? enabled)}`,
    `${tr('popup.diagnosticMounted')}: ${formatBoolean(status?.mounted ?? false)}`,
    `${tr('popup.diagnosticFoldersOpen')}: ${formatBoolean(status?.foldersOpen ?? false)}`,
    `${tr('popup.diagnosticPromptOpen')}: ${formatBoolean(status?.promptLibraryOpen ?? false)}`,
    `${tr('popup.diagnosticTab')}: ${tab?.url ?? tr('popup.noDeepSeekTab')}`,
    `${tr('popup.diagnosticLocale')}: ${locale}`,
    `${tr('popup.diagnosticTime')}: ${new Date().toISOString()}`,
    `${tr('popup.diagnosticUserAgent')}: ${navigator.userAgent}`,
  ];
  await navigator.clipboard.writeText(lines.join('\n'));
  await render(tr('popup.copyDone'));
}

async function sendToActiveDeepSeekTab(message: RuntimeMessage): Promise<RuntimeStatus | null> {
  const tab = await activeDeepSeekTab();
  if (!tab?.id) return null;

  try {
    return await chrome.tabs.sendMessage(tab.id, message) as RuntimeStatus;
  } catch {
    return null;
  }
}

async function activeDeepSeekTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url?.startsWith('https://chat.deepseek.com/') ? tab : null;
}

function formatBoolean(value: boolean): string {
  return value ? tr('popup.on') : tr('popup.off');
}

function tr(key: MessageKey, params?: Record<string, string | number>): string {
  return t(locale as AppLocale, key, params);
}
