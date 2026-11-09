# 量子 Ising 求解系统前端

用户端应用，使用 Vue、TypeScript、Element Plus 和 Vite。包含登录与扫码登录、五类优化问题求解、任务历史、额度申请、反馈和 API 中心。

## 开发与验证

在 `frontend` 目录执行：

```sh
npm ci
npm run dev
```

使用终端打印的本地地址。开发环境通过 `VITE_API_PROXY_TARGET` 代理 `/api`、`/auth` 和 `/media`，配置见 [vite.config.js](vite.config.js)。

```sh
npm test
npm run type-check
npm run lint
npm run build
```

生产构建输出到 `dist/`，不发布源码映射。`VITE_API_BASE_URL` 设置生产 API 地址，留空时使用同源地址；修改后需要重新构建。

`npm test` 可在独立检出的前端仓库运行，不依赖后端检出或仓库外的文档。Python 请求示例测试仍需本机 Python 3。

跨仓库 API 契约校验单独执行 `npm run test:integration`。默认使用同级 `backend` 和完整工作区的 `docs/API文档.md`，需先在所用 Python 环境安装后端依赖。不同目录可设置 `QNET_BACKEND_DIR`（后端路径）、`QNET_API_DOC_FILE`（离线文档路径）及 `QNET_PYTHON`（Python 可执行文件）；缺少依赖会明确报错。

## 代码入口

扫码登录使用普通二维码：打开「量子 Ising 求解」小程序，在「我的 → 扫码登录网页」内扫描网页二维码并确认。该入口需要同步更新后端的本地二维码生成实现和小程序版本。

- [src/main.ts](src/main.ts)：应用初始化、路由和全局样式。
- [src/views](src/views/)：登录、求解页面和任务等业务页面。
- [src/components](src/components/)：共享组件。
- [src/api](src/api/)：后端请求。
- [src/content/api-docs.ts](src/content/api-docs.ts)：API 中心展示的接口文档。
- [tests](tests/)：回归测试。

登录页底部的“累计使用用户”按注册账号总数统计，每 30 秒读取后端汇总，排除管理员和已合并的重复账号。访问和刷新不增加人数。

后端启动、计算节点与监控配置见 [后端仓库说明](https://github.com/Satorica/QNet-backend#readme)。前端发布和回滚使用完整工作区根目录的《前端发布流程.md》，该文件独立于本仓库维护。
