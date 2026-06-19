# Better DeepSeek

[中文](#中文说明) | [English](#english)

## English

Better DeepSeek is a local-first browser extension for [DeepSeek Chat](https://chat.deepseek.com/). It adds conversation folders, a prompt library, quote reply, table copy tools, tab title sync, and a small popup escape hatch for everyday DeepSeek workflows.

> Local-first. No telemetry. No chat upload.

## Features

- **Conversation folders**: organize DeepSeek chats into folders and subfolders.
- **Pinned workspace**: pin frequently used folders and conversations.
- **Prompt library**: create, favorite, tag, search, import, export, and reuse prompts.
- **Quote reply**: select text from a response and continue the conversation with context.
- **Table tools**: copy generated tables as Markdown, CSV, or JSON.
- **Popup escape hatch**: enable or disable Better DeepSeek, open or close folders and the prompt library, import/export backups, reset UI state, and copy diagnostics.
- **Local backup**: export and import folder data as JSON.
- **Theme support**: follows DeepSeek light and dark appearance.
- **Bilingual UI**: supports Chinese and English, following the DeepSeek page language when possible.

## Privacy

Better DeepSeek stores its data locally in your browser.

- No analytics.
- No telemetry.
- No account system.
- No tracking scripts.
- No remote code execution.
- Your folder and prompt data are stored with browser storage.
- Your chat content is not uploaded by this extension.

The extension currently declares access to `chat.deepseek.com` for content-script features and `www.deepseek.com` for DeepSeek-related pages.

## Installation From Source

```bash
git clone https://github.com/fly233338/better-deepseek.git
cd better-deepseek
npm install
npm run build
```

Then load the extension manually:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the generated `dist` folder.
5. Open `https://chat.deepseek.com/`.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

Project layout:

```txt
src/
  content/   Injected UI, feature modules, i18n, and theme handling
  core/      Storage, folder/prompt stores, import/export, runtime messages
  deepseek/  DeepSeek-specific DOM adapters and composer helpers
data/
  prompts/   Built-in prompt source data
public/
  _locales/  Browser extension locale metadata
```

## Contributing

Pull requests and issues are welcome. Please use the GitHub templates in `.github/`.

Before opening a pull request, run:

```bash
npm run typecheck
npm test
npm run build
```

For UI changes, please include screenshots, a GIF, or a short video, and check both light and dark themes.

## Status

Better DeepSeek is in early development. DeepSeek Web may change its DOM structure, so some injected UI behavior may need updates over time. The popup provides a recovery entry point if the page UI changes unexpectedly.

## License

MIT

---

# 中文说明

Better DeepSeek 是一个面向 [DeepSeek Chat](https://chat.deepseek.com/) 的本地优先浏览器扩展。它为 DeepSeek 网页增加对话文件夹、提示词库、引用回复、表格复制工具、标签页标题同步，以及一个用于恢复和备份的 popup 入口。

> 本地优先。不上传聊天记录。不做遥测。

## 功能特性

- **对话文件夹**：把 DeepSeek 对话整理到文件夹和子文件夹中。
- **置顶工作区**：置顶常用文件夹和对话。
- **提示词库**：创建、收藏、打标签、搜索、导入、导出并复用提示词。
- **引用回复**：选中回复中的文本，带着上下文继续提问。
- **表格工具**：将 AI 生成的表格复制为 Markdown、CSV 或 JSON。
- **Popup 逃生入口**：启用或禁用 Better DeepSeek，打开或关闭文件夹和提示词库，导入/导出备份，重置 UI，复制诊断信息。
- **本地备份**：将文件夹数据导出或导入为 JSON。
- **主题适配**：跟随 DeepSeek 的浅色和深色外观。
- **中英双语界面**：支持中文和英文，并尽量跟随 DeepSeek 页面语言。

## 隐私说明

Better DeepSeek 将数据保存在你的浏览器本地。

- 不包含统计分析。
- 不包含遥测。
- 不需要账号系统。
- 不包含追踪脚本。
- 不执行远程代码。
- 文件夹和提示词数据使用浏览器存储保存。
- 本扩展不会上传你的聊天内容。

扩展当前声明访问 `chat.deepseek.com` 以运行内容脚本功能，并声明访问 `www.deepseek.com` 以适配 DeepSeek 相关页面。

## 从源码安装

```bash
git clone https://github.com/fly233338/better-deepseek.git
cd better-deepseek
npm install
npm run build
```

然后手动加载扩展：

1. 打开 `chrome://extensions`。
2. 启用 **开发者模式**。
3. 点击 **加载已解压的扩展程序**。
4. 选择生成的 `dist` 文件夹。
5. 打开 `https://chat.deepseek.com/`。

## 开发

```bash
npm install
npm run typecheck
npm test
npm run build
```

项目结构：

```txt
src/
  content/   注入页面的 UI、功能模块、i18n 和主题适配
  core/      存储、文件夹/提示词状态、导入导出、运行时消息
  deepseek/  DeepSeek 页面相关 DOM 适配和输入框辅助逻辑
data/
  prompts/   内置提示词源数据
public/
  _locales/  浏览器扩展本地化元数据
```

## 参与贡献

欢迎提交 issue 和 pull request。请使用 `.github/` 中的 GitHub 模板。

提交 pull request 前，请运行：

```bash
npm run typecheck
npm test
npm run build
```

如果是界面改动，请附上截图、GIF 或短视频，并检查浅色和深色主题。

## 项目状态

Better DeepSeek 仍处于早期开发阶段。DeepSeek 网页可能调整 DOM 结构，因此部分注入式 UI 行为后续可能需要适配。若页面 UI 出现异常，可以通过 popup 作为恢复入口。

## 许可证

MIT
