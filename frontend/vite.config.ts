import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cesium from "vite-plugin-cesium";

export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    host: "0.0.0.0",
    port: 13100,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:18100",
        changeOrigin: true,
      },
    },
  },
});
