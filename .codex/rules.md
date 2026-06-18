# Agent Rules

1. 必须维护 `docs/overview.md`，任何架构、数据流、模块边界、路线图变化都要同步更新。
2. 必须维护 `docs/development-checklist.md`，每实现一个功能，用简单清晰的话总结功能、状态、关键文件和验证方式。
3. 功能实现遇到不确定或出错时，优先探查 DeepSeek 网页真实行为和接口；其次参考 Gemini Voyager、Superpower ChatGPT、DeepSeek Exporter 等公开项目的产品结构和实现思路；不得凭空自造关键逻辑。
4. 参考外部项目时，只参考架构、交互、接口思路和公开行为；不得复制受 GPL 或其他不兼容许可证限制的代码、文案、UI 资产。
5. 每完成一个可验证功能或模块后提交一次 git commit；提交前运行相关测试或手动验证，并让 commit 信息说明用户可见变化。
6. 不要求每次功能都更新 README；README 在阶段性版本完成后统一整理。
