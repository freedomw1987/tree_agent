import type { ToolSpec } from "../types";
import { fsListTool, fsReadTool, fsSearchTool, fsWriteTool } from "./fs-tools";
import { terminalTool } from "./terminal-tool";

/** M05 工具目錄：全部工具都帶風險級別，由 M04 風險閘把關 */
export function createCatalogTools(workspace: string): ToolSpec[] {
  return [
    fsReadTool(workspace),
    fsListTool(workspace),
    fsSearchTool(workspace),
    fsWriteTool(workspace),
    terminalTool(workspace),
  ];
}

export { checkCommand } from "./terminal-tool";
export { fsListTool, fsReadTool, fsSearchTool, fsWriteTool } from "./fs-tools";
export { terminalTool } from "./terminal-tool";
