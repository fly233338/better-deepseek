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
  findConversationAnchors,
  findSidebar,
  navigateToConversation,
} from '../deepseek/adapter';

const ROOT_ID = 'better-deepseek-folders';
const DRAG_MIME = 'application/x-better-deepseek';

class BetterDeepSeekFolders {
  private readonly storage = new ExtensionFolderStorage();
  private store = new FolderStore();
  private observer: MutationObserver | null = null;
  private saveTimer: number | null = null;

  async mount(): Promise<void> {
    this.store = new FolderStore(await this.storage.load());
    this.render();
    this.enhanceNativeConversationRows();
    this.observePageChanges();
  }

  private render(): void {
    const sidebar = findSidebar();
    const root = this.ensureRoot(sidebar);
    root.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'bd-folder-header';

    const title = document.createElement('div');
    title.className = 'bd-folder-title';
    title.textContent = 'Better DeepSeek';

    const actions = document.createElement('div');
    actions.className = 'bd-folder-actions';
    actions.append(
      this.button('+', '新建文件夹', () => this.createFolder(null)),
      this.button('当前', '保存当前会话到第一个文件夹', () => this.addCurrentConversation()),
    );

    header.append(title, actions);
    root.append(header);

    const list = document.createElement('div');
    list.className = 'bd-folder-list';
    root.append(list);

    const folders = this.store.foldersByParent(null);
    if (folders.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bd-empty';
      empty.textContent = '新建文件夹后，可拖入 DeepSeek 历史会话。';
      list.append(empty);
      return;
    }

    for (const folder of folders) {
      list.append(this.folderElement(folder, 0));
    }
  }

  private ensureRoot(sidebar: HTMLElement | null): HTMLElement {
    const existing = document.getElementById(ROOT_ID);
    if (existing) {
      existing.classList.toggle('bd-floating', !sidebar);
      return existing;
    }

    const root = document.createElement('section');
    root.id = ROOT_ID;
    root.className = 'bd-folder-root';

    if (sidebar) {
      sidebar.prepend(root);
    } else {
      root.classList.add('bd-floating');
      document.documentElement.append(root);
    }

    return root;
  }

  private folderElement(folder: Folder, level: number): HTMLElement {
    const block = document.createElement('div');
    block.className = 'bd-folder-block';
    block.dataset.folderId = folder.id;

    const row = document.createElement('div');
    row.className = 'bd-folder-row';
    row.style.paddingLeft = `${level * 14 + 4}px`;
    row.draggable = true;
    row.title = '拖入会话，或双击改名';

    row.addEventListener('dragstart', (event) => {
      const payload: DragPayload = { type: 'folder', folderId: folder.id };
      event.dataTransfer?.setData(DRAG_MIME, JSON.stringify(payload));
    });
    this.makeConversationDropTarget(row, folder.id);

    const toggle = this.button(folder.isExpanded ? '▾' : '▸', '展开/收起', () => {
      this.store.toggleFolder(folder.id);
      this.persistAndRender();
    });

    const name = document.createElement('span');
    name.className = 'bd-folder-name';
    name.textContent = folder.name;
    name.addEventListener('dblclick', () => this.renameFolder(folder));

    const actions = document.createElement('div');
    actions.className = 'bd-folder-actions';
    actions.append(
      this.button('+', '新建子文件夹', () => this.createFolder(folder.id)),
      this.button('当前', '保存当前会话', () => this.addCurrentConversation(folder.id)),
      this.button('×', '删除文件夹', () => this.deleteFolder(folder.id)),
    );

    row.append(toggle, name, actions);
    block.append(row);

    if (folder.isExpanded) {
      for (const conversation of this.store.conversations(folder.id)) {
        block.append(this.conversationElement(folder.id, conversation));
      }
      for (const child of this.store.foldersByParent(folder.id)) {
        block.append(this.folderElement(child, level + 1));
      }
    }

    return block;
  }

  private conversationElement(folderId: string, conversation: ConversationReference): HTMLElement {
    const row = document.createElement('div');
    row.className = 'bd-conversation-row';
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

    const title = document.createElement('span');
    title.className = 'bd-conversation-title';
    title.textContent = conversation.title;

    const remove = this.button('×', '从文件夹移除', (event) => {
      event.stopPropagation();
      this.store.removeConversation(folderId, conversation.conversationId);
      this.persistAndRender();
    });

    row.append(title, remove);
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

    element.addEventListener('drop', (event) => {
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
        alert(error instanceof Error ? error.message : '移动失败');
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

  private createFolder(parentId: string | null): void {
    const name = prompt(parentId ? '子文件夹名称' : '文件夹名称', '新文件夹');
    if (name === null) return;

    try {
      this.store.createFolder(name, parentId);
      this.persistAndRender();
    } catch (error) {
      alert(error instanceof Error ? error.message : '创建文件夹失败');
    }
  }

  private renameFolder(folder: Folder): void {
    const name = prompt('重命名文件夹', folder.name);
    if (name === null) return;
    this.store.renameFolder(folder.id, name);
    this.persistAndRender();
  }

  private deleteFolder(folderId: string): void {
    if (!confirm('删除该文件夹及其子文件夹？文件夹内引用会一并移除，但不会删除 DeepSeek 原始会话。')) {
      return;
    }
    this.store.deleteFolder(folderId);
    this.persistAndRender();
  }

  private addCurrentConversation(preferredFolderId?: string): void {
    const conversation = currentConversation();
    if (!conversation) {
      alert('当前页面不是 DeepSeek 会话页。');
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

  private enhanceNativeConversationRows(): void {
    for (const anchor of findConversationAnchors()) {
      if (anchor.dataset.bdEnhanced === 'true') continue;
      const conversation = conversationFromAnchor(anchor);
      if (!conversation) continue;

      anchor.dataset.bdEnhanced = 'true';
      anchor.draggable = true;
      anchor.addEventListener('dragstart', (event) => {
        const payload: ConversationDragPayload = { type: 'conversation', conversation };
        event.dataTransfer?.setData(DRAG_MIME, JSON.stringify(payload));
      });

      const button = document.createElement('button');
      button.className = 'bd-native-save-button';
      button.type = 'button';
      button.textContent = '+';
      button.title = '保存到 Better DeepSeek 第一个文件夹';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.addNativeConversation(conversation);
      });

      const host = anchor.parentElement;
      if (host && !host.querySelector('.bd-native-save-button')) host.append(button);
    }
  }

  private addNativeConversation(conversation: ConversationReference): void {
    const folder = this.store.foldersByParent(null)[0] ?? this.store.createFolder('默认');
    this.store.addConversation(folder.id, conversation);
    this.persistAndRender();
  }

  private observePageChanges(): void {
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => {
      this.enhanceNativeConversationRows();
      if (!document.getElementById(ROOT_ID)) this.render();
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  private persistAndRender(): void {
    this.render();
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      void this.storage.save(this.store.snapshot());
    }, 80);
  }

  private button(label: string, title: string, onClick: (event: MouseEvent) => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'bd-button';
    button.type = 'button';
    button.textContent = label;
    button.title = title;
    button.addEventListener('click', onClick);
    return button;
  }
}

void new BetterDeepSeekFolders().mount();
