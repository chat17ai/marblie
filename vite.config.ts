import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
  },
  build: {
    target: "es2022", // this affects Rollup build
  },
  esbuild: {
    target: "es2022", // or 'esnext'
  },
});
