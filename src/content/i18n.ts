export type AppLocale = 'zh-CN' | 'en-US';

const LOCALE_ATTRS = ['lang', 'data-locale', 'data-lang', 'data-language', 'data-i18n-locale'];

type Params = Record<string, string | number>;

const messages = {
  'zh-CN': {
    'action.addToLibrary': '添加到我的库',
    'action.backToLibrary': '← 返回库',
    'action.cancel': '取消',
    'action.clear': '清空',
    'action.confirm': '确定',
    'action.copy': '复制',
    'action.delete': '删除',
    'action.edit': '编辑',
    'action.export': '导出',
    'action.import': '导入',
    'action.importFile': '从文件导入',
    'action.loading': '正在加载...',
    'action.openRepo': '打开仓库文档',
    'action.refresh': '刷新',
    'action.refreshRepo': '刷新提示词仓库',
    'action.retryRefresh': '重试刷新',
    'action.save': '保存',
    'action.use': '使用',
    'chat.label': '聊天',
    'color.amber': '琥珀',
    'color.default': '默认',
    'color.lightBlue': '浅蓝',
    'color.mint': '薄荷绿',
    'color.pink': '粉色',
    'color.purple': '淡紫',
    'dialog.colorTitle': '设置“{name}”颜色',
    'dialog.confirmDeleteFolder': '删除该文件夹及其子文件夹？文件夹内引用会一并移除，但不会删除 DeepSeek 原始会话。',
    'dialog.confirmRemoveConversation': '从文件夹移除“{title}”？不会删除 DeepSeek 原始会话。',
    'dialog.confirmRemoveSelected': '从 Better DeepSeek 文件夹移除 {count} 个所选会话？不会删除 DeepSeek 原始会话。',
    'dialog.folderChoiceTitle': '移动到文件夹',
    'dialog.folderName': '文件夹名称',
    'dialog.renameFolder': '重命名文件夹',
    'dialog.subfolderName': '子文件夹名称',
    'dialog.variablesTitle': '填写变量 — "{title}"',
    'error.createFolderFailed': '创建文件夹失败',
    'error.importFolderInvalid': '导入失败：请选择 Better DeepSeek 导出的文件夹 JSON。',
    'error.importInvalidJson': '导入失败：文件不是有效 JSON。',
    'error.importPromptFailed': '导入失败: {message}',
    'error.loadFailed': '加载失败: {message}',
    'error.moveFailed': '移动失败',
    'error.noComposer': '未找到输入框，已将提示词内容复制到剪贴板',
    'feature.conversationReorder': '会话拖拽排序',
    'feature.folderColors': '文件夹颜色',
    'feature.folderExport': '导出文件夹',
    'feature.folderImport': '导入和备份',
    'feature.folderReorder': '文件夹拖拽排序',
    'feature.folderSearch': '文件夹搜索',
    'feature.multiSelect': '多选批量操作',
    'feature.pinFolders': '置顶文件夹',
    'folder.defaultName': '新文件夹',
    'folder.empty': '新建文件夹后，可拖入 DeepSeek 历史会话。',
    'folder.noMatchingConversations': '没有匹配的会话。',
    'folder.searchPlaceholder': '搜索此文件夹',
    'folder.title': '文件夹',
    'folder.tooltip': '拖入会话，或双击改名',
    'icon.deleteFolder': '删除文件夹',
    'icon.expandCollapse': '展开/收起',
    'icon.newFolder': '新建文件夹',
    'icon.newSubfolder': '新建子文件夹',
    'icon.pinConversation': '置顶会话',
    'icon.pinFolder': '置顶文件夹',
    'icon.searchFolder': '搜索文件夹',
    'icon.selectConversation': '选择会话',
    'icon.setColor': '设置颜色',
    'icon.settings': '设置',
    'icon.unpin': '取消置顶',
    'import.added': '已添加',
    'import.alreadyAdded': '已添加',
    'import.alreadyInLibrary': '已在库中',
    'import.favoriteAndAdd': '收藏并添加',
    'import.filteredRisks': '已过滤 {count} 条风险内容',
    'import.offlineFallback': '离线兜底',
    'import.repoDescription': '点击下方按钮从官方仓库获取最新提示词集合。',
    'import.repoSearch': '在官方仓库搜索',
    'import.repoTitle': 'Better DeepSeek 提示词仓库',
    'import.sourceMeta': '来源: {source}{status}',
    'import.sourceStatusAdded': ' · 已添加',
    'import.stats': '{total} 条{available}',
    'import.statsAvailable': '，{count} 条可添加',
    'import.unknownError': '未知错误',
    'quote.action': '询问Deepseek',
    'quote.header': '针对你刚才这段内容：',
    'quote.remove': '移除引用',
    'table.action': '表格工具',
    'table.copyMarkdown': '复制 Markdown',
    'table.copyCsv': '复制 CSV',
    'table.copyJson': '复制 JSON',
    'prompt.builtin': '内置',
    'prompt.contentPlaceholder': '提示词内容，用 {{变量名}} 标记变量',
    'prompt.descriptionPlaceholder': '描述（可选）',
    'prompt.detailPlaceholder': '选择左侧提示词查看详情',
    'prompt.editTitle': '编辑提示词',
    'prompt.empty': '点击"新建"创建第一个提示词',
    'prompt.favorite': '☆ 收藏',
    'prompt.favorited': '★ 已收藏',
    'prompt.filterAll': '全部',
    'prompt.filterBuiltin': '内置',
    'prompt.filterFavorites': '收藏',
    'prompt.filterUser': '自建',
    'prompt.newTitle': '新建提示词',
    'prompt.notUsed': '未使用',
    'prompt.searchEmpty': '没有匹配的提示词',
    'prompt.searchPlaceholder': '搜索...',
    'prompt.sourceBuiltin': '内置',
    'prompt.sourceUser': '自建',
    'prompt.tagsPlaceholder': '标签，逗号分隔',
    'prompt.title': '提示词库',
    'prompt.titlePlaceholder': '标题',
    'prompt.used': '使用 {count} 次',
    'prompt.usedLast': '使用 {count} 次 · 最后 {date}',
    'selection.count': '已选 {count}',
    'selection.move': '移动所选',
    'selection.remove': '移除所选',
    'settings.exportFolders': '导出文件夹 JSON',
    'settings.hideNative': '收纳到文件夹后，隐藏外部历史对话',
    'settings.importFolders': '导入文件夹 JSON',
    'settings.restoreBackup': '恢复导入前备份',
    'settings.title': '文件夹设置',
    'status.importComplete': '导入完成：新增 {folders} 个文件夹，新增 {conversations} 个会话。',
    'status.restoreComplete': '已恢复到上次导入前的文件夹数据。',
    'status.restoreMissing': '没有可恢复的导入前备份。',
  },
  'en-US': {
    'action.addToLibrary': 'Add to Library',
    'action.backToLibrary': '← Back to Library',
    'action.cancel': 'Cancel',
    'action.clear': 'Clear',
    'action.confirm': 'OK',
    'action.copy': 'Duplicate',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.export': 'Export',
    'action.import': 'Import',
    'action.importFile': 'Import File',
    'action.loading': 'Loading...',
    'action.openRepo': 'Open Repository Docs',
    'action.refresh': 'Refresh',
    'action.refreshRepo': 'Refresh Prompt Repository',
    'action.retryRefresh': 'Retry Refresh',
    'action.save': 'Save',
    'action.use': 'Use',
    'chat.label': 'Chats',
    'color.amber': 'Amber',
    'color.default': 'Default',
    'color.lightBlue': 'Light Blue',
    'color.mint': 'Mint',
    'color.pink': 'Pink',
    'color.purple': 'Purple',
    'dialog.colorTitle': 'Set "{name}" Color',
    'dialog.confirmDeleteFolder': 'Delete this folder and its subfolders? Folder references will be removed, but original DeepSeek chats will not be deleted.',
    'dialog.confirmRemoveConversation': 'Remove "{title}" from this folder? The original DeepSeek chat will not be deleted.',
    'dialog.confirmRemoveSelected': 'Remove {count} selected chats from Better DeepSeek folders? Original DeepSeek chats will not be deleted.',
    'dialog.folderChoiceTitle': 'Move to Folder',
    'dialog.folderName': 'Folder Name',
    'dialog.renameFolder': 'Rename Folder',
    'dialog.subfolderName': 'Subfolder Name',
    'dialog.variablesTitle': 'Fill Variables — "{title}"',
    'error.createFolderFailed': 'Failed to create folder',
    'error.importFolderInvalid': 'Import failed: choose a folder JSON exported by Better DeepSeek.',
    'error.importInvalidJson': 'Import failed: file is not valid JSON.',
    'error.importPromptFailed': 'Import failed: {message}',
    'error.loadFailed': 'Load failed: {message}',
    'error.moveFailed': 'Move failed',
    'error.noComposer': 'Composer not found. Prompt content has been copied to the clipboard.',
    'feature.conversationReorder': 'Drag to reorder chats',
    'feature.folderColors': 'Folder colors',
    'feature.folderExport': 'Export folders',
    'feature.folderImport': 'Import and backup',
    'feature.folderReorder': 'Drag to reorder folders',
    'feature.folderSearch': 'Folder search',
    'feature.multiSelect': 'Batch multi-select',
    'feature.pinFolders': 'Pinned folders',
    'folder.defaultName': 'New Folder',
    'folder.empty': 'Create a folder, then drag DeepSeek history chats into it.',
    'folder.noMatchingConversations': 'No matching chats.',
    'folder.searchPlaceholder': 'Search this folder',
    'folder.title': 'Folders',
    'folder.tooltip': 'Drop chats here, or double-click to rename',
    'icon.deleteFolder': 'Delete folder',
    'icon.expandCollapse': 'Expand/collapse',
    'icon.newFolder': 'New folder',
    'icon.newSubfolder': 'New subfolder',
    'icon.pinConversation': 'Pin chat',
    'icon.pinFolder': 'Pin folder',
    'icon.searchFolder': 'Search folder',
    'icon.selectConversation': 'Select chat',
    'icon.setColor': 'Set color',
    'icon.settings': 'Settings',
    'icon.unpin': 'Unpin',
    'import.added': 'Added',
    'import.alreadyAdded': 'Added',
    'import.alreadyInLibrary': 'Already in Library',
    'import.favoriteAndAdd': 'Favorite and Add',
    'import.filteredRisks': 'Filtered {count} risky prompts',
    'import.offlineFallback': 'Offline fallback',
    'import.repoDescription': 'Click below to fetch the latest prompt set from the official repository.',
    'import.repoSearch': 'Search official repository',
    'import.repoTitle': 'Better DeepSeek Prompt Repository',
    'import.sourceMeta': 'Source: {source}{status}',
    'import.sourceStatusAdded': ' · Added',
    'import.stats': '{total} prompts{available}',
    'import.statsAvailable': ', {count} available',
    'import.unknownError': 'Unknown error',
    'quote.action': 'Ask Deepseek',
    'quote.header': 'Regarding what you just said:',
    'quote.remove': 'Remove quote',
    'table.action': 'Table tools',
    'table.copyMarkdown': 'Copy Markdown',
    'table.copyCsv': 'Copy CSV',
    'table.copyJson': 'Copy JSON',
    'prompt.builtin': 'Built-in',
    'prompt.contentPlaceholder': 'Prompt content. Use {{variable}} for variables',
    'prompt.descriptionPlaceholder': 'Description (optional)',
    'prompt.detailPlaceholder': 'Select a prompt on the left to view details',
    'prompt.editTitle': 'Edit Prompt',
    'prompt.empty': 'Click "New" to create your first prompt',
    'prompt.favorite': '☆ Favorite',
    'prompt.favorited': '★ Favorited',
    'prompt.filterAll': 'All',
    'prompt.filterBuiltin': 'Built-in',
    'prompt.filterFavorites': 'Favorites',
    'prompt.filterUser': 'Mine',
    'prompt.newTitle': 'New Prompt',
    'prompt.notUsed': 'Not used',
    'prompt.searchEmpty': 'No matching prompts',
    'prompt.searchPlaceholder': 'Search...',
    'prompt.sourceBuiltin': 'Built-in',
    'prompt.sourceUser': 'Mine',
    'prompt.tagsPlaceholder': 'Tags, comma-separated',
    'prompt.title': 'Prompt Library',
    'prompt.titlePlaceholder': 'Title',
    'prompt.used': 'Used {count} times',
    'prompt.usedLast': 'Used {count} times · Last {date}',
    'selection.count': '{count} selected',
    'selection.move': 'Move Selected',
    'selection.remove': 'Remove Selected',
    'settings.exportFolders': 'Export Folder JSON',
    'settings.hideNative': 'Hide chats from history after adding them to folders',
    'settings.importFolders': 'Import Folder JSON',
    'settings.restoreBackup': 'Restore Pre-import Backup',
    'settings.title': 'Folder Settings',
    'status.importComplete': 'Import complete: {folders} folders added, {conversations} chats added.',
    'status.restoreComplete': 'Restored folder data to the state before the last import.',
    'status.restoreMissing': 'No pre-import backup is available.',
  },
} as const;

