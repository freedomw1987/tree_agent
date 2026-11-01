import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import type { Dirent } from "node:fs";
import { dirname, join } from "node:path";
import { formatDiff } from "../diff";
import { resolveInWorkspace, toDisplayPath } from "../paths";
import type { ToolSpec } from "../types";

/**
 * M05 Workspace 檔案工具（路徑全部鎖死喺 workspace 內）
 */

const MAX_READ_BYTES = 200_000;
const MAX_SEARCH_RESULTS = 80;
const MAX_WALK_FILES = 2000;

function schema(properties: Record<string, unknown>, required: string[] = []) {
  return { type: "object", properties, required, additionalProperties: false };
}

const str = (description: string) => ({ type: "string", description });

export function fsReadTool(workspace: string): ToolSpec {
  return {
    name: "fs_read",
    label: "讀檔案",
    description: "讀取 workspace 內一個文字檔案嘅內容",
    riskLevel: "read_only",
    parameters: schema({
      path: str("相對於 workspace 嘅檔案路徑"),
      maxBytes: { type: "number", description: "最多讀幾多 byte（預設 200000）" },
    }, ["path"]),
    run(args) {
      const path = String(args.path ?? "");
      if (!path) return { ok: false, text: "缺少 path 參數" };
      const abs = resolveInWorkspace(workspace, path);
      if (!existsSync(abs)) return { ok: false, text: `檔案唔存在：${path}` };
      const st = statSync(abs);
      if (st.isDirectory()) return { ok: false, text: `係目錄唔係檔案：${path}（用 fs_list）` };
      const limit = Number(args.maxBytes ?? MAX_READ_BYTES);
      const buf = readFileSync(abs);
      const slice = buf.subarray(0, limit);
      const text = slice.toString("utf8");
      const more = buf.length > limit ? `\n…（已截斷，全檔 ${buf.length} byte）` : "";
      return {
        ok: true,
        text: `📄 ${path}（${buf.length} byte）\n${text}${more}`,
        details: { path, bytes: buf.length },
      };
    },
  };
}

export function fsWriteTool(workspace: string): ToolSpec {
  return {
    name: "fs_write",
    label: "寫檔案",
    description: "喺 workspace 內建立或覆蓋一個文字檔案（會先問用戶確認）",
    riskLevel: "write",
    parameters: schema({
      path: str("相對於 workspace 嘅檔案路徑"),
      content: str("完整檔案內容（會覆蓋整個檔案）"),
    }, ["path", "content"]),
    preview(args) {
      const path = String(args.path ?? "");
      const content = String(args.content ?? "");
      const abs = resolveInWorkspace(workspace, path);
      const old = existsSync(abs) ? readFileSync(abs, "utf8") : null;
      return formatDiff(path, old, content);
    },
    run(args) {
      const path = String(args.path ?? "");
      const content = String(args.content ?? "");
      if (!path) return { ok: false, text: "缺少 path 參數" };
      const abs = resolveInWorkspace(workspace, path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
      return {
        ok: true,
        text: `✅ 已寫入 ${path}（${Buffer.byteLength(content, "utf8")} byte）`,
        details: { path, bytes: Buffer.byteLength(content, "utf8") },
      };
    },
  };
}

export function fsListTool(workspace: string): ToolSpec {
  return {
    name: "fs_list",
    label: "睇目錄",
    description: "列出 workspace 內某個目錄嘅內容",
    riskLevel: "read_only",
    parameters: schema({
      path: str("相對於 workspace 嘅目錄路徑（預設 workspace 根）"),
    }),
    run(args) {
      const path = String(args.path ?? ".");
      const abs = resolveInWorkspace(workspace, path);
      if (!existsSync(abs)) return { ok: false, text: `目錄唔存在：${path}` };
      const entries = readdirSync(abs, { withFileTypes: true })
        .map((e) => {
          const size = e.isDirectory() ? 0 : statSync(join(abs, e.name)).size;
          return `${e.isDirectory() ? "📁" : "📄"} ${e.name}${e.isDirectory() ? "/" : `（${size} B）`}`;
        })
        .sort();
      return {
        ok: true,
        text: entries.length ? `📂 ${path}\n${entries.join("\n")}` : `📂 ${path}（空）`,
        details: { path, count: entries.length },
      };
    },
  };
}

export function fsSearchTool(workspace: string): ToolSpec {
  return {
    name: "fs_search",
    label: "搜尋檔案",
    description: "喺 workspace 內搜尋包含某段文字嘅檔案（回傳檔案名 + 行號）",
    riskLevel: "read_only",
    parameters: schema({
      query: str("要搜尋嘅文字"),
      path: str("限定喺某個目錄（預設全部 workspace）"),
      maxResults: { type: "number", description: "最多回傳幾多個結果（預設 80）" },
    }, ["query"]),
    run(args) {
      const query = String(args.query ?? "");
      if (!query) return { ok: false, text: "缺少 query 參數" };
      const root = resolveInWorkspace(workspace, String(args.path ?? "."));
      const limit = Number(args.maxResults ?? MAX_SEARCH_RESULTS);
      const needle = query.toLowerCase();
      const hits: string[] = [];
      let scanned = 0;

      const walk = (dir: string): void => {
        if (scanned >= MAX_WALK_FILES || hits.length >= limit) return;
        let entries: Dirent[];
        try {
          entries = readdirSync(dir, { withFileTypes: true }) as Dirent[];
        } catch {
          return;
        }
        for (const e of entries) {
          if (hits.length >= limit || scanned >= MAX_WALK_FILES) return;
          if (e.name.startsWith(".") || e.name === "node_modules") continue;
          const full = join(dir, e.name);
          if (e.isDirectory()) {
            walk(full);
            continue;
          }
          let text: string;
          try {
            const st = statSync(full);
            if (st.size > MAX_READ_BYTES) continue;
            text = readFileSync(full, "utf8");
          } catch {
            continue;
          }
          scanned++;
          const lines = text.split("\n");
          for (let i = 0; i < lines.length && hits.length < limit; i++) {
            if (lines[i].toLowerCase().includes(needle)) {
              hits.push(`${toDisplayPath(workspace, full)}:${i + 1}: ${lines[i].trim().slice(0, 160)}`);
            }
          }
        }
      };
      walk(root);

      return {
        ok: true,
        text: hits.length
          ? `🔍 「${query}」搵到 ${hits.length} 個結果（掃描 ${scanned} 個檔案）\n${hits.join("\n")}`
          : `🔍 「${query}」冇結果（掃描 ${scanned} 個檔案）`,
        details: { query, hits: hits.length, scanned },
      };
    },
  };
}
