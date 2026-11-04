import { defineConfig } from "vitest/config";
import { loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Dev twin of netlify/functions/tts.mjs — same contract, same env vars,
// so `pnpm dev` speaks through AssemblyAI exactly like production does.
const devTts = (env: Record<string, string>): Plugin => ({
  name: "brume-tts-dev",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use("/api/tts", async (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        return res.end(JSON.stringify({ error: "method_not_allowed" }));
      }
      const apiKey = env.ASSEMBLYAI_API_KEY;
      if (!apiKey) {
        res.statusCode = 503;
        return res.end(JSON.stringify({ error: "voice_unavailable" }));
      }
      let body = "";
      for await (const chunk of req) body += chunk;
      let text: unknown;
      try {
        text = JSON.parse(body || "{}").text;
      } catch {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "bad_json" }));
      }
      if (typeof text !== "string" || !text.trim() || text.length > 280) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "bad_text" }));
      }
      const upstream = { text: (text as string).trim(), container: "wav", stream: false } as Record<string, unknown>;
      if (env.ASSEMBLYAI_VOICE_ID) upstream.voice_id = env.ASSEMBLYAI_VOICE_ID;
      try {
        const r = await fetch("https://tts.us.assemblyai.com/v1/speech", {
          method: "POST",
          headers: { Authorization: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(upstream),
          signal: AbortSignal.timeout(12_000),
        });
        if (!r.ok) {
          res.statusCode = 502;
          return res.end(JSON.stringify({ error: "upstream_error" }));
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "audio/wav");
        res.end(Buffer.from(await r.arrayBuffer()));
      } catch {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: "upstream_unreachable" }));
      }
    });
  },
});

/**
 * Vite Configuration - Production Optimized
 *
 * Key principles:
 * - Performance: Rolldown default code splitting and minification
 * - Security: Clean path aliases and disabled source maps in production
 * - Compatibility: Node.js polyfills for blockchain libraries
 */
export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";

  console.log(`Building for ${mode} mode`);

  return {
    plugins: [
      devTts(loadEnv(mode, process.cwd(), "")),
      react({
        include: "**/*.{jsx,tsx}",
      }),
      tailwindcss(),

      // Add Node.js polyfills for browser compatibility
      nodePolyfills({
        // Polyfill only what's needed
        include: ["buffer", "process", "util", "events"],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],

    // Configure path aliases to match tsconfig
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "./src"),
        components: resolve(import.meta.dirname, "./src/components"),
        hooks: resolve(import.meta.dirname, "./src/hooks"),
        lib: resolve(import.meta.dirname, "./src/lib"),
        integrations: resolve(import.meta.dirname, "./src/integrations"),
        types: resolve(import.meta.dirname, "./src/types"),
        pages: resolve(import.meta.dirname, "./src/pages"),
        utils: resolve(import.meta.dirname, "./src/utils"),
        wagmi: resolve(import.meta.dirname, "./node_modules/wagmi"),
        viem: resolve(import.meta.dirname, "./node_modules/viem"),
      },
      dedupe: [
        "react",
        "react-dom",
        "wagmi",
        "viem",
        "@tanstack/react-query",
      ],
    },

    // Production-optimized build configuration
    build: {
      // Source maps: disabled in production to prevent source reconstruction from bundles
      sourcemap: isProduction ? false : true,

      // Production minification
      ...(isProduction
        ? {
            minify: "terser",
            terserOptions: {
              compress: {
                drop_console: false, // Keep for production debugging
                drop_debugger: true,
              },
            },
          }
        : {}),

      chunkSizeWarningLimit: 10000,
      target: 'esnext',

      // Rolldown options — default code splitting handles the module graph
      rolldownOptions: {
        output: {
          // Configure chunk file naming with better cache busting
          chunkFileNames: 'js/[name]-[hash:8].js',
          entryFileNames: 'js/[name]-[hash:8].js',

          // Configure asset file naming
          assetFileNames: (assetInfo) => {
            if (!assetInfo.name) {
              return 'assets/[name]-[hash:8][extname]';
            }

            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return 'img/[name]-[hash:8][extname]';
            }
            if (/css/i.test(ext)) {
              return 'css/[name]-[hash:8][extname]';
            }
            return 'assets/[name]-[hash:8][extname]';
          },
        },
      },

      // Ensure we generate proper HTML
      emptyOutDir: true,
    },

    // Add custom defines for consistent behavior
    define: {
      // Ensure React production mode is properly set
      ...(isProduction
        ? {
            "process.env.NODE_ENV": JSON.stringify("production"),
            global: "globalThis",
          }
        : {}),
    },

    // Configure server options
    server: {
      port: 4556,
      open: true,
      strictPort: false,
    },

    // Configure web workers
    worker: {
      format: 'es',
      plugins: () => [
        // Apply the same plugins to workers
        react({
          include: "**/*.{jsx,tsx}",
        }),
      ],
    },

    // Configure preview server (for testing production builds locally)
    preview: {
      port: 4173,
      open: true,
    },

    // React-specific optimizations
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react-router-dom",
        "scheduler",
        "zustand",
        "@tanstack/react-query"
      ],
      // Exclude optional dependencies that may not be available
      exclude: [
        "@lens-chain/sdk",
        "@lens-chain/storage-client"
      ],
    },

    // Vitest configuration
    test: {
      exclude: ['**/e2e/**', '**/node_modules/**'],
      environment: 'node',
    },

    // Ensure proper HMR behavior
    css: {
      devSourcemap: true,
    },
  };
});
