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
import { t, type AppLocale, type MessageKey } from './i18n';
import { getSourceList, loadSource, refreshSource } from './promptSources';
import { applyThemeClass, type ThemeMode } from './theme';

const PANEL_CLASS = 'bd-prompt-panel';

export type PanelCloseCallback = () => void;

export class PromptPanel {
  private readonly store: PromptStore;
  private readonly onClose: PanelCloseCallback;
  private readonly onPersist: () => void;
  private readonly getTheme: () => ThemeMode;
  private readonly getLocale: () => AppLocale;
  private container: HTMLElement | null = null;

  private searchQuery = '';
  private activeFilter: PromptFilter = 'all';
  private selectedId: PromptId | null = null;
  private activeTag: string | null = null;
  private editingId: PromptId | null = null;
  private isNew = false;
  private sourceMode: 'library' | 'source' | 'import' = 'library';
  private sourcePack: PromptSourceItem[] = [];
  private sourceRiskCount = 0;
  private selectedSourceIndex: number | null = null;
  private activeSourceId: string | null = null;
  private sourceLoading = false;
  private sourceError: string | null = null;
  private sourceFallback = false;
  private addedSourceFingerprints = new Set<string>();
  private sourceSearchQuery = '';

  constructor(
    store: PromptStore,
    onClose: PanelCloseCallback,
    onPersist: () => void,
    getTheme: () => ThemeMode,
    getLocale: () => AppLocale,
  ) {
    this.store = store;
    this.onClose = onClose;
    this.onPersist = onPersist;
    this.getTheme = getTheme;
    this.getLocale = getLocale;
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
    applyThemeClass(overlay, this.getTheme());

    const panel = document.createElement('div');
    panel.className = `${PANEL_CLASS} ${PANEL_CLASS}-v1`;
    applyThemeClass(panel, this.getTheme());
    panel.addEventListener('click', (event) => event.stopPropagation());
    overlay.addEventListener('click', () => this.close());

    this.panelEl = panel;
    this.updatePanelWidth();
    panel.append(this.buildHeader(), this.buildBody());
    overlay.append(panel);
    return overlay;
  }

  private panelEl: HTMLElement | null = null;

  private updatePanelWidth(): void {
    this.panelEl?.classList.toggle('bd-prompt-panel-wide', this.sourceMode !== 'library');
  }

  setTheme(mode: ThemeMode): void {
    applyThemeClass(this.container, mode);
    applyThemeClass(this.panelEl, mode);
  }

  setLocale(locale: AppLocale): void {
    void locale;
    if (!this.container) return;
    const next = this.buildPanel();
    this.container.replaceWith(next);
    this.container = next;
  }

  private t(key: MessageKey, params?: Record<string, string | number>): string {
    return t(this.getLocale(), key, params);
  }

