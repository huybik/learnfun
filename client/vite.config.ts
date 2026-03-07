import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const serverPort = process.env.VITE_SERVER_PORT || "8000";

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
      "/api": `http://localhost:${serverPort}`,
      "/yjs": {
        target: `ws://localhost:${serverPort}`,
        ws: true,
      },
    },
  },
});
