import './styles.css';

import { FolderStore } from '../core/folderStore';
import {
  createFolderExportPayload,
  downloadJson,
  generateFolderExportFilename,
  isFolderExportPayload,
  loadImportBackup,
  mergeFolderImport,
  readJsonFile,
  saveImportBackup,
} from '../core/folderImportExport';
import { ExtensionFolderStorage } from '../core/storage';
import type {
  ConversationDragPayload,
  ConversationReference,
  DragPayload,
  FolderFeatureSettings,
  Folder,
} from '../core/types';
import {
  conversationFromAnchor,
  currentConversation,
  extractConversationId,
  findConversationAnchors,
  findFolderInsertionTarget,
  findNativeConversationContainer,
  navigateToConversation,
} from '../deepseek/adapter';
import { PromptStore } from '../core/promptStore';
import { PromptStorage } from '../core/promptStorage';
import { PromptPanel } from './promptPanel';

const ROOT_ID = 'better-deepseek-folders';
const DRAG_MIME = 'application/x-better-deepseek';
const DEFAULT_FOLDER_COLOR = '#66e2aa';
const FOLDER_COLORS = [
  { label: '默认', value: DEFAULT_FOLDER_COLOR },
  { label: '浅蓝', value: '#74a8ff' },
  { label: '薄荷绿', value: '#66e2aa' },
  { label: '淡紫', value: '#b99cff' },
  { label: '粉色', value: '#ff9ac2' },
  { label: '琥珀', value: '#f4bf5f' },
] as const;

interface SelectedConversation {
  conversation: ConversationReference;
  sourceFolderId?: string;
}

class BetterDeepSeekFolders {
  private readonly storage = new ExtensionFolderStorage();
  private store = new FolderStore();
  private promptStorage = new PromptStorage();
  private promptStore: PromptStore | null = null;
  private promptPanel: PromptPanel | null = null;
  private observer: MutationObserver | null = null;
  private observerTimer: number | null = null;
  private saveTimer: number | null = null;
  private promptSaveTimer: number | null = null;
  private readonly selectedConversations = new Map<string, SelectedConversation>();
  private folderSearchQueries = new Map<string, string>();
  private openFolderSearchIds = new Set<string>();
  private hideEnabled = true;

  async mount(): Promise<void> {
    this.store = new FolderStore(await this.storage.load());
    this.promptStore = new PromptStore(await this.promptStorage.load());
    this.promptStore.seedBuiltins();
    void this.promptStorage.save(this.promptStore.snapshot());
    this.hideEnabled = this.store.getSettings().hideEnabled;
    this.render();
    this.enhanceNativeConversationRows();
    this.refreshNativeConversationVisibility();
    this.observePageChanges();
    this.listenNativePinClick();
  }

  private render(): void {
    const root = this.ensureRoot();
    if (!root) return;

    if (!this.featureEnabled('folderSearch')) this.folderSearchQueries.clear();

    root.classList.toggle('bd-feature-pin-off', !this.featureEnabled('pinFolders'));
    root.classList.toggle('bd-feature-colors-off', !this.featureEnabled('folderColors'));

    root.innerHTML = '';
    root.append(this.promptEntryElement());
    root.append(this.separatorElement());
    root.append(this.pinnedSectionElement());
    root.append(this.folderSectionElement());
    root.append(this.chatLabelElement());
  }

  private folderSectionElement(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'bd-sidebar-section';

    const settings = this.store.getSettings();
    const expanded = settings.foldersExpanded !== false;
    const actions = document.createElement('div');
    actions.className = 'bd-folder-toolbar';
    actions.append(
      this.iconButton('settings', '设置', () => this.openSettingsDialog()),
      this.iconButton('plus', '新建文件夹', () => this.createFolder(null)),
    );

    section.append(
      this.sectionHeaderElement('文件夹', expanded, () => {
        this.store.setSettings({ ...this.store.getSettings(), foldersExpanded: !expanded });
        this.persistAndRender();
      }, actions),
    );

    const selectionBar = this.selectionToolbarElement();
    if (selectionBar) section.append(selectionBar);

    if (!expanded) return section;

    const list = document.createElement('div');
    list.className = 'bd-folder-list';
    section.append(list);

    const query = '';
    const folders = this.visibleFoldersByParent(null, query, true);
    if (folders.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bd-empty';
      empty.textContent = '新建文件夹后，可拖入 DeepSeek 历史会话。';
      list.append(empty);
      return section;
    }

    for (const folder of folders) {
      list.append(this.folderElement(folder, 0, query));
    }

    return section;
  }

  private promptEntryElement(): HTMLElement {
    const entry = document.createElement('button');
    entry.className = 'bd-prompt-entry';
    entry.type = 'button';
    entry.append(this.iconElement('library'), document.createTextNode('提示词库'));
    entry.addEventListener('click', () => {
      if (!this.promptStore) return;
      this.promptPanel = new PromptPanel(
        this.promptStore,
        () => { this.promptPanel = null; },
        () => this.persistPromptData(),
      );
      this.promptPanel.open();
    });
    return entry;
  }

  private persistPromptData(): void {
    if (this.promptSaveTimer) window.clearTimeout(this.promptSaveTimer);
    this.promptSaveTimer = window.setTimeout(() => {
      if (this.promptStore) void this.promptStorage.save(this.promptStore.snapshot());
    }, 80);
  }

  private separatorElement(): HTMLElement {
    const el = document.createElement('hr');
    el.className = 'bd-separator';
    return el;
  }

  private chatLabelElement(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'bd-chat-label';
    el.textContent = '聊天';
    return el;
  }

