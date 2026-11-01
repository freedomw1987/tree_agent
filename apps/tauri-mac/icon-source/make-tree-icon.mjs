/**
 * Digital-art 風格 app icon 生成器 —— 「黑底暖橙樹」
 *
 * 參考風格（用戶提供 7038607_43ed.webp 分析而得）：
 *   純黑底 60% ／ 暖橙 #C06040 主體 19% ／ 白色描邊高光 4% ／ 柔和有機輪廓
 *
 * 技法：兩層描邊（先白色粗線偏移 → 再主色線蓋上 → 白色邊就似 rim light）
 * 用法：node icon-source/make-tree-icon.mjs > /dev/null
 */
import { writeFileSync } from "node:fs";

const S = 1024;

// 決定性亂數
let seed = 991027;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const between = (a, b) => a + rnd() * (b - a);

// 變體：orange（參考圖風格）／ inverted（暖橙底黑影）／ mono（極簡剪影）
const VARIANT = process.env.TREE_VARIANT ?? "orange";
const DETAIL = process.env.TREE_DETAIL ?? "full";
const PAL = {
  orange: { BLACK: "#000000", ORANGE: "#C06040", ORANGE_DEEP: "#8E3F28", ORANGE_LIGHT: "#E08A63", WHITE: "#F4EDE7" },
  inverted: { BLACK: "#C06040", ORANGE: "#120A06", ORANGE_DEEP: "#2A1710", ORANGE_LIGHT: "#3A2118", WHITE: "#F6E9DE" },
  mono: { BLACK: "#000000", ORANGE: "#C06040", ORANGE_DEEP: "#C06040", ORANGE_LIGHT: "#C06040", WHITE: "#C06040" },
  mark: { BLACK: "#000000", ORANGE: "#C06040", ORANGE_DEEP: "#C06040", ORANGE_LIGHT: "#C06040", WHITE: "#C06040" },
}[VARIANT];
const BLACK = PAL.BLACK;
const ORANGE = PAL.ORANGE;
const ORANGE_DEEP = PAL.ORANGE_DEEP;
const ORANGE_LIGHT = PAL.ORANGE_LIGHT;
const WHITE = PAL.WHITE;
const SIMPLE = DETAIL === "simple";
const MARK = VARIANT === "mark";

// ── 有機曲線枝（fractal，帶彎曲）──────────────────────────
const branches = [];
const tips = [];

function grow(x, y, angle, len, w, depth) {
  const x2 = x + Math.cos(angle) * len;
  const y2 = y + Math.sin(angle) * len;
  const bend = between(-0.35, 0.35);
  const cx = x + Math.cos(angle + bend) * len * 0.55;
  const cy = y + Math.sin(angle + bend) * len * 0.55;
  branches.push({ x1: x, y1: y, x2, y2, cx, cy, w });

  if (depth > 6 || len < 18) {
    tips.push({ x: x2, y: y2, w });
    return;
  }
  const kids = rnd() > 0.3 ? 2 : 1;
  for (let i = 0; i < kids; i++) {
    const dir = kids === 1 ? (rnd() > 0.5 ? 1 : -1) : i === 0 ? -1 : 1;
    const a2 = angle + between(0.28, 0.62) * dir;
    grow(x2, y2, a2, len * between(0.66, 0.78), w * between(0.6, 0.72), depth + 1);
  }
}

// ── 極簡標誌模式（mark）：固定幾何樹形，單色，零裝飾 ────────
const MARK_CIRCLES = [];
const MARK_TRUNK = [];
if (MARK) {
  // 樹冠：3 行整齊對稱嘅圓
  const rowsDef = [
    { y: 0.215, r: 60, offsets: [-124, -62, 0, 62, 124] },
    { y: 0.318, r: 84, offsets: [-166, -83, 0, 83, 166] },
    { y: 0.448, r: 72, offsets: [-116, -38, 38, 116] },
  ];
  for (const row of rowsDef) {
    for (const ox of row.offsets) {
      MARK_CIRCLES.push({ x: S / 2 + ox, y: S * row.y, r: row.r });
    }
  }
  // 樹冠底部填充橢圓（令下緣平滑、接實樹幹）
  MARK_CIRCLES.push({ x: S / 2, y: S * 0.435, r: 150 });
  // 樹幹：上窄下寬梯形，底部兩邊微微張開
  MARK_TRUNK.push(
    `<path d="M ${S / 2 - 30} ${S * 0.44} L ${S / 2 - 21} ${S * 0.72} L ${S / 2 - 44} ${S * 0.855} L ${S / 2 + 44} ${S * 0.855} L ${S / 2 + 21} ${S * 0.72} L ${S / 2 + 30} ${S * 0.44} Z" fill="${ORANGE}"/>`,
  );
}

