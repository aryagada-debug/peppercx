import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendor libs into their own chunks so the initial
        // route doesn't pay for chart/dnd/motion code it doesn't use.
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router")) return "react-vendor";
          if (id.match(/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/)) return "react-vendor";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("/zod/")) return "forms";
          if (id.includes("@dnd-kit")) return "dnd";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("date-fns")) return "date-fns";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("@supabase")) return "supabase";
        },
      },
    },
  },
}));
