import { defineConfig } from "vitest/config";
import { loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

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
    // Dev twin of /api/stt-token — without it the dev check-in never
    // streams and silently takes the clip fallback, unlike production.
    server.middlewares.use("/api/stt-token", async (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        return res.end(JSON.stringify({ error: "method_not_allowed" }));
      }
      const apiKey = env.ASSEMBLYAI_API_KEY;
      if (!apiKey) {
        res.statusCode = 503;
        return res.end(JSON.stringify({ error: "voice_unavailable" }));
      }
      try {
        const r = await fetch("https://streaming.assemblyai.com/v3/token?expires_in_seconds=300", {
          headers: { Authorization: apiKey },
          signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) {
          res.statusCode = 502;
          return res.end(JSON.stringify({ error: "token_error" }));
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(await r.text());
      } catch {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: "upstream_unreachable" }));
      }
    });
    // Dev twin of /api/stt — clip in, {text} out, same env vars.
    server.middlewares.use("/api/stt", async (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        return res.end(JSON.stringify({ error: "method_not_allowed" }));
      }
      const apiKey = env.ASSEMBLYAI_API_KEY;
      if (!apiKey) {
        res.statusCode = 503;
        return res.end(JSON.stringify({ error: "voice_unavailable" }));
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const audio = Buffer.concat(chunks);
      const headers = { Authorization: apiKey };
      try {
        const up = await fetch("https://api.assemblyai.com/v2/upload", {
          method: "POST", headers, body: audio,
        });
        if (!up.ok) throw new Error("upload");
        const { upload_url } = (await up.json()) as { upload_url: string };
        const sub = await fetch("https://api.assemblyai.com/v2/transcript", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ audio_url: upload_url, language_code: "en" }),
        });
        if (!sub.ok) throw new Error("submit");
        const { id } = (await sub.json()) as { id: string };
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 400));
          const poll = await fetch(
            `https://api.assemblyai.com/v2/transcript/${id}`,
            { headers },
          );
          const data = (await poll.json()) as { status: string; text?: string };
          if (data.status === "completed") {
            res.statusCode = 200;
            return res.end(JSON.stringify({ text: data.text ?? "" }));
          }
          if (data.status === "error") throw new Error("transcript");
        }
        res.statusCode = 504;
        res.end(JSON.stringify({ error: "transcript_timeout" }));
      } catch {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: "upstream_error" }));
      }
    });
    // Dev twin of /api/metrics — echoes what the wire would send. The real
    // counter keeps daily aggregates in Netlify Blobs; this keeps nothing.
    server.middlewares.use("/api/metrics", async (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        return res.end(JSON.stringify({ error: "method_not_allowed" }));
      }
      let body = "";
      for await (const chunk of req) body += chunk;
      let sent: unknown;
      try {
        sent = JSON.parse(body || "{}");
      } catch {
        sent = { name: "<unparseable>" };
      }
      const name = (sent as { name?: unknown })?.name;
      if (typeof name === "string" && !name.startsWith("<")) {
        console.log(`[metrics] ${name}`, (sent as { props?: unknown }).props);
      }
      res.statusCode = 202;
      res.end(JSON.stringify({ ok: true, dev: true }));
    });
  },
});

/**
 * Vite Configuration - Production Optimized
 *
 * Key principles:
 * - Performance: Rolldown default code splitting and minification
 * - Security: Clean path aliases and disabled source maps in production
 * - Compatibility: a few `process.env.NODE_ENV` reads need the Node globals
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
      },
      dedupe: [
        "react",
        "react-dom",
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
                "zustand",
        "@tanstack/react-query"
      ],
      exclude: [],
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
