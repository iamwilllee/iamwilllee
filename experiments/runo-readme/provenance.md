# Runo README 实验 · 内容与素材依据

资料核对日期：2026-10-14，Asia/Shanghai。GitHub main 与本地 HEAD 均为 `ce302e808573800c463d0df6fc8d57122cab34de`。

| 内容 | 来源 | 本次检查 |
| --- | --- | --- |
| 版本 0.12.1、MyGo 0.4.5、开发检查命令 | 本地 package.json、go.mod，与远端 README 对照 | 已读取；未重新构建 Runo |
| Apple Silicon、macOS 13+、私有下载、ad hoc 签名 | README、docs/install.md | 已读取；没有新增发行声明 |
| 本地项目发现、需确认配置 | README、internal/discovery/codex.go | 已读对应实现和说明 |
| 纯净模式、运行目标总览 | README、src/main.tsx 的 runningTargets / runo.panel.pure | 已读实现；没有把快照写成实时画面 |
| 浮窗、窗口恢复、外部服务只读 | README、docs/install.md、docs/validation.md | 已读项目说明与已有验收记录 |
| Codex 插件安装步骤 | docs/install.md、README | 与现有说明一致；没有执行安装 Runo 的命令 |
| AI 封面 | 内置 imagegen，Runo 图标为参考 | 已目视检查，概念配图 |
| 侧栏截图 | .qa/runo-sidebar-current.png | 已目视检查；隔离演示项目 |
| 纯净模式、浮窗截图 | .qa/pure-mode-360.png、.qa/floating-web-360.png | 已目视检查；界面演示数据，非当前真实项目运行证明 |

源文件：[README](https://github.com/iamwilllee/runo/blob/ce302e808573800c463d0df6fc8d57122cab34de/README.md)、[安装指南](https://github.com/iamwilllee/runo/blob/ce302e808573800c463d0df6fc8d57122cab34de/docs/install.md)、[验收记录](https://github.com/iamwilllee/runo/blob/ce302e808573800c463d0df6fc8d57122cab34de/docs/validation.md)。

## 范围

这是独立的 README 图文与主题实验，原 Runo README 和应用源文件未修改。安装包访问限制在文中保留；未提交、推送或发布。截图复用已有验收素材，未以此宣称本次重新完成原生应用验收。

## 本地预览验收

- 1440px 桌面与 390px 手机视口已目视检查；手机页面宽度与内容宽度均为 390px，没有整体横向溢出。
- 5 张正文图片均已加载；开始使用锚点、两处折叠说明、浅色和深色预览已操作检查。
- README 素材与兼容性检查、Skill 结构检查通过；现有仓库 6 项测试和 builder/portfolio 检查通过。未重新构建 Runo。
- GitHub Markdown API 的渲染尝试被自动审批拒绝，原因是这份含私有项目资料的具体内容未获外发授权。随后采用完全本地的 marked 渲染，未上传该 README。真实 GitHub 仓库页的最终效果尚未验收。
