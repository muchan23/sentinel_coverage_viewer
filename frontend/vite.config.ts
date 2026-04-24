import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cesium from "vite-plugin-cesium";

export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    host: "0.0.0.0",
    port: 13200,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:18200",
        changeOrigin: true,
      },
    },
  },
});
