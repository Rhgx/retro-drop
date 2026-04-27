import { cp, mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));
const romsDir = path.join(root, "roms");
const outDir = path.join(root, "dist");
const mimeTypes = new Map([
  [".json", "application/json"],
  [".nes", "application/octet-stream"],
  [".fds", "application/octet-stream"],
  [".smc", "application/octet-stream"],
  [".sfc", "application/octet-stream"],
  [".gb", "application/octet-stream"],
  [".gbc", "application/octet-stream"],
  [".gba", "application/octet-stream"],
  [".n64", "application/octet-stream"],
  [".z64", "application/octet-stream"],
  [".v64", "application/octet-stream"],
  [".md", "application/octet-stream"],
  [".gen", "application/octet-stream"],
  [".smd", "application/octet-stream"],
  [".sms", "application/octet-stream"],
  [".gg", "application/octet-stream"],
  [".32x", "application/octet-stream"],
  [".chd", "application/octet-stream"],
  [".pbp", "application/octet-stream"],
  [".cue", "text/plain"],
  [".pce", "application/octet-stream"],
  [".ngp", "application/octet-stream"],
  [".ngc", "application/octet-stream"],
  [".ws", "application/octet-stream"],
  [".wsc", "application/octet-stream"],
  [".col", "application/octet-stream"],
  [".a26", "application/octet-stream"],
  [".a78", "application/octet-stream"],
  [".lnx", "application/octet-stream"]
]);

function copyRomsPlugin() {
  return {
    name: "copy-roms",
    async closeBundle() {
      await rm(path.join(outDir, "roms"), { recursive: true, force: true });
      await mkdir(outDir, { recursive: true });
      await cp(romsDir, path.join(outDir, "roms"), { recursive: true });
    },
    configureServer(server) {
      server.middlewares.use("/roms", async (req, res) => {
        const url = new URL(req.url || "/", "http://localhost");
        const requested = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
        const filePath = path.normalize(path.join(romsDir, requested));

        if (!filePath.startsWith(romsDir)) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }

        try {
          const info = await stat(filePath);
          if (!info.isFile()) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }

          res.setHeader("Content-Type", mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream");
          res.end(await readFile(filePath));
        } catch {
          res.statusCode = 404;
          res.end("Not found");
        }
      });
    }
  };
}

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        index: path.join(root, "index.html"),
        player: path.join(root, "player.html")
      }
    }
  },
  plugins: [copyRomsPlugin()]
});
