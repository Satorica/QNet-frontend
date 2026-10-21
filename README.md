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

## 代码入口

- [src/main.ts](src/main.ts)：应用初始化、路由和全局样式。
- [src/views](src/views/)：登录、求解页面和任务等业务页面。
- [src/components](src/components/)：共享组件。
- [src/api](src/api/)：后端请求。
- [src/content/api-docs.ts](src/content/api-docs.ts)：API 中心展示的接口文档。
- [tests](tests/)：回归测试。

登录页底部的“累计使用用户”按注册账号总数统计，每 30 秒读取后端汇总，排除管理员和已合并的重复账号。访问和刷新不增加人数。

后端启动、计算节点与监控配置见 [后端仓库说明](https://github.com/Satorica/QNet-backend#readme)。前端发布和回滚使用完整工作区根目录的《前端发布流程.md》，该文件独立于本仓库维护。