  private sectionHeaderElement(
    title: string,
    expanded: boolean,
    onToggle: () => void,
    actions?: HTMLElement,
  ): HTMLElement {
    const header = document.createElement('div');
    header.className = 'bd-section-header';

    const label = document.createElement('button');
    label.className = 'bd-section-title';
    label.type = 'button';
    label.textContent = title;
    label.addEventListener('click', onToggle);

    const toggle = document.createElement('button');
    toggle.className = 'bd-section-toggle';
    toggle.type = 'button';
    toggle.append(this.iconElement(expanded ? 'chevronDown' : 'chevronRight'));
    toggle.addEventListener('click', onToggle);

    header.append(label, toggle);
    if (actions) header.append(actions);
    return header;
  }

  private pinnedSectionElement(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'bd-sidebar-section';

    const pinnedFolders = this.store.pinnedFolders();
    const pinnedConversations = this.store.pinnedConversations();
    const hasPinned = pinnedFolders.length > 0 || pinnedConversations.length > 0;
    if (!hasPinned) return section;

    const settings = this.store.getSettings();
    const expanded = settings.pinnedExpanded !== false;
    section.append(
      this.sectionHeaderElement('已置顶', expanded, () => {
        this.store.setSettings({ ...this.store.getSettings(), pinnedExpanded: !expanded });
        this.persistAndRender();
      }),
    );

    if (!expanded) return section;

    const list = document.createElement('div');
    list.className = 'bd-pinned-list';

    for (const folder of pinnedFolders) {
      list.append(this.folderElement(folder, 0, ''));
    }

    for (const conversation of pinnedConversations) {
      list.append(this.pinnedConversationElement(conversation));
    }

    section.append(list);
    return section;
  }

  private pinnedConversationElement(conversation: ConversationReference): HTMLElement {
    const row = document.createElement('div');
    row.className = 'bd-pinned-row';

    const icon = this.iconElement('chat');
    icon.classList.add('bd-pinned-symbol');

    const title = document.createElement('span');
    title.className = 'bd-pinned-title';
    title.textContent = conversation.title;

    const unpin = this.iconButton('pinOff', '取消置顶', (event) => {
      event.stopPropagation();
      this.store.togglePinnedConversation(conversation);
      this.persistAndRender();
    });
    unpin.classList.add('bd-pinned-action');

    row.addEventListener('click', () => navigateToConversation(conversation.url));
    row.append(icon, title, unpin);
    return row;
  }

  private selectionToolbarElement(): HTMLElement | null {
    if (!this.featureEnabled('multiSelect')) {
      this.clearSelection();
      return null;
    }

    const selected = this.selectedItems();
    if (selected.length === 0) return null;

    const bar = document.createElement('div');
    bar.className = 'bd-selection-toolbar';

    const count = document.createElement('span');
    count.className = 'bd-selection-count';
    count.textContent = `已选 ${selected.length}`;

    const move = document.createElement('button');
    move.type = 'button';
    move.className = 'bd-selection-action';
    move.textContent = '移动所选';
    move.addEventListener('click', () => {
      void this.moveSelectedConversations();
    });

    const selectedFromFolders = selected.filter((item) => item.sourceFolderId);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'bd-selection-action';
    remove.textContent = '移除所选';
    remove.disabled = selectedFromFolders.length === 0;
    remove.addEventListener('click', () => {
      void this.removeSelectedConversations();
    });

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'bd-selection-action bd-selection-muted';
    clear.textContent = '清空';
    clear.addEventListener('click', () => {
      this.clearSelection();
      this.refreshSelectionUi();
    });

    bar.append(count, move, remove, clear);
    return bar;
  }

  private selectedItems(): SelectedConversation[] {
    return Array.from(this.selectedConversations.values());
  }

  private isConversationSelected(conversationId: string): boolean {
    return this.selectedConversations.has(conversationId);
  }

  private setConversationSelected(
    conversation: ConversationReference,
    selected: boolean,
    sourceFolderId?: string,
  ): void {
    if (selected) {
      this.selectedConversations.set(conversation.conversationId, { conversation, sourceFolderId });
    } else {
      this.selectedConversations.delete(conversation.conversationId);
    }
  }

  private clearSelection(): void {
    this.selectedConversations.clear();
  }

  private refreshSelectionUi(): void {
    this.render();
    this.enhanceNativeConversationRows();
  }

  private featureEnabled(feature: keyof FolderFeatureSettings): boolean {
    return Boolean(this.store.getSettings().features?.[feature]);
  }

  private ensureRoot(): HTMLElement | null {
    const target = findFolderInsertionTarget();
    if (!target) return null;

    const existing = document.getElementById(ROOT_ID);
    if (existing) {
      if (target.before === existing) return existing;
      if (existing.parentElement !== target.sidebar || existing.nextSibling !== target.before) {
        target.sidebar.insertBefore(existing, target.before);
      }
      return existing;
    }

    const root = document.createElement('section');
    root.id = ROOT_ID;
    root.className = 'bd-folder-root';
    target.sidebar.insertBefore(root, target.before);
    return root;
  }