export type MessageKey = keyof typeof messages['en-US'];

export function t(locale: AppLocale, key: MessageKey, params: Params = {}): string {
  const template = messages[locale][key] ?? messages['en-US'][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''));
}

export function detectLocale(doc: Document = document): AppLocale {
  const explicit = detectExplicitLocale(doc);
  if (explicit) return explicit;

  const nav = doc.defaultView?.navigator;
  const candidates = [...(nav?.languages ?? []), nav?.language].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate);
    if (locale) return locale;
  }

  return 'en-US';
}

export function detectExplicitLocale(doc: Document = document): AppLocale | null {
  for (const element of [doc.documentElement, doc.body]) {
    if (!element) continue;
    for (const attr of LOCALE_ATTRS) {
      const value = element.getAttribute(attr);
      const locale = value ? normalizeLocale(value) : null;
      if (locale) return locale;
    }
  }

  return null;
}

export function observeLocaleChanges(onChange: (locale: AppLocale) => void): () => void {
  const emit = () => onChange(detectLocale());
  const observer = new MutationObserver(emit);
  const config: MutationObserverInit = {
    attributes: true,
    attributeFilter: LOCALE_ATTRS,
  };

  observer.observe(document.documentElement, config);
  if (document.body) observer.observe(document.body, config);

  return () => observer.disconnect();
}

export function normalizeLocale(value: string): AppLocale {
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith('zh')) return 'zh-CN';
  if (normalized.startsWith('en')) return 'en-US';
  return 'en-US';
}
