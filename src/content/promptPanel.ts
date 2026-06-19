import type { PromptFilter, PromptId, PromptItem, PromptSourceItem } from '../core/promptTypes';
import type { PromptStore } from '../core/promptStore';
import { fillComposerText, findComposerInput } from '../deepseek/composer';
import {
  createExportPayload,
  downloadJson,
  generateExportFilename,
  parseBetterDeepSeekJson,
  parseCsv,
  parseMarkdown,
  readJsonFile,
} from '../core/promptImportExport';
import { getSourceList, loadSource } from './promptSources';

const PANEL_CLASS = 'bd-prompt-panel';

export type PanelCloseCallback = () => void;

export class PromptPanel {
  private readonly store: PromptStore;
  private readonly onClose: PanelCloseCallback;
  private readonly onPersist: () => void;
  private container: HTMLElement | null = null;

  private searchQuery = '';
  private activeFilter: PromptFilter = 'all';
  private selectedId: PromptId | null = null;
  private activeTag: string | null = null;
  private editingId: PromptId | null = null;
  private isNew = false;
  private sourceMode: 'library' | 'source' | 'import' = 'library';
  private sourcePack: PromptSourceItem[] = [];
  private selectedSourceIndex: number | null = null;

  constructor(store: PromptStore, onClose: PanelCloseCallback, onPersist: () => void) {
    this.store = store;
    this.onClose = onClose;
    this.onPersist = onPersist;
  }

  open(): void {
    this.close();
    this.container = this.buildPanel();
    document.body.append(this.container);
  }

  close(): void {
    this.container?.remove();
    this.container = null;
    this.editingId = null;
    this.isNew = false;
    this.onClose();
  }

  /* ======== helpers ======== */

  private filtered(): PromptItem[] {
    return this.store.filteredPrompts(this.activeFilter, this.searchQuery, this.activeTag ?? undefined);
  }

  /* ======== layout ======== */

  private buildPanel(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = `${PANEL_CLASS}-overlay`;

    const panel = document.createElement('div');
    panel.className = `${PANEL_CLASS} ${PANEL_CLASS}-v1`;
    panel.addEventListener('click', (event) => event.stopPropagation());
    overlay.addEventListener('click', () => this.close());

    panel.append(this.buildHeader(), this.buildBody());
    overlay.append(panel);
    return overlay;
  }

  private buildHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'bd-pp-header';

    const title = document.createElement('span');
    title.className = 'bd-pp-title';
    title.textContent = '提示词库';

    const search = document.createElement('input');
    search.className = 'bd-pp-search';
    search.type = 'search';
    search.placeholder = '搜索...';
    search.value = this.searchQuery;
    search.addEventListener('input', () => {
      this.searchQuery = search.value;
      this.selectedId = null;
      this.renderBody();
    });

    const newBtn = document.createElement('button');
    newBtn.className = 'bd-pp-action-btn';
    newBtn.type = 'button';
    newBtn.textContent = '新建';
    newBtn.addEventListener('click', () => this.startCreate());

    const exportBtn = document.createElement('button');
    exportBtn.className = 'bd-pp-action-btn';
    exportBtn.type = 'button';
    exportBtn.textContent = '导出';
    exportBtn.addEventListener('click', () => this.exportAll());

    const importBtn = document.createElement('button');
    importBtn.className = 'bd-pp-action-btn';
    importBtn.type = 'button';
    importBtn.textContent = '导入/来源';
    importBtn.addEventListener('click', () => this.showSourcePicker());

