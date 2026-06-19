# Agent Rules for Better DeepSeek

## i18n (中英双语适配)

- 所有用户可见文案必须通过 `t(locale, 'key', params)` 渲染，禁止硬编码中文或英文。
- i18n 字典定义在 `src/content/i18n.ts` 的 `messages` 对象中，每个 key 必须有 `'zh-CN'` 和 `'en-US'` 两个条目。
- 新功能新增文案时，先在 `messages` 中 `'zh-CN'` 和 `'en-US'` 分别添加对应的 key-value，再在代码中使用 `t(locale, 'key', params)` 引用。
- 参数化文案使用 `{param}` 占位符，例如 `'used {count} times'`，调用时传 `{ count: n }`。
- 当前语言通过 `detectLocale()` 自动检测（优先 DeepSeek 页面语言属性，回退到浏览器语言），通过 `observeLocaleChanges()` 监听变化。
- locale 变化时通过 `updateQuoteReplyLocale(locale)` 等更新已有 UI 元素文案。

## Theme (深浅主题适配)

- 所有颜色值必须使用 CSS 自定义属性（`var(--bd-xxx)`），禁止硬编码颜色值。
- 主题 token 定义在 `src/content/styles.css` 的 `.bd-theme-light` 和 `.bd-theme-dark` 中。
- 新功能添加 UI 元素时，需通过 `applyThemeClass(element, themeMode)` 挂载主题 class。
- 当前主题通过 `detectThemeMode()` 自动检测（优先 DeepSeek 页面属性，回退到 `prefers-color-scheme`），通过 `observeThemeChanges()` 监听变化。
- 主题变化时通过 `updateQuoteReplyTheme(mode)` 等更新已有 UI 元素主题。
- 新建的浮动/弹窗元素必须应用主题，例如 `this.themeElement(overlay)` 或 `applyThemeClass(btn, theme)`。
