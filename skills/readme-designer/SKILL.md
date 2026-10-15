---
name: readme-designer
description: 用 AI 理解项目或个人作品，按指定主题生成封面、图文展示和 GitHub 兼容的 README。用于图文 README 重设计、项目介绍或 Profile 作品集，支持宜家风格等自定义主题。
---

把 README 当作有事实依据的图文出版物。项目模式面向使用者；Profile 模式面向认识作者和浏览作品的人。两种模式共享主题和素材管理，不需要生成网站。

## 工作方式

- 以实际工作目录或用户指定仓库为输入。先读现有 README、相关清单、使用入口、发布信息和已有素材；项目能力以实现和发布边界为依据。只读少量相关源文件来解决关键事实，不把整个仓库变成长篇说明。
- 首次图文实验先输出到独立目录，保留原 README。用户明确要求替换时再应用。读取当前配置和用户已有修改，保持未要求改动的内容。
- 把指定主题转成配色、图片构图、素材类型和段落密度，参考 [主题与图片](references/themes.md)。AI 生成封面与概念插画时优先使用可用的 imagegen；如果不能调用，报告能力缺口，不把简单形状冒充 AI 配图。
- 产品截图用真实界面素材。测试或演示数据、概念画面、生成图片分别标记来源。AI 图可借用品牌参考，但不能把生成的 UI 当成产品截图或功能证据。
- 以 Markdown 为主，少量 `picture`、`img`、`table`、`details` 和 `summary` 组合图文。主题主要由图像实现；不依赖 GitHub 会过滤的 CSS、style、class、脚本和 iframe。标题、功能、安装命令及链接保留为原生文字，图片提供 alt。
- 少量有效图像配简短说明，避免做一张包含全部文档的巨型图片。开发细节可折叠，关键支持范围、下载限制和安装要求要在行动附近可见。
- 图片保存在输出目录内，README 使用相对链接。主题与素材的关系记录在 `.readme-design.json`，关键事实及证据放在 `provenance.md`；以后只更新受变化影响的章节和素材。

## 预览与交付

`scripts/preview.mjs --readme <README 绝对路径> --port 4319` 默认在本地渲染 GFM，优先使用宿主已有的 marked；可用 `--marked-module <marked 模块文件>` 传入 bundled runtime 的模块路径。Codex desktop 可通过 `load_workspace_dependencies` 找到已提供的包，不为此新增项目依赖。已渲染的内容可用 `--offline` 重开。

本地预览不替代真实仓库页面的最终验收。预览样式和控件不写进 README。用户明确允许向 GitHub 提交这份内容做渲染验证后，才可使用 `--github-render`；它会将 Markdown 发送到 GitHub Markdown API，使用 gh 已有凭据且不保存凭据。私有项目默认本地预览。

生成后运行 `scripts/validate.mjs <README 路径>`，并在浏览器检查图片加载、图文尺寸、折叠区、锚点、深浅模式和窄屏。交付 Markdown、图片、主题配置和可看的预览；说明内容依据及检查范围。提交、推送和发布遵从用户已有授权，不由读取素材或预览行为推导授权。
