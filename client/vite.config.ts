import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "./src") + "/",
      "@data/": path.resolve(__dirname, "../data") + "/",
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
      "/yjs": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
  },
});
