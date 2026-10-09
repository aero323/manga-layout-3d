// 对话气泡（ふきだし）— 页面上的气泡与自由文字
// 与「漫画分格」共用同一套页面（分格 / 画面）：每页可以叠加气泡与文字，
// 文字默认「竖排・从右到左・居中」，并可以统一编辑所有页面的文字后整本导出。
import { uid } from './stages.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rad = (d) => (d * Math.PI) / 180;

export const BUBBLE_TYPES = ['ellipse', 'cloud', 'jagged', 'dotted', 'rect', 'text'];
export const TAIL_TYPES = new Set(['ellipse', 'cloud', 'dotted']);
export const BUBBLE_LINE = 4;
const INK = '#191b20';
const FONT_STACK = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Yu Gothic","Yu Gothic UI",Meiryo,"Microsoft YaHei","PingFang SC",system-ui,sans-serif';

/* ---------- 形状参数（同时决定文字安全区） ---------- */
const SHAPE = {
  ellipse: { k: 1, pad: 0.14, curvy: true },
  cloud: { k: 1, pad: 0.17, curvy: true },
  jagged: { k: 0.78, pad: 0.1, curvy: true },
  dotted: { k: 1, pad: 0.16, curvy: true },
  rect: { k: 1, pad: 0.09, curvy: false },
  text: { k: 1, pad: 0.02, curvy: false },
};

const DEFAULTS = {
  ellipse: { w: 320, h: 230, tail: true },
  cloud: { w: 340, h: 250, tail: false },
  jagged: { w: 360, h: 240, tail: false },
  dotted: { w: 320, h: 220, tail: true },
  rect: { w: 460, h: 160, tail: false },
  text: { w: 300, h: 200, tail: false },
};

/* ================= 模型 ================= */

function num(v, min, max, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return clamp(n, min, max);
}

export function defaultTail(w, h) {
  return { x: -w * 0.2, y: h * 0.72 };
}

export function makeBubble(type, page, at = null) {
  const t = BUBBLE_TYPES.includes(type) ? type : 'ellipse';
  const d = DEFAULTS[t];
  return {
    id: uid('bb'),
    type: t,
    x: at ? at[0] : (page ? page.w / 2 : 500),
    y: at ? at[1] : (page ? page.h / 2 : 700),
    w: d.w,
    h: d.h,
    rot: 0,
    text: '',
    scale: 0.86,
    vertical: true,
    filled: t !== 'text',
    tail: d.tail ? defaultTail(d.w, d.h) : null,
  };
}

export function normalizeBubbles(list, page) {
  const out = [];
  if (!Array.isArray(list)) return out;
  const pw = page?.w || 1000, ph = page?.h || 1400;
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const type = BUBBLE_TYPES.includes(raw.type) ? raw.type : 'ellipse';
    const b = {
      id: raw.id || uid('bb'),
      type,
      x: num(raw.x, 0, pw, pw / 2),
      y: num(raw.y, 0, ph, ph / 2),
      w: num(raw.w, 24, pw * 2.5, DEFAULTS[type].w),
      h: num(raw.h, 20, ph * 2.5, DEFAULTS[type].h),
      rot: num(raw.rot, -180, 180, 0),
      text: typeof raw.text === 'string' ? raw.text.slice(0, 4000) : '',
      scale: num(raw.scale, 0.2, 1.4, 0.86),
      vertical: raw.vertical !== false,
      filled: type === 'text' ? false : raw.filled !== false,
      tail: null,
    };
    if (raw.tail && TAIL_TYPES.has(type)
      && Number.isFinite(Number(raw.tail.x)) && Number.isFinite(Number(raw.tail.y))) {
      b.tail = { x: Number(raw.tail.x), y: Number(raw.tail.y) };
    }
    out.push(b);
  }
  return out;
}

export function cloneBubbles(list, page = null) {
  return normalizeBubbles(JSON.parse(JSON.stringify(list || [])), page);
}

/* ================= 几何 ================= */

export function rotPoint(x, y, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [x * c - y * s, x * s + y * c];
}

export function toLocal(pt, b) {
  const p = rotPoint(pt[0] - b.x, pt[1] - b.y, -rad(b.rot || 0));
  return p;
}

export function bubbleHandles(b) {
  const ang = rad(b.rot || 0);
  const corner = rotPoint(b.w / 2, b.h / 2, ang);
  const tail = b.tail ? rotPoint(b.tail.x, b.tail.y, ang) : null;
  return {
    resize: { x: b.x + corner[0], y: b.y + corner[1] },
    tail: tail ? { x: b.x + tail[0], y: b.y + tail[1] } : null,
  };
}

export function hitBubble(b, pt) {
  const l = toLocal(pt, b);
  if (b.type === 'rect' || b.type === 'text') {
    return Math.abs(l[0]) <= b.w / 2 + 4 && Math.abs(l[1]) <= b.h / 2 + 4;
  }
  const nx = l[0] / (b.w / 2), ny = l[1] / (b.h / 2);
  return nx * nx + ny * ny <= 1.04;
}

function pickBubbleAt(page, pt) {
  const list = page.bubbles || [];
  for (let i = list.length - 1; i >= 0; i--) if (hitBubble(list[i], pt)) return list[i];
  return null;
}

/* ================= 文字排版（竖排从右到左 / 横排） ================= */