  private formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat(this.getLocale()).format(new Date(timestamp));
  }

  private displaySourceName(name: string): string {
    if (name === 'BDS 提示词仓库') return this.t('import.repoTitle');
    return name;
  }

  private buildHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'bd-pp-header';

    const title = document.createElement('span');
    title.className = 'bd-pp-title';
    title.textContent = this.t('prompt.title');

    const search = document.createElement('input');
    search.className = 'bd-pp-search';
    search.type = 'search';
    search.placeholder = this.t('prompt.searchPlaceholder');
    search.value = this.searchQuery;
    search.addEventListener('input', () => {
      this.searchQuery = search.value;
      this.selectedId = null;
      this.renderBody();
    });

    const newBtn = document.createElement('button');
    newBtn.className = 'bd-pp-action-btn';
    newBtn.type = 'button';
    newBtn.textContent = this.t('prompt.newTitle');
    newBtn.addEventListener('click', () => this.startCreate());

    const exportBtn = document.createElement('button');
    exportBtn.className = 'bd-pp-action-btn';
    exportBtn.type = 'button';
    exportBtn.textContent = this.t('action.export');
    exportBtn.addEventListener('click', () => this.exportAll());

    const importBtn = document.createElement('button');
    importBtn.className = 'bd-pp-action-btn';
    importBtn.type = 'button';
    importBtn.textContent = this.t('action.import');
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
      { id: 'all', label: this.t('prompt.filterAll') },
      { id: 'favorites', label: this.t('prompt.filterFavorites') },
      { id: 'builtin', label: this.t('prompt.filterBuiltin') },
      { id: 'user', label: this.t('prompt.filterUser') },
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
      empty.textContent = this.searchQuery ? this.t('prompt.searchEmpty') : this.t('prompt.empty');
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
      badge.textContent = this.t('prompt.builtin');
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
      placeholder.textContent = this.t('prompt.detailPlaceholder');
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
      ? this.t('prompt.usedLast', { count: prompt.usageCount, date: this.formatDate(prompt.lastUsedAt) })
      : prompt.usageCount > 0
        ? this.t('prompt.used', { count: prompt.usageCount })
        : this.t('prompt.notUsed');

    meta.textContent = `${prompt.source === 'builtin' ? this.t('prompt.sourceBuiltin') : this.t('prompt.sourceUser')} · ${usedText}`;

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
    useBtn.textContent = this.t('action.use');
    useBtn.addEventListener('click', () => this.usePrompt(prompt));

    const favBtn = document.createElement('button');
    favBtn.className = 'bd-pp-action-btn';
    favBtn.type = 'button';
    favBtn.textContent = prompt.favorite ? this.t('prompt.favorited') : this.t('prompt.favorite');
    favBtn.addEventListener('click', () => {
      this.store.toggleFavorite(prompt.id);
      this.onPersist();
      this.renderBody();
    });

    const editBtn = document.createElement('button');
    editBtn.className = 'bd-pp-action-btn';
    editBtn.type = 'button';
    editBtn.textContent = this.t('action.edit');
    editBtn.addEventListener('click', () => {
      this.editingId = prompt.id;
      this.renderBody();
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'bd-pp-action-btn';
    copyBtn.type = 'button';
    copyBtn.textContent = this.t('action.copy');
    copyBtn.addEventListener('click', () => {
      this.store.duplicate(prompt.id);
      this.onPersist();
      this.renderBody();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'bd-pp-action-btn bd-pp-danger-btn';
    deleteBtn.type = 'button';
    deleteBtn.textContent = this.t('action.delete');
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
    heading.textContent = prompt ? this.t('prompt.editTitle') : this.t('prompt.newTitle');

    const titleInput = document.createElement('input');
    titleInput.className = 'bd-pp-editor-input';
    titleInput.type = 'text';
    titleInput.placeholder = this.t('prompt.titlePlaceholder');
    titleInput.value = prompt?.title ?? '';

    const descInput = document.createElement('input');
    descInput.className = 'bd-pp-editor-input';
    descInput.type = 'text';
    descInput.placeholder = this.t('prompt.descriptionPlaceholder');
    descInput.value = prompt?.description ?? '';

    const contentInput = document.createElement('textarea');
    contentInput.className = 'bd-pp-editor-textarea';
    contentInput.placeholder = this.t('prompt.contentPlaceholder');
    contentInput.value = prompt?.content ?? '';
    contentInput.rows = 8;

    const tagsInput = document.createElement('input');
    tagsInput.className = 'bd-pp-editor-input';
    tagsInput.type = 'text';
    tagsInput.placeholder = this.t('prompt.tagsPlaceholder');
    tagsInput.value = prompt?.tags.join(', ') ?? '';

    const favLabel = document.createElement('label');
    favLabel.className = 'bd-pp-editor-check';
    const favCheck = document.createElement('input');
    favCheck.type = 'checkbox';
    favCheck.checked = prompt?.favorite ?? false;
    favLabel.append(favCheck, document.createTextNode(` ${this.t('prompt.filterFavorites')}`));

    const actions = document.createElement('div');
    actions.className = 'bd-pp-detail-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'bd-pp-use-btn';
    saveBtn.type = 'button';
    saveBtn.textContent = this.t('action.save');
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
    cancelBtn.textContent = this.t('action.cancel');
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
    applyThemeClass(overlay, this.getTheme());

    const dialog = document.createElement('div');
    dialog.className = 'bd-dialog';

    const label = document.createElement('div');
    label.className = 'bd-dialog-label';
    label.textContent = this.t('dialog.variablesTitle', { title: prompt.title });

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
    cancelBtn.textContent = this.t('action.cancel');
    cancelBtn.addEventListener('click', () => overlay.remove());

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'bd-dialog-btn bd-dialog-confirm';
    confirmBtn.textContent = this.t('action.confirm');
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
      void this.alertDialog(this.t('error.noComposer'));
    }

    this.close();
  }

  private alertDialog(message: string): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'bd-dialog-overlay';
      applyThemeClass(overlay, this.getTheme());

      const dialog = document.createElement('div');
      dialog.className = 'bd-dialog';

      const label = document.createElement('div');
      label.className = 'bd-dialog-label';
      label.textContent = message;

      const actions = document.createElement('div');
      actions.className = 'bd-dialog-actions';

      const okBtn = document.createElement('button');
      okBtn.className = 'bd-dialog-btn bd-dialog-confirm';
      okBtn.textContent = this.t('action.confirm');
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

  /* ======== export / import / source ======== */

  private exportAll(): void {
    const data = this.store.snapshot();
    const json = createExportPayload(data);
    downloadJson(json, generateExportFilename());
  }

  private showSourcePicker(): void {
    this.sourceMode = 'source';
    this.sourcePack = [];
    this.sourceRiskCount = 0;
    this.selectedSourceIndex = null;
    this.activeSourceId = 'better-deepseek';
    this.sourceLoading = false;
    this.sourceError = null;
    this.sourceFallback = false;
    this.addedSourceFingerprints.clear();
    this.renderBody();
  }

  private backToLibrary(): void {
    this.sourceMode = 'library';
    this.sourcePack = [];
    this.selectedSourceIndex = null;
    this.activeSourceId = null;
    this.addedSourceFingerprints.clear();
    this.renderBody();
  }

  private buildSourceView(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'bd-pp-source-view';

    const left = document.createElement('div');
    left.className = 'bd-pp-source-left';

    const topBar = document.createElement('div');
    topBar.className = 'bd-pp-source-topbar';

    const backBtn = document.createElement('button');
    backBtn.className = 'bd-pp-action-btn';
    backBtn.type = 'button';
    backBtn.textContent = this.t('action.backToLibrary');
    backBtn.addEventListener('click', () => this.backToLibrary());
    topBar.append(backBtn);

    const importFileBtn = document.createElement('button');
    importFileBtn.className = 'bd-pp-action-btn';
    importFileBtn.type = 'button';
    importFileBtn.textContent = this.t('action.importFile');
    importFileBtn.addEventListener('click', () => this.importFile());
    topBar.append(importFileBtn);

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'bd-pp-action-btn';
    refreshBtn.textContent = this.t('action.refresh');
    refreshBtn.disabled = this.sourceLoading;
    refreshBtn.addEventListener('click', () => this.fetchSource(true));
    topBar.append(refreshBtn);

    const linkBtn = document.createElement('button');
    linkBtn.className = 'bd-pp-action-btn';
    linkBtn.textContent = '↗';
    linkBtn.title = this.t('action.openRepo');
    linkBtn.addEventListener('click', () => {
      const src = getSourceList().find((s) => s.id === this.activeSourceId);
      if (src) window.open(src.homepage, '_blank');
    });
    topBar.append(linkBtn);

    left.append(topBar);

    const search = document.createElement('input');
    search.className = 'bd-pp-search bd-pp-source-searchwide';
    search.type = 'search';
    search.placeholder = this.t('import.repoSearch');
    search.value = this.sourceSearchQuery;
    search.addEventListener('input', () => {
      this.sourceSearchQuery = search.value;
      this.renderBody();
    });
    const searchRow = document.createElement('div');
    searchRow.className = 'bd-pp-source-searchrow';
    searchRow.append(search);
    left.append(searchRow);

    if (this.sourceLoading) {
      const loading = document.createElement('div');
      loading.className = 'bd-pp-empty';
      loading.textContent = this.t('action.loading');
      left.append(loading);
    } else if (this.sourceError) {
      const errBox = document.createElement('div');
      errBox.className = 'bd-pp-source-error';
      const errMsg = document.createElement('div');
      errMsg.className = 'bd-pp-source-error-msg';
      errMsg.textContent = this.t('error.loadFailed', { message: this.sourceError });
      errBox.append(errMsg);

      const retryBtn = document.createElement('button');
      retryBtn.className = 'bd-pp-action-btn';
      retryBtn.textContent = this.t('action.retryRefresh');
      retryBtn.addEventListener('click', () => this.fetchSource(true));
      const openBtn = document.createElement('button');
      openBtn.className = 'bd-pp-action-btn';
      openBtn.textContent = this.t('action.openRepo');
      openBtn.addEventListener('click', () => {
        const src = getSourceList().find((s) => s.id === this.activeSourceId);
        if (src) window.open(src.homepage, '_blank');
      });
      errBox.append(retryBtn, openBtn);
      left.append(errBox);
    } else if (this.sourcePack.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bd-pp-source-welcome';
      const heading = document.createElement('div');
      heading.className = 'bd-pp-source-welcome-title';
      heading.textContent = this.t('import.repoTitle');
      const desc = document.createElement('div');
      desc.textContent = this.t('import.repoDescription');
      const cta = document.createElement('button');
      cta.className = 'bd-pp-use-btn';
      cta.textContent = this.t('action.refreshRepo');
      cta.addEventListener('click', () => this.fetchSource(true));
      empty.append(heading, desc, cta);
      left.append(empty);
    } else {
      let filtered = this.sourcePack;
      if (this.sourceSearchQuery) {
        const q = this.sourceSearchQuery.toLowerCase();
        filtered = filtered.filter((p) =>
          p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q)),
        );
      }
      const statBar = document.createElement('div');
      statBar.className = 'bd-pp-source-stats';
      const available = filtered.filter(
        (item) => !this.store.hasFingerprint(item.fingerprint) && !this.addedSourceFingerprints.has(item.fingerprint),
      ).length;
      statBar.textContent = this.t('import.stats', {
        total: filtered.length,
        available: available > 0 ? this.t('import.statsAvailable', { count: available }) : '',
      });
      if (this.sourceRiskCount > 0) statBar.textContent += ` · ${this.t('import.filteredRisks', { count: this.sourceRiskCount })}`;
      if (this.sourceFallback) statBar.textContent += ` · ${this.t('import.offlineFallback')}`;
      left.append(statBar);

      const grid = document.createElement('div');
      grid.className = 'bd-pp-source-grid';
      for (const item of filtered) {
        const origIndex = this.sourcePack.indexOf(item);
        grid.append(this.buildSourceCard(item, origIndex));
      }
      left.append(grid);
    }

    const detail = this.buildSourceDetail();
    wrapper.append(left, detail);
    return wrapper;
  }

  private async fetchSource(forceRefresh: boolean): Promise<void> {
    this.sourceLoading = true;
    this.sourceError = null;
    this.sourcePack = [];
    this.sourceRiskCount = 0;
    this.selectedSourceIndex = null;
    this.renderBody();

    try {
      const pack = forceRefresh ? await refreshSource() : await loadSource();
      this.sourcePack = pack.items;
      this.sourceRiskCount = pack.risks?.length ?? 0;
      this.sourceLoading = false;
      if (this.sourcePack.length > 0) this.selectedSourceIndex = 0;
      this.renderBody();
    } catch (err) {
      this.sourceLoading = false;
      this.sourceError = err instanceof Error ? err.message : this.t('import.unknownError');
      this.renderBody();
    }
  }

  private buildSourceCard(item: PromptSourceItem, index: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bd-pp-card';
    card.classList.toggle('bd-pp-card-selected', this.selectedSourceIndex === index);
    card.addEventListener('click', () => {
      this.selectedSourceIndex = index;
      this.renderBody();
    });

    const stored = this.store.hasFingerprint(item.fingerprint);
    const added = this.addedSourceFingerprints.has(item.fingerprint);

    const header = document.createElement('div');
    header.className = 'bd-pp-card-header';

    const title = document.createElement('span');
    title.className = 'bd-pp-card-title';
    title.textContent = item.title;

    const meta = document.createElement('span');
    meta.className = 'bd-pp-card-meta';

    if (stored || added) {
      const badge = document.createElement('span');
      badge.className = 'bd-pp-badge bd-pp-badge-success';
      badge.textContent = added ? this.t('import.added') : '✓';
      meta.append(badge);
    }

    const srcBadge = document.createElement('span');
    srcBadge.className = 'bd-pp-badge';
    srcBadge.textContent = this.displaySourceName(item.sourceName).slice(0, 10);
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
      placeholder.textContent = this.t('prompt.detailPlaceholder');
      detail.append(placeholder);
      return detail;
    }

    const item = this.sourcePack[this.selectedSourceIndex];
    const stored = this.store.hasFingerprint(item.fingerprint);
    const added = this.addedSourceFingerprints.has(item.fingerprint);

    const header = document.createElement('div');
    header.className = 'bd-pp-detail-header';

    const title = document.createElement('div');
    title.className = 'bd-pp-detail-title';
    title.textContent = item.title;

    const meta = document.createElement('div');
    meta.className = 'bd-pp-detail-meta';
    meta.textContent = this.t('import.sourceMeta', {
      source: this.displaySourceName(item.sourceName),
      status: stored || added ? this.t('import.sourceStatusAdded') : '',
    });

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

    if (!stored && !added) {
      const addBtn = document.createElement('button');
      addBtn.className = 'bd-pp-use-btn';
      addBtn.type = 'button';
      addBtn.textContent = this.t('action.addToLibrary');
      addBtn.addEventListener('click', () => {
        this.store.addFromSource(item, false);
        this.onPersist();
        this.addedSourceFingerprints.add(item.fingerprint);
        this.renderBody();
      });
      actions.append(addBtn);

      const favAddBtn = document.createElement('button');
      favAddBtn.className = 'bd-pp-action-btn';
      favAddBtn.type = 'button';
      favAddBtn.textContent = this.t('import.favoriteAndAdd');
      favAddBtn.addEventListener('click', () => {
        this.store.addFromSource(item, true);
        this.onPersist();
        this.addedSourceFingerprints.add(item.fingerprint);
        this.renderBody();
      });
      actions.append(favAddBtn);
    } else {
      const doneBtn = document.createElement('button');
      doneBtn.className = 'bd-pp-action-btn';
      doneBtn.type = 'button';
      doneBtn.textContent = added ? this.t('import.alreadyAdded') : this.t('import.alreadyInLibrary');
      doneBtn.disabled = true;
      actions.append(doneBtn);
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
        void this.alertDialog(this.t('error.importPromptFailed', {
          message: err instanceof Error ? err.message : this.t('import.unknownError'),
        }));
      }
    });

    input.click();
  }
}
