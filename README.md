# MJ 审批中心

MJ 审批中心是一个面向企业内部审批流转的 Web 应用，前端使用 React、TypeScript、Vite 和 Tailwind CSS，后端使用 Express。系统支持申请人、审批人、老板视角和超级管理员视角，审批记录、账号、附件、AI 提示词配置都通过服务端持久化到本地或部署环境的文件目录。

## 主要功能

- 登录认证：服务端签发 token，前端保存在浏览器本地会话中。
- 角色视角：申请、审批、老板、超管四类角色，超管可以切换业务视角。
- 申请台账：申请人可新建审批、查看本人历史记录、查看详情和进度。
- 审批处理：审批人和老板可查看待审批记录，并执行批准或驳回。
- 全局看板：老板和超管可查看全部审批记录，按状态筛选和搜索单据。
- 账号权限管理：超管可创建、启停、修改普通账号，并重置密码。
- 业务类型配置：审批模块和字段由 `src/approvalSchema.ts` 统一配置。
- 附件上传：申请表单支持附件上传，详情页支持下载，图片、PDF、文本可预览。
- AI 审批建议：新申请提交后后台生成风险建议，未配置 AI 时不影响正常审批。
- AI 管理助手：老板和超管可查看全局洞察，用自然语言询问审批数据。
- AI 提示词维护：超管可维护每个审批类型的 AI 建议提示词，以及 AI 管理助手提示词。

## 技术栈

- React 19
- TypeScript
- Vite 6
- Tailwind CSS 4
- Express 4
- Motion
- Lucide React
- date-fns

## 项目结构

```text
.
├── public/
│   └── mj-logo.png
├── server/
│   └── index.js
├── src/
│   ├── components/
│   ├── approvalSchema.ts
│   ├── auth.ts
│   ├── storage.ts
│   ├── types.ts
│   ├── App.tsx
│   └── main.tsx
├── data/
│   └── approval-records.json
├── .env.example
├── package.json
├── tsconfig.json
└── vite.config.ts
```

`data/`、`dist/`、`node_modules/` 都不应提交到仓库。`data/` 是本地运行时数据目录，部署时建议挂载持久化存储。

## 本地运行

先安装依赖：

```powershell
npm install
```

启动后端 API：

```powershell
$env:APP_PASSWORD="your-super-admin-password"
$env:AUTH_SECRET="your-long-random-session-secret"
npm run api
```

再开一个终端启动前端：

```powershell
npm run dev
```

默认访问地址：

```text
http://localhost:3000
```

后端默认端口为 `8080`，前端开发服务通过 `vite.config.ts` 把 `/api` 转发到 `http://localhost:8080`。

## 登录账号

超级管理员账号由环境变量控制：

```text
SUPER_ADMIN_USERNAME=developer
SUPER_ADMIN_NAME=超级管理员
SUPER_ADMIN_PASSWORD=your-super-admin-password
```

如果没有设置 `SUPER_ADMIN_PASSWORD`，服务端会使用 `APP_PASSWORD` 作为超管密码。

普通账号在首次启动后端时自动写入 `data/approval-accounts.json`：

```text
applicant   张申请   默认密码 123456
approver    李审批   默认密码 123456
boss        王老板   默认密码 123456
```

超管登录后可在“账号权限管理”中创建新账号、启停账号、修改角色和重置密码。

## 环境变量

复制 `.env.example` 的内容到本地或部署平台的环境变量中。关键配置如下：

```text
DATA_DIR="./data"
APP_PASSWORD="replace-with-a-real-login-password"
AUTH_SECRET="replace-with-a-long-random-session-secret"
AUTH_TOKEN_TTL_MS="28800000"

SUPER_ADMIN_USERNAME="developer"
SUPER_ADMIN_NAME="超级管理员"
SUPER_ADMIN_PASSWORD="replace-with-a-real-super-admin-password"

JSON_BODY_LIMIT="30mb"
MAX_UPLOAD_FILE_BYTES="10485760"
MAX_UPLOAD_BATCH_BYTES="20971520"

OPENAI_API_KEY="replace-with-your-ai-api-key"
OPENAI_API_BASE="https://api.openai.com/v1"
OPENAI_MODEL="replace-with-your-model"
AI_REQUEST_TIMEOUT_MS="12000"

ENABLE_RECORD_DELETE="false"
```

AI 相关变量不配置时，审批流程仍可正常使用，单据详情会显示 AI 建议未启用或生成失败。

## 数据持久化

服务端优先使用以下路径作为数据目录：

```js
process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || "./data"
```

运行时会使用或生成这些文件：

```text
approval-records.json          兼容旧审批记录
approval-accounts.json         普通账号
approval-uploads.json          附件索引
ai-prompt-configs.json         各审批类型 AI 提示词
ai-assistant-config.json       AI 管理助手提示词
business-records/*.json        按业务类型拆分的新审批记录
uploads/*                      附件实体文件
```

## 审批模块

当前审批类型在 `src/approvalSchema.ts` 中维护，包含这些模块：

```text
班列、任务、资金、客户、供应商、订单、提柜、子账号
```

每个模块下的审批类型和字段都由 schema 驱动，左侧菜单、新建申请表单、列表摘要和详情展示都会读取同一份配置。

## 常用命令

```powershell
npm run dev      # 启动前端开发服务
npm run api      # 启动后端 API
npm start        # 启动生产服务，提供 API 和 dist 静态文件
npm run build    # 生成生产前端产物
npm run preview  # 本地预览生产前端产物
npm run lint     # TypeScript 类型检查
```

`npm start` 会读取 `dist/`，所以生产启动前需要先执行 `npm run build`。

## 部署建议

以 Railway 为例：

```text
Build Command: npm run build
Start Command: npm start
Volume Mount Path: /app/data
```

需要配置的基础环境变量：

```text
AUTH_SECRET
SUPER_ADMIN_PASSWORD
APP_PASSWORD
```

如果挂载 Railway Volume，Railway 会注入 `RAILWAY_VOLUME_MOUNT_PATH`，服务端会自动把审批数据、账号、附件和 AI 配置写入该路径。

## 注意事项

- 不要提交真实 `.env`、API Key、密码或上传附件。
- `node_modules/`、`dist/`、`data/` 已在 `.gitignore` 中排除。
- `ENABLE_RECORD_DELETE` 默认关闭，避免误删审批记录。
- 普通账号密码存储为服务端哈希值，超管密码只来自环境变量。
- 当前持久化方案是 JSON 文件，适合原型和轻量部署；如果要承载真实高并发生产场景，建议迁移到数据库和更完整的权限审计体系。