const graphemes = (() => {
  try {
    const seg = new Intl.Segmenter('ja', { granularity: 'grapheme' });
    return (s) => Array.from(seg.segment(s), (x) => x.segment);
  } catch {
    return (s) => Array.from(String(s));
  }
})();

function textLines(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
}

function glyphFont(fs) { return `${fs}px ${FONT_STACK}`; }

export function textArea(b) {
  const s = SHAPE[b.type] || SHAPE.ellipse;
  return {
    w: Math.max(10, b.w * s.k * (1 - s.pad)),
    h: Math.max(10, b.h * s.k * (1 - s.pad)),
    curvy: !!s.curvy,
  };
}

// 在给定字号下排版：竖排按气泡比例自动折成多列（从右到左），横排按宽度折行
export function layoutBlock(ctx, b, fs, area) {
  const lines = textLines(b.text);
  if (b.vertical) {
    const colW = fs * 1.1, rowH = fs * 1.1;
    const maxRows = Math.max(1, Math.floor(area.h / rowH));
    const cols = [];
    for (const line of lines) {
      const chars = graphemes(line);
      if (!chars.length) { if (!cols.length) cols.push([]); continue; }
      const n = chars.length;
      // 每列至少 4 字；1~3 字的短行物理上凑不满，保持原样（整行一列）
      const minPer = n >= 4 ? 4 : 1;
      // 理想列高按气泡长宽比估算后放宽 2 字（字号相应变小，列内容变多）
      const base = Math.max(2, Math.round(Math.sqrt(n * (area.h / Math.max(1, area.w)))));
      const target = Math.max(minPer, Math.min(maxRows, base + 2));
      // 先按目标列高折列，再把「末尾不足 4 字」的列并回去，直到每列都不少于 minPer
      let count = Math.max(1, Math.ceil(n / target));
      while (count > 1 && Math.floor(n / count) < minPer) count--;
      // 均分（多出的字摊给靠前的列），避免 4/4/4/1 这种长短不齐的尾巴
      const q = Math.floor(n / count), rem = n % count;
      let at = 0;
      for (let c = 0; c < count; c++) {
        const len = q + (c < rem ? 1 : 0);
        cols.push(chars.slice(at, at + len));
        at += len;
      }
    }
    if (!cols.length) cols.push([]);
    const rows = Math.max(1, ...cols.map((c) => c.length));
    return { vertical: true, cols, colW, rowH, w: cols.length * colW, h: rows * rowH, rows, maxRows };
  }
  ctx.font = glyphFont(fs);
  const lineH = fs * 1.34;
  const rows = [];
  for (const line of lines) {
    if (!line) { rows.push(''); continue; }
    let cur = '';
    for (const ch of graphemes(line)) {
      const test = cur + ch;
      if (cur && ctx.measureText(test).width > area.w) { rows.push(cur); cur = ch; }
      else cur = test;
    }
    rows.push(cur);
  }
  if (!rows.length) rows.push('');
  const w = Math.max(fs * 0.6, ...rows.map((r) => ctx.measureText(r).width));
  return { vertical: false, rows, lineH, w, h: rows.length * lineH };
}

export function fitSize(ctx, b) {
  const area = textArea(b);
  const fit = (fs) => {
    const m = layoutBlock(ctx, b, fs, area);
    if (b.vertical) {
      // 竖排列数是整数格（列高 × 行数），边界不留 0.1% 余量：
      // 一行都不能超出，否则字号在「多挤一列」和「多放一行」之间来回抖。
      // 每列 ≥4 字时 maxRows<4 必然不通过 → 字号继续缩小（压扁气泡的兜底；
      // 正文只有 1~3 字时列本来就只有 1~3 行，不受影响）
      if (m.rows > m.maxRows) return false;
      if (area.curvy) return ((m.w / area.w) ** 2 + (m.h / area.h) ** 2) <= 1.02;
      return m.w <= area.w;
    }
    if (m.h > area.h * 1.001) return false;
    if (area.curvy) return ((m.w / area.w) ** 2 + (m.h / area.h) ** 2) <= 1.02;
    return m.w <= area.w * 1.001;
  };
  let lo = 3, hi = Math.max(6, Math.min(b.w, b.h) * 0.9);
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (fit(mid)) lo = mid; else hi = mid;
  }
  return lo;
}

export function drawBubbleText(ctx, b) {
  const raw = String(b.text ?? '');
  if (!raw.trim()) return;
  const area = textArea(b);
  const fs = Math.max(3, fitSize(ctx, b) * clamp(b.scale ?? 0.86, 0.2, 1.4));
  const m = layoutBlock(ctx, b, fs, area);
  const halo = b.type === 'text' || !b.filled;
  ctx.save();
  ctx.font = glyphFont(fs);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.fillStyle = INK;
  if (halo) { ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(2, fs * 0.26); }
  const glyph = (ch, x, y) => {
    if (halo) ctx.strokeText(ch, x, y);
    ctx.fillText(ch, x, y);
  };
  if (m.vertical) {
    const x0 = m.w / 2 - m.colW / 2;
    const y0 = -m.h / 2 + m.rowH / 2;
    m.cols.forEach((chars, ci) => {
      const x = x0 - ci * m.colW;
      chars.forEach((ch, ri) => glyph(ch, x, y0 + ri * m.rowH));
    });
  } else {
    const y0 = -m.h / 2 + m.lineH / 2;
    m.rows.forEach((row, ri) => { if (row) glyph(row, 0, y0 + ri * m.lineH); });
  }
  ctx.restore();
}

