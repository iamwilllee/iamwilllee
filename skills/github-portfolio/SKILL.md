---
name: github-portfolio
description: 打开并操作 GitHub 作品集手动工作台，承接页面选中的项目优化任务，将 README、Profile 和个人站点串联。用于打开作品集工作台或优化工作台选中的项目。
---

使用当前聊天的实际 workspace，工作台数据位于其 `.portfolio-workbench/`。服务与页面负责保存选择和预览；需要 AI 的分析、写作和配图在当前聊天执行。所有步骤由用户手动发起。

## 打开工作台

运行本 Skill 的 `scripts/server.mjs --workspace <实际目录>`，默认绑定 127.0.0.1:4318，已有同一工作区服务则复用。`marked` 优先使用宿主已有模块，可通过 `--marked-module <文件>` 指定，不为预览安装项目依赖。用浏览器打开服务输出 URL。

首次启动导入 workspace 内已有的 portfolio-builder 配置、项目图文稿和已确认展示资料，保留 Profile 与站点的独立选择。数据与私有项目草稿应被 Git 忽略。

## 手动同步与优化范围

用户说“同步我的项目”时，运行 `scripts/cli.mjs sync --workspace <实际目录>`，刷新 GitHub 仓库元数据并列出待核对项目；`plan` 只查看已缓存的清单。按清单的 `checkedAt` 说明检查时间，`pushed_at` 变化只是核对线索，仍需读取源码判断 README 是否需要更新。没有变化时不重做配图。

核对默认分支实际提交与相关差异后，可用 `record-check --workspace <实际目录> --repo <仓库> --source-sha <完整 SHA> --pushed-at <本次仓库更新时间> --summary <检查结论>` 保存检查基线；确认需更新文档时加 `--needs-update`。这不会修改原分析快照、README 或已确认展示资料，原有设计任务仍保留。只要求检查时报告结论，不自动执行设计或发布。

每个项目的 `optimizationEnabled` 独立控制 README 优化，旧记录缺失时沿用启用状态；新发现仓库默认暂停。暂停项目仍在仓库清单中，可继续展示已确认内容，但不创建或回写优化任务，也不纳入批量优化。暂停会取消该项目已有的待执行任务；恢复后需重新准备任务。不要自行替用户选择停用项目。

参与优化、Profile 展示、站点展示分别配置。手动同步本身不会写回任何 GitHub README 或发布站点，采用和发布按用户本次要求继续执行。

## 优化工作台选中的项目

读取已保存任务：

```sh
node <本 Skill>/scripts/cli.mjs request --workspace <实际目录>
```

任务包含准确仓库、当前稿目录、源版本、目标主题、修改要求和封面/文案保留选项。只处理该任务；没有任务时先让用户在项目详情保存选择，不按最近项目猜测。

结合可用的 `readme-designer` 执行项目分析和设计。重新读取选中仓库的相关文件核对当前能力；按用户保留选项处理现有文案和图片。将新 README、素材、主题配置和内容依据输出到独立目录，验证相对图片、链接、Markdown 以及渲染，不把图片概念图当作 UI 证据。

完成后回写：

```sh
node <本 Skill>/scripts/cli.mjs import --workspace <实际目录> --repo <任务仓库> --request <任务 ID> --draft <独立稿件目录> --source-sha <核对后的提交 SHA>
```

回写会检查任务是否仍有效、当前文档基线和锁定封面；新稿进入“待采用”，不会替换已确认的公开展示资料。告诉用户回到工作台点击“刷新结果”预览，在页面采用后再供 Profile 和站点使用。若中途失败保留旧稿，说明具体未完成部分。

## Profile 与站点

读取用户在页面保存的选择，用 `cli.mjs generate-profile` 或 `generate-site`（均需 `--workspace`）生成本地结果。页面也提供相同生成按钮。生成只使用已确认展示资料与允许公开的封面，私有仓库不输出源码链接；Profile 与站点可以选择不同作品。Profile 的 `profileLayout` 单独配置最多四个精选（双列配图）、其他作品的分类和短介绍；没有版式配置时默认精选四个。普通作品只生成分类文字链接，个人站点入口使用 `profile.website`。不要将所有项目重新排成长列大图。

生成站点同时输出公开的 `site/portfolio-data.json`。正式站点以根 `portfolio-data.json` 为来源，清单只含已确认的公开个人资料、项目文案、入口与素材路径；没有清单的旧仓库兼容原 README 表格。发布时把清单和引用的素材一起整理，再运行 `pnpm sync:portfolio` 与 `pnpm check:portfolio`。不要从精简 Profile 的四张卡片推导完整网站清单。

本地采用、生成、提交、推送和部署是不同状态。仅在用户授权的范围内提交或发布；工作台“采用当前稿”只保存本地确认。保持现有项目源文件与其他仓库不变。
