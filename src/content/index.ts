import './styles.css';

import { FolderStore } from '../core/folderStore';
import { ExtensionFolderStorage } from '../core/storage';
import type {
  ConversationDragPayload,
  ConversationReference,
  DragPayload,
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

class BetterDeepSeekFolders {
  private readonly storage = new ExtensionFolderStorage();
  private store = new FolderStore();
  private observer: MutationObserver | null = null;
  private saveTimer: number | null = null;
  private searchTimer: number | null = null;
  private searchQuery = '';
  private hideEnabled = true;

  async mount(): Promise<void> {
    this.store = new FolderStore(await this.storage.load());
    this.hideEnabled = this.store.getSettings().hideEnabled;
    this.render();
    this.enhanceNativeConversationRows();
    this.refreshNativeConversationVisibility();
    this.observePageChanges();
  }

  private render(): void {
    const root = this.ensureRoot();
    if (!root) return;

    const query = this.normalizedSearchQuery();
    root.innerHTML = '';
    root.append(this.headerElement());

    const list = document.createElement('div');
    list.className = 'bd-folder-list';
    root.append(list);

    const folders = this.visibleFoldersByParent(null, query);
    if (folders.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bd-empty';
      empty.textContent = query ? '没有匹配的文件夹或会话。' : '新建文件夹后，可拖入 DeepSeek 历史会话。';
      list.append(empty);
      return;
    }

    for (const folder of folders) {
      list.append(this.folderElement(folder, 0, query));
    }
  }

  private headerElement(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'bd-folder-header';

    const title = document.createElement('div');
    title.className = 'bd-folder-title';
    title.textContent = '文件夹';

    const actions = document.createElement('div');
    actions.className = 'bd-folder-toolbar';
    actions.append(
      this.iconButton('settings', '设置', () => this.openSettingsDialog()),
      this.iconButton('plus', '新建文件夹', () => this.createFolder(null)),
    );

    const search = document.createElement('input');
    search.className = 'bd-folder-search';
    search.type = 'search';
    search.placeholder = '搜索文件夹和会话';
    search.value = this.searchQuery;
    search.addEventListener('input', () => {
      if (this.searchTimer) window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => {
        this.searchQuery = search.value;
        this.render();
      }, 150);
    });

    header.append(title, actions, search);
    return header;
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
    block.style.setProperty('--bd-folder-accent', folder.color || DEFAULT_FOLDER_COLOR);

    const row = document.createElement('div');
    row.className = 'bd-folder-row';
    row.style.setProperty('--bd-level', String(level));
    row.draggable = true;
    row.title = '拖入会话，或双击改名';

    row.addEventListener('dragstart', (event) => {
      const payload: DragPayload = { type: 'folder', folderId: folder.id };
      event.dataTransfer?.setData(DRAG_MIME, JSON.stringify(payload));
    });
    this.makeConversationDropTarget(row, folder.id);

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

    const actions = document.createElement('div');
    actions.className = 'bd-row-actions';
    actions.append(
      this.iconButton(folder.pinned ? 'pinOff' : 'pin', folder.pinned ? '取消置顶' : '置顶文件夹', () => {
        this.store.togglePinned(folder.id);
        this.persistAndRender();
      }),
      this.iconButton('palette', '设置颜色', () => this.openColorDialog(folder)),
      this.iconButton('plus', '新建子文件夹', () => this.createFolder(folder.id)),
      this.iconButton('chat', '保存当前会话', () => this.addCurrentConversation(folder.id)),
      this.iconButton('x', '删除文件夹', () => this.deleteFolder(folder.id)),
    );

    row.append(toggle, folderIcon, name, actions);
    block.append(row);

    if (folder.isExpanded || query) {
      for (const conversation of this.visibleConversations(folder.id, query)) {
        block.append(this.conversationElement(folder.id, conversation, level));
      }
      for (const child of this.visibleFoldersByParent(folder.id, query)) {
        block.append(this.folderElement(child, level + 1, query));
      }
    }

    return block;
  }

  private visibleFoldersByParent(parentId: string | null, query: string): Folder[] {
    const folders = this.store.foldersByParent(parentId);
    if (!query) return folders;

    return folders.filter((folder) => this.folderMatchesSearch(folder, query));
  }

  private visibleConversations(folderId: string, query: string): ConversationReference[] {
    const conversations = this.store.conversations(folderId);
    if (!query) return conversations;

    return conversations.filter((conversation) => this.textMatchesSearch(conversation.title, query));
  }

  private folderMatchesSearch(folder: Folder, query: string): boolean {
    if (this.textMatchesSearch(folder.name, query)) return true;
    if (this.visibleConversations(folder.id, query).length > 0) return true;

    return this.store
      .foldersByParent(folder.id)
      .some((child) => this.folderMatchesSearch(child, query));
  }

  private textMatchesSearch(value: string, query: string): boolean {
    return value.trim().toLocaleLowerCase().includes(query);
  }

  private normalizedSearchQuery(): string {
    return this.searchQuery.trim().toLocaleLowerCase();
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

    const chatIcon = this.iconElement('chat');
    chatIcon.classList.add('bd-chat-symbol');

    const title = document.createElement('span');
    title.className = 'bd-conversation-title';
    title.textContent = conversation.title;

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

    row.append(chatIcon, title, remove);
    return row;
  }

  private makeConversationDropTarget(element: HTMLElement, folderId: string): void {
    element.addEventListener('dragover', (event) => {
      if (this.eventHasDragPayload(event)) {
        event.preventDefault();
        element.classList.add('bd-drop-target');
      }
    });

    element.addEventListener('dragleave', () => {
      element.classList.remove('bd-drop-target');
    });

    element.addEventListener('drop', async (event) => {
      const payload = this.readDragPayload(event);
      element.classList.remove('bd-drop-target');
      if (!payload) return;

      event.preventDefault();
      try {
        if (payload.type === 'conversation') {
          this.store.moveConversation(payload.sourceFolderId, folderId, payload.conversation);
        } else {
          this.store.moveFolder(payload.folderId, folderId);
        }
      } catch (error) {
        await this.alertDialog(error instanceof Error ? error.message : '移动失败');
        return;
      }
      this.persistAndRender();
    });
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

  private async addCurrentConversation(preferredFolderId?: string): Promise<void> {
    const conversation = currentConversation();
    if (!conversation) {
      await this.alertDialog('当前页面不是 DeepSeek 会话页。');
      return;
    }

    const targetFolderId = preferredFolderId ?? this.store.foldersByParent(null)[0]?.id;
    if (!targetFolderId) {
      const folder = this.store.createFolder('默认');
      this.store.addConversation(folder.id, conversation);
    } else {
      this.store.addConversation(targetFolderId, conversation);
    }
    this.persistAndRender();
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
        this.hideEnabled = input.checked;
        this.store.setSettings({ hideEnabled: this.hideEnabled });
        this.persistAndRender();
        cleanup();
      });

      actions.append(cancelBtn, confirmBtn);
      dialog.append(title, row, actions);
      overlay.append(dialog);
      document.body.append(overlay);
    });
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
      if (!host || host.querySelector('.bd-native-save-button')) continue;

      const button = this.iconButton('plus', '保存到第一个 Better DeepSeek 文件夹', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.addNativeConversation(conversation);
      });
      button.classList.add('bd-native-save-button');
      host.append(button);
    }
  }

  private addNativeConversation(conversation: ConversationReference): void {
    const folder = this.store.foldersByParent(null)[0] ?? this.store.createFolder('默认');
    this.store.addConversation(folder.id, conversation);
    this.persistAndRender();
  }

  private refreshNativeConversationVisibility(): void {
    const hiddenIds = this.store.conversationIdsInFolders();

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
      this.enhanceNativeConversationRows();
      this.refreshNativeConversationVisibility();
      const root = document.getElementById(ROOT_ID);
      const target = findFolderInsertionTarget();
      if (!root || (target && root.parentElement !== target.sidebar)) this.render();
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
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
  | 'palette'
  | 'pin'
  | 'pinOff'
  | 'plus'
  | 'settings'
  | 'x';

const baseIconAttrs =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const ICONS: Record<IconName, string> = {
  chat: `<svg ${baseIconAttrs}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`,
  chevronDown: `<svg ${baseIconAttrs}><path d="m6 9 6 6 6-6"/></svg>`,
  chevronRight: `<svg ${baseIconAttrs}><path d="m9 6 6 6-6 6"/></svg>`,
  folder: `<svg ${baseIconAttrs}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
  palette: `<svg ${baseIconAttrs}><path d="M12 22a10 10 0 1 1 10-10 3 3 0 0 1-3 3h-1.5a2 2 0 0 0-1.7 3l.2.3a2.5 2.5 0 0 1-2.1 3.7z"/><circle cx="7.5" cy="10.5" r=".5"/><circle cx="10.5" cy="7.5" r=".5"/><circle cx="14.5" cy="7.5" r=".5"/><circle cx="16.5" cy="11.5" r=".5"/></svg>`,
  pin: `<svg ${baseIconAttrs}><path d="M12 17v5"/><path d="M5 17h14"/><path d="M15 3.6 14 10l3 3v4H7v-4l3-3-.9-6.4A1 1 0 0 1 10.1 2h3.8a1 1 0 0 1 1.1 1.6z"/></svg>`,
  pinOff: `<svg ${baseIconAttrs}><path d="m3 3 18 18"/><path d="M12 17v5"/><path d="M5 17h12"/><path d="M10 4 9.5 7.5"/><path d="M14.5 10.5 17 13v4H7v-4l2-2"/><path d="M14 2a1 1 0 0 1 1 1.2L14 10"/></svg>`,
  plus: `<svg ${baseIconAttrs}><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
  settings: `<svg ${baseIconAttrs}><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 0 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 0 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 0 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  x: `<svg ${baseIconAttrs}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
};

void new BetterDeepSeekFolders().mount();
