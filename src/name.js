// 漫画分格（ネームのコマ割り）
// 多页面管理 / 拉线分格 / 把 3D 保存的画面放进分格 / 导出整本ネーム PNG
import { uid } from './stages.js';
import { drawBubbles, normalizeBubbles, cloneBubbles } from './bubble.js';

/* ================= 纯函数：页面模型与几何 ================= */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const EPS = 1e-6;

// 分格线在页面里实际切出的位置（运行时推导结果，不写进工程文件）
const creasesByPage = new WeakMap();
export function pageCreases(page) { return creasesByPage.get(page) || new Map(); }

export const PAGE_SIZES = {
  b5: { w: 1000, h: 1414 },
  square: { w: 1000, h: 1000 },
  wide: { w: 1414, h: 1000 },
  tall: { w: 900, h: 2100 },
};

export const NAME_TOOLS = ['line', 'select', 'erase'];

function num(v, min, max, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return clamp(n, min, max);
}

export function makePage(sizeId = 'b5') {
  const s = PAGE_SIZES[sizeId] || PAGE_SIZES.b5;
  const page = {
    id: uid('pg'), name: '', sizeId: PAGE_SIZES[sizeId] ? sizeId : 'b5',
    w: s.w, h: s.h, margin: 46, gap: 14, line: 5,
    lines: [], panels: [], bubbles: [],
  };
  rebuildPanels(page);
  return page;
}

export function defaultNameState() {
  const page = makePage('b5');
  return {
    pages: [page], activePageId: page.id, pageSeq: 1,
    tool: 'line', exportWidth: 1600, selectFrameId: null,
  };
}

function normalizeFrameRef(f) {
  return {
    frameId: f.frameId,
    zoom: num(f.zoom, 0.2, 6, 1),
    ox: Number.isFinite(Number(f.ox)) ? Number(f.ox) : 0,
    oy: Number.isFinite(Number(f.oy)) ? Number(f.oy) : 0,
    mask: ['gray', 'dim', 'hide'].includes(f.mask) ? f.mask : 'gray',
  };
}

function sanitizePage(p) {
  const s = PAGE_SIZES[p.sizeId] || PAGE_SIZES.b5;
  const page = {
    id: p.id || uid('pg'),
    name: typeof p.name === 'string' ? p.name : '',
    sizeId: PAGE_SIZES[p.sizeId] ? p.sizeId : 'b5',
    w: s.w, h: s.h,
    margin: num(p.margin, 0, 220, 46),
    gap: num(p.gap, 0, 60, 14),
    line: num(p.line, 0, 22, 5),
    lines: [],
    panels: [],
    bubbles: [],
  };
  if (Array.isArray(p.lines)) {
    for (const l of p.lines) {
      if (!Array.isArray(l.a) || !Array.isArray(l.b)) continue;
      const a = [Number(l.a[0]), Number(l.a[1])], b = [Number(l.b[0]), Number(l.b[1])];
      if (!a.every(Number.isFinite) || !b.every(Number.isFinite)) continue;
      page.lines.push({ id: l.id || uid('ln'), a, b });
    }
  }
  if (Array.isArray(p.panels)) {
    for (const panel of p.panels) {
      if (!Array.isArray(panel.poly) || panel.poly.length < 3) continue;
      const poly = panel.poly
        .map((pt) => [Number(pt[0]), Number(pt[1])])
        .filter((pt) => pt.every(Number.isFinite));
      if (poly.length < 3) continue;
      page.panels.push({
        id: panel.id || uid('pn'), poly,
        frame: panel.frame && panel.frame.frameId ? normalizeFrameRef(panel.frame) : null,
      });
    }
  }
  page.bubbles = normalizeBubbles(p.bubbles, page);
  rebuildPanels(page);
  return page;
}

export function normalizeNameState(data) {
  if (!data || !Array.isArray(data.pages) || !data.pages.length) return defaultNameState();
  const out = {
    pages: [],
    activePageId: null,
    pageSeq: Math.max(1, Number(data.pageSeq) || data.pages.length),
    tool: NAME_TOOLS.includes(data.tool) ? data.tool : 'line',
    exportWidth: num(data.exportWidth, 800, 4096, 1600),
    selectFrameId: null,
  };
  for (const p of data.pages) {
    if (p && typeof p === 'object') out.pages.push(sanitizePage(p));
  }
  if (!out.pages.length) return defaultNameState();
  out.activePageId = out.pages.some((p) => p.id === data.activePageId) ? data.activePageId : out.pages[0].id;
  return out;
}

/* ---------- 几何 ---------- */

export function polygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

export function polygonCentroid(poly) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const f = p[0] * q[1] - q[0] * p[1];
    a += f; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f;
  }
  if (Math.abs(a) < EPS) {
    const n = poly.length;
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

export function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

export function bboxOf(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) {
    if (p[0] < x0) x0 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[0] > x1) x1 = p[0];
    if (p[1] > y1) y1 = p[1];
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, x1, y1 };
}

function dedupe(poly) {
  const out = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (last && Math.hypot(last[0] - p[0], last[1] - p[1]) < 0.05) continue;
    out.push([p[0], p[1]]);
  }
  if (out.length > 1) {
    const first = out[0], last = out[out.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.05) out.pop();
  }
  return out;
}

// 用直线（过 a、b 的无限长线）切多边形，sign=+1 取一侧 / -1 取另一侧
function clipHalf(poly, a, b, sign) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const dist = (p) => sign * (dx * (p[1] - a[1]) - dy * (p[0] - a[0]));
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i], nxt = poly[(i + 1) % poly.length];
    const dc = dist(cur), dn = dist(nxt);
    if (dc >= -1e-9) out.push([cur[0], cur[1]]);
    if ((dc > 1e-9 && dn < -1e-9) || (dc < -1e-9 && dn > 1e-9)) {
      const t = dc / (dc - dn);
      out.push([cur[0] + (nxt[0] - cur[0]) * t, cur[1] + (nxt[1] - cur[1]) * t]);
    }
  }
  return dedupe(out);
}

// 沿 a、b 的无限长线把多边形一分为二；切不开时返回 null
export function splitPolygon(poly, a, b) {
  const p1 = clipHalf(poly, a, b, 1);
  const p2 = clipHalf(poly, a, b, -1);
  if (p1.length < 3 || p2.length < 3) return null;
  const area = polygonArea(poly);
  const a1 = polygonArea(p1), a2 = polygonArea(p2);
  const minArea = Math.max(1200, area * 0.035);
  if (a1 < minArea || a2 < minArea) return null;
  if (Math.min(a1, a2) < 400) return null;
  return [p1, p2];
}

// 直线在多边形内部的弦 {a,b,t0,t1}（t 为沿 a→b 方向的一维坐标）
export function lineChord(poly, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;
  const ux = dx / len, uy = dy / len;
  const side = (p) => ux * (p[1] - a[1]) - uy * (p[0] - a[0]);
  const hits = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const sp = side(p), sq = side(q);
    if (Math.abs(sp) < 0.01) hits.push(p);
    if ((sp > 0.01 && sq < -0.01) || (sp < -0.01 && sq > 0.01)) {
      const t = sp / (sp - sq);
      hits.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  if (hits.length < 2) return null;
  let lo = hits[0], hi = hits[0], t0 = Infinity, t1 = -Infinity;
  for (const p of hits) {
    const t = (p[0] - a[0]) * ux + (p[1] - a[1]) * uy;
    if (t < t0) { t0 = t; lo = p; }
    if (t > t1) { t1 = t; hi = p; }
  }
  if (t1 - t0 < 0.6) return null;
  return { a: lo, b: hi, t0, t1 };
}

export function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 < EPS) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
}