    const closeBtn = document.createElement('button');
    closeBtn.className = 'bd-pp-close-btn';
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.close());

    header.append(title, search, newBtn, exportBtn, importBtn, closeBtn);
    return header;
  }

  private buildBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'bd-pp-body';

    if (this.sourceMode === 'library') {
      body.append(this.buildSidebar(), this.buildList(), this.buildDetail());
    } else {
      body.append(this.buildSourceView());
    }

    return body;
  }

  private buildSidebar(): HTMLElement {
    const sidebar = document.createElement('div');
    sidebar.className = 'bd-pp-sidebar';

    const filters: Array<{ id: PromptFilter; label: string }> = [
      { id: 'all', label: '全部' },
      { id: 'favorites', label: '收藏' },
      { id: 'builtin', label: '内置' },
      { id: 'user', label: '自建' },
    ];

    for (const f of filters) {
      const btn = document.createElement('button');
      btn.className = 'bd-pp-filter-btn';
      btn.type = 'button';
      btn.textContent = f.label;
      btn.classList.toggle('bd-pp-filter-active', this.activeFilter === f.id);
      btn.addEventListener('click', () => {
        this.activeFilter = f.id;
        this.selectedId = null;
        this.activeTag = null;
        this.renderBody();
      });
      sidebar.append(btn);
    }

    const sep = document.createElement('div');
    sep.className = 'bd-pp-sidebar-sep';
    sidebar.append(sep);

    const allTags = this.store.allTags();
    for (const tag of allTags) {
      const tagBtn = document.createElement('button');
      tagBtn.className = 'bd-pp-tag-btn';
      tagBtn.type = 'button';
      tagBtn.textContent = tag;
      tagBtn.classList.toggle('bd-pp-tag-active', this.activeTag === tag);
      tagBtn.addEventListener('click', () => {
        this.activeTag = this.activeTag === tag ? null : tag;
        this.selectedId = null;
        this.renderBody();
      });
      sidebar.append(tagBtn);
    }

    return sidebar;
  }

  private buildList(): HTMLElement {
    const list = document.createElement('div');
    list.className = 'bd-pp-list';

    const prompts = this.filtered();
    if (prompts.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bd-pp-empty';
      empty.textContent = this.searchQuery ? '没有匹配的提示词' : '点击"新建"创建第一个提示词';
      list.append(empty);
      return list;
    }

    for (const prompt of prompts) {
      list.append(this.buildCard(prompt));
    }

    return list;
  }

  private buildCard(prompt: PromptItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bd-pp-card';
    card.classList.toggle('bd-pp-card-selected', this.selectedId === prompt.id);
    card.addEventListener('click', () => {
      this.selectedId = prompt.id;
      this.renderBody();
    });

    const header = document.createElement('div');
    header.className = 'bd-pp-card-header';

    const title = document.createElement('span');
    title.className = 'bd-pp-card-title';
    title.textContent = prompt.title;

    const meta = document.createElement('span');
    meta.className = 'bd-pp-card-meta';

    if (prompt.favorite) {
      const star = document.createElement('span');
      star.className = 'bd-pp-star';
      star.textContent = '★';
      meta.append(star);
    }

    if (prompt.source === 'builtin') {
      const badge = document.createElement('span');
      badge.className = 'bd-pp-badge';
      badge.textContent = '内置';
      meta.append(badge);
    }

    header.append(title, meta);

    const desc = document.createElement('div');
    desc.className = 'bd-pp-card-desc';
    desc.textContent = prompt.description;

    const tagsRow = document.createElement('div');
    tagsRow.className = 'bd-pp-card-tags';
    for (const tag of prompt.tags) {
      const t = document.createElement('span');
      t.className = 'bd-pp-tag-pill';
      t.textContent = tag;
      tagsRow.append(t);
    }

    card.append(header, desc, tagsRow);
    return card;
  }

  private buildDetail(): HTMLElement {
    const detail = document.createElement('div');
    detail.className = 'bd-pp-detail';

    const prompt = this.selectedId ? this.store.get(this.selectedId) : null;

    if (this.isNew || (this.editingId && !prompt)) {
      detail.append(this.buildEditor(null));
      return detail;
    }

    if (this.editingId && prompt) {
      detail.append(this.buildEditor(prompt));
      return detail;
    }

    if (!prompt) {
      const placeholder = document.createElement('div');
      placeholder.className = 'bd-pp-detail-placeholder';
      placeholder.textContent = '选择左侧提示词查看详情';
      detail.append(placeholder);
      return detail;
    }

    const header = document.createElement('div');
    header.className = 'bd-pp-detail-header';

    const title = document.createElement('div');
    title.className = 'bd-pp-detail-title';
    title.textContent = prompt.title;

    const meta = document.createElement('div');
    meta.className = 'bd-pp-detail-meta';

    const usedText = prompt.lastUsedAt
      ? `使用 ${prompt.usageCount} 次 · 最后 ${new Date(prompt.lastUsedAt).toLocaleDateString()}`
      : prompt.usageCount > 0
        ? `使用 ${prompt.usageCount} 次`
        : '未使用';

    meta.textContent = `${prompt.source === 'builtin' ? '内置 · ' : '自建 · '}${usedText}`;

    header.append(title, meta);

    const content = document.createElement('div');
    content.className = 'bd-pp-detail-content';
    content.textContent = prompt.content;

    const tagsRow = document.createElement('div');
    tagsRow.className = 'bd-pp-detail-tags';
    for (const tag of prompt.tags) {
      const t = document.createElement('span');
      t.className = 'bd-pp-tag-pill';
      t.textContent = tag;
      tagsRow.append(t);
    }

    const actions = document.createElement('div');
    actions.className = 'bd-pp-detail-actions';

    const useBtn = document.createElement('button');
    useBtn.className = 'bd-pp-use-btn';
    useBtn.type = 'button';
    useBtn.textContent = '使用';
    useBtn.addEventListener('click', () => this.usePrompt(prompt));

    const favBtn = document.createElement('button');
    favBtn.className = 'bd-pp-action-btn';
    favBtn.type = 'button';
    favBtn.textContent = prompt.favorite ? '★ 已收藏' : '☆ 收藏';
    favBtn.addEventListener('click', () => {
      this.store.toggleFavorite(prompt.id);
      this.onPersist();
      this.renderBody();
    });

    const editBtn = document.createElement('button');
    editBtn.className = 'bd-pp-action-btn';
    editBtn.type = 'button';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', () => {
      this.editingId = prompt.id;
      this.renderBody();
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'bd-pp-action-btn';
    copyBtn.type = 'button';
    copyBtn.textContent = '复制';
    copyBtn.addEventListener('click', () => {
      this.store.duplicate(prompt.id);
      this.onPersist();
      this.renderBody();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'bd-pp-action-btn bd-pp-danger-btn';
    deleteBtn.type = 'button';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', () => {
      this.store.delete(prompt.id);
      if (this.selectedId === prompt.id) this.selectedId = null;
      this.onPersist();
      this.renderBody();
    });

    actions.append(useBtn, favBtn, editBtn, copyBtn, deleteBtn);

    detail.append(header, content, tagsRow, actions);
    return detail;
  }

  private buildEditor(prompt: PromptItem | null): HTMLElement {
    const form = document.createElement('div');
    form.className = 'bd-pp-editor';

    const heading = document.createElement('div');
    heading.className = 'bd-pp-editor-heading';
    heading.textContent = prompt ? '编辑提示词' : '新建提示词';

    const titleInput = document.createElement('input');
    titleInput.className = 'bd-pp-editor-input';
    titleInput.type = 'text';
    titleInput.placeholder = '标题';
    titleInput.value = prompt?.title ?? '';

    const descInput = document.createElement('input');
    descInput.className = 'bd-pp-editor-input';
    descInput.type = 'text';
    descInput.placeholder = '描述（可选）';
    descInput.value = prompt?.description ?? '';

    const contentInput = document.createElement('textarea');
    contentInput.className = 'bd-pp-editor-textarea';
    contentInput.placeholder = '提示词内容，用 {{变量名}} 标记变量';
    contentInput.value = prompt?.content ?? '';
    contentInput.rows = 8;

    const tagsInput = document.createElement('input');
    tagsInput.className = 'bd-pp-editor-input';
    tagsInput.type = 'text';
    tagsInput.placeholder = '标签，逗号分隔';
    tagsInput.value = prompt?.tags.join(', ') ?? '';

    const favLabel = document.createElement('label');
    favLabel.className = 'bd-pp-editor-check';
    const favCheck = document.createElement('input');
    favCheck.type = 'checkbox';
    favCheck.checked = prompt?.favorite ?? false;
    favLabel.append(favCheck, document.createTextNode(' 收藏'));

    const actions = document.createElement('div');
    actions.className = 'bd-pp-detail-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'bd-pp-use-btn';
    saveBtn.type = 'button';
    saveBtn.textContent = '保存';
    saveBtn.addEventListener('click', () => {
      const title = titleInput.value.trim();
      if (!title) {
        titleInput.focus();
        return;
      }
      const tags = tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean);

      if (prompt) {
        this.store.update(prompt.id, {
          title,
          description: descInput.value,
          content: contentInput.value,
          tags,
          favorite: favCheck.checked,
        });
      } else {
        this.store.create({
          title,
          description: descInput.value,
          content: contentInput.value,
          tags,
          favorite: favCheck.checked,
        });
      }

      this.editingId = null;
      this.isNew = false;
      this.onPersist();
      this.renderBody();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'bd-pp-action-btn';
    cancelBtn.type = 'button';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', () => {
      this.editingId = null;
      this.isNew = false;
      this.renderBody();
    });

    actions.append(saveBtn, cancelBtn);

    form.append(heading, titleInput, descInput, contentInput, tagsInput, favLabel, actions);
    return form;
  }

  /* ======== render ======== */

  private renderBody(): void {
    if (!this.container) return;
    const oldBody = this.container.querySelector('.bd-pp-body');
    if (oldBody) oldBody.replaceWith(this.buildBody());
  }

  private startCreate(): void {
    this.isNew = true;
    this.editingId = null;
    this.renderBody();
  }

  /* ======== use prompt ======== */

  private usePrompt(prompt: PromptItem): void {
    const variables = this.extractVariables(prompt.content);

    if (variables.length === 0) {
      this.fillAndClose(prompt);
      return;
    }

    const uniqueVars = [...new Set(variables)];
    this.showVariableForm(prompt, uniqueVars);
  }

  private extractVariables(content: string): string[] {
    const matches = content.matchAll(/\{\{(\S+?)\}\}/g);
    return Array.from(matches, (m) => m[1]);
  }

  private showVariableForm(prompt: PromptItem, variables: string[]): void {
    const overlay = document.createElement('div');
    overlay.className = 'bd-dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'bd-dialog';

    const label = document.createElement('div');
    label.className = 'bd-dialog-label';
    label.textContent = `填写变量 — "${prompt.title}"`;

    const inputs: HTMLInputElement[] = [];
    for (const varName of variables) {
      const row = document.createElement('div');
      row.className = 'bd-pp-var-row';

      const name = document.createElement('span');
      name.className = 'bd-pp-var-name';
      name.textContent = varName;

      const input = document.createElement('input');
      input.className = 'bd-dialog-input';
      input.type = 'text';
      input.placeholder = varName;
      inputs.push(input);

      row.append(name, input);
      dialog.append(row);
    }

    const actions = document.createElement('div');
    actions.className = 'bd-dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'bd-dialog-btn bd-dialog-cancel';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', () => overlay.remove());

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'bd-dialog-btn bd-dialog-confirm';
    confirmBtn.textContent = '填入';
    confirmBtn.addEventListener('click', () => {
      let result = prompt.content;
      for (let i = 0; i < variables.length; i++) {
        result = result.replaceAll(`{{${variables[i]}}}`, inputs[i].value);
      }
      overlay.remove();
      this.fillAndClose(prompt, result);
    });

    actions.append(cancelBtn, confirmBtn);
    dialog.append(label, actions);
    overlay.append(dialog);
    document.body.append(overlay);

    requestAnimationFrame(() => inputs[0]?.focus());
  }

  private fillAndClose(prompt: PromptItem, resolvedContent?: string): void {
    const text = resolvedContent ?? prompt.content;
    const input = findComposerInput();
    const ok = fillComposerText(input, text);

    if (ok) {
      this.store.recordUsage(prompt.id);
      this.onPersist();
    } else {
      navigator.clipboard.writeText(text).catch(() => {
        console.warn('[BetterDeepSeek] copy fallback failed');
      });
      alert('未找到输入框，已将提示词内容复制到剪贴板');
    }

    this.close();
  }

  /* ======== export / import / source ======== */

  private exportAll(): void {
    const data = this.store.snapshot();
    const json = createExportPayload(data);
    downloadJson(json, generateExportFilename());
  }

  private showSourcePicker(): void {
    this.sourceMode = 'source';
    this.sourcePack = [];
    this.selectedSourceIndex = null;
    this.renderBody();
  }

  private backToLibrary(): void {
    this.sourceMode = 'library';
    this.sourcePack = [];
    this.selectedSourceIndex = null;
    this.renderBody();
  }

  private buildSourceView(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'bd-pp-source-view';

    const sidebar = document.createElement('div');
    sidebar.className = 'bd-pp-sidebar';

    const backBtn = document.createElement('button');
    backBtn.className = 'bd-pp-filter-btn';
    backBtn.type = 'button';
    backBtn.textContent = '← 返回库';
    backBtn.addEventListener('click', () => this.backToLibrary());
    sidebar.append(backBtn);

    const sep = document.createElement('div');
    sep.className = 'bd-pp-sidebar-sep';
    sidebar.append(sep);

    const sourceList = getSourceList();
    for (const src of sourceList) {
      const btn = document.createElement('button');
      btn.className = 'bd-pp-filter-btn';
      btn.type = 'button';
      btn.textContent = src.name;
      btn.addEventListener('click', async () => {
        btn.textContent = '加载中...';
        btn.disabled = true;
        try {
          const pack = await loadSource(src.id);
          this.sourceMode = 'source';
          this.sourcePack = pack.items;
          this.selectedSourceIndex = null;
          this.renderBody();
        } finally {
          btn.textContent = src.name;
          btn.disabled = false;
        }
      });
      sidebar.append(btn);
    }

    const importFileBtn = document.createElement('button');
    importFileBtn.className = 'bd-pp-filter-btn';
    importFileBtn.type = 'button';
    importFileBtn.textContent = '从文件导入';
    importFileBtn.addEventListener('click', () => this.importFile());
    sidebar.append(importFileBtn);

    const list = document.createElement('div');
    list.className = 'bd-pp-list';

    if (this.sourcePack.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bd-pp-empty';
      empty.textContent = this.sourceMode === 'source' ? '选择一个来源或导入文件开始浏览' : '暂无内容';
      list.append(empty);
    } else {
      for (let i = 0; i < this.sourcePack.length; i++) {
        const item = this.sourcePack[i];
        const card = this.buildSourceCard(item, i);
        list.append(card);
      }
    }

    const detail = this.buildSourceDetail();

    wrapper.append(sidebar, list, detail);
    return wrapper;
  }

  private buildSourceCard(item: PromptSourceItem, index: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bd-pp-card';
    card.classList.toggle('bd-pp-card-selected', this.selectedSourceIndex === index);
    card.addEventListener('click', () => {
      this.selectedSourceIndex = index;
      this.renderBody();
    });

    const exists = this.store.hasFingerprint(item.fingerprint);

    const header = document.createElement('div');
    header.className = 'bd-pp-card-header';

    const title = document.createElement('span');
    title.className = 'bd-pp-card-title';
    title.textContent = item.title;

    const meta = document.createElement('span');
    meta.className = 'bd-pp-card-meta';

    if (exists) {
      const badge = document.createElement('span');
      badge.className = 'bd-pp-badge';
      badge.textContent = '已存在';
      badge.style.background = '#f0fdf4';
      badge.style.color = '#16a34a';
      meta.append(badge);
    }

    const srcBadge = document.createElement('span');
    srcBadge.className = 'bd-pp-badge';
    srcBadge.textContent = item.sourceName.slice(0, 10);
    meta.append(srcBadge);

    header.append(title, meta);

    const desc = document.createElement('div');
    desc.className = 'bd-pp-card-desc';
    desc.textContent = item.description;

    const tagsRow = document.createElement('div');
    tagsRow.className = 'bd-pp-card-tags';
    for (const tag of item.tags) {
      const t = document.createElement('span');
      t.className = 'bd-pp-tag-pill';
      t.textContent = tag;
      tagsRow.append(t);
    }

    card.append(header, desc, tagsRow);
    return card;
  }

  private buildSourceDetail(): HTMLElement {
    const detail = document.createElement('div');
    detail.className = 'bd-pp-detail';

    if (this.selectedSourceIndex === null || !this.sourcePack[this.selectedSourceIndex]) {
      const placeholder = document.createElement('div');
      placeholder.className = 'bd-pp-detail-placeholder';
      placeholder.textContent = '选择左侧提示词查看详情';
      detail.append(placeholder);
      return detail;
    }

    const item = this.sourcePack[this.selectedSourceIndex];
    const exists = this.store.hasFingerprint(item.fingerprint);

    const header = document.createElement('div');
    header.className = 'bd-pp-detail-header';

    const title = document.createElement('div');
    title.className = 'bd-pp-detail-title';
    title.textContent = item.title;

    const meta = document.createElement('div');
    meta.className = 'bd-pp-detail-meta';
    meta.textContent = `来源: ${item.sourceName}${exists ? ' · 已存在于库中' : ''}`;

    header.append(title, meta);

    const content = document.createElement('div');
    content.className = 'bd-pp-detail-content';
    content.textContent = item.content;

    const tagsRow = document.createElement('div');
    tagsRow.className = 'bd-pp-detail-tags';
    for (const tag of item.tags) {
      const t = document.createElement('span');
      t.className = 'bd-pp-tag-pill';
      t.textContent = tag;
      tagsRow.append(t);
    }

    const actions = document.createElement('div');
    actions.className = 'bd-pp-detail-actions';

    if (!exists) {
      const addBtn = document.createElement('button');
      addBtn.className = 'bd-pp-use-btn';
      addBtn.type = 'button';
      addBtn.textContent = '添加到我的库';
      addBtn.addEventListener('click', () => {
        this.store.addFromSource(item, false);
        this.onPersist();
        this.sourcePack = this.sourcePack.filter((_, j) => j !== this.selectedSourceIndex);
        this.selectedSourceIndex = null;
        this.renderBody();
      });
      actions.append(addBtn);

      const favAddBtn = document.createElement('button');
      favAddBtn.className = 'bd-pp-action-btn';
      favAddBtn.type = 'button';
      favAddBtn.textContent = '收藏并添加';
      favAddBtn.addEventListener('click', () => {
        this.store.addFromSource(item, true);
        this.onPersist();
        this.sourcePack = this.sourcePack.filter((_, j) => j !== this.selectedSourceIndex);
        this.selectedSourceIndex = null;
        this.renderBody();
      });
      actions.append(favAddBtn);
    } else {
      const viewBtn = document.createElement('button');
      viewBtn.className = 'bd-pp-action-btn';
      viewBtn.type = 'button';
      viewBtn.textContent = '已在库中';
      viewBtn.disabled = true;
      actions.append(viewBtn);
    }

    detail.append(header, content, tagsRow, actions);
    return detail;
  }

  private async importFile(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.md,.txt';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const text = await readJsonFile(file);
        let pack;

        if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
          pack = parseCsv(text);
        } else if (file.name.endsWith('.md')) {
          pack = parseMarkdown(text);
        } else {
          pack = parseBetterDeepSeekJson(text);
        }

        this.sourceMode = 'source';
        this.sourcePack = pack.items;
        this.selectedSourceIndex = null;
        this.renderBody();
      } catch (err) {
        alert(`导入失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    });

    input.click();
  }
}
