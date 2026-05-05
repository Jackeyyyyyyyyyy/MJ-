# MJ Approval Center

MJ 审批中心是一个基于 React、Vite、TypeScript、Tailwind CSS 和 Express 的审批流程原型。审批记录通过后端 API 保存到服务器文件系统，部署在 Railway 时会写入挂载的 Volume。

## 功能

- 申请人：创建申请、查看历史记录、查看审批详情和进度
- 审批人：处理待审批事项、批准或驳回申请
- 管理端：查看全局审批数据、按状态筛选、搜索单据
- 开发者账号：可在申请人、审批人、管理端视角之间切换
- 审批类型由 `src/approvalSchema.ts` 配置驱动

## 本地运行

```powershell
npm install
npm run api
npm run dev
```

默认开发地址：

```text
http://localhost:3000
```

本地开发需要两个终端：

- 终端 1：`npm run api`，启动后端 API，默认端口 `8080`
- 终端 2：`npm run dev`，启动 Vite 前端，默认端口 `3000`

本地后端数据默认保存到：

```text
./data/approval-records.json
```

## 测试账号

所有账号使用同一个登录密码，密码不写入代码库，必须通过环境变量 `APP_PASSWORD` 配置。
同时必须配置 `AUTH_SECRET`，用于签发和校验登录令牌。

本地 PowerShell 示例：

```powershell
$env:APP_PASSWORD="your-local-password"
$env:AUTH_SECRET="your-long-random-session-secret"
npm run api
```

账号：

```text
applicant   申请人
approver    审批人
boss        管理端
developer   开发者视角切换
```

## 常用命令

```powershell
npm run dev      # 启动开发服务
npm run api      # 启动后端 API
npm run build    # 生产构建
npm start        # 启动生产服务，提供 API 和 dist 静态文件
npm run lint     # TypeScript 类型检查
npm run preview  # 本地预览生产构建
```

## Railway Volume

项目已经接入 Express 后端持久化。Railway Volume mount path 使用：

```text
/app/data
```

审批记录会保存到：

```text
/app/data/approval-records.json
```

后端会优先读取 Railway 自动注入的环境变量：

```js
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || './data';
```

Railway 上建议配置：

```text
Build Command: npm run build
Start Command: npm start
Volume Mount Path: /app/data
```

注意：Railway Volume 只在运行时挂载，不在 build 阶段挂载。不要在构建阶段写入持久化数据。

## GitHub 初始化推送

如果当前目录还不是 Git 仓库，可以在 PowerShell 执行：

```powershell
Set-Location "C:\Users\32493\OneDrive\Desktop\mj审批"

git init
git branch -M main
git remote add origin https://github.com/Jackeyyyyyyyyyy/MJ-.git

git add .
git commit -m "initial commit"
git push -u origin main
```

如果远程已存在：

```powershell
git remote set-url origin https://github.com/Jackeyyyyyyyyyy/MJ-.git
git push -u origin main
```

## 项目说明

- 不要提交 `.env.local` 或任何真实密钥
- `node_modules/`、`dist/` 和本地 `data/` 已在 `.gitignore` 中排除
- 当前登录状态仍保存在浏览器本地，审批记录保存在后端 JSON 文件
- 要上线成真实多用户系统，还需要补真实登录、权限控制和数据库
