import { isAbsolute, relative, resolve } from "node:path";

/**
 * Workspace 路徑守衛：所有檔案工具都一定要經呢度
 * 目標 —— 路徑鎖死喺 workspace 之內，Agent 掂唔到外面嘅檔案。
 */
export function resolveInWorkspace(workspace: string, relPath: string): string {
  const root = resolve(workspace);
  const target = isAbsolute(relPath) ? resolve(relPath) : resolve(root, relPath);
  const rel = relative(root, target);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`路徑越界：${relPath}（只可以存取 workspace 之內嘅檔案）`);
  }
  return target;
}

/** 顯示用嘅相對路徑 */
export function toDisplayPath(workspace: string, absPath: string): string {
  const rel = relative(resolve(workspace), absPath);
  return rel === "" ? "." : rel;
}