/* ================= 形状路径 ================= */

function ellipsePath(ctx, a, hh) {
  ctx.beginPath();
  ctx.ellipse(0, 0, a, hh, 0, 0, Math.PI * 2);
  ctx.closePath();
}

function roundRectPath(ctx, a, hh, r) {
  const rr = Math.min(r, a, hh);
  ctx.beginPath();
  ctx.moveTo(-a + rr, -hh);
  ctx.lineTo(a - rr, -hh);
  ctx.arcTo(a, -hh, a, -hh + rr, rr);
  ctx.lineTo(a, hh - rr);
  ctx.arcTo(a, hh, a - rr, hh, rr);
  ctx.lineTo(-a + rr, hh);
  ctx.arcTo(-a, hh, -a, hh - rr, rr);
  ctx.lineTo(-a, -hh + rr);
  ctx.arcTo(-a, -hh, -a + rr, -hh, rr);
  ctx.closePath();
}

// 丸の連なり（云朵形）：沿椭圆画一圈向外的弧
function cloudPath(ctx, a, hh) {
  const m = Math.min(a, hh);
  const n = clamp(Math.round((Math.PI * (a + hh)) / (m * 1.05)), 9, 20);
  const amp = 1.19;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const x = Math.cos(t) * a, y = Math.sin(t) * hh;
    if (i === 0) { ctx.moveTo(x, y); continue; }
    const tm = t - Math.PI / n;
    ctx.quadraticCurveTo(Math.cos(tm) * a * amp, Math.sin(tm) * hh * amp, x, y);
  }
  ctx.closePath();
}

