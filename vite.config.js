import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const createProxyConfig = () => ({
    target: env.VITE_API_PROXY_TARGET,
    changeOrigin: true,
    // 将后端响应中 Set-Cookie 的 domain 重写为空（匹配前端开发服务器域名），
    // 确保 HttpOnly Cookie 能被浏览器正确存储
    cookieDomainRewrite: { "*": "" },
  });

  return {
    plugins: [
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
    ],
    server: {
      proxy: {
        "/api": createProxyConfig(),
        "/auth": createProxyConfig(),
      },
    },
    build: {
      // "hidden" 在构建产物中不嵌入 sourcemap 引用，但仍生成 .map 文件供内部调试
      sourcemap: "hidden",
    },
    esbuild:
      mode === "production"
        ? {
            pure: ["console.log", "console.error", "console.warn", "console.debug", "console.info"],
          }
        : undefined,
  };
});
