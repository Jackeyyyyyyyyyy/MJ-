# MJ 审批中心

MJ 审批中心是一套面向企业内部审批流转的 Web 系统。项目提供员工发起申请、审批人处理待办、老板查看全局数据、超级管理员维护账号/组织/流程/表单/AI 提示词等能力，适合课程设计、原型交付或轻量级内部流程演示。

## 功能概览

- 登录与权限：支持员工、老板、超级管理员三类视角，超级管理员可切换业务视角。
- 审批工作台：员工可创建审批、查看自己发起的申请、处理分配给自己的审批、查看抄送。
- 全局看板：老板和超级管理员可查看全部审批记录，并按状态、模块、关键字检索。
- 动态业务表单：审批模块、审批类型和字段由表单配置驱动，支持在线维护。
- 审批流配置：支持组织架构、指定成员、多级主管、会签/或签、条件分支、AI 分支和抄送规则。
- 附件上传：审批申请支持附件上传，详情页支持预览或下载。
- AI 审批建议：配置 OpenAI 兼容接口后，可为新申请生成风险提示和审批建议。
- AI 管理助手：老板和超级管理员可用自然语言分析审批数据。
- 数据备份：提供独立备份页，可下载或恢复持久化数据目录。

## 技术栈

- React 19
- TypeScript
- Vite 6
- Tailwind CSS 4
- Express 4
- date-fns
- lucide-react
- motion

## 项目结构

```text
.
├─ public/                 静态资源
├─ scripts/                本地启动脚本
├─ server/                 Express API 与生产静态服务
├─ src/                    React 前端源码
│  ├─ components/          页面与业务组件
│  ├─ lib/                 通用工具
│  ├─ approvalSchema.ts    内置审批表单 Schema
│  ├─ auth.ts              登录态与视角处理
│  ├─ storage.ts           前端 API 封装
│  └─ types.ts             共享类型定义
├─ .env.example            环境变量模板
├─ 开始.bat                Windows 一键启动入口
├─ package.json            项目依赖与命令
└─ vite.config.ts          Vite 配置
```

以下目录属于本地运行产物，已经写入 `.gitignore`，提交或打包源码时不要包含：

```text
node_modules/              依赖目录，可通过 npm install 重新生成
dist/                      构建产物，可通过 npm run build 重新生成
data/                      本地持久化数据、账号、附件和流程配置
.env.local                 本地环境变量，可能包含密码或 API Key
```

## 本地运行

### 方式一：Windows 一键启动

双击项目根目录下的 `开始.bat`。

首次启动时脚本会创建并打开 `.env.local`，确认配置后保存并关闭记事本，脚本会继续启动后端 API 和前端开发服务。

访问地址：

```text
http://localhost:3000
```

### 方式二：手动启动

安装依赖：

```powershell
npm install
```

准备本地环境变量：

```powershell
Copy-Item .env.example .env.local
```

至少需要配置：

```text
APP_PASSWORD="用于本地演示的登录密码"
AUTH_SECRET="一段足够长的随机字符串"
```

启动后端 API：

```powershell
npm run api
```

再打开一个终端启动前端：

```powershell
npm run dev
```

前端默认运行在 `http://localhost:3000`，后端默认运行在 `http://localhost:8080`。开发环境下，Vite 会把 `/api` 请求转发到后端。

## 登录账号

超级管理员账号由环境变量控制：

```text
SUPER_ADMIN_USERNAME="developer"
SUPER_ADMIN_NAME="超级管理员"
SUPER_ADMIN_PASSWORD="超级管理员密码"
```

如果没有设置 `SUPER_ADMIN_PASSWORD`，后端会使用 `APP_PASSWORD` 作为超级管理员密码。

首次启动时，系统会在 `data/approval-accounts.json` 中生成三组演示账号：

```text
applicant   张申请   员工   默认密码 123456
approver    李审批   员工   默认密码 123456
boss        王老板   老板   默认密码 123456
```

超级管理员登录后，可在“账号权限管理”中创建新账号、启停账号、修改角色和重置密码。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `DATA_DIR` | 本地数据目录，默认 `./data` |
| `APP_PASSWORD` | 未单独配置超管密码时使用的登录密码 |
| `AUTH_SECRET` | 登录 token 签名密钥，生产环境必须设置为强随机字符串 |
| `AUTH_TOKEN_TTL_MS` | 登录有效期，默认 8 小时 |
| `SUPER_ADMIN_USERNAME` | 超级管理员用户名，默认 `developer` |
| `SUPER_ADMIN_NAME` | 超级管理员显示名称 |
| `SUPER_ADMIN_PASSWORD` | 超级管理员密码 |
| `BACKUP_ADMIN_USER` | 备份页用户名 |
| `BACKUP_ADMIN_PASSWORD` | 备份页密码 |
| `BACKUP_TOKEN_TTL_MS` | 备份页登录有效期 |
| `BACKUP_UPLOAD_LIMIT_BYTES` | 备份恢复文件大小限制，默认 300 MB |
| `JSON_BODY_LIMIT` | JSON 请求体大小限制 |
| `MAX_UPLOAD_FILE_BYTES` | 单个附件大小限制 |
| `MAX_UPLOAD_BATCH_BYTES` | 单次上传总大小限制 |
| `OPENAI_API_KEY` | AI 接口密钥 |
| `OPENAI_API_BASE` | OpenAI 兼容接口地址 |
| `OPENAI_MODEL` | AI 模型名称 |
| `AI_REQUEST_TIMEOUT_MS` | AI 请求超时时间 |

AI 相关变量不配置时，普通审批流程仍可正常使用，只是 AI 建议和 AI 管理助手会显示未启用或生成失败。

## 数据说明

后端优先使用以下路径作为持久化数据目录：

```js
process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || "./data"
```

运行时会在数据目录中维护这些文件：

```text
approval-records.json             审批记录兼容文件
approval-accounts.json            普通账号数据
approval-uploads.json             附件索引
approval-schema.json              在线维护后的业务表单 Schema
ai-prompt-configs.json            各审批类型的 AI 提示词
ai-assistant-config.json          AI 管理助手提示词
ai-branch-decision-logs.json      AI 分支判断日志
organization-directory.json       组织架构
workflow-templates.json           审批流模板
business-records/*.json           按业务类型拆分的审批记录
uploads/*                         附件实体文件
```

这些文件是运行数据，不建议作为源码提交。交付源码时保留 `.env.example` 即可；需要演示历史数据时再单独说明并打包 `data/`。

## 常用命令

```powershell
npm run dev      # 启动前端开发服务
npm run api      # 启动后端 API
npm run build    # 构建生产前端产物
npm start        # 构建后启动生产服务
npm run preview  # 本地预览前端构建产物
npm run lint     # TypeScript 类型检查
npm run clean    # 删除 dist 构建目录
```

`npm start` 会先执行 `npm run build`，再由 Express 提供 API 和 `dist/` 静态文件。

