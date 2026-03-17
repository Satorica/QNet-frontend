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
      sourcemap: false,
    },
    esbuild:
      mode === "production"
        ? {
            pure: ["console.log"],
          }
        : undefined,
  };
});