// 樹幹：由下向上，4 段漸窄（假漸變）
const trunkSegs = [];
{
  const baseX = S / 2;
  const baseY = S * 0.865;
  const topY = S * 0.585;
  let x = baseX;
  let y = baseY;
  let w = 62;
  const steps = 4;
  for (let i = 0; i < steps; i++) {
    const segLen = (baseY - topY) / steps;
    const nx = x + between(-14, 14);
    const ny = y - segLen;
    trunkSegs.push({ x1: x, y1: y, x2: nx, y2: ny, cx: (x + nx) / 2 + between(-10, 10), cy: (y + ny) / 2, w });
    x = nx;
    y = ny;
    w *= 0.82;
  }
  if (MARK) { x = S / 2; y = S * 0.44; }
  // 主枝（由樹幹頂分出 5 條）
  const base = { x, y };
  const spread = MARK ? [] : [-0.95, -0.5, -0.05, 0.42, 0.9];
  for (const s of spread) {
    grow(base.x + s * 10, base.y + between(-4, 8), -Math.PI / 2 + s, between(104, 136), between(24, 30), 0);
  }
}

// ── 樹冠：重疊圓形（union 出柔和有機輪廓）──────────────────
const blobs = [];
// 樹冠整體橢圓範圍
const crown = { cx: S / 2, cy: S * 0.335, rx: S * 0.23, ry: S * 0.15 };
// 每個枝梢長一團
for (const t of tips) {
  const n = Math.round(between(1.6, 3.4));
  for (let i = 0; i < n; i++) {
    blobs.push({
      x: t.x + between(-30, 30),
      y: t.y + between(-26, 26),
      r: between(22, 44),
      tone: rnd(),
    });
  }
}
// 填實中間
for (let i = 0; i < 13; i++) {
  const a = rnd() * Math.PI * 2;
  const rr = Math.sqrt(rnd());
  blobs.push({
    x: crown.cx + Math.cos(a) * crown.rx * rr * 0.9,
    y: crown.cy + Math.sin(a) * crown.ry * rr * 0.9,
    r: between(30, 58),
    tone: rnd(),
  });
}

// ── SVG 元件 ─────────────────────────────────────────────
function branchPath(b, width, color, opacity = 1) {
  return `<path d="M ${b.x1} ${b.y1} Q ${b.cx} ${b.cy} ${b.x2} ${b.y2}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`;
}

// 白色 rim（偏移 -5,-5，粗少少）→ 露出白邊
const rim = SIMPLE
  ? []
  : [
      ...trunkSegs.map((b) => branchPath(b, b.w + 11, WHITE, 0.95)),
      ...branches.map((b) => branchPath(b, b.w + 9, WHITE, 0.9)),
    ];

const mainLines = MARK
  ? MARK_TRUNK
  : [
      ...trunkSegs.map((b) => branchPath(b, b.w, "url(#barkGrad)")),
      ...branches.map((b) => branchPath(b, b.w, "url(#barkGrad)")),
    ];

// 樹冠：白 rim 圓（同樣偏移）→ 再主色圓
const rimBlobs = SIMPLE
  ? []
  : blobs.map((b) => `<circle cx="${b.x - 5}" cy="${b.y - 5}" r="${b.r + 5}" fill="${WHITE}" opacity="0.92"/>`);
// 陰影層（深橙，畫喺主色下面，偏移右下）→ 做出立體感
const shadeBlobs = (SIMPLE ? [] : blobs)
  .filter((b) => b.tone > 0.55)
  .map((b) => `<circle cx="${b.x + 16}" cy="${b.y + 18}" r="${b.r * 0.92}" fill="${ORANGE_DEEP}" opacity="0.75"/>`);
