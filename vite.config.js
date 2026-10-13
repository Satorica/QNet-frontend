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
    // 并行验证服务可指定独立缓存，避免覆盖正在运行的主开发服务。
    cacheDir: env.QNET_VITE_CACHE_DIR || "node_modules/.vite",
    plugins: [
      vue(),
      AutoImport({
        dts: false,
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        dts: "components.d.ts",
        resolvers: [ElementPlusResolver()],
      }),
    ],
    server: {
      proxy: {
        "^/api(?:/|$)": createProxyConfig(),
        "/auth": createProxyConfig(),
        "/media": createProxyConfig(),
      },
    },
    build: {
      // Production builds must not publish source maps.
      sourcemap: mode === "production" ? false : "hidden",
    },
    esbuild:
      mode === "production"
        ? {
            drop: ["console"],
          }
        : undefined,
  };
});