  private folderElement(folder: Folder, level: number, query: string): HTMLElement {
    const block = document.createElement('div');
    block.className = 'bd-folder-block';
    block.dataset.folderId = folder.id;
    block.style.setProperty(
      '--bd-folder-accent',
      this.featureEnabled('folderColors') ? folder.color || DEFAULT_FOLDER_COLOR : DEFAULT_FOLDER_COLOR,
    );

    const row = document.createElement('div');
    row.className = 'bd-folder-row';
    row.style.setProperty('--bd-level', String(level));
    row.draggable = true;
    row.title = '拖入会话，或双击改名';

    row.addEventListener('dragstart', (event) => {
      const payload: DragPayload = { type: 'folder', folderId: folder.id };
      event.dataTransfer?.setData(DRAG_MIME, JSON.stringify(payload));
    });
    this.makeFolderDropTarget(row, folder);

    const toggle = this.iconButton(
      folder.isExpanded ? 'chevronDown' : 'chevronRight',
      '展开/收起',
      () => {
        this.store.toggleFolder(folder.id);
        this.persistAndRender();
      },
    );
    toggle.classList.add('bd-row-icon-button');

    const folderIcon = this.iconElement('folder');
    folderIcon.classList.add('bd-folder-symbol');

    const name = document.createElement('span');
    name.className = 'bd-folder-name';
    name.textContent = folder.name;
    name.addEventListener('dblclick', () => {
      void this.renameFolder(folder);
    });

    const actionButtons = [
      this.iconButton(folder.pinned ? 'pinOff' : 'pin', folder.pinned ? '取消置顶' : '置顶文件夹', () => {
        this.store.togglePinned(folder.id);
        this.persistAndRender();
      }),
      this.iconButton('palette', '设置颜色', () => this.openColorDialog(folder)),
      this.iconButton('plus', '新建子文件夹', () => this.createFolder(folder.id)),
    ];

    if (this.featureEnabled('folderSearch')) {
      actionButtons.push(
        this.iconButton('search', '搜索文件夹', () => {
          if (this.openFolderSearchIds.has(folder.id)) {
            this.openFolderSearchIds.delete(folder.id);
            this.folderSearchQueries.delete(folder.id);
          } else {
            if (!folder.isExpanded) this.store.toggleFolder(folder.id);
            this.openFolderSearchIds.add(folder.id);
          }
          this.persistAndRender();
        }),
      );
    }

    actionButtons.push(this.iconButton('x', '删除文件夹', () => this.deleteFolder(folder.id)));

    const actions = document.createElement('div');
    actions.className = 'bd-row-actions';
    actions.append(...actionButtons);

    row.append(toggle, folderIcon, name, actions);
    block.append(row);

    const folderQuery = this.folderSearchQueries.get(folder.id) ?? '';

    const folderSearchOpen = this.openFolderSearchIds.has(folder.id);

    if (folder.isExpanded && this.featureEnabled('folderSearch') && folderSearchOpen) {
      const folderSearchInput = document.createElement('input');
      folderSearchInput.className = 'bd-folder-inner-search';
      folderSearchInput.type = 'search';
      folderSearchInput.placeholder = '搜索此文件夹';
      folderSearchInput.value = folderQuery;
      folderSearchInput.addEventListener('input', (event) => {
        if ((event as InputEvent).isComposing) return;
        this.folderSearchQueries.set(folder.id, folderSearchInput.value);
        if (!folderSearchInput.value) {
          this.openFolderSearchIds.delete(folder.id);
          this.folderSearchQueries.delete(folder.id);
        }
        this.render();
      });
      folderSearchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          this.openFolderSearchIds.delete(folder.id);
          this.folderSearchQueries.delete(folder.id);
          this.render();
        }
      });
      block.append(folderSearchInput);
    }

    if (folder.isExpanded || query || folderQuery) {
      for (const conversation of this.visibleConversations(folder.id, query, folderQuery)) {
        block.append(this.conversationElement(folder.id, conversation, level));
      }
      for (const child of this.visibleFoldersByParent(folder.id, query)) {
        block.append(this.folderElement(child, level + 1, query));
      }
      if (folderQuery && !this.visibleConversations(folder.id, query, folderQuery).length && this.visibleFoldersByParent(folder.id, query).length === 0) {
        const empty = document.createElement('div');
        empty.className = 'bd-folder-search-empty';
        empty.textContent = '没有匹配的会话。';
        block.append(empty);
      }
    }

    return block;
  }

  private visibleFoldersByParent(parentId: string | null, query: string, excludePinned = false): Folder[] {
    const folders = this.store.foldersByParent(parentId);
    const filtered = excludePinned ? folders.filter((folder) => !folder.pinned) : folders;
    if (!query) return filtered;

    return filtered.filter((folder) => this.folderMatchesSearch(folder, query));
  }

  private visibleConversations(folderId: string, query: string, folderQuery = ''): ConversationReference[] {
    const conversations = this.store.conversations(folderId);

    let filtered = conversations;
    if (query) filtered = filtered.filter((c) => this.textMatchesSearch(c.title, query));
    if (folderQuery) filtered = filtered.filter((c) => this.textMatchesSearch(c.title, folderQuery));

    return filtered;
  }

  private folderMatchesSearch(folder: Folder, query: string): boolean {
    if (this.textMatchesSearch(folder.name, query)) return true;
    if (this.visibleConversations(folder.id, query).length > 0) return true;

    const folderQuery = this.folderSearchQueries.get(folder.id) ?? '';
    if (folderQuery) return true;

    return this.store
      .foldersByParent(folder.id)
      .some((child) => this.folderMatchesSearch(child, query));
  }

  private textMatchesSearch(value: string, query: string): boolean {
    return value.trim().toLocaleLowerCase().includes(query);
  }

  private conversationElement(
    folderId: string,
    conversation: ConversationReference,
    level: number,
  ): HTMLElement {
    const current = currentConversation();
    const row = document.createElement('div');
    row.className = 'bd-conversation-row';
    row.classList.toggle('bd-current-conversation', current?.conversationId === conversation.conversationId);
    row.style.setProperty('--bd-level', String(level));
    row.draggable = true;
    row.title = conversation.title;

    row.addEventListener('click', () => navigateToConversation(conversation.url));
    row.addEventListener('dragstart', (event) => {
      const payload: ConversationDragPayload = {
        type: 'conversation',
        conversation,
        sourceFolderId: folderId,
      };
      event.dataTransfer?.setData(DRAG_MIME, JSON.stringify(payload));
    });
    if (this.featureEnabled('conversationReorder')) {
      this.makeConversationReorderTarget(row, folderId, conversation.conversationId);
    }

    const select = document.createElement('input');
    select.className = 'bd-conversation-select';
    select.type = 'checkbox';
    select.title = '选择会话';
    select.checked = this.isConversationSelected(conversation.conversationId);
    select.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    select.addEventListener('change', (event) => {
      event.stopPropagation();
      this.setConversationSelected(conversation, select.checked, folderId);
      this.refreshSelectionUi();
    });

    const chatIcon = this.iconElement('chat');
    chatIcon.classList.add('bd-chat-symbol');

    const title = document.createElement('span');
    title.className = 'bd-conversation-title';
    title.textContent = conversation.title;

    const pin = this.iconButton(
      this.store.isConversationPinned(conversation.conversationId) ? 'pinOff' : 'pin',
      this.store.isConversationPinned(conversation.conversationId) ? '取消置顶' : '置顶会话',
      (event) => {
        event.stopPropagation();
        this.store.togglePinnedConversation(conversation);
        this.persistAndRender();
      },
    );
    pin.classList.add('bd-conversation-pin');

    const remove = this.iconButton('x', '从文件夹移除', async (event) => {
      event.stopPropagation();
      const confirmed = await this.confirmDialog(
        `从文件夹移除“${conversation.title}”？不会删除 DeepSeek 原始会话。`,
      );
      if (!confirmed) return;
      this.store.removeConversation(folderId, conversation.conversationId);
      this.persistAndRender();
    });
    remove.classList.add('bd-conversation-remove');

    if (this.featureEnabled('multiSelect')) row.append(select);
    row.append(chatIcon, title, pin, remove);
    return row;
  }

  private makeFolderDropTarget(element: HTMLElement, folder: Folder): void {
    element.addEventListener('dragover', (event) => {
      if (!this.eventHasDragPayload(event)) return;

      event.preventDefault();
      const placement = this.featureEnabled('folderReorder')
        ? this.getFolderDropPlacement(event, element)
        : 'inside';
      element.classList.toggle('bd-reorder-before', placement === 'before');
      element.classList.toggle('bd-drop-target', placement === 'inside');
      element.classList.toggle('bd-reorder-after', placement === 'after');
    });

    element.addEventListener('dragleave', () => {
      this.clearFolderDropState(element);
    });

    element.addEventListener('drop', async (event) => {
      const payload = this.readDragPayload(event);
      const placement = this.featureEnabled('folderReorder')
        ? this.getFolderDropPlacement(event, element)
        : 'inside';
      this.clearFolderDropState(element);
      if (!payload) return;

      event.preventDefault();
      try {
        if (payload.type === 'conversation') {
          this.store.moveConversation(payload.sourceFolderId, folder.id, payload.conversation);
        } else if (placement === 'inside') {
          this.store.moveFolder(payload.folderId, folder.id);
        } else {
          this.store.moveFolderToPosition(
            payload.folderId,
            folder.parentId,
            folder.id,
            placement,
          );
        }
      } catch (error) {
        await this.alertDialog(error instanceof Error ? error.message : '绉诲姩澶辫触');
        return;
      }
      this.persistAndRender();
    });
  }

  private makeConversationReorderTarget(
    element: HTMLElement,
    folderId: string,
    targetConversationId: string,
  ): void {
    element.addEventListener('dragover', (event) => {
      if (!this.eventHasDragPayload(event)) return;
      event.preventDefault();

      const placement = this.getConversationDropPlacement(event, element);
      element.classList.toggle('bd-reorder-before', placement === 'before');
      element.classList.toggle('bd-reorder-after', placement === 'after');
    });

    element.addEventListener('dragleave', () => {
      this.clearConversationReorderState(element);
    });

    element.addEventListener('drop', (event) => {
      const payload = this.readDragPayload(event);
      this.clearConversationReorderState(element);
      if (!payload || payload.type !== 'conversation') return;
      if (payload.sourceFolderId === folderId && payload.conversation.conversationId === targetConversationId) return;

      event.preventDefault();
      this.store.moveConversationToPosition(
        payload.sourceFolderId,
        folderId,
        payload.conversation,
        targetConversationId,
        this.getConversationDropPlacement(event, element),
      );
      this.persistAndRender();
    });
  }

  private getConversationDropPlacement(event: DragEvent, element: HTMLElement): 'before' | 'after' {
    const rect = element.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  }

  private clearConversationReorderState(element: HTMLElement): void {
    element.classList.remove('bd-reorder-before', 'bd-reorder-after');
  }

  private getFolderDropPlacement(event: DragEvent, element: HTMLElement): 'before' | 'inside' | 'after' {
    const rect = element.getBoundingClientRect();
    const offset = event.clientY - rect.top;
    const edgeSize = Math.min(12, rect.height * 0.3);
    if (offset < edgeSize) return 'before';
    if (offset > rect.height - edgeSize) return 'after';
    return 'inside';
  }

  private clearFolderDropState(element: HTMLElement): void {
    element.classList.remove('bd-reorder-before', 'bd-drop-target', 'bd-reorder-after');
  }

  private eventHasDragPayload(event: DragEvent): boolean {
    const types = Array.from(event.dataTransfer?.types ?? []);
    return types.includes(DRAG_MIME) || types.includes('application/json');
  }

  private readDragPayload(event: DragEvent): DragPayload | null {
    const raw = event.dataTransfer?.getData(DRAG_MIME) || event.dataTransfer?.getData('application/json');
    if (!raw) return null;

    try {
      const payload = JSON.parse(raw) as DragPayload;
      return payload.type === 'conversation' || payload.type === 'folder' ? payload : null;
    } catch {
      return null;
    }
  }

  private async createFolder(parentId: string | null): Promise<void> {
    const name = await this.promptDialog(parentId ? '子文件夹名称' : '文件夹名称', '新文件夹');
    if (name === null) return;

    try {
      this.store.createFolder(name, parentId);
      this.persistAndRender();
    } catch (error) {
      await this.alertDialog(error instanceof Error ? error.message : '创建文件夹失败');
    }
  }

  private async renameFolder(folder: Folder): Promise<void> {
    const name = await this.promptDialog('重命名文件夹', folder.name);
    if (name === null) return;
    this.store.renameFolder(folder.id, name);
    this.persistAndRender();
  }

  private async deleteFolder(folderId: string): Promise<void> {
    const confirmed = await this.confirmDialog(
      '删除该文件夹及其子文件夹？文件夹内引用会一并移除，但不会删除 DeepSeek 原始会话。',
    );
    if (!confirmed) return;
    this.store.deleteFolder(folderId);
    this.persistAndRender();
  }

  private async moveSelectedConversations(): Promise<void> {
    if (!this.featureEnabled('multiSelect')) return;

    const selected = this.selectedItems();
    if (selected.length === 0) return;

    const targetFolderId = await this.selectTargetFolder();
    if (!targetFolderId) return;

    this.store.addConversations(
      targetFolderId,
      selected.map((item) => item.conversation),
    );
    this.clearSelection();
    this.persistAndRender();
  }

  private async removeSelectedConversations(): Promise<void> {
    if (!this.featureEnabled('multiSelect')) return;

    const selectedFromFolders = this.selectedItems().filter((item) => item.sourceFolderId);
    if (selectedFromFolders.length === 0) return;

    const confirmed = await this.confirmDialog(
      `从 Better DeepSeek 文件夹移除 ${selectedFromFolders.length} 个所选会话？不会删除 DeepSeek 原始会话。`,
    );
    if (!confirmed) return;

    const idsByFolder = new Map<string, string[]>();
    for (const item of selectedFromFolders) {
      const sourceFolderId = item.sourceFolderId;
      if (!sourceFolderId) continue;

      const ids = idsByFolder.get(sourceFolderId) ?? [];
      ids.push(item.conversation.conversationId);
      idsByFolder.set(sourceFolderId, ids);
      this.selectedConversations.delete(item.conversation.conversationId);
    }

    for (const [folderId, conversationIds] of idsByFolder) {
      this.store.removeConversations(folderId, conversationIds);
    }
    this.persistAndRender();
  }

  private async selectTargetFolder(): Promise<string | null> {
    const folders = this.flattenFolders();
    if (folders.length === 0) {
      return this.store.createFolder('默认').id;
    }

    return this.folderChoiceDialog('移动到文件夹', folders);
  }

  private flattenFolders(parentId: string | null = null, level = 0): Array<{ folder: Folder; level: number }> {
    const folders = this.store.foldersByParent(parentId);
    return folders.flatMap((folder) => [
      { folder, level },
      ...this.flattenFolders(folder.id, level + 1),
    ]);
  }

  private openColorDialog(folder: Folder): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'bd-dialog-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'bd-dialog';

      const title = document.createElement('div');
      title.className = 'bd-dialog-label';
      title.textContent = `设置“${folder.name}”颜色`;

      const grid = document.createElement('div');
      grid.className = 'bd-color-grid';

      for (const color of FOLDER_COLORS) {
        const button = document.createElement('button');
        button.className = 'bd-color-option';
        button.type = 'button';
        button.title = color.label;
        button.style.setProperty('--bd-color-option', color.value);
        button.classList.toggle('bd-color-option-active', (folder.color || DEFAULT_FOLDER_COLOR) === color.value);
        button.addEventListener('click', () => {
          this.store.setFolderColor(folder.id, color.value === DEFAULT_FOLDER_COLOR ? undefined : color.value);
          this.persistAndRender();
          overlay.remove();
          resolve();
        });
        grid.append(button);
      }

      const actions = document.createElement('div');
      actions.className = 'bd-dialog-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'bd-dialog-btn bd-dialog-cancel';
      cancelBtn.textContent = '取消';
      cancelBtn.addEventListener('click', () => {
        overlay.remove();
        resolve();
      });

      actions.append(cancelBtn);
      dialog.append(title, grid, actions);
      overlay.append(dialog);
      document.body.append(overlay);
    });
  }

  private folderChoiceDialog(
    labelText: string,
    folders: Array<{ folder: Folder; level: number }>,
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'bd-dialog-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'bd-dialog';

      const label = document.createElement('div');
      label.className = 'bd-dialog-label';
      label.textContent = labelText;

      const list = document.createElement('div');
      list.className = 'bd-folder-choice-list';

      const cleanup = (folderId: string | null) => {
        overlay.remove();
        resolve(folderId);
      };

      for (const { folder, level } of folders) {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'bd-folder-choice';
        option.style.setProperty('--bd-choice-level', String(level));
        option.textContent = folder.name;
        option.addEventListener('click', () => cleanup(folder.id));
        list.append(option);
      }

      const actions = document.createElement('div');
      actions.className = 'bd-dialog-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'bd-dialog-btn bd-dialog-cancel';
      cancelBtn.textContent = '取消';
      cancelBtn.addEventListener('click', () => cleanup(null));

      actions.append(cancelBtn);
      dialog.append(label, list, actions);
      overlay.append(dialog);
      document.body.append(overlay);
    });
  }

  private openSettingsDialog(): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'bd-dialog-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'bd-dialog';

      const title = document.createElement('div');
      title.className = 'bd-dialog-label';
      title.textContent = '文件夹设置';

      const row = document.createElement('label');
      row.className = 'bd-setting-row';

      const copy = document.createElement('span');
      copy.className = 'bd-setting-copy';
      copy.textContent = '收纳到文件夹后，隐藏外部历史对话';

      const input = document.createElement('input');
      input.className = 'bd-setting-checkbox';
      input.type = 'checkbox';
      input.checked = this.hideEnabled;

      const switchTrack = document.createElement('span');
      switchTrack.className = 'bd-setting-switch';
      switchTrack.append(input, document.createElement('span'));

      row.append(copy, switchTrack);

      const featureInputs = new Map<keyof FolderFeatureSettings, HTMLInputElement>();
      const featureList = document.createElement('div');
      featureList.className = 'bd-feature-settings';

      const currentFeatures = this.store.getSettings().features;
      const featureOptions: Array<{ key: keyof FolderFeatureSettings; label: string }> = [
        { key: 'pinFolders', label: '置顶文件夹' },
        { key: 'folderColors', label: '文件夹颜色' },
        { key: 'folderSearch', label: '文件夹搜索' },
        { key: 'folderExport', label: '导出文件夹' },
        { key: 'folderImport', label: '导入和备份' },
        { key: 'conversationReorder', label: '会话拖拽排序' },
        { key: 'folderReorder', label: '文件夹拖拽排序' },
        { key: 'multiSelect', label: '多选批量操作' },
      ];

      for (const option of featureOptions) {
        const featureRow = document.createElement('label');
        featureRow.className = 'bd-setting-row';

        const featureCopy = document.createElement('span');
        featureCopy.className = 'bd-setting-copy';
        featureCopy.textContent = option.label;

        const featureInput = document.createElement('input');
        featureInput.className = 'bd-setting-checkbox';
        featureInput.type = 'checkbox';
        featureInput.checked = Boolean(currentFeatures?.[option.key]);
        featureInputs.set(option.key, featureInput);

        const featureSwitch = document.createElement('span');
        featureSwitch.className = 'bd-setting-switch';
        featureSwitch.append(featureInput, document.createElement('span'));

        featureRow.append(featureCopy, featureSwitch);
        featureList.append(featureRow);
      }

      const exportButton = document.createElement('button');
      exportButton.className = 'bd-dialog-btn bd-dialog-secondary';
      exportButton.type = 'button';
      exportButton.textContent = '导出文件夹 JSON';
      exportButton.addEventListener('click', () => {
        this.exportFolders();
      });

      const importInput = document.createElement('input');
      importInput.type = 'file';
      importInput.accept = 'application/json,.json';
      importInput.className = 'bd-file-input';
      importInput.addEventListener('change', async () => {
        const file = importInput.files?.[0];
        if (!file) return;

        await this.importFoldersFromFile(file);
        overlay.remove();
        resolve();
      });

      const importButton = document.createElement('button');
      importButton.className = 'bd-dialog-btn bd-dialog-secondary';
      importButton.type = 'button';
      importButton.textContent = '导入文件夹 JSON';
      importButton.addEventListener('click', () => {
        importInput.click();
      });

      const restoreButton = document.createElement('button');
      restoreButton.className = 'bd-dialog-btn bd-dialog-secondary';
      restoreButton.type = 'button';
      restoreButton.textContent = '恢复导入前备份';
      restoreButton.disabled = !loadImportBackup();
      restoreButton.addEventListener('click', async () => {
        await this.restoreImportBackup();
        overlay.remove();
        resolve();
      });

      const actions = document.createElement('div');
      actions.className = 'bd-dialog-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'bd-dialog-btn bd-dialog-cancel';
      cancelBtn.textContent = '取消';

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'bd-dialog-btn bd-dialog-confirm';
      confirmBtn.textContent = '保存';

      const cleanup = () => {
        overlay.remove();
        resolve();
      };

      cancelBtn.addEventListener('click', cleanup);
      confirmBtn.addEventListener('click', () => {
        const features: FolderFeatureSettings = { ...this.store.getSettings().features! };
        for (const [key, featureInput] of featureInputs) {
          features[key] = featureInput.checked;
        }
        this.hideEnabled = input.checked;
        this.store.setSettings({ ...this.store.getSettings(), hideEnabled: this.hideEnabled, features });
        if (!features.multiSelect) this.clearSelection();
        if (!features.folderSearch) this.folderSearchQueries.clear();
        this.persistAndRender();
        cleanup();
      });

      actions.append(cancelBtn, confirmBtn);
      dialog.append(title, row, featureList);
      if (this.featureEnabled('folderExport')) dialog.append(exportButton);
      if (this.featureEnabled('folderImport')) dialog.append(importButton, restoreButton, importInput);
      dialog.append(actions);
      overlay.append(dialog);
      document.body.append(overlay);
    });
  }

  private exportFolders(): void {
    if (!this.featureEnabled('folderExport')) return;

    const payload = createFolderExportPayload(this.store.snapshot());
    downloadJson(payload, generateFolderExportFilename());
  }

  private async importFoldersFromFile(file: File): Promise<void> {
    if (!this.featureEnabled('folderImport')) return;

    try {
      const parsed = await readJsonFile(file);
      if (!isFolderExportPayload(parsed)) {
        await this.alertDialog('导入失败：请选择 Better DeepSeek 导出的文件夹 JSON。');
        return;
      }

      const snapshot = this.store.snapshot();
      saveImportBackup(snapshot);
      const result = mergeFolderImport(snapshot, parsed);
      this.store = new FolderStore(result.data);
      this.hideEnabled = this.store.getSettings().hideEnabled;
      this.persistAndRender();

      await this.alertDialog(
        `导入完成：新增 ${result.stats.foldersImported} 个文件夹，新增 ${result.stats.conversationsImported} 个会话。`,
      );
    } catch {
      await this.alertDialog('导入失败：文件不是有效 JSON。');
    }
  }

  private async restoreImportBackup(): Promise<void> {
    const backup = loadImportBackup();
    if (!backup) {
      await this.alertDialog('没有可恢复的导入前备份。');
      return;
    }

    this.store = new FolderStore(backup);
    this.hideEnabled = this.store.getSettings().hideEnabled;
    this.persistAndRender();
    await this.alertDialog('已恢复到上次导入前的文件夹数据。');
  }

  private promptDialog(title: string, initialValue: string): Promise<string | null> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'bd-dialog-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'bd-dialog';

      const label = document.createElement('div');
      label.className = 'bd-dialog-label';
      label.textContent = title;

      const input = document.createElement('input');
      input.className = 'bd-dialog-input';
      input.type = 'text';
      input.value = initialValue;

      const actions = document.createElement('div');
      actions.className = 'bd-dialog-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'bd-dialog-btn bd-dialog-cancel';
      cancelBtn.textContent = '取消';

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'bd-dialog-btn bd-dialog-confirm';
      confirmBtn.textContent = '确定';

      const cleanup = (result: string | null) => {
        overlay.remove();
        resolve(result);
      };

      cancelBtn.addEventListener('click', () => cleanup(null));
      confirmBtn.addEventListener('click', () => cleanup(input.value.trim() || null));
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') confirmBtn.click();
        if (event.key === 'Escape') cancelBtn.click();
      });

      actions.append(cancelBtn, confirmBtn);
      dialog.append(label, input, actions);
      overlay.append(dialog);
      document.body.append(overlay);

      requestAnimationFrame(() => input.focus());
    });
  }

  private confirmDialog(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'bd-dialog-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'bd-dialog';

      const label = document.createElement('div');
      label.className = 'bd-dialog-label';
      label.textContent = message;

      const actions = document.createElement('div');
      actions.className = 'bd-dialog-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'bd-dialog-btn bd-dialog-cancel';
      cancelBtn.textContent = '取消';

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'bd-dialog-btn bd-dialog-confirm';
      confirmBtn.textContent = '确定';

      const cleanup = (result: boolean) => {
        overlay.remove();
        resolve(result);
      };

      cancelBtn.addEventListener('click', () => cleanup(false));
      confirmBtn.addEventListener('click', () => cleanup(true));

      actions.append(cancelBtn, confirmBtn);
      dialog.append(label, actions);
      overlay.append(dialog);
      document.body.append(overlay);
    });
  }

  private alertDialog(message: string): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'bd-dialog-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'bd-dialog';

      const label = document.createElement('div');
      label.className = 'bd-dialog-label';
      label.textContent = message;

      const actions = document.createElement('div');
      actions.className = 'bd-dialog-actions';

      const okBtn = document.createElement('button');
      okBtn.className = 'bd-dialog-btn bd-dialog-confirm';
      okBtn.textContent = '确定';

      okBtn.addEventListener('click', () => {
        overlay.remove();
        resolve();
      });

      actions.append(okBtn);
      dialog.append(label, actions);
      overlay.append(dialog);
      document.body.append(overlay);
    });
  }

  private enhanceNativeConversationRows(): void {
    for (const anchor of findConversationAnchors()) {
      if (anchor.closest(`#${ROOT_ID}`)) continue;

      const conversation = conversationFromAnchor(anchor);
      if (!conversation) continue;

      if (anchor.dataset.bdEnhanced !== 'true') {
        anchor.dataset.bdEnhanced = 'true';
        anchor.draggable = true;
        anchor.addEventListener('dragstart', (event) => {
          const payload: ConversationDragPayload = { type: 'conversation', conversation };
          event.dataTransfer?.setData(DRAG_MIME, JSON.stringify(payload));
        });
      }

      const host = anchor.parentElement;
      if (!host) continue;

      const existingSelect = host.querySelector<HTMLInputElement>('.bd-native-select');
      if (this.featureEnabled('multiSelect')) {
        const select = existingSelect ?? document.createElement('input');
        if (!existingSelect) {
          select.className = 'bd-native-select';
          select.type = 'checkbox';
          select.title = '选择会话';
          select.addEventListener('click', (event) => {
            event.stopPropagation();
          });
          select.addEventListener('change', (event) => {
            event.stopPropagation();
            this.setConversationSelected(conversation, select.checked);
            this.refreshSelectionUi();
          });
          host.append(select);
        }
        select.checked = this.isConversationSelected(conversation.conversationId);
      } else {
        existingSelect?.remove();
      }

    }
  }

  private refreshNativeConversationVisibility(): void {
    const hiddenIds = this.store.conversationIdsInFolders();
    for (const pinned of this.store.pinnedConversations()) {
      hiddenIds.add(pinned.conversationId);
    }

    for (const element of document.querySelectorAll<HTMLElement>('[data-bd-native-hidden="true"]')) {
      const anchor = element.querySelector<HTMLAnchorElement>('a[href*="/chat/s/"]');
      const id = anchor ? extractConversationId(anchor.href) : null;
      const shouldHide = this.hideEnabled && Boolean(id && hiddenIds.has(id));
      element.classList.toggle('bd-native-hidden', shouldHide);
      if (!shouldHide) delete element.dataset.bdNativeHidden;
    }

    for (const anchor of findConversationAnchors()) {
      if (anchor.closest(`#${ROOT_ID}`)) continue;

      const id = extractConversationId(anchor.href);
      if (!id) continue;

      const row = findNativeConversationContainer(anchor);
      const shouldHide = this.hideEnabled && hiddenIds.has(id);
      row.classList.toggle('bd-native-hidden', shouldHide);
      if (shouldHide) row.dataset.bdNativeHidden = 'true';
      else delete row.dataset.bdNativeHidden;
    }
  }

  private observePageChanges(): void {
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => {
      if (this.observerTimer) return;
      this.observerTimer = window.setTimeout(() => {
        this.observerTimer = null;
        this.enhanceNativeConversationRows();
        this.refreshNativeConversationVisibility();
        const root = document.getElementById(ROOT_ID);
        const target = findFolderInsertionTarget();
        if (!root || (target && root.parentElement !== target.sidebar)) this.render();
      }, 60);
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  private listenNativePinClick(): void {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target) return;
      if (target.closest(`#${ROOT_ID}`)) return;
      const text = (target.textContent ?? '').trim();
      if (!/^置顶$/i.test(text)) return;
      const anchor = this.findConversationAnchorNear(target);
      if (!anchor) return;
      const conversation = conversationFromAnchor(anchor);
      if (!conversation) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.store.togglePinnedConversation(conversation);
      this.persistAndRender();
    }, true);
  }

  private findConversationAnchorNear(el: HTMLElement): HTMLAnchorElement | null {
    let current: HTMLElement | null = el;
    for (let i = 0; i < 10 && current; i++) {
      const anchor = current.querySelector<HTMLAnchorElement>('a[href*="/chat/s/"]');
      if (anchor) return anchor;
      current = current.parentElement;
    }
    return null;
  }

  private persistAndRender(): void {
    this.render();
    this.enhanceNativeConversationRows();
    this.refreshNativeConversationVisibility();
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      void this.storage.save(this.store.snapshot());
    }, 80);
  }

  private iconButton(
    icon: IconName,
    title: string,
    onClick: (event: MouseEvent) => void | Promise<void>,
    active = false,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'bd-icon-button';
    button.classList.toggle('bd-icon-button-active', active);
    button.type = 'button';
    button.title = title;
    button.append(this.iconElement(icon));
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void onClick(event);
    });
    return button;
  }

  private iconElement(icon: IconName): SVGSVGElement {
    const wrapper = document.createElement('span');
    wrapper.innerHTML = ICONS[icon];
    return wrapper.firstElementChild as SVGSVGElement;
  }
}