// 主色圓
const mainBlobs = (MARK ? MARK_CIRCLES : blobs).map((b) =>
  MARK
    ? `<circle cx="${b.x}" cy="${b.y}" r="${b.r}" fill="${ORANGE}"/>`
    : `<circle cx="${b.x}" cy="${b.y}" r="${b.r}" fill="url(#leafGrad)"/>`,
);
// 高光圓（左上）
const hiBlobs = (SIMPLE ? [] : blobs)
  .filter((b) => b.tone > 0.78)
  .map((b) => `<circle cx="${b.x - b.r * 0.3}" cy="${b.y - b.r * 0.34}" r="${b.r * 0.46}" fill="${ORANGE_LIGHT}" opacity="0.55"/>`);
// 白色斑點
const speckles = [];
for (let i = 0; i < (SIMPLE ? 0 : 34); i++) {
  const t = tips[Math.floor(rnd() * tips.length)];
  if (!t) continue;
  speckles.push(
    `<circle cx="${t.x + between(-34, 34)}" cy="${t.y + between(-30, 30)}" r="${between(1.4, 3.4)}" fill="${WHITE}" opacity="${between(0.45, 0.95)}"/>`,
  );
}
// 地面橢圓陰影（參考圖底部有深色橢圓感）
const ground = `<ellipse cx="${S / 2}" cy="${S * 0.915}" rx="${S * 0.2}" ry="${S * 0.026}" fill="${ORANGE_DEEP}" opacity="0.5"/>`;
// 背光
const backGlow = `<ellipse cx="${S / 2}" cy="${S * 0.4}" rx="${S * 0.42}" ry="${S * 0.32}" fill="${ORANGE}" opacity="0.13"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="bgGlow" cx="0.5" cy="0.42" r="0.62">
      <stop offset="0" stop-color="${ORANGE}" stop-opacity="0.20"/>
      <stop offset="0.6" stop-color="${ORANGE_DEEP}" stop-opacity="0.07"/>
      <stop offset="1" stop-color="${BLACK}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="barkGrad" x1="0" y1="1" x2="0.2" y2="0">
      <stop offset="0" stop-color="${ORANGE_DEEP}"/>
      <stop offset="0.55" stop-color="${ORANGE}"/>
      <stop offset="1" stop-color="${ORANGE_LIGHT}"/>
    </linearGradient>
    <radialGradient id="leafGrad" cx="0.36" cy="0.32" r="0.78">
      <stop offset="0" stop-color="${ORANGE_LIGHT}"/>
      <stop offset="0.5" stop-color="${ORANGE}"/>
      <stop offset="1" stop-color="#A04A30"/>
    </radialGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="9" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- 黑底 + 暖背光 -->
  <rect width="${S}" height="${S}" fill="${BLACK}"/>
  <rect width="${S}" height="${S}" fill="url(#bgGlow)"/>
  ${SIMPLE ? "" : `<g filter="url(#soft)">${backGlow}</g>`}

  <!-- 地面 -->
  ${ground}

  <!-- 白 rim（樹幹 + 枝） -->
  ${rim.length ? `<g transform="translate(-5,-5)">${rim.join("\n  ")}</g>` : ""}
  <!-- 樹幹 + 枝 主色 -->
  <g>${mainLines.join("\n  ")}</g>

  <!-- 樹冠：白 rim → 陰影 → 主色 → 高光 -->
  ${rimBlobs.length ? `<g transform="translate(-5,-5)">${rimBlobs.join("\n  ")}</g>` : ""}
  <g>${shadeBlobs.join("\n  ")}</g>
  <g>${mainBlobs.join("\n  ")}</g>
  <g>${hiBlobs.join("\n  ")}</g>

  <!-- 白色斑點 -->
  ${speckles.length ? `<g filter="url(#glow)">${speckles.join("\n  ")}</g>` : ""}
</svg>
`;

const OUT = process.env.TREE_OUT ?? "./tree-icon.svg";
writeFileSync(new URL(OUT, import.meta.url), svg);
console.log(`已生成 ${OUT}（變體：${VARIANT}${SIMPLE ? " / 極簡" : ""}）`);
