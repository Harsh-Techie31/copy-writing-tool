import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import geminiHandler from "./api/gemini.js";

// Serves /api/gemini during `npm run dev` so the key in .env is used
// server-side, the same way the Vercel function does in production.
function apiDevServer(env) {
  return {
    name: "api-dev-server",
    configureServer(server) {
      server.middlewares.use("/api/gemini", async (req, res) => {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }

        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (obj) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(obj));
          return res;
        };

        process.env.GEMINI_API_KEY ??= env.GEMINI_API_KEY;
        process.env.GEMINI_MODEL ??= env.GEMINI_MODEL;
        await geminiHandler(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // "" prefix = load all vars, not just VITE_* (these never reach the browser bundle).
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), apiDevServer(env)],
  };
});
