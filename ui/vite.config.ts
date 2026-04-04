import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    allowedHosts: ["conduit.test", "localhost"],
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 5173,
    },
    proxy: {
      "/api": {
        target: "http://localhost:9999",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router"],
          icons: ["lucide-react"],
        },
      },
    },
  },
});
