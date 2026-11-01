export type SurfaceKey = "mobile-app" | "desktop-mac" | "cli-terminal";

export interface DemoStep {
  id: string;
  surface: SurfaceKey;
  route: string;
  title: string;
  say: string;
  /** 跳到呢步時要觸發嘅動作（用 store action，跨 Surface 資料流靠同一個 store） */
  run?: () => void;
}

const getStore = () => import("@/mock/store").then((m) => m.useDemoStore);

export const demoSteps: DemoStep[] = [
  {
    id: "step-1",
    surface: "mobile-app",
    route: "/m/chat",
    title: "用手機講嘢派任務",
    say: "雙手唔得閒 → 語音輸入 → 文字可編輯 → 送出。你講嘅嘢會經 Relay 送到你部 Mac。",
    run: () => {
      void getStore().then((s) =>
        s.getState().sendMessage("幫我整理本週交付進度，寫成摘要", {
          voice: true,
          title: "整理本週交付進度",
        }),
      );
    },
  },
  {
    id: "step-2",
    surface: "cli-terminal",
    route: "/t/console",
    title: "Sidecar 收到任務並開始做",
    say: "Mac 上面嘅 Pi SDK session 收到任務，streaming 回覆；relay 送達紀錄喺下面（request_id 冪等）。",
  },
  {
    id: "step-3",
    surface: "desktop-mac",
    route: "/d/runtime",
    title: "Agent 狀態 / Workspace / Session",
    say: "Agent 係就緒嘅（sidecar running）；Workspace 決定 Agent 可以郁邊啲檔案；session 留喺 Mac 本地。",
  },
  {
    id: "step-4",
    surface: "mobile-app",
    route: "/m/chat",
    title: "任務完成：卡片 + 語音通知",
    say: "你唔使望住個 App —— 完成會推播（Polly 語音），返嚟就見到任務卡片同交付物。",
  },
  {
    id: "step-5",
    surface: "mobile-app",
    route: "/m/chat",
    title: "高風險操作 → 確認卡",
    say: "Agent 想改檔案（write 級別）→ Risk Gate 攔截 → 出確認卡，5 分鐘有效，講「confirm」都得。",
    run: () => {
      void getStore().then((s) => s.getState().requestConfirm());
    },
  },
  {
    id: "step-6",
    surface: "cli-terminal",
    route: "/t/console",
    title: "確認咗 → 工具執行",
    say: "確認之後工具先會執行；被攔截嘅操作亦會喺 console 留低（[blocked]）。",
    run: () => {
      void getStore().then((s) => s.getState().approveConfirm());
    },
  },
  {
    id: "step-7",
    surface: "desktop-mac",
    route: "/d/tools",
    title: "Audit log + Risk Gate 規則",
    say: "每次工具調用都有留痕（工具 / 風險級別 / 參數摘要 / 結果）；風險規則集中喺 M04。",
  },
  {
    id: "step-8",
    surface: "mobile-app",
    route: "/m/stats",
    title: "每日任務數（核心指標）",
    say: "每日完成任務數 + 估算慳咗幾多分鐘打字 —— 呢個就係成個產品嘅成功標準。",
  },
];