type IconName =
  | 'chat'
  | 'chevronDown'
  | 'chevronRight'
  | 'folder'
  | 'library'
  | 'palette'
  | 'pin'
  | 'pinOff'
  | 'plus'
  | 'search'
  | 'settings'
  | 'x';

const baseIconAttrs =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const ICONS: Record<IconName, string> = {
  chat: `<svg ${baseIconAttrs}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`,
  chevronDown: `<svg ${baseIconAttrs}><path d="m6 9 6 6 6-6"/></svg>`,
  chevronRight: `<svg ${baseIconAttrs}><path d="m9 6 6 6-6 6"/></svg>`,
  folder: `<svg ${baseIconAttrs}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
  library: `<svg ${baseIconAttrs}><path d="M4 19.5V5a2 2 0 0 1 2-2h11"/><path d="M8 7h11v14H8a4 4 0 0 1 0-8h11"/><path d="M8 7v6"/></svg>`,
  palette: `<svg ${baseIconAttrs}><path d="M12 22a10 10 0 1 1 10-10 3 3 0 0 1-3 3h-1.5a2 2 0 0 0-1.7 3l.2.3a2.5 2.5 0 0 1-2.1 3.7z"/><circle cx="7.5" cy="10.5" r=".5"/><circle cx="10.5" cy="7.5" r=".5"/><circle cx="14.5" cy="7.5" r=".5"/><circle cx="16.5" cy="11.5" r=".5"/></svg>`,
  pin: `<svg ${baseIconAttrs}><path d="M12 17v5"/><path d="M5 17h14"/><path d="M15 3.6 14 10l3 3v4H7v-4l3-3-.9-6.4A1 1 0 0 1 10.1 2h3.8a1 1 0 0 1 1.1 1.6z"/></svg>`,
  pinOff: `<svg ${baseIconAttrs}><path d="m3 3 18 18"/><path d="M12 17v5"/><path d="M5 17h12"/><path d="M10 4 9.5 7.5"/><path d="M14.5 10.5 17 13v4H7v-4l2-2"/><path d="M14 2a1 1 0 0 1 1 1.2L14 10"/></svg>`,
  plus: `<svg ${baseIconAttrs}><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
  search: `<svg ${baseIconAttrs}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  settings: `<svg ${baseIconAttrs}><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 0 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 0 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 0 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  x: `<svg ${baseIconAttrs}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
};

void new BetterDeepSeekFolders().mount();