export function innerRect(page) {
  const m = clamp(page.margin, 0, Math.min(page.w, page.h) / 2 - 10);
  return { x: m, y: m, w: page.w - m * 2, h: page.h - m * 2 };
}

function innerPoly(page) {
  const r = innerRect(page);
  return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
}

// 把线段裁到内枠里
export function clipSegmentToInner(page, a, b) {
  const r = innerRect(page);
  const dx = b[0] - a[0], dy = b[1] - a[1];
  let t0 = 0, t1 = 1;
  const tests = [
    [-dx, a[0] - r.x], [dx, r.x + r.w - a[0]],
    [-dy, a[1] - r.y], [dy, r.y + r.h - a[1]],
  ];
  for (const [p, q] of tests) {
    if (Math.abs(p) < EPS) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
    else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  if (t1 - t0 < 1e-4) return null;
  return [
    [a[0] + dx * t0, a[1] + dy * t0],
    [a[0] + dx * t1, a[1] + dy * t1],
  ];
}

/**
 * 用 page.lines 重新推导所有分格（lines 是唯一真相，分格是推导结果）。
 * 旧分格的 id 与画面分配会按「重心落在哪个旧分格里」继承。
 */
export function rebuildPanels(page) {
  let cells = [{ poly: innerPoly(page) }];
  const creases = new Map();
  for (const line of page.lines || []) {
    const segLen = Math.hypot(line.b[0] - line.a[0], line.b[1] - line.a[1]);
    const next = [];
    const chords = [];
    for (const cell of cells) {
      const ch = lineChord(cell.poly, line.a, line.b);
      let hit = false;
      if (ch && segLen > EPS) {
        const ux = (line.b[0] - line.a[0]) / segLen, uy = (line.b[1] - line.a[1]) / segLen;
        const p0 = (ch.a[0] - line.a[0]) * ux + (ch.a[1] - line.a[1]) * uy;
        const p1 = (ch.b[0] - line.a[0]) * ux + (ch.b[1] - line.a[1]) * uy;
        const overlap = Math.min(segLen, Math.max(p0, p1)) - Math.max(0, Math.min(p0, p1));
        hit = overlap > 1.2;
      }
      if (hit) {
        const parts = splitPolygon(cell.poly, line.a, line.b);
        if (parts) {
          next.push({ poly: parts[0] }, { poly: parts[1] });
          chords.push([ch.a, ch.b]);
          continue;
        }
      }
      next.push(cell);
    }
    creases.set(line.id, chords);
    cells = next;
  }

  const prev = page.panels || [];
  const claims = cells.map((c) => {
    const cen = polygonCentroid(c.poly);
    return prev.findIndex((p) => pointInPolygon(cen, p.poly));
  });
  const groups = new Map();
  cells.forEach((c, i) => {
    const idx = claims[i];
    if (idx < 0) return;
    const list = groups.get(idx) || [];
    list.push(i);
    groups.set(idx, list);
  });
  const ids = new Array(cells.length).fill(null);
  const frames = new Array(cells.length).fill(null);
  for (const [idx, list] of groups) {
    list.sort((x, y) => polygonArea(cells[y].poly) - polygonArea(cells[x].poly));
    const keep = list[0];
    ids[keep] = prev[idx].id;
    frames[keep] = prev[idx].frame || null;
    for (const i of list.slice(1)) {
      ids[i] = uid('pn');
      frames[i] = prev[idx].frame ? { ...prev[idx].frame } : null; // 切开时分格里的画面两半都保留，方便分别微调
    }
  }
  page.panels = cells.map((c, i) => ({
    id: ids[i] || uid('pn'),
    poly: c.poly,
    frame: frames[i],
  }));
  creasesByPage.set(page, creases);
  return page.panels;
}

// 从右往左、从上往下的阅读顺序（漫画顺序）
export function readingOrder(page) {
  const items = (page.panels || []).map((p) => ({ p, c: polygonCentroid(p.poly), b: bboxOf(p.poly) }));
  const rows = [];
  for (const it of items.slice().sort((a, b) => a.c[1] - b.c[1])) {
    let row = rows.find((r) => Math.abs(r.cy - it.c[1]) < Math.max(24, (r.h + it.b.h) * 0.22));
    if (!row) { row = { cy: it.c[1], h: it.b.h, items: [] }; rows.push(row); }
    row.items.push(it);
    row.cy = row.items.reduce((s, x) => s + x.c[1], 0) / row.items.length;
    row.h = Math.max(row.h, it.b.h);
  }
  rows.sort((a, b) => a.cy - b.cy);
  const out = [];
  for (const r of rows) {
    r.items.sort((a, b) => b.c[0] - a.c[0]);
    for (const it of r.items) out.push(it.p);
  }
  return out;
}

/* ================= 模块 ================= */

export function createNameModule(deps) {
  const { state, getT, toast, commit, beginOp, endOp, renderToCanvas, downloadCanvas, frameById, redraw3DFrames, sceneSignature } = deps;
  const T = (k, vars) => getT()(k, vars);

  const imgLo = new Map();     // frameId -> { canvas, gen }
  const imgHi = new Map();
  let cacheGen = 0;
  let lastSig = '';
  let hoverPanelId = null;
  let miniHoverId = null;
  let drag = null;
  let preview = null;
  let bound = false;
  let paintRaf = 0;

  const $ = (sel, root = document) => root.querySelector(sel);

  function h(tag, attrs = {}, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'style') node.setAttribute('style', v);
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
  const st = () => state.name;
  function activePage() {
    const s = st();
    return s.pages.find((p) => p.id === s.activePageId) || s.pages[0] || null;
  }
  function activeIndex() {
    const s = st();
    return Math.max(0, s.pages.findIndex((p) => p.id === activePage()?.id));
  }
  function panelById(page, id) { return id ? page.panels.find((p) => p.id === id) || null : null; }

  /* ---------- 画面缓存 ---------- */
  function invalidate() { cacheGen += 1; imgLo.clear(); imgHi.clear(); }

  function checkScene() {
    if (!sceneSignature) return;
    let sig = '';
    try { sig = sceneSignature(); } catch { sig = ''; }
    if (sig && sig !== lastSig) { lastSig = sig; invalidate(); }
  }

  function hiResWidth() {
    return clamp(Math.ceil((st().exportWidth || 1600) * 0.82), 1200, 3000);
  }

  function frameImage(frameId, bucket = 'lo') {
    if (!frameId) return null;
    const f = frameById(frameId);
    if (!f) return null;
    const map = bucket === 'hi' ? imgHi : imgLo;
    const cur = map.get(frameId);
    if (cur && cur.gen === cacheGen) return cur.canvas;
    const W = bucket === 'hi' ? hiResWidth() : 1100;
    const asp = f.aspect || [16, 9];
    const H = Math.max(1, Math.round((W * asp[1]) / asp[0]));
    let canvas = null;
    try { canvas = renderToCanvas(f, W, H, {}); } catch (err) { console.warn('name: render frame failed', err); }
    if (!canvas) return null;
    map.set(frameId, { canvas, gen: cacheGen });
    if (map === imgLo && imgLo.size > 26) imgLo.delete(imgLo.keys().next().value);
    return canvas;
  }

  /* ---------- 画面在分格里的摆放 ---------- */
  function placement(page, panel, img) {
    const bb = bboxOf(panel.poly);
    const fr = panel.frame || {};
    const zoom = clamp(fr.zoom ?? 1, 0.2, 6);
    const cover = Math.max(bb.w / img.width, bb.h / img.height);
    const s = cover * zoom;
    const w = img.width * s, hgt = img.height * s;
    const cx = bb.x + bb.w / 2 + (fr.ox || 0);
    const cy = bb.y + bb.h / 2 + (fr.oy || 0);
    return { x: cx - w / 2, y: cy - hgt / 2, w, h: hgt, cx, cy, bb };
  }

  function clampOffsets(page, panel, img) {
    const f = panel.frame;
    if (!f || !img) return;
    const bb = bboxOf(panel.poly);
    const halfW = (img.width * Math.max(bb.w / img.width, bb.h / img.height) * clamp(f.zoom ?? 1, 0.2, 6)) / 2;
    const halfH = (img.height * Math.max(bb.w / img.width, bb.h / img.height) * clamp(f.zoom ?? 1, 0.2, 6)) / 2;
    const bcx = bb.x + bb.w / 2, bcy = bb.y + bb.h / 2;
    const xMin = bb.x + bb.w - halfW - bcx, xMax = bb.x + halfW - bcx;
    const yMin = bb.y + bb.h - halfH - bcy, yMax = bb.y + halfH - bcy;
    f.ox = xMin <= xMax ? clamp(f.ox || 0, xMin, xMax) : (xMin + xMax) / 2;
    f.oy = yMin <= yMax ? clamp(f.oy || 0, yMin, yMax) : (yMin + yMax) / 2;
  }

  /* ---------- 绘制 ---------- */
  function polyPath(ctx, poly) {
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
  }

  function roundRect(ctx, x, y, w, hgt, r) {
    const rr = Math.min(r, w / 2, hgt / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + hgt - rr);
    ctx.arcTo(x + w, y + hgt, x + w - rr, y + hgt, rr);
    ctx.lineTo(x + rr, y + hgt);
    ctx.arcTo(x, y + hgt, x, y + hgt - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }

  function paintPage(ctx, page, scale, opts = {}) {
    const {
      editing = false, numbers = false, selectedPanelId = null,
      hoverId = null, preview: pv = null, hi = false,
    } = opts;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, page.w, page.h);
    if (editing) {
      ctx.strokeStyle = 'rgba(120,128,145,0.5)';
      ctx.lineWidth = Math.max(1.2 / scale, 1.1);
      ctx.strokeRect(0, 0, page.w, page.h);
    }

    const sel = panelById(page, selectedPanelId);
    // ① 选中分格：格外部分用灰色 / 降低透明度遮罩显示
    if (editing && sel && sel.frame && sel.frame.mask !== 'hide') {
      const img = frameImage(sel.frame.frameId, 'lo');
      if (img) {
        const pl = placement(page, sel, img);
        ctx.save();
        if ((sel.frame.mask || 'gray') === 'dim') {
          ctx.globalAlpha = 0.26;
          ctx.drawImage(img, pl.x, pl.y, pl.w, pl.h);
        } else {
          ctx.globalAlpha = 1;
          ctx.drawImage(img, pl.x, pl.y, pl.w, pl.h);
          ctx.fillStyle = 'rgba(140,144,154,0.66)';
          ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
        }
        ctx.restore();
      }
    }

    // ② 每个分格里的画面（裁切在分格内）
    for (const panel of page.panels) {
      const img = panel.frame ? frameImage(panel.frame.frameId, hi ? 'hi' : 'lo') : null;
      if (img) {
        const pl = placement(page, panel, img);
        ctx.save();
        polyPath(ctx, panel.poly);
        ctx.clip();
        ctx.drawImage(img, pl.x, pl.y, pl.w, pl.h);
        ctx.restore();
      } else if (editing) {
        ctx.save();
        polyPath(ctx, panel.poly);
        ctx.fillStyle = 'rgba(99,107,126,0.05)';
        ctx.fill();
        ctx.restore();
      }
    }

    // ③ 分格线：先白（做出间隙）再黑
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 3;
    ctx.lineCap = 'butt';
    if (page.gap > 0) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = page.gap + page.line;
      for (const panel of page.panels) { polyPath(ctx, panel.poly); ctx.stroke(); }
    }
    if (page.line > 0) {
      ctx.strokeStyle = '#22262f';
      ctx.lineWidth = page.line;
      for (const panel of page.panels) { polyPath(ctx, panel.poly); ctx.stroke(); }
    }

    // ③.5 对话气泡与自由文字（与页面一起导出）
    drawBubbles(ctx, page);

    // ④ 编辑用装饰：格号 / 悬停 / 选中 / 拉线预览
    if (numbers) {
      const order = readingOrder(page);
      const nums = new Map(order.map((p, i) => [p.id, i + 1]));
      const bs = page.w * 0.03;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const panel of page.panels) {
        const bb = bboxOf(panel.poly);
        const x = bb.x + bs * 0.42, y = bb.y + bs * 0.42;
        if (bb.w < bs * 1.6 || bb.h < bs * 1.4) continue;
        ctx.save();
        roundRect(ctx, x, y, bs * 1.2, bs, bs * 0.28);
        ctx.fillStyle = panel.frame ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.78)';
        ctx.fill();
        ctx.lineWidth = Math.max(page.w * 0.0012, 0.8);
        ctx.strokeStyle = 'rgba(45,52,70,0.32)';
        ctx.stroke();
        ctx.fillStyle = panel.frame ? '#3b49c9' : 'rgba(72,80,100,0.6)';
        ctx.font = `700 ${bs * 0.6}px system-ui, sans-serif`;
        ctx.fillText(String(nums.get(panel.id) || ''), x + bs * 0.6, y + bs * 0.53);
        ctx.restore();
      }
    }

    if (!editing) return;

    const hover = panelById(page, hoverId);
    if (hover && hover.id !== selectedPanelId) {
      ctx.save();
      polyPath(ctx, hover.poly);
      ctx.fillStyle = 'rgba(91,107,240,0.10)';
      ctx.fill();
      ctx.restore();
    }
    if (sel) {
      ctx.save();
      polyPath(ctx, sel.poly);
      ctx.setLineDash([page.w * 0.013, page.w * 0.009]);
      ctx.strokeStyle = '#5b6bf0';
      ctx.lineWidth = page.w * 0.0024;
      ctx.stroke();
      ctx.restore();
    }
    if (pv && pv.chords && pv.chords.length) {
      ctx.save();
      ctx.setLineDash([page.w * 0.011, page.w * 0.01]);
      ctx.lineWidth = Math.max(page.w * 0.0018, 1);
      ctx.strokeStyle = 'rgba(91,107,240,0.7)';
      for (const seg of pv.chords) {
        ctx.beginPath();
        ctx.moveTo(seg[0][0], seg[0][1]);
        ctx.lineTo(seg[1][0], seg[1][1]);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (pv && pv.a && pv.b) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(page.w * 0.003, 2);
      ctx.strokeStyle = '#5b6bf0';
      ctx.beginPath();
      ctx.moveTo(pv.a[0], pv.a[1]);
      ctx.lineTo(pv.b[0], pv.b[1]);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------- 画布 ---------- */
  function paintEditor() {
    const canvas = $('#nameCanvas');
    const wrap = $('#nameStageWrap');
    const page = activePage();
    if (!canvas || !wrap || !page) return;
    const avW = wrap.clientWidth - 30, avH = wrap.clientHeight - 30;
    if (avW < 60 || avH < 60) return;
    const tall = page.h / page.w > 1.85;
    let cssScale = tall
      ? Math.min(avW / page.w, 1.1)
      : Math.min((avW / page.w), (avH / page.h), 1.6);
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
    paintPage(ctx, page, pxW / page.w, {
      editing: true,
      numbers: true,
      selectedPanelId: st().selectedPanelId && panelById(page, st().selectedPanelId) ? st().selectedPanelId : null,
      hoverId: hoverPanelId,
      preview,
    });
  }

  function schedulePaint() {
    if (paintRaf) return;
    paintRaf = requestAnimationFrame(() => { paintRaf = 0; paintEditor(); });
  }

  function paintMini() {
    const canvas = $('#nameMini');
    const page = activePage();
    if (!canvas || !page) return;
    const host = canvas.parentElement;
    const availW = Math.max(120, (host?.clientWidth || 220) - 2);
    let w = Math.min(availW, 320);
    let hgt = w * (page.h / page.w);
    const maxH = 340;
    if (hgt > maxH) { hgt = maxH; w = hgt * (page.w / page.h); }
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const pxW = Math.max(1, Math.round(w * dpr)), pxH = Math.max(1, Math.round(hgt * dpr));
    if (canvas.width !== pxW || canvas.height !== pxH) { canvas.width = pxW; canvas.height = pxH; }
    canvas.style.width = Math.round(w) + 'px';
    canvas.style.height = Math.round(hgt) + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pxW, pxH);
    paintPage(ctx, page, pxW / page.w, { editing: false, numbers: true, hoverId: miniHoverId });
    const label = $('#nameMiniLabel');
    if (label) label.textContent = T('name.pageOf', { n: activeIndex() + 1, m: st().pages.length });
  }

  function paintPageThumb(canvas, page, w = 86) {
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const pxW = Math.round(w * dpr);
    const pxH = Math.round(w * (page.h / page.w) * dpr);
    canvas.width = pxW; canvas.height = pxH;
    canvas.style.width = w + 'px'; canvas.style.height = Math.round(w * (page.h / page.w)) + 'px';
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, pxW, pxH);
    paintPage(ctx, page, pxW / page.w, { editing: false, numbers: true });
  }

  /* ---------- 命中测试 ---------- */
  function hitPanel(page, pt) {
    for (let i = page.panels.length - 1; i >= 0; i--) {
      if (pointInPolygon(pt, page.panels[i].poly)) return page.panels[i];
    }
    return null;
  }

  function hitCrease(page, pt, tol) {
    let best = null, bestD = tol;
    for (const line of page.lines) {
      const chords = pageCreases(page).get(line.id) || [];
      for (const seg of chords) {
        const d = distanceToSegment(pt, seg[0], seg[1]);
        if (d < bestD) { bestD = d; best = line; }
      }
    }
    return best;
  }

  // 这条线能否真正切开至少一个分格（用于过滤无效手势）
  function canSplit(page, a, b) {
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (segLen < EPS) return false;
    const ux = (b[0] - a[0]) / segLen, uy = (b[1] - a[1]) / segLen;
    for (const panel of page.panels) {
      const ch = lineChord(panel.poly, a, b);
      if (!ch) continue;
      const p0 = (ch.a[0] - a[0]) * ux + (ch.a[1] - a[1]) * uy;
      const p1 = (ch.b[0] - a[0]) * ux + (ch.b[1] - a[1]) * uy;
      const overlap = Math.min(segLen, Math.max(p0, p1)) - Math.max(0, Math.min(p0, p1));
      if (overlap <= 1.2) continue;
      if (splitPolygon(panel.poly, a, b)) return true;
    }
    return false;
  }

  function creasesFor(page, a, b) {
    const out = [];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (segLen < EPS) return out;
    const ux = (b[0] - a[0]) / segLen, uy = (b[1] - a[1]) / segLen;
    for (const panel of page.panels) {
      const ch = lineChord(panel.poly, a, b);
      if (!ch) continue;
      const p0 = (ch.a[0] - a[0]) * ux + (ch.a[1] - a[1]) * uy;
      const p1 = (ch.b[0] - a[0]) * ux + (ch.b[1] - a[1]) * uy;
      const overlap = Math.min(segLen, Math.max(p0, p1)) - Math.max(0, Math.min(p0, p1));
      if (overlap > 1.2) out.push([ch.a, ch.b]);
    }
    return out;
  }

  /* ---------- 交互 ---------- */
  function pointerPage(canvas, e) {
    const page = activePage();
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * (page.w / r.width), (e.clientY - r.top) * (page.h / r.height)];
  }

  function snapSegment(a, b, disable) {
    if (disable) return [a, b];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const devH = Math.min(Math.abs(ang), Math.abs(180 - Math.abs(ang)));
    const devV = Math.abs(90 - Math.abs(ang));
    if (devH <= 7) return [a, [b[0], a[1]]];
    if (devV <= 7) return [a, [a[0], b[1]]];
    return [a, b];
  }

  function selectPanel(id) {
    if (st().selectedPanelId === id) return;
    st().selectedPanelId = id;
    renderInspector();
    schedulePaint();
  }

  function assignFrame(panel, frameId) {
    commit(() => {
      panel.frame = {
        frameId,
        zoom: 1, ox: 0, oy: 0,
        mask: panel.frame?.mask || 'gray',
      };
      st().selectFrameId = null;
      st().selectedPanelId = panel.id;
    });
    afterEdit();
    toast(T('toast.framePlaced'));
  }

  function removeFrame(panel) {
    if (!panel.frame) return;
    const id = panel.frame.frameId;
    commit(() => { panel.frame = null; });
    afterEdit();
    toast(T('toast.frameRemoved', { name: frameById(id)?.name || '' }));
  }

  function onPointerDown(e) {
    const canvas = e.currentTarget;
    const page = activePage();
    if (!page || e.button !== 0) return;
    const p = pointerPage(canvas, e);
    const tool = st().tool;
    const hit = hitPanel(page, p);
    hoverPanelId = hit ? hit.id : null;

    if (tool === 'line') {
      drag = { type: 'line', a: p, b: p, pointerId: e.pointerId, moved: false, shift: e.shiftKey };
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      schedulePaint();
      return;
    }
    if (tool === 'erase') {
      const r = canvas.getBoundingClientRect();
      const tol = (10 * page.w) / r.width;
      const line = hitCrease(page, p, tol);
      if (line) {
        commit(() => {
          page.lines = page.lines.filter((l) => l.id !== line.id);
          rebuildPanels(page);
        });
        afterEdit();
        toast(T('toast.creaseRemoved'));
      }
      return;
    }
    // select
    if (st().selectFrameId && hit) { assignFrame(hit, st().selectFrameId); return; }
    selectPanel(hit ? hit.id : null);
    if (hit && hit.frame) {
      const img = frameImage(hit.frame.frameId, 'lo');
      if (img) {
        beginOp();
        drag = {
          type: 'pan', panel: hit, img, p0: p, ox0: hit.frame.ox || 0, oy0: hit.frame.oy || 0,
          pointerId: e.pointerId, moved: false,
        };
        try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }
    }
  }

  function onPointerMove(e) {
    const canvas = e.currentTarget;
    const page = activePage();
    if (!page) return;
    const p = pointerPage(canvas, e);
    if (!drag) {
      const hit = hitPanel(page, p);
      const id = hit ? hit.id : null;
      if (id !== hoverPanelId) { hoverPanelId = id; schedulePaint(); }
      return;
    }
    if (drag.type === 'line') {
      if (Math.hypot(p[0] - drag.a[0], p[1] - drag.a[1]) > 2) drag.moved = true;
      const seg = snapSegment(drag.a, p, e.shiftKey);
      drag.b = seg[1];
      const clipped = clipSegmentToInner(page, seg[0], seg[1]);
      preview = { a: clipped ? clipped[0] : seg[0], b: clipped ? clipped[1] : seg[1], chords: creasesFor(page, seg[0], seg[1]) };
      schedulePaint();
      return;
    }
    if (drag.type === 'pan') {
      drag.moved = true;
      const f = drag.panel.frame;
      f.ox = drag.ox0 + (p[0] - drag.p0[0]);
      f.oy = drag.oy0 + (p[1] - drag.p0[1]);
      clampOffsets(page, drag.panel, drag.img);
      schedulePaint();
    }
  }

  function onPointerUp(e) {
    const canvas = e.currentTarget;
    const page = activePage();
    if (!drag || !page) return;
    const d = drag;
    drag = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (d.type === 'line') {
      const seg = preview ? [preview.a, preview.b] : [d.a, d.b];
      preview = null;
      const r = canvas.getBoundingClientRect();
      const minLen = (12 * page.w) / r.width;
      const len = Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]);
      const clipped = len >= minLen ? clipSegmentToInner(page, seg[0], seg[1]) : null;
      if (!clipped || !d.moved) {
        // 没拖动（单击）：当作选择 / 放入画面
        const hit = hitPanel(page, seg[0]);
        if (st().selectFrameId && hit) assignFrame(hit, st().selectFrameId);
        else selectPanel(hit ? hit.id : null);
        schedulePaint();
        return;
      }
      if (clipped && canSplit(page, clipped[0], clipped[1])) {
        commit(() => {
          page.lines.push({ id: uid('ln'), a: clipped[0], b: clipped[1] });
          rebuildPanels(page);
        });
        afterEdit();
        toast(T('toast.panelSplit', { n: page.panels.length }));
      } else if (clipped) {
        toast(T('toast.splitTooSmall'));
      }
      schedulePaint();
      return;
    }
    if (d.type === 'pan') {
      if (d.moved) { clampOffsets(page, d.panel, d.img); endOp(); }
      else endOp(); // 无位移 → endOp 内部会判定无变化
      schedulePaint();
    }
  }

  function onDoubleClick(e) {
    const canvas = e.currentTarget;
    const page = activePage();
    if (!page) return;
    const p = pointerPage(canvas, e);
    const panel = hitPanel(page, p);
    if (!panel || !panel.frame) return;
    commit(() => { panel.frame.zoom = 1; panel.frame.ox = 0; panel.frame.oy = 0; });
    afterEdit();
    toast(T('toast.frameFitReset'));
  }

  function onWheel(e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const canvas = e.currentTarget;
    const page = activePage();
    if (!page) return;
    const panel = hitPanel(page, pointerPage(canvas, e));
    if (!panel || !panel.frame) return;
    e.preventDefault();
    const img = frameImage(panel.frame.frameId, 'lo');
    if (!img) return;
    const next = clamp((panel.frame.zoom || 1) * (e.deltaY < 0 ? 1.08 : 1 / 1.08), 0.3, 4);
    panel.frame.zoom = next;
    clampOffsets(page, panel, img);
    selectPanel2(panel.id, false);
    syncInspectorOnly();
    schedulePaint();
    scheduleWheelCommit();
  }

  let wheelTimer = null;
  function scheduleWheelCommit() {
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { commit(() => {}); afterEdit(); }, 420);
  }

  function selectPanel2(id) {
    if (st().selectedPanelId !== id) { st().selectedPanelId = id; renderInspector(); }
  }

  /* ---------- 拖放 ---------- */
  function frameIdFromEvent(e) {
    const dt = e.dataTransfer;
    if (!dt) return null;
    let v = '';
    try { v = dt.getData('application/x-manga-frame') || dt.getData('text/plain') || ''; } catch { v = ''; }
    if (v.startsWith('frame:')) return v.slice(6);
    if (v && frameById(v)) return v;
    return null;
  }

  // dragover 阶段浏览器不允许读取 dataTransfer 的数据，只能看 types
  function isFrameDrag(e) {
    const dt = e.dataTransfer;
    if (!dt) return false;
    const types = Array.from(dt.types || []);
    return types.includes('application/x-manga-frame') || types.includes('text/plain');
  }

  function bindDrop(target, onPanel, rectEl = target) {
    target.addEventListener('dragover', (e) => {
      if (!isFrameDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      const page = activePage();
      const r = rectEl.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      const panel = inside ? hitPanel(page, pointerPage(rectEl, e)) : null;
      onPanel.hover(panel ? panel.id : null);
    });
    target.addEventListener('dragleave', (e) => {
      if (target.contains(e.relatedTarget)) return;
      onPanel.hover(null);
    });
    target.addEventListener('drop', (e) => {
      const id = frameIdFromEvent(e);
      if (!id) return;
      e.preventDefault();
      const page = activePage();
      const panel = hitPanel(page, pointerPage(rectEl, e));
      onPanel.hover(null);
      if (panel) assignFrame(panel, id);
    });
  }

  /* ---------- 编辑后的同步 ---------- */
  const changeCbs = new Set();
  function afterEdit() {
    if (redraw3DFrames) redraw3DFrames();
    syncAll();
    for (const cb of changeCbs) { try { cb(); } catch (err) { console.warn('name: change listener failed', err); } }
  }

  /* ---------- 使用情况 ---------- */
  function usageMap(filterFrameId = null) {
    const map = new Map();
    st().pages.forEach((page, pi) => {
      const order = readingOrder(page);
      const numOf = new Map(order.map((p, i) => [p.id, i + 1]));
      for (const panel of page.panels) {
        const f = panel.frame;
        if (!f || !f.frameId) continue;
        if (filterFrameId && f.frameId !== filterFrameId) continue;
        const list = map.get(f.frameId) || [];
        list.push({ page: pi + 1, n: numOf.get(panel.id) || 1 });
        map.set(f.frameId, list);
      }
    });
    return map;
  }

  function locateFrame(frameId) {
    const list = usageMap(frameId).get(frameId) || [];
    if (!list.length) return null;
    return list.map((u) => T('name.badge', { p: u.page, n: u.n })).join(' / ');
  }

  /* ---------- 渲染：左侧页面列表 ---------- */
  function renderPageList() {
    const host = $('#namePageList');
    if (!host) return;
    host.replaceChildren();
    st().pages.forEach((page, i) => {
      const isActive = page.id === st().activePageId;
      const canvas = h('canvas', { class: 'page-thumb' });
      const item = h('div', {
        class: 'page-item' + (isActive ? ' active' : ''),
        onclick: (e) => { if (e.target.closest('.page-item-btn')) return; setActivePage(page.id); },
      },
        canvas,
        h('div', { class: 'page-item-meta' },
          h('div', { class: 'page-item-name', text: page.name || T('name.pageN', { n: i + 1 }) }),
          h('div', { class: 'page-item-sub', text: T('name.pageMeta', { p: page.panels.length }) }),
        ),
        h('div', { class: 'page-item-btns' },
          h('button', { class: 'page-item-btn', title: T('name.moveUp'), disabled: i === 0, onclick: () => movePage(i, -1) }, '↑'),
          h('button', { class: 'page-item-btn', title: T('name.moveDown'), disabled: i === st().pages.length - 1, onclick: () => movePage(i, 1) }, '↓'),
          h('button', { class: 'page-item-btn', title: T('name.duplicatePage'), onclick: () => duplicatePage(page.id) }, '⧉'),
          h('button', { class: 'page-item-btn danger', title: T('name.deletePage'), disabled: st().pages.length <= 1, onclick: () => deletePage(page.id) }, '✕'),
        ),
      );
      host.append(item);
      paintPageThumb(canvas, page, 62);
    });
  }

  /* ---------- 渲染：画面素材 ---------- */
  function frameThumb(frame, w = 76) {
    const img = frameImage(frame.id, 'lo');
    const asp = frame.aspect || [16, 9];
    const hh = Math.max(1, Math.round((w * asp[1]) / asp[0]));
    const canvas = h('canvas', { class: 'pal-thumb' });
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = hh + 'px';
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (img) {
      const s = Math.max(canvas.width / img.width, canvas.height / img.height);
      const dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    }
    return canvas;
  }

  function renderPalette() {
    const host = $('#namePalette');
    if (!host) return;
    host.replaceChildren();
    setText('#nameFrameCount', state.frames.length ? String(state.frames.length) : '');
    if (!state.frames.length) {
      host.append(h('div', { class: 'muted', text: T('name.framesEmpty') }));
      return;
    }
    const used = usageMap();
    for (const frame of state.frames) {
      const uses = used.get(frame.id) || [];
      const card = h('div', {
        class: 'pal-card' + (st().selectFrameId === frame.id ? ' picking' : '') + (uses.length ? ' used' : ''),
        draggable: 'true',
        title: T('name.framesHint'),
        onclick: (e) => {
          if (e.target.closest('.pal-add')) return;
          st().selectFrameId = st().selectFrameId === frame.id ? null : frame.id;
          syncAll();
        },
      },
        frameThumb(frame, 76),
        h('div', { class: 'pal-meta' },
          h('div', { class: 'pal-name', text: frame.name }),
          h('div', { class: 'pal-sub', text: `${frame.aspect[0]}:${frame.aspect[1]} · ${frame.lens}mm` }),
          uses.length
            ? h('div', { class: 'pal-used', text: uses.map((u) => T('name.badge', { p: u.page, n: u.n })).join(' / ') })
            : h('div', { class: 'pal-free', text: T('name.notPlaced') }),
        ),
        h('button', {
          class: 'pal-add', title: T('name.fillFirstEmpty'),
          onclick: (e) => { e.stopPropagation(); fillFirstEmpty(frame.id); },
        }, '＋'),
      );
      card.addEventListener('dragstart', (e) => {
        st().selectFrameId = frame.id;
        e.dataTransfer.setData('application/x-manga-frame', 'frame:' + frame.id);
        e.dataTransfer.setData('text/plain', 'frame:' + frame.id);
        e.dataTransfer.effectAllowed = 'copy';
      });
      host.append(card);
    }
  }

  /* ---------- 渲染：右侧属性 ---------- */
  function renderInspector() {
    const host = $('#nameInspector');
    if (!host) return;
    host.replaceChildren();
    const page = activePage();
    if (!page) return;
    const panel = panelById(page, st().selectedPanelId);
    if (!panel) {
      host.append(h('div', { class: 'insp-empty', text: T('name.panelNone') }));
      return;
    }
    const order = readingOrder(page);
    const num = order.findIndex((p) => p.id === panel.id) + 1;
    host.append(h('div', { class: 'name-panel-no', text: T('name.panelNo', { n: num, p: activeIndex() + 1 }) }));

    const frame = panel.frame ? frameById(panel.frame.frameId) : null;
    if (!frame) {
      host.append(
        h('div', { class: 'insp-empty', text: T('name.noFrame') }),
        h('div', { class: 'row', style: 'margin-top:8px' },
          h('button', { class: 'btn block', onclick: () => { st().selectFrameId = state.frames[0]?.id || null; syncAll(); }, text: T('name.pickFrame') }),
        ),
      );
      return;
    }

    const thumb = frameThumb(frame, 150);
    host.append(
      h('div', { class: 'name-assigned' }, thumb,
        h('div', { class: 'name-assigned-meta' },
          h('div', { class: 'pal-name', text: frame.name }),
          h('div', { class: 'pal-sub', text: `${frame.aspect[0]}:${frame.aspect[1]} · ${frame.lens}mm` }),
        )),
    );
    const zoom = panel.frame.zoom ?? 1;
    const zoomIn = h('input', { type: 'range', min: '30', max: '400', step: '1', value: String(Math.round(zoom * 100)) });
    const zoomOut = h('output', { text: Math.round(zoom * 100) + '%' });
    let zoomOp = false;
    zoomIn.addEventListener('input', () => {
      if (!zoomOp) { beginOp(); zoomOp = true; }
      panel.frame.zoom = clamp(Number(zoomIn.value) / 100, 0.3, 4);
      zoomOut.value = Math.round(panel.frame.zoom * 100) + '%';
      const img = frameImage(panel.frame.frameId, 'lo');
      clampOffsets(page, panel, img);
      schedulePaint();
    });
    zoomIn.addEventListener('change', () => {
      if (zoomOp) { zoomOp = false; endOp(); }
      afterEdit();
    });

    host.append(
      h('label', { class: 'slider-row wide' }, h('span', { text: T('name.zoom') }), zoomIn, zoomOut),
      h('p', { class: 'note', text: T('name.dragHint') }),
      h('div', { class: 'field-label', text: T('name.mask') }),
      h('div', { class: 'row chips' }, ...['gray', 'dim', 'hide'].map((m) => h('button', {
        class: 'chip' + ((panel.frame.mask || 'gray') === m ? ' active' : ''),
        text: T('name.mask.' + m),
        onclick: () => { commit(() => { panel.frame.mask = m; }); afterEdit(); },
      }))),
      h('div', { class: 'row', style: 'margin-top:10px' },
        h('button', { class: 'btn block', onclick: () => {
          commit(() => { panel.frame.zoom = 1; panel.frame.ox = 0; panel.frame.oy = 0; });
          afterEdit();
        }, text: T('name.resetFit') }),
        h('button', { class: 'btn block danger', onclick: () => removeFrame(panel), text: T('name.removeFrame') }),
      ),
    );
  }

  function syncInspectorOnly() {
    // 只更新缩放滑杆显示，避免拖动时重建整个面板
    const host = $('#nameInspector');
    if (!host) return;
    const range = host.querySelector('input[type=range]');
    const out = host.querySelector('output');
    const page = activePage();
    const panel = page ? panelById(page, st().selectedPanelId) : null;
    if (range && panel && panel.frame) {
      range.value = String(Math.round((panel.frame.zoom ?? 1) * 100));
      if (out) out.value = Math.round((panel.frame.zoom ?? 1) * 100) + '%';
    }
  }

  /* ---------- 渲染：工具条 / 提示 ---------- */
  function renderToolbar() {
    const s = st();
    const n = s.pages.length, idx = activeIndex();
    setText('#namePageInfo', T('name.pageOf', { n: idx + 1, m: n }));
    const prev = $('#namePrev'), next = $('#nameNext');
    if (prev) prev.disabled = idx <= 0;
    if (next) next.disabled = idx >= n - 1;
    const del = $('#nameDelPage');
    if (del) del.disabled = n <= 1;
    const tools = $('#nameTools');
    if (tools) {
      tools.replaceChildren(...[
        ['line', T('name.toolLine'), '✎'],
        ['select', T('name.toolSelect'), '✥'],
        ['erase', T('name.toolErase'), '⌫'],
      ].map(([id, label, icon]) => h('button', {
        class: 'chip' + (s.tool === id ? ' active' : ''),
        onclick: () => setTool(id),
      }, h('span', { class: 'chip-ico', text: icon }), label)));
    }
    const hud = $('#nameHud');
    if (hud) {
      const key = s.tool === 'line' ? 'name.toolHintLine' : s.tool === 'select' ? 'name.toolHintSelect' : 'name.toolHintErase';
      hud.textContent = T(key);
    }
    const sel = $('#nameExportWidth');
    if (sel) {
      const opts = [1200, 1600, 2048, 2560];
      if (sel.options.length !== opts.length) {
        sel.replaceChildren(...opts.map((v) => h('option', { value: String(v), text: `${v} px` })));
      }
      sel.value = String(s.exportWidth);
    }
    const nameInput = $('#namePageName');
    if (nameInput) {
      const page = activePage();
      if (document.activeElement !== nameInput) nameInput.value = page ? page.name : '';
    }
    const sizeSel = $('#namePageSize');
    if (sizeSel) {
      const ids = Object.keys(PAGE_SIZES);
      if (sizeSel.options.length !== ids.length) {
        sizeSel.replaceChildren(...ids.map((id) => h('option', { value: id, text: T('name.size.' + id) })));
      }
      const page = activePage();
      if (page) sizeSel.value = page.sizeId;
    }
    const page = activePage();
    const setRange = (sel2, out, value, fmtFn) => {
      const el = $(sel2), o = $(out);
      if (el && document.activeElement !== el) el.value = String(value);
      if (o) o.value = fmtFn(value);
    };
    if (page) {
      setRange('#nameMargin', '#nameMarginOut', page.margin, (v) => String(Math.round(v)));
      setRange('#nameGap', '#nameGapOut', page.gap, (v) => String(Math.round(v)));
      setRange('#nameLineW', '#nameLineWOut', page.line, (v) => String(Math.round(v)));
    }
    const empty = $('#nameEmptyHint');
    if (empty) {
      const emptyCount = activePage() ? activePage().panels.filter((p) => !p.frame).length : 0;
      empty.textContent = emptyCount ? T('name.emptyPanels', { n: emptyCount }) : '';
      empty.style.display = emptyCount ? '' : 'none';
    }
  }

  /* ---------- 页面操作 ---------- */
  function setActivePage(id) {
    if (st().activePageId === id) return;
    st().activePageId = id;
    st().selectedPanelId = null;
    syncAll();
  }
  function gotoPage(delta) {
    const idx = clamp(activeIndex() + delta, 0, st().pages.length - 1);
    const page = st().pages[idx];
    if (page) setActivePage(page.id);
  }
  function addPage(copyOf = null) {
    if (st().pages.length >= 40) { toast(T('toast.pageLimit')); return; }
    const s = st();
    s.pageSeq = (s.pageSeq || 1);
    const page = copyOf ? clonePage(copyOf) : makePage(activePage()?.sizeId || 'b5');
    page.name = copyOf ? T('name.copyName', { name: copyOf.name || T('name.pageN', { n: activeIndex() + 1 }) }) : '';
    commit(() => {
      const idx = activeIndex();
      s.pages.splice(copyOf ? idx + 1 : s.pages.length, 0, page);
      s.activePageId = page.id;
      s.selectedPanelId = null;
      s.pageSeq += 1;
    });
    afterEdit();
    toast(copyOf ? T('toast.pageDuplicated') : T('toast.pageAdded'));
  }
  function clonePage(src) {
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uid('pg');
    copy.name = '';
    copy.panels = (copy.panels || []).map((p) => ({ ...p, id: uid('pn') }));
    copy.lines = (copy.lines || []).map((l) => ({ ...l, id: uid('ln') }));
    copy.bubbles = cloneBubbles(copy.bubbles, copy).map((b) => ({ ...b, id: uid('bb') }));
    rebuildPanels(copy);
    return copy;
  }
  function duplicatePage(id) {
    const page = st().pages.find((p) => p.id === id);
    if (page) addPage(page);
  }
  function deletePage(id) {
    const s = st();
    if (s.pages.length <= 1) return;
    commit(() => {
      const idx = s.pages.findIndex((p) => p.id === id);
      s.pages = s.pages.filter((p) => p.id !== id);
      if (s.activePageId === id) s.activePageId = s.pages[Math.max(0, idx - 1)].id;
      s.selectedPanelId = null;
    });
    afterEdit();
    toast(T('toast.pageDeleted'));
  }
  function movePage(i, dir) {
    const s = st();
    const j = i + dir;
    if (j < 0 || j >= s.pages.length) return;
    commit(() => {
      const [p] = s.pages.splice(i, 1);
      s.pages.splice(j, 0, p);
    });
    afterEdit();
  }
  function resetPage() {
    const page = activePage();
    if (!page) return;
    commit(() => {
      page.lines = [];
      page.panels = [];
      rebuildPanels(page);
      st().selectedPanelId = null;
    });
    afterEdit();
    toast(T('toast.pageReset'));
  }

  /* ---------- 自动填入 ---------- */
  function fillEmptyInPage(page, frameIds) {
    const order = readingOrder(page);
    let used = 0;
    for (const panel of order) {
      if (panel.frame) continue;
      const next = frameIds.shift();
      if (!next) break;
      panel.frame = { frameId: next, zoom: 1, ox: 0, oy: 0, mask: 'gray' };
      used += 1;
    }
    return used;
  }

  function autoFill(scope) {
    const pages = scope === 'all' ? st().pages : [activePage()].filter(Boolean);
    const taken = new Set();
    for (const page of pages) for (const panel of page.panels) if (panel.frame) taken.add(panel.frame.frameId);
    const queue = state.frames.filter((f) => !taken.has(f.id)).map((f) => f.id);
    if (!queue.length) { toast(T('toast.autoFillNone')); return; }
    let n = 0;
    commit(() => {
      for (const page of pages) n += fillEmptyInPage(page, queue);
    });
    if (n) { afterEdit(); toast(T('toast.autoFilled', { n })); }
    else toast(T('toast.autoFillNone'));
  }

  function fillFirstEmpty(frameId) {
    const page = activePage();
    if (!page) return;
    const panel = readingOrder(page).find((p) => !p.frame);
    if (!panel) { toast(T('toast.noEmptyPanel')); return; }
    assignFrame(panel, frameId);
  }

  /* ---------- 导出 ---------- */
  function pageFileName(page, index, W, H, prefix = 'name') {
    const raw = (page.name || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 24);
    const base = `${prefix}_p${String(index + 1).padStart(2, '0')}${raw ? '_' + raw : ''}`;
    return `${base}_${W}x${H}.png`;
  }

  function renderPageToCanvas(page, W) {
    const H = Math.max(1, Math.round((W * page.h) / page.w));
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    paintPage(ctx, page, W / page.w, { editing: false, numbers: false, hi: true });
    return canvas;
  }

  async function exportPages(pages, opts = {}) {
    const W = clamp(Number(opts.width) || st().exportWidth || 1600, 800, 4096);
    const prefix = opts.prefix || 'name';
    try {
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const canvas = renderPageToCanvas(page, W);
        const H = canvas.height;
        const idx = st().pages.findIndex((p) => p.id === page.id);
        await downloadCanvas(canvas, pageFileName(page, idx < 0 ? i : idx, W, H, prefix));
        await new Promise((r) => setTimeout(r, 320));
      }
      imgHi.clear();
      toast(T(opts.toastKey || 'toast.nameExported', { n: pages.length }));
    } catch (err) {
      console.error(err);
      imgHi.clear();
      toast(T(opts.failKey || 'toast.nameExportFailed'));
    }
  }

  /* ---------- 工具 / 同步 ---------- */
  function setTool(id) {
    if (!NAME_TOOLS.includes(id)) return;
    st().tool = id;
    if (id !== 'line') preview = null;
    renderToolbar();
    schedulePaint();
  }

  function renderPageSettings() {
    renderToolbar();
  }

  function syncAll() {
    if (!state.name) state.name = defaultNameState();
    checkScene();
    renderToolbar();
    renderPageList();
    renderPalette();
    renderInspector();
    paintMini();
    schedulePaint();
    const hint = $('#namePageCount');
    if (hint) hint.textContent = String(st().pages.length);
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    if (bound) return;
    bound = true;
    const canvas = $('#nameCanvas');
    if (canvas) {
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
      canvas.addEventListener('pointerleave', () => { if (!drag) { hoverPanelId = null; schedulePaint(); } });
      canvas.addEventListener('dblclick', onDoubleClick);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      bindDrop(canvas, { hover: (id) => { if (id !== hoverPanelId) { hoverPanelId = id; schedulePaint(); } } });
    }
    const mini = $('#nameMini');
    if (mini) {
      mini.addEventListener('contextmenu', (e) => e.preventDefault());
      const miniWrap = $('#nameMiniWrap');
      bindDrop(miniWrap || mini, { hover: (id) => { if (id !== miniHoverId) { miniHoverId = id; paintMini(); } } }, mini);
      mini.addEventListener('click', () => { /* 3D 面板里点缩略页只做提示 */ });
    }
    const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };

    on('#nameAddPage', 'click', () => addPage(null));
    on('#nameAddPageTop', 'click', () => addPage(null));
    on('#nameDupPage', 'click', () => activePage() && duplicatePage(activePage().id));
    on('#nameDelPage', 'click', () => activePage() && deletePage(activePage().id));
    on('#namePrev', 'click', () => gotoPage(-1));
    on('#nameNext', 'click', () => gotoPage(1));
    on('#nameMiniPrev', 'click', () => gotoPage(-1));
    on('#nameMiniNext', 'click', () => gotoPage(1));
    on('#nameMiniAdd', 'click', () => addPage(null));
    on('#nameResetPage', 'click', resetPage);
    on('#nameAutoFill', 'click', () => autoFill('page'));
    on('#nameAutoFillAll', 'click', () => autoFill('all'));
    on('#nameExportAll', 'click', () => exportPages(st().pages.slice()));
    on('#nameExportOne', 'click', () => { const p = activePage(); if (p) exportPages([p]); });

    on('#namePageSize', 'change', (e) => {
      const page = activePage();
      if (!page) return;
      const id = e.target.value;
      if (PAGE_SIZES[id]) {
        commit(() => {
          page.sizeId = id;
          page.w = PAGE_SIZES[id].w;
          page.h = PAGE_SIZES[id].h;
          rebuildPanels(page);
        });
        afterEdit();
      }
    });
    const rangeBind = (sel, key, min, max) => {
      const el = $(sel);
      if (!el) return;
      let op = false;
      el.addEventListener('input', () => {
        const page = activePage();
        if (!page) return;
        if (!op) { beginOp(); op = true; }
        page[key] = clamp(Number(el.value), min, max);
        rebuildPanels(page);
        renderToolbar();
        schedulePaint();
      });
      el.addEventListener('change', () => {
        if (op) { op = false; endOp(); }
        afterEdit();
      });
    };
    rangeBind('#nameMargin', 'margin', 0, 220);
    rangeBind('#nameGap', 'gap', 0, 60);
    rangeBind('#nameLineW', 'line', 0, 22);

    let nameOp = false;
    on('#namePageName', 'input', (e) => {
      const page = activePage();
      if (!page) return;
      if (!nameOp) { beginOp(); nameOp = true; }
      page.name = e.target.value;
      renderPageList();
    });
    on('#namePageName', 'change', () => {
      if (nameOp) { nameOp = false; endOp(); }
      afterEdit();
    });

    on('#nameExportWidth', 'change', (e) => {
      commit(() => { st().exportWidth = clamp(Number(e.target.value) || 1600, 800, 4096); });
      afterEdit();
    });

    on('#nameOpenFrom3d', 'click', () => { if (deps.openNameMode) deps.openNameMode(); });
    on('#nameMiniOpen', 'click', () => { if (deps.openNameMode) deps.openNameMode(); });

    const ro = new ResizeObserver(() => { paintMini(); schedulePaint(); });
    const wrap = $('#nameStageWrap');
    if (wrap) ro.observe(wrap);
    const miniWrap = $('#nameMiniWrap');
    if (miniWrap) ro.observe(miniWrap);
    window.addEventListener('resize', () => { paintMini(); schedulePaint(); });
  }

  /* ---------- 对外 API ---------- */
  function setMode(mode) {
    if (mode === 'name') {
      // 进入分格模式：同步一次页面 / 画面
      syncAll();
      requestAnimationFrame(() => { schedulePaint(); paintMini(); });
    }
  }

  if (state.name) {
    for (const page of state.name.pages) rebuildPanels(page);
  }
  bind();

  return {
    syncAll,
    setMode,
    invalidate,
    locateFrame,
    setTool,
    paintPage: (ctx, page, scale, opts) => paintPage(ctx, page, scale, opts),
    onChange: (cb) => { changeCbs.add(cb); return () => changeCbs.delete(cb); },
    setActivePage,
    duplicatePage,
    deletePage,
    movePage,
    rebuild: () => { for (const page of st().pages) rebuildPanels(page); },
    onFrameDeleted: (frameId) => {
      let touched = false;
      for (const page of st().pages) {
        for (const panel of page.panels) {
          if (panel.frame && panel.frame.frameId === frameId) { panel.frame = null; touched = true; }
        }
      }
      if (touched) afterEdit();
    },
    onFrameUpdated: (frameId) => { imgLo.delete(frameId); imgHi.delete(frameId); syncAll(); },
    addPage,
    pages: () => st().pages,
    activePage,
    autoFill,
    exportPages,
    gotoPage,
  };
}
