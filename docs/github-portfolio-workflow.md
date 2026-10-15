# GitHub → 项目 README → Profile → 个人站点

2026-10-15，Asia/Shanghai。手动工作台已合并，默认入口为 http://127.0.0.1:4318/。各步骤由用户发起。

## 现在怎么使用

在当前项目运行 `pnpm portfolio:workbench`，或在 Codex 中说“打开作品集工作台”。原有 `pnpm portfolio:builder` 也进入新版。

1. **仓库总览**：查看已盘点的仓库、图文稿和展示状态。点击“刷新 GitHub 仓库”更新远端元数据；这一步不等于重新分析源码。
2. **项目 README**：选一个项目，填写主题、修改要求和保留选项，保存为 Codex 优化任务。
3. 回到聊天说 **“优化工作台选中的项目”**。`github-portfolio` 读取任务，复用 `readme-designer` 分析真实项目、设计文案与配图，将独立新稿回写工作台。
4. 页面点“刷新结果”，查看当前稿、原说明和内容依据。确认后点“采用当前稿与展示资料”，供后续 Profile 与站点使用。
5. **Profile README**：编辑个人介绍，独立选择和排序代表作品，点击“生成并预览”。
6. **个人站点**：独立选择和排序上站作品，点击“生成并预览”。两类输出共享已确认的项目名称、摘要、入口与封面。

页面负责配置、保存和预览；AI 分析、写作与生图在 Codex 聊天中执行。保存任务后页面明确显示“等待 Codex”，不会假装网页后台已开始调用当前聊天的生图工具。

本地采用、生成、提交、推送和部署分别处理；本轮合并没有提交或发布其他仓库。

## 已导入的内容

- 17 个个人仓库与图文 README 资料。
- 原有 5 个 Profile 作品和 6 个站点作品，保留各自的选择。
- Runo 已发布的北欧版 README，保留原说明与素材。
- 其他项目的北欧初稿作为对照。用户选择的“按项目定位定制主题”保存为目标方向，尚未全部重新生成。
- Fluo 保存了一份示例优化任务：轻盈通透的蓝色方向，重点讲清下载活动和空间账本；当前封面仍是此前初稿。

私有仓库可以有用户确认的公开产品介绍与官网入口；公开输出不包含私有源码链接。未经采用的新稿不会自动改变已有的展示资料或站点封面。

## Skill 与实现职责

| 位置 | 职责 |
| --- | --- |
| `skills/github-portfolio/SKILL.md` | 统一手动入口；读取页面任务、调用设计流程、回写与生成 |
| `skills/github-portfolio/scripts/workbench.mjs` | 状态迁移、任务、采用、版本与两种输出生成 |
| `skills/github-portfolio/scripts/server.mjs` | 本地页面、API、README 预览和站点预览 |
| `skills/github-portfolio/scripts/cli.mjs` | 聊天侧读任务与导入新稿 |
| `skills/readme-designer/` | AI 图文设计、主题、内容依据和 GitHub Markdown 校验 |
| `skills/portfolio-builder/` | 保留已有能力，复用站点渲染器；原入口转到统一工作台 |

`github-portfolio` 已安装到本机 Codex Skills，指向本仓库内的源文件。

聊天侧读取与回写示例：

```sh
node skills/github-portfolio/scripts/cli.mjs request --workspace .
node skills/github-portfolio/scripts/cli.mjs import --workspace . --repo owner/repo --request TASK_ID --draft /absolute/new-draft --source-sha VERIFIED_SHA
```

新稿需要独立输出目录；回写核对任务、文档基线和保留封面要求。只改选中的项目，其他项目保持原状。生成失败保留上一份成功结果。

## 共享数据

```text
.portfolio-workbench/                 # 本地忽略，不提交私有草稿
  workbench.json                      # 仓库、设计、任务、采用状态与独立展示选择
  projects/<stable-id>/
    draft/                            # 初次导入的图文稿、原说明与内容依据
    versions/<request-id>/            # Codex 回写的新稿
    approved/<version>/               # 已确认公开展示封面
  profile/
    README.md
    assets/
  site/
    index.html
    site.css
    site.js
    assets/
```

复用现有 `.portfolio-builder/config.json`、批量图文稿与根 README 做首次迁移，不覆盖这些来源。根 README 和原 `portfolio/` 继续保留；新 Profile 使用 `assets/` 图片路径和可被现有 `parseProjects` 识别的表格结构，尚未替换线上版本。

状态使用原子写入与版本冲突检查。页面的主题要求、保留选项与任务刷新后可恢复；Profile 与站点分别提示已生成结果是否需要更新。

## 本轮验证

- 9 个测试通过，覆盖迁移、独立展示选择、新稿回写、采用边界、冲突、保留封面和失败恢复。
- 工作台与原生成器语法检查通过；原 Profile 的 5 个作品与站点同步检查通过。
- 浏览器验证了搜索、Fluo 任务保存及重载恢复、聊天侧读取同一任务、Profile 与站点生成。
- 检查桌面和 390px 手机布局、图片加载，以及找不到文件后服务继续响应。

真实 AI 新主题的审美验收需要在用户选中任务后继续设计；本轮验证的是已合并工作台及读写链路，没有把旧初稿当作新主题成品。
