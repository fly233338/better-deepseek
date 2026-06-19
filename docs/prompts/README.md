# Better DeepSeek 提示词库

为 [Better DeepSeek](https://github.com/fly233338/better-deepseek) 浏览器扩展提供的官方提示词集合。

## 目录结构

| 目录/文件 | 用途 |
|-----------|------|
| `docs/prompts/` | 面向人类的文档和 awesome 风格展示 |
| `data/prompts/index.json` | 插件读取的数据源（由 Markdown 生成） |
| `scripts/build-prompts.mjs` | Markdown → JSON 生成脚本 |

## 贡献指南

1. 在 `docs/prompts/awesome-deepseek-prompts.md` 中按分类添加新提示词。
2. 每条提示词使用以下格式：

```markdown
### 标题

描述文字。

```text
提示词正文（使用 {{变量名}} 标记变量）
```

tags: 分类标签1, 分类标签2
```

3. 运行 `node scripts/build-prompts.mjs` 重新生成 `data/prompts/index.json`。
4. 提交 PR 并确保 JSON schema 校验通过。

## 提示词规范

- 标题简洁，描述一句话说明用途。
- 变量使用 `{{变量名}}` 语法，插件会自动弹出填写表单。
- 标签全部使用中文，逗号分隔。
- 禁止 jailbreak、NSFW、违法内容。
