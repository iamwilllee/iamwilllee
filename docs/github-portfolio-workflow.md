# GitHub → 项目 README → Profile → 个人站点

2026-10-15，Asia/Shanghai。手动工作台已合并，默认入口为 http://127.0.0.1:4318/。各步骤由用户发起。

## 现在怎么使用

在当前项目运行 `pnpm portfolio:workbench`，或在 Codex 中说“打开作品集工作台”。原有 `pnpm portfolio:builder` 也进入新版。

1. **仓库总览**：查看已盘点的仓库、图文稿和展示状态。点击“刷新 GitHub 仓库”更新远端元数据；这一步不等于重新分析源码。
2. **项目 README**：选一个项目，填写主题、修改要求和保留选项，保存为 Codex 优化任务。
3. 回到聊天说 **“优化工作台选中的项目”**。`github-portfolio` 读取任务，复用 `readme-designer` 分析真实项目、设计文案与配图，将独立新稿回写工作台。
4. 页面点“刷新结果”，查看当前稿、原说明和内容依据。确认后点“采用当前稿与展示资料”，供后续 Profile 与站点使用。
5. **Profile README**：编辑个人介绍与个人站点入口，独立选择和排序作品。最多四个设为“精选”并配短介绍，以双列展示；其余设为“普通”，填写分类后显示文字链接，点击“生成并预览”。
6. **个人站点**：独立选择和排序上站作品，点击“生成并预览”。两类输出共享已确认的项目名称、摘要、入口与封面。

页面负责配置、保存和预览；AI 分析、写作与生图在 Codex 聊天中执行。保存任务后页面明确显示“等待 Codex”，不会假装网页后台已开始调用当前聊天的生图工具。

本地采用、生成、提交、推送和部署分别处理；本轮合并没有提交或发布其他仓库。

## 后续同步与暂停项目（2026-10-27）

仓库卡片和项目详情均提供“暂停优化 / 恢复优化”。参与 README 优化、展示在 Profile、展示在站点是三个独立设置：项目可以暂停优化，同时继续展示此前确认的内容；也可以优化文档而不加入作品集。

暂停后保留当前稿件、素材和公开展示资料，取消待执行的优化任务，并阻止新任务和迟到的新稿回写。恢复后重新准备任务。旧项目沿用当前启用状态，不替用户决定停用哪些项目；新发现仓库默认暂停，等用户手动启用。

手动更新的顺序：刷新 GitHub 仓库 → 查看“待核对 / 待优化”清单 → 选中参与优化的项目交给 Codex 核对源码 → 预览并采用 → 重新生成 Profile / 站点 → 按用户要求发布。仓库更新时间变化只代表需要核对，不等于必须重写 README 或重做封面。

```sh
# 只查看上次盘点的同步清单，输出包含 checkedAt
node skills/github-portfolio/scripts/cli.mjs plan --workspace .
# 手动刷新远端元数据，再输出清单；不进行 AI 优化或发布
node skills/github-portfolio/scripts/cli.mjs sync --workspace .
```

本轮没有执行远端全量同步、停用任何实际项目，也没有创建定时任务。

## 已导入的内容

- 17 个个人仓库与图文 README 资料。
- 初次迁移保留了 5 个 Profile 作品和 6 个站点作品；本次发布按用户要求统一展示六个作品。
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

首次迁移复用 `.portfolio-builder/config.json`、批量图文稿与公开项目资料。2026-10-31 起，正式站点从根 `portfolio-data.json` 读取公开个人介绍和完整项目清单，Profile 的图文版式不再决定网站展示数量。旧仓库没有清单时仍支持从原 README 表格迁移；有清单但内容无效时会报错，不回退到 Profile。

`pnpm sync:portfolio` 从清单及其引用的素材生成 `portfolio/`，同步共享 CSS / JS 和 favicon。`pnpm check:portfolio` 核对所有输出字节。Profile 的精选、分类与短介绍仅影响 Profile；网站继续使用独立的选择、完整摘要和站点封面。

工作台生成站点时也输出 `site/portfolio-data.json`，只含已确认的公开文案、产品入口与配图路径，不包含私有仓库地址、任务和分析快照。用户要求发布时，将该清单及引用的 `assets/` 素材一起整理到根目录（已有素材路径可复用，调整清单引用后再生成），同时将 Profile README 与其精选配图整理到根目录。不要再从 Profile 的四张卡片重新构造全部站点项目；提交前运行同步、README 校验和发布检查。本地生成不会自动提交或发布。

状态使用原子写入与版本冲突检查。页面的主题要求、保留选项与任务刷新后可恢复；Profile 与站点分别提示已生成结果是否需要更新。

## 站点项目配图规范

主推作品、普通卡片和手机端统一采用 **16:9**。素材建议 1600×900，最低 1280×720；画面满幅，不在图内添加留白边框或长文案。项目名称和介绍由页面原生文字承载。按各产品定位设计主题概念配图，真实产品截图保留在项目 README 中。

`assets/project-covers/manifest.json` 保存本站六个项目的配图、主题与内置 image_gen 提示词。导入后保存在项目的独立 `siteCover` 字段，默认只供站点使用；项目 README 的封面保留选项与已发布文档保持各自的状态。用户明确要求 Profile 同步配图时，导入命令可加 `--include-profile`，本次发布已同步采用。以后重新采用 README 或点击生成站点，也不会丢失这组站点配图。

```sh
node skills/github-portfolio/scripts/cli.mjs import-site-covers --workspace . --manifest assets/project-covers/manifest.json
node skills/github-portfolio/scripts/cli.mjs generate-site --workspace .
```

导入会核对所有项目、PNG 尺寸和 16:9 比例（允许 1px 取整误差）后统一保存；输出容器使用固定比例与满幅图片定位，避免图片自身高度改变容器。窄屏按单列展示，让图片仍有足够的可读尺寸。

## 本轮验证

- 13 个测试通过，覆盖迁移、独立展示选择、新稿回写、采用边界、冲突、保留封面、独立站点配图与失败恢复，以及暂停任务、拒绝迟到回写、刷新后保留开关、新项目默认暂停和已核实更新基线。
- 工作台与生成器语法检查、根 Profile README 六张图片校验，以及正式站点与 README 的内容和素材同步检查通过。
- 浏览器验证了搜索、Fluo 任务保存及重载恢复、聊天侧读取同一任务、Profile 与站点生成。
- 检查桌面和 390px 手机布局、六张新配图加载与满幅 16:9 尺寸、筛选和搜索；页面重新生成后保留新配图。找不到文件后服务继续响应。

本站六张展示配图已经按各项目主题重新生成并验收；其他项目 README 的北欧初稿仍是对照稿，不代表全部仓库都完成主题重设计。


## Profile 精简版（2026-10-31，本地预览）

当前 12 个作品中，Aster、Makenue、栖栏 · Perch、Runo 作为四个精选；其他八个按“研究与创作 / 亲子与家庭 / 日常工具”分类。所有文字和入口仍为原生 GitHub Markdown / HTML，图片最多四张，复用现有封面；Runo 的 Profile 原图与网站 16:9 配图分别保留。

配置保存在 `profileLayout.featuredRepos` 与 `profileLayout.entries`，生成器兼容此前没有版式配置的状态，默认精选四个。取消 Profile 勾选代表不展示，与 README 优化开关、上站选择互不影响。修改分类、短介绍或精选只使 Profile 预览过期，不要求重新生成网站。
