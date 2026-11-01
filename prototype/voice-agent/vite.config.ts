import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    target: "es2022",
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
  },
});
