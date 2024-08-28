import { defineConfig } from "vite";
import vue3 from "@vitejs/plugin-vue";
import path from "path";
import dts from "vite-plugin-dts";
import * as compiler from "@vue/compiler-sfc";

export default defineConfig({
  base: "/",
  server: {
    host: true,
    port: 8000,
  },
  define: {
    __DEV__: false,
  },
  plugins: [
    vue3({
      compiler: compiler as any,
    }),
    dts({
      insertTypesEntry: true,
    }),
  ],
  optimizeDeps: {
    exclude: ["csstype"],
  },
  build: {
    target: "es2018",
    outDir: "lib",
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    lib: {
      formats: ["es", "cjs"],
      entry: path.resolve("src/index.ts"),
      name: "@tma.js/sdk-vue",
      fileName: (format) => {
        switch (format) {
          case "es":
            return "index.mjs";
          case "cjs":
            return "index.cjs";
          default:
            throw new Error("Unknown format");
        }
      },
    },
    rollupOptions: {
      external: ["vue", "@telegram-apps/sdk"],
      output: {
        globals: {
          vue: "Vue",
          "@telegram-apps/sdk": "TMA_JS_SDK",
        },
      },
    },
  },
});