// ギザギザ型（锯齿 / 喊叫）
function jaggedPath(ctx, a, hh) {
  const spikes = clamp(Math.round((Math.PI * (a + hh)) / (Math.min(a, hh) * 1.35)), 9, 18);
  const total = spikes * 2;
  ctx.beginPath();
  for (let i = 0; i < total; i++) {
    const t = -Math.PI / 2 + (i / total) * Math.PI * 2;
    const k = i % 2 ? 0.76 : 1;
    const x = Math.cos(t) * a * k, y = Math.sin(t) * hh * k;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function shapePath(ctx, b) {
  const a = b.w / 2, hh = b.h / 2;
  if (b.type === 'rect') roundRectPath(ctx, a, hh, Math.min(10, Math.min(a, hh) * 0.14));
  else if (b.type === 'cloud') cloudPath(ctx, a, hh);
  else if (b.type === 'jagged') jaggedPath(ctx, a, hh);
  else ellipsePath(ctx, a, hh);
}

function dashFor(b) {
  return [0.01, Math.max(6, Math.min(b.w, b.h) * 0.075)];
}

// 引出し（气泡的尾巴）：椭圆边缘 → 尖端，两段线（不含底边，避免穿帮）
function drawTail(ctx, b, lw) {
  const a = b.w / 2, hh = b.h / 2;
  let tx = b.tail.x, ty = b.tail.y;
  let len = Math.hypot(tx, ty);
  if (len < 1) { tx = 0; ty = hh * 1.3; len = Math.hypot(tx, ty); }
  const ux = tx / len, uy = ty / len;
  const reach = 1 / Math.sqrt((ux / a) ** 2 + (uy / hh) ** 2);
  if (len < reach * 1.05) {
    const k = (reach * 1.28) / len;
    tx *= k; ty *= k; len = Math.hypot(tx, ty);
  }
  const ang = Math.atan2(ty / hh, tx / a);
  const speed = Math.hypot(a * Math.sin(ang), hh * Math.cos(ang)) || 1;
  const d = clamp((Math.min(b.w, b.h) * 0.5) / (2 * speed), 0.1, 0.95);
  const p1 = [a * Math.cos(ang - d), hh * Math.sin(ang - d)];
  const p2 = [a * Math.cos(ang + d), hh * Math.sin(ang + d)];
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(tx, ty);
  ctx.lineTo(p2[0], p2[1]);
  ctx.closePath();
  if (b.filled !== false) { ctx.fillStyle = '#fff'; ctx.fill(); }
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(tx, ty);
  ctx.lineTo(p2[0], p2[1]);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  if (b.type === 'dotted') ctx.setLineDash(dashFor(b));
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawBubble(ctx, b, opts = {}) {
  const lw = opts.lw || BUBBLE_LINE;
  const ang = rad(b.rot || 0);
  ctx.save();
  ctx.translate(b.x, b.y);
  if (ang) ctx.rotate(ang);
  if (b.type === 'text') {
    drawBubbleText(ctx, b);
    ctx.restore();
    return;
  }
  if (b.tail && TAIL_TYPES.has(b.type)) drawTail(ctx, b, lw);
  shapePath(ctx, b);
  if (b.filled !== false) { ctx.fillStyle = '#fff'; ctx.fill(); }
  ctx.lineJoin = b.type === 'jagged' ? 'miter' : 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  if (b.type === 'dotted') { ctx.lineCap = 'round'; ctx.setLineDash(dashFor(b)); }
  ctx.stroke();
  ctx.setLineDash([]);
  drawBubbleText(ctx, b);
  ctx.restore();
}

export function drawBubbles(ctx, page) {
  const list = page?.bubbles || [];
  for (const b of list) drawBubble(ctx, b);
}

export function drawBubblePreview(canvas, type) {
  if (!canvas) return;
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  const cw = Math.max(60, Math.round(canvas.clientWidth || 104));
  const ch = Math.max(40, Math.round(canvas.clientHeight || 54));
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const w = Math.min(cw * 0.78, 92), h = Math.min(ch * 0.72, 52);
  drawBubble(ctx, {
    id: 'preview', type, x: cw / 2, y: ch / 2 + 2, w, h, rot: 0,
    text: type === 'text' ? '字' : '',
    scale: 0.8, vertical: true, filled: type !== 'text',
    tail: type === 'ellipse' ? { x: -w * 0.16, y: h * 0.62 } : null,
  }, { lw: 2.6 });
}

/* ================= 模块：编辑器 ================= */

export function defaultBubbleState() {
  return { exportWidth: 1600, selectId: null };
}

export function normalizeBubbleState(data) {
  const d = data && typeof data === 'object' ? data : {};
  return {
    exportWidth: clamp(Number(d.exportWidth) || 1600, 800, 4096),
    selectId: null,
  };
}

export function createBubbleModule(deps) {
  const {
    state, getT, toast, commit, beginOp, endOp, downloadCanvas,
    paintPage, nameSync, exportPages,
  } = deps;
  const T = (k, vars) => getT()(k, vars);

  const $ = (sel, root = document) => root.querySelector(sel);
  let bound = false;
  let hoverId = null;
  let drag = null;
  let paintRaf = 0;
  let textSnapshot = null;
  let dlgOk = false;

  function h(tag, attrs = {}, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'style') node.setAttribute('style', v);
      else if (k === 'value') node.value = String(v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of kids.flat(3)) {
      if (c === null || c === undefined || c === false) continue;
      node.append(c && c.nodeType ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  function setText(sel, text) { const el = $(sel); if (el) el.textContent = text; }

  /* ---------- 访问器 ---------- */
  const st = () => state.bubble;
  function pages() { return state.name?.pages || []; }
  function activePage() {
    const s = state.name;
    if (!s) return null;
    return s.pages.find((p) => p.id === s.activePageId) || s.pages[0] || null;
  }
  function activeIndex() {
    return Math.max(0, pages().findIndex((p) => p.id === activePage()?.id));
  }
  function bubbleOf(page, id) { return id ? (page?.bubbles || []).find((b) => b.id === id) || null : null; }
  function selected() { return bubbleOf(activePage(), st().selectId); }
  function allBubbles() {
    const out = [];
    for (const page of pages()) for (const b of page.bubbles || []) out.push({ page, b });
    return out;
  }

  /* ---------- 画布 ---------- */
  function scaleOf(canvas) {
    const page = activePage();
    const rect = canvas.getBoundingClientRect();
    return page && rect.width ? rect.width / page.w : 1;
  }

  function paintEditor() {
    const canvas = $('#bubbleCanvas');
    const wrap = $('#bubbleStageWrap');
    const page = activePage();
    if (!canvas || !wrap || !page) return;
    const avW = wrap.clientWidth - 30, avH = wrap.clientHeight - 30;
    if (avW < 60 || avH < 60) return;
    const tall = page.h / page.w > 1.85;
    let cssScale = tall
      ? Math.min(avW / page.w, 1.1)
      : Math.min(avW / page.w, avH / page.h, 1.6);
    cssScale = Math.max(0.05, cssScale);
    const cssW = Math.round(page.w * cssScale), cssH = Math.round(page.h * cssScale);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const pxW = Math.round(cssW * dpr), pxH = Math.round(cssH * dpr);
    if (canvas.width !== pxW || canvas.height !== pxH) { canvas.width = pxW; canvas.height = pxH; }
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pxW, pxH);
    const scale = pxW / page.w;
    paintPage(ctx, page, scale, { editing: true, numbers: false, selectedPanelId: null, hoverId: null, preview: null });
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawOverlay(ctx, page, scale);
  }

  function schedulePaint() {
    if (paintRaf) return;
    paintRaf = requestAnimationFrame(() => { paintRaf = 0; paintEditor(); });
  }

  function outline(ctx, b, color, scale, dashed) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(rad(b.rot || 0));
    ctx.strokeStyle = color;
    ctx.lineWidth = (dashed ? 1.6 : 1.8) / scale;
    if (dashed) ctx.setLineDash([7 / scale, 5 / scale]);
    ctx.strokeRect(-b.w / 2 - 2 / scale, -b.h / 2 - 2 / scale, b.w + 4 / scale, b.h + 4 / scale);
    ctx.restore();
  }

  function handle(ctx, pt, scale, round) {
    const r = 5.5 / scale;
    ctx.save();
    ctx.beginPath();
    if (round) ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    else ctx.rect(pt.x - r, pt.y - r, r * 2, r * 2);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#5b6bf0';
    ctx.lineWidth = 2 / scale;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawOverlay(ctx, page, scale) {
    const sel = selected();
    const hov = hoverId && hoverId !== sel?.id ? bubbleOf(page, hoverId) : null;
    if (hov) outline(ctx, hov, 'rgba(91,107,240,0.55)', scale, true);
    // 空文字的气泡给一点提示（只在编辑器里显示）
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${Math.round(page.w * 0.032)}px ${FONT_STACK}`;
    for (const b of page.bubbles || []) {
      if (String(b.text || '').trim()) continue;
      ctx.fillStyle = 'rgba(90,100,130,0.32)';
      ctx.fillText(T('bubble.blank'), b.x, b.y);
    }
    ctx.restore();
    if (!sel) return;
    outline(ctx, sel, '#5b6bf0', scale, false);
    const hd = bubbleHandles(sel);
    handle(ctx, hd.resize, scale, false);
    if (hd.tail) handle(ctx, hd.tail, scale, true);
  }

  /* ---------- 左侧：气泡素材（只构建一次，避免点击后引用失效） ---------- */
  let paletteLang = null;

  function redrawPreviews() {
    const host = $('#bubblePalette');
    if (!host) return;
    const w = host.clientWidth;
    if (!w || host.dataset.pw === String(w)) return;
    host.dataset.pw = String(w);
    for (const canvas of host.querySelectorAll('canvas.bb-prev')) drawBubblePreview(canvas, canvas.dataset.type);
  }

  function renderPalette() {
    const host = $('#bubblePalette');
    if (!host) return;
    if (!host.children.length || paletteLang !== state.lang) {
      paletteLang = state.lang;
      host.dataset.pw = '';
      host.replaceChildren(...BUBBLE_TYPES.map((type) => {
        const canvas = h('canvas', { class: 'bb-prev', 'data-type': type });
        return h('button', {
          class: 'bb-card', title: T('bubble.desc.' + type),
          onclick: () => addBubble(type),
        }, canvas, h('span', { class: 'bb-card-name', text: T('bubble.type.' + type) }));
      }));
      requestAnimationFrame(redrawPreviews);
    } else {
      redrawPreviews();
    }
  }

  /* ---------- 顶栏 ---------- */
  function renderToolbar() {
    const page = activePage();
    const idx = activeIndex(), total = pages().length;
    setText('#bubblePageInfo', T('name.pageOf', { n: idx + 1, m: total }));
    const prev = $('#bubblePrev'), next = $('#bubbleNext');
    if (prev) prev.disabled = idx <= 0;
    if (next) next.disabled = idx >= total - 1;
    const tools = $('#bubbleTools');
    if (tools) {
      tools.replaceChildren(
        h('span', { class: 'chip active' }, h('span', { class: 'chip-ico', text: '✥' }), T('bubble.toolSelect')),
      );
    }
    const hud = $('#bubbleHud');
    if (hud) hud.textContent = T('bubble.hudHint');
    const sel = $('#bubbleExportWidth');
    if (sel) {
      const opts = [1200, 1600, 2048, 2560];
      if (sel.options.length !== opts.length) {
        sel.replaceChildren(...opts.map((v) => h('option', { value: String(v), text: `${v} px` })));
      }
      sel.value = String(st().exportWidth);
    }
    const count = $('#bubbleTextCount');
    if (count) {
      const n = allBubbles().filter(({ b }) => String(b.text || '').trim()).length;
      count.textContent = T('bubble.textCount', { n });
    }
    void page;
  }

  /* ---------- 右侧：属性 ---------- */
  function rangeRow(label, min, max, value, fmt, onInput, onDone) {
    const input = h('input', { type: 'range', min: String(min), max: String(max), step: '1', value: String(value) });
    const out = h('output', { text: fmt(value) });
    let op = false;
    input.addEventListener('input', () => {
      if (!op) { beginOp(); op = true; }
      const v = Number(input.value);
      out.value = fmt(v);
      onInput(v);
      schedulePaint();
    });
    const done = () => { if (op) { op = false; endOp(); } onDone(); };
    input.addEventListener('change', done);
    return h('label', { class: 'slider-row wide' }, h('span', { text: label }), input, out);
  }

  function renderInspector() {
    const host = $('#bubbleInspector');
    if (!host) return;
    host.replaceChildren();
    const page = activePage();
    if (!page) return;
    const list = page.bubbles || [];
    const sel = selected();

    if (!sel) {
      host.append(h('div', { class: 'insp-empty', text: T('bubble.none') }));
    } else {
      const no = list.findIndex((b) => b.id === sel.id) + 1;
      host.append(h('div', { class: 'name-panel-no', text: T('bubble.no', { n: no, p: activeIndex() + 1 }) }));

      host.append(
        h('div', { class: 'field-label', text: T('bubble.kind') }),
        h('div', { class: 'row chips bb-types' }, ...BUBBLE_TYPES.map((type) => h('button', {
          class: 'chip' + (sel.type === type ? ' active' : ''),
          title: T('bubble.desc.' + type),
          text: T('bubble.type.' + type),
          onclick: () => { commit(() => setBubbleType(sel, type)); syncAll(); },
        }))),
      );

      const ta = h('textarea', {
        class: 'input bb-textarea', rows: '3', spellcheck: 'false',
        placeholder: T('bubble.textPlaceholder'), value: sel.text,
      });
      let top = false;
      ta.addEventListener('input', () => {
        if (!top) { beginOp(); top = true; }
        sel.text = ta.value;
        schedulePaint();
      });
      ta.addEventListener('change', () => {
        if (top) { top = false; endOp(); }
        afterEdit();
      });
      host.append(h('div', { class: 'field-label', text: T('bubble.text') }), ta);

      host.append(h('div', { class: 'row chips', style: 'margin-top:8px' },
        h('button', {
          class: 'chip' + (sel.vertical ? ' active' : ''),
          text: T('bubble.vertical'),
          onclick: () => { commit(() => { sel.vertical = true; }); syncAll(); },
        }),
        h('button', {
          class: 'chip' + (sel.vertical ? '' : ' active'),
          text: T('bubble.horizontal'),
          onclick: () => { commit(() => { sel.vertical = false; }); syncAll(); },
        }),
      ));

      host.append(rangeRow(T('bubble.size'), 40, 100,
        Math.round((sel.scale ?? 0.86) * 100), (v) => v + '%',
        (v) => { sel.scale = clamp(v / 100, 0.4, 1); }, afterEdit));
      host.append(rangeRow(T('bubble.rot'), -45, 45, Math.round(sel.rot || 0), (v) => v + '°',
        (v) => { sel.rot = v; }, afterEdit));

      if (TAIL_TYPES.has(sel.type)) {
        host.append(h('label', { class: 'check' },
          h('input', {
            type: 'checkbox', checked: !!sel.tail,
            onchange: (e) => {
              commit(() => {
                sel.tail = e.target.checked ? defaultTail(sel.w, sel.h) : null;
              });
              syncAll();
            },
          }),
          h('span', { text: T('bubble.tail') }),
        ));
      }
      if (sel.type !== 'text') {
        host.append(h('label', { class: 'check' },
          h('input', {
            type: 'checkbox', checked: sel.filled !== false,
            onchange: (e) => { commit(() => { sel.filled = e.target.checked; }); syncAll(); },
          }),
          h('span', { text: T('bubble.fill') }),
        ));
      }

      host.append(h('div', { class: 'row', style: 'margin-top:10px' },
        h('button', { class: 'btn block', text: T('bubble.front'), onclick: () => moveBubble(sel, 1) }),
        h('button', { class: 'btn block', text: T('bubble.back'), onclick: () => moveBubble(sel, -1) }),
      ));
      host.append(h('div', { class: 'row', style: 'margin-top:6px' },
        h('button', { class: 'btn block', text: T('bubble.fit'), onclick: () => fitBubble(sel) }),
        h('button', { class: 'btn block danger', text: T('bubble.delete'), onclick: () => removeBubble(sel) }),
      ));
      host.append(h('p', { class: 'note', text: T('bubble.inspNote') }));
    }

    if (list.length) {
      host.append(h('div', { class: 'field-label', text: T('bubble.thisPage') }));
      host.append(h('div', { class: 'bb-list' }, ...list.map((b, i) => h('button', {
        class: 'bb-list-item' + (b.id === st().selectId ? ' active' : ''),
        onclick: () => { st().selectId = b.id; syncAll(); },
      },
        h('span', { class: 'bb-list-no', text: String(i + 1) }),
        h('span', { class: 'bb-list-type', text: T('bubble.type.' + b.type) }),
        h('span', { class: 'bb-list-text', text: String(b.text || '').replace(/\n/g, ' ').trim() || T('bubble.blank') }),
      ))));
    }
  }

  function setBubbleType(b, type) {
    const prev = b.type;
    b.type = type;
    if (!TAIL_TYPES.has(type)) b.tail = null;
    else if (!b.tail) b.tail = defaultTail(b.w, b.h);
    if (type === 'text') b.filled = false;
    else if (prev === 'text') b.filled = true;
  }

  function moveBubble(b, dir) {
    const page = activePage();
    if (!page) return;
    const list = page.bubbles || [];
    const i = list.findIndex((x) => x.id === b.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    commit(() => {
      const [it] = list.splice(i, 1);
      list.splice(j, 0, it);
    });
    syncAll();
  }

  function removeBubble(b) {
    const page = activePage();
    if (!page) return;
    commit(() => {
      page.bubbles = (page.bubbles || []).filter((x) => x.id !== b.id);
      if (st().selectId === b.id) st().selectId = null;
    });
    syncAll();
    toast(T('toast.bubbleDeleted'));
  }

  // 把气泡缩到「贴着文字」的大小
  function fitBubble(b) {
    const page = activePage();
    if (!page) return;
    const canvas = $('#bubbleCanvas');
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    if (!String(b.text || '').trim()) { toast(T('toast.bubbleNoText')); return; }
    const s = SHAPE[b.type] || SHAPE.ellipse;
    const k = Math.max(0.2, s.k * (1 - s.pad));
    const scale = clamp(b.scale ?? 0.86, 0.2, 1.4);
    let w = b.w, hh = b.h;
    for (let i = 0; i < 3; i++) {
      const probe = { ...b, w, h: hh };
      const area = textArea(probe);
      const fs = Math.max(8, fitSize(ctx, probe) * scale);
      const m = layoutBlock(ctx, probe, fs, area);
      w = clamp((m.w * 1.18) / k, 60, 2200);
      hh = clamp((m.h * 1.18) / k, 50, 2200);
    }
    commit(() => {
      b.w = w;
      b.h = hh;
      if (b.tail) b.tail = defaultTail(b.w, b.h);
    });
    syncAll();
    toast(T('toast.bubbleFit'));
  }

  function addBubble(type) {
    const page = activePage();
    if (!page) return;
    if (!Array.isArray(page.bubbles)) page.bubbles = [];
    if (page.bubbles.length >= 80) { toast(T('toast.bubbleLimit')); return; }
    const n = page.bubbles.length;
    const off = ((n % 4) - 1.5) * 26;
    const b = makeBubble(type, page, [page.w / 2 + off, page.h / 2 + off]);
    commit(() => { page.bubbles.push(b); st().selectId = b.id; });
    syncAll();
    const ta = $('#bubbleInspector textarea');
    if (ta) ta.focus();
    toast(T('toast.bubbleAdded', { name: T('bubble.type.' + type) }));
  }

  /* ---------- 统一编辑所有文字 ---------- */
  function snapshotTexts() {
    return allBubbles().map(({ b }) => ({ id: b.id, text: b.text, vertical: b.vertical, scale: b.scale }));
  }

  function restoreTexts() {
    if (!textSnapshot) return;
    const map = new Map(textSnapshot.map((it) => [it.id, it]));
    for (const { b } of allBubbles()) {
      const it = map.get(b.id);
      if (!it) continue;
      b.text = it.text;
      b.vertical = it.vertical;
      b.scale = it.scale;
    }
  }

  function renderTextDialog() {
    const host = $('#bubbleTextList');
    if (!host) return;
    host.replaceChildren();
    let any = false;
    pages().forEach((page, pi) => {
      const list = page.bubbles || [];
      if (!list.length) return;
      any = true;
      host.append(h('div', { class: 'bb-group' }, T('bubble.textGroup', { p: pi + 1, n: list.length })));
      list.forEach((b, bi) => {
        const ta = h('textarea', {
          class: 'input bb-ta', rows: '2', spellcheck: 'false',
          placeholder: T('bubble.textPlaceholder'), value: b.text,
        });
        ta.addEventListener('input', () => {
          b.text = ta.value;
          schedulePaint();
        });
        host.append(h('div', { class: 'bb-row' },
          h('div', { class: 'bb-row-head' },
            h('span', { class: 'bb-badge', text: T('bubble.type.' + b.type) }),
            h('span', { class: 'bb-row-no', text: `#${bi + 1}` }),
            h('button', {
              class: 'mini', text: T('bubble.locate'),
              onclick: () => {
                state.name.activePageId = page.id;
                st().selectId = b.id;
                dlgOk = true;
                $('#bubbleTextDialog')?.close();
              },
            }),
          ),
          ta,
        ));
      });
    });
    if (!any) host.append(h('div', { class: 'muted', text: T('bubble.textEmpty') }));
    const size = $('#bubbleAllSize');
    if (size) size.value = String(86);
  }

  function openTextDialog() {
    const dlg = $('#bubbleTextDialog');
    if (!dlg) return;
    textSnapshot = snapshotTexts();
    dlgOk = false;
    beginOp();
    renderTextDialog();
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  /* ---------- 导出 ---------- */
  async function exportNow(list) {
    const pagesToGo = list.filter(Boolean);
    if (!pagesToGo.length) return;
    await exportPages(pagesToGo, {
      prefix: 'fukidashi',
      width: st().exportWidth,
      toastKey: 'toast.bubbleExported',
      failKey: 'toast.bubbleExportFailed',
    });
  }

  /* ---------- 编辑后的同步 ---------- */
  function afterEdit() {
    nameSync();
    schedulePaint();
  }

  function syncAll() {
    if (!state.bubble) state.bubble = defaultBubbleState();
    if (!state.name) return;
    renderToolbar();
    renderPalette();
    renderInspector();
    schedulePaint();
  }

  /* ---------- 指针交互 ---------- */
  function pointerPage(canvas, e) {
    const page = activePage();
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * (page.w / r.width), (e.clientY - r.top) * (page.h / r.height)];
  }

  function onPointerDown(e) {
    const canvas = e.currentTarget;
    const page = activePage();
    if (!page) return;
    const pt = pointerPage(canvas, e);
    const scale = scaleOf(canvas);
    const tol = 12 / scale;
    const sel = selected();
    let kind = null, target = null;
    if (sel) {
      const hd = bubbleHandles(sel);
      if (sel.tail && hd.tail && Math.hypot(pt[0] - hd.tail.x, pt[1] - hd.tail.y) <= tol) { kind = 'tail'; target = sel; }
      else if (Math.hypot(pt[0] - hd.resize.x, pt[1] - hd.resize.y) <= tol) { kind = 'resize'; target = sel; }
    }
    if (!target) {
      const hit = pickBubbleAt(page, pt);
      if (!hit) {
        if (st().selectId) { st().selectId = null; syncAll(); }
        return;
      }
      if (st().selectId !== hit.id) { st().selectId = hit.id; syncAll(); }
      kind = 'move';
      target = hit;
    }
    const start = { x: target.x, y: target.y, w: target.w, h: target.h, rot: target.rot || 0, tail: target.tail ? { ...target.tail } : null };
    drag = { kind, id: target.id, start, pt0: pt };
    beginOp();
    canvas.setPointerCapture?.(e.pointerId);
    schedulePaint();
  }

  function onPointerMove(e) {
    const canvas = e.currentTarget;
    const page = activePage();
    if (!page) return;
    if (!drag) {
      const pt = pointerPage(canvas, e);
      const hit = pickBubbleAt(page, pt);
      const id = hit ? hit.id : null;
      if (id !== hoverId) { hoverId = id; schedulePaint(); }
      return;
    }
    const b = bubbleOf(page, drag.id);
    if (!b) { drag = null; return; }
    const pt = pointerPage(canvas, e);
    const dx = pt[0] - drag.pt0[0], dy = pt[1] - drag.pt0[1];
    const s = drag.start;
    if (drag.kind === 'move') {
      b.x = clamp(s.x + dx, 0, page.w);
      b.y = clamp(s.y + dy, 0, page.h);
      if (!e.shiftKey) {
        if (Math.abs(b.x - page.w / 2) < 9) b.x = page.w / 2;
        if (Math.abs(b.y - page.h / 2) < 9) b.y = page.h / 2;
      }
    } else if (drag.kind === 'resize') {
      const l = rotPoint(dx, dy, -rad(s.rot));
      const w = clamp(s.w + l[0], 40, page.w * 2.5);
      const hh = clamp(s.h + l[1], 34, page.h * 2.5);
      const shift = rotPoint((w - s.w) / 2, (hh - s.h) / 2, rad(s.rot));
      b.w = w;
      b.h = hh;
      b.x = clamp(s.x + shift[0], 0, page.w);
      b.y = clamp(s.y + shift[1], 0, page.h);
    } else if (drag.kind === 'tail') {
      const l = toLocal(pt, b);
      const len = Math.hypot(l[0], l[1]);
      b.tail = len < 8 ? { x: 0, y: b.h * 0.4 } : { x: l[0], y: l[1] };
    }
    schedulePaint();
  }

  function onPointerUp(e) {
    if (!drag) return;
    const canvas = e.currentTarget;
    canvas.releasePointerCapture?.(e.pointerId);
    drag = null;
    endOp();
    renderInspector();
    afterEdit();
  }

  function onDoubleClick(e) {
    const canvas = e.currentTarget;
    const page = activePage();
    if (!page) return;
    const hit = pickBubbleAt(page, pointerPage(canvas, e));
    if (!hit) return;
    st().selectId = hit.id;
    syncAll();
    const ta = $('#bubbleInspector textarea');
    if (ta) { ta.focus(); ta.select(); }
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    if (bound) return;
    bound = true;
    const canvas = $('#bubbleCanvas');
    if (canvas) {
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
      canvas.addEventListener('pointerleave', () => { if (!drag) { hoverId = null; schedulePaint(); } });
      canvas.addEventListener('dblclick', onDoubleClick);
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
    on('#bubbleAddPage', 'click', () => deps.addPage());
    on('#bubblePrev', 'click', () => deps.gotoPage(-1));
    on('#bubbleNext', 'click', () => deps.gotoPage(1));
    on('#bubbleTextAll', 'click', openTextDialog);
    on('#bubbleTextOpen', 'click', openTextDialog);
    on('#bubbleExportOne', 'click', () => { const p = activePage(); if (p) exportNow([p]); });
    on('#bubbleExportAll', 'click', () => exportNow(pages().slice()));
    on('#bubbleExportWidth', 'change', (e) => {
      commit(() => { st().exportWidth = clamp(Number(e.target.value) || 1600, 800, 4096); });
      deps.scheduleAutosave();
    });

    const dlg = $('#bubbleTextDialog');
    if (dlg) {
      on('#bubbleTextOk', 'click', () => { dlgOk = true; dlg.close(); });
      on('#bubbleTextCancel', 'click', () => dlg.close());
      on('#bubbleAllVertical', 'click', () => {
        for (const { b } of allBubbles()) b.vertical = true;
        schedulePaint();
      });
      on('#bubbleAllHorizontal', 'click', () => {
        for (const { b } of allBubbles()) b.vertical = false;
        schedulePaint();
      });
      const size = $('#bubbleAllSize'), out = $('#bubbleAllSizeOut');
      size?.addEventListener('input', () => {
        const v = clamp(Number(size.value) / 100, 0.4, 1);
        for (const { b } of allBubbles()) b.scale = v;
        if (out) out.value = size.value + '%';
        schedulePaint();
      });
      dlg.addEventListener('close', () => {
        if (!dlgOk) restoreTexts();
        textSnapshot = null;
        dlgOk = false;
        endOp();
        afterEdit();
        renderInspector();
      });
    }

    const ro = new ResizeObserver(() => schedulePaint());
    const wrap = $('#bubbleStageWrap');
    if (wrap) ro.observe(wrap);
    window.addEventListener('resize', () => schedulePaint());
  }

  /* ---------- 对外 API ---------- */
  function setMode(mode) {
    if (mode !== 'bubble') return;
    syncAll();
    requestAnimationFrame(() => schedulePaint());
  }

  function selectedBubble() { return selected(); }

  function removeSelected() {
    const b = selected();
    if (b) removeBubble(b);
    return !!b;
  }

  function nudgeSelected(dx, dy) {
    const b = selected();
    const page = activePage();
    if (!b || !page) return false;
    commit(() => {
      b.x = clamp(b.x + dx, 0, page.w);
      b.y = clamp(b.y + dy, 0, page.h);
    });
    afterEdit();
    return true;
  }

  function duplicateSelected() {
    const page = activePage();
    const b = selected();
    if (!page || !b) return false;
    const copy = JSON.parse(JSON.stringify(b));
    copy.id = uid('bb');
    copy.x = clamp(b.x + 24, 0, page.w);
    copy.y = clamp(b.y + 24, 0, page.h);
    commit(() => { page.bubbles.push(copy); st().selectId = copy.id; });
    syncAll();
    return true;
  }

  bind();

  return {
    syncAll,
    setMode,
    renderPalette,
    exportNow,
    addBubble,
    openTextDialog,
    selectedBubble,
    removeSelected,
    nudgeSelected,
    duplicateSelected,
    activePage,
    pages,
  };
}
