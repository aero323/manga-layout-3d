import { jiangxiExteriorStage, jiangxiInteriorStage } from './scenes/jiangxi.js';
import { iwasakiExteriorStage } from './scenes/iwasakiExterior.js';
import { iwasakiInteriorStage } from './scenes/iwasakiInterior.js';
import { iwasakiJapaneseStage } from './scenes/iwasakiJapanese.js';
import { lushanStage } from './scenes/lushan.js';
// 舞台预设 / 舞台プリセット：室外・室内・人物のみ
let seq = 0;
export const uid = (p = 'o') => p + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 都以「底面中心」为原点，y 是底面的高度
// 场景文件里的 rx/ry/rz 一律写弧度；最终 spec 存的是「度」（与检查器 / 变换工具一致）
const toDeg = (r) => (r || 0) * 180 / Math.PI;

function prim(type, x, z, sx, sy, sz, color, o = {}) {
  return {
    id: uid('s'), type, layer: 'stage', color,
    position: [x, o.y || 0, z],
    rotation: [toDeg(o.rx), toDeg(o.ry), toDeg(o.rz)],
    scale: [sx, sy, sz],
    ...(o.occlude !== undefined ? { occlude: o.occlude } : {}),
  };
}
const box = (x, z, w, h, d, color, o = {}) => prim('cube', x, z, w / 0.5, h / 0.5, d / 0.5, color, o);
const cyl = (x, z, r, h, color, o = {}) => prim('cylinder', x, z, r / 0.15, h / 0.6, r / 0.15, color, o);
const cone = (x, z, r, h, color, o = {}) => prim('cone', x, z, r / 0.2, h / 0.5, r / 0.2, color, o);
const sph = (x, z, r, color, o = {}) => prim('sphere', x, z, r / 0.25, r / 0.25, r / 0.25, color, o);
const prism = (x, z, w, h, d, color, o = {}) => prim('prism', x, z, w / 0.5, h / 0.5, d / 0.5, color, o);
const slope = (x, z, w, h, d, color, o = {}) => prim('slope', x, z, w / 0.5, h / 0.5, d / 0.5, color, o);
const col = (x, z, s = 1, o = {}) => ({
  id: uid('c'), type: 'column', layer: 'stage', color: C.marble,
  position: [x, o.y || 0, z], rotation: [0, toDeg(o.ry), 0], scale: [s, s, s],
});
const item = (type, x, z, ry = 0, color) => ({
  id: uid('f'), type, layer: 'stage', position: [x, 0, z], rotation: [0, toDeg(ry), 0], scale: [1, 1, 1],
  ...(color ? { color } : {}),
});

const C = {
  floor: '#e7e2d8', tatami: '#dcd6ac', wall: '#f3f0e9', wall2: '#e9e5dc',
  wood: '#c99f6c', woodDark: '#a97f52', white: '#eff1f5', metal: '#c3c9d3',
  road: '#b6bac1', roadDark: '#9aa0a8', sidewalk: '#d9dade', curb: '#eceded',
  grass: '#cbd9b4', grass2: '#bccfa4', dirt: '#d8c7a8', water: '#b7d6e8', stone: '#cfd0cf',
  building: ['#e6ded3', '#dfe4e8', '#e8dfe0', '#e4e6da', '#efe7dc', '#dde3e6'],
  roof: ['#c98d84', '#a8b3bd', '#cbb08a', '#b9a2b4'],
  awning: ['#d8a0a0', '#a8bfd6', '#d8c69a', '#a9c8b4'],
  dark: '#5b606b', marble: '#efeade', marble2: '#e3dccd', sand: '#d7cdba',
};

/* ---------------- 房间外壳 ---------------- */
function wallRun(axis, fixed, from, to, opts) {
  const { h = 2.4, t = 0.12, openings = [], color = C.wall, y: baseY = 0 } = opts;
  const res = [];
  const push = (a, b, y0, y1) => {
    if (b - a < 0.02 || y1 - y0 < 0.02) return;
    const len = b - a, mid = (a + b) / 2, base = baseY + y0, hh = y1 - y0;
    // spec.position.y 是「底面高度」，所以这里用段底而不是段中心（修掉墙整体浮空半个墙高的老 bug）
    if (axis === 'x') res.push(box(mid, fixed, len, hh, t, color, { y: base, occlude: true }));
    else res.push(box(fixed, mid, t, hh, len, color, { y: base, occlude: true }));
  };
  let cursor = from;
  for (const op of openings.slice().sort((a, b) => a.start - b.start)) {
    const s = Math.max(from, op.start), e = Math.min(to, op.end);
    if (s > cursor) push(cursor, s, 0, h);
    push(s, e, 0, op.y0 ?? 0);
    push(s, e, op.y1 ?? 2.0, h);
    cursor = e;
  }
  if (cursor < to) push(cursor, to, 0, h);
  return res;
}

function room(opts = {}) {
  const {
    w = 4, d = 5, h = 2.4, t = 0.12,
    floor = C.floor, wall = C.wall, floorThick = 0.08,
    door = { wall: 'south', at: 0, width: 0.9, height: 2.0 },
    windows = [{ wall: 'west', at: 0, width: 1.6, height: 1.2, sill: 0.9 }],
    walls = true,
  } = opts;
  const out = [box(0, 0, w, floorThick, d, floor, { y: -floorThick })];
  if (!walls) return out;
  const doorsOn = (name) => door && door.wall === name
    ? [{ start: door.at - door.width / 2, end: door.at + door.width / 2, y0: 0, y1: door.height }] : [];
  const winsOn = (name) => windows.filter((x) => x.wall === name).map((x) => ({
    start: x.at - x.width / 2, end: x.at + x.width / 2, y0: x.sill, y1: x.sill + x.height,
  }));
  out.push(...wallRun('x', -d / 2 + t / 2, -w / 2, w / 2, { h, t, color: wall, openings: [...doorsOn('south'), ...winsOn('south')] }));
  out.push(...wallRun('x', d / 2 - t / 2, -w / 2, w / 2, { h, t, color: wall, openings: [...doorsOn('north'), ...winsOn('north')] }));
  out.push(...wallRun('z', -w / 2 + t / 2, -d / 2, d / 2, { h, t, color: wall, openings: [...doorsOn('west'), ...winsOn('west')] }));
  out.push(...wallRun('z', w / 2 - t / 2, -d / 2, d / 2, { h, t, color: wall, openings: [...doorsOn('east'), ...winsOn('east')] }));
  return out;
}

/* ---------------- 室外零件 ---------------- */
// ry：房屋正面（局部 -Z 面）的朝向
function house(x, z, w, h0, d, i, ry = 0, y = 0) {
  const h = h0;
  const cos = Math.cos(ry), sin = Math.sin(ry);
  const P = (lx, lz) => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
  const out = [
    box(x, z, w, h, d, C.building[i % C.building.length], { ry, y }),
    prism(x, z, d + 0.3, Math.max(0.7, w * 0.24), w + 0.3, C.roof[i % C.roof.length], { ry: ry + Math.PI / 2, y: y + h }),
  ];
  const fz = -d / 2 - 0.05;
  for (const lx of [-w * 0.25, w * 0.25]) {
    const [px, pz] = P(lx, fz);
    out.push(box(px, pz, Math.min(w * 0.38, 1.3), 1.1, 0.1, C.white, { ry, y: y + h * 0.5 }));
  }
  const [dx, dz] = P(0, fz);
  out.push(box(dx, dz, 0.9, 1.95, 0.1, '#c9a97f', { ry, y }));
  return out;
}
function goal(x, z, h = 0, w = 3.7) {
  return [
    cyl(x - w / 2 + 0.1, z, 0.06, 2.4, '#eceef2', { y: h }),
    cyl(x + w / 2 - 0.1, z, 0.06, 2.4, '#eceef2', { y: h }),
    box(x, z, w, 0.09, 0.09, '#eceef2', { y: h + 2.4 }),
  ];
}
function tree(x, z, s = 1, conifer = false, base = 0) {
  const y = (v) => base + v;
  const out = [cyl(x, z, 0.13 * s, 1.5 * s, '#9c7b57', { y: base })];
  if (conifer) {
    out.push(cone(x, z, 1.05 * s, 1.9 * s, '#9dbb92', { y: y(1.2 * s) }));
    out.push(cone(x, z, 0.8 * s, 1.5 * s, '#a8c59b', { y: y(2.4 * s) }));
    out.push(cone(x, z, 0.5 * s, 1.2 * s, '#b3cfa6', { y: y(3.3 * s) }));
  } else {
    out.push(sph(x, z, 0.95 * s, '#a9c79a', { y: y(1.6 * s) }));
    out.push(sph(x - 0.5 * s, z + 0.35 * s, 0.72 * s, '#9fbf90', { y: y(1.85 * s) }));
    out.push(sph(x + 0.55 * s, z - 0.3 * s, 0.66 * s, '#b2cfa4', { y: y(2.0 * s) }));
  }
  return out;
}
function pole(x, z, h = 5.2) {
  return [
    cyl(x, z, 0.1, h, '#b3b7bd'),
    box(x, z + 0.5, 0.08, 0.08, 1.0, '#a9adb4', { y: h - 0.35 }),
    box(x, z - 0.5, 0.08, 0.08, 1.0, '#a9adb4', { y: h - 0.35 }),
  ];
}
function fence(x, z, len, ry = 0, h = 1.1) {
  const out = [box(x, z, len, 0.06, 0.05, '#c9ccd2', { ry, y: h - 0.1 }), box(x, z, len, 0.06, 0.05, '#c9ccd2', { ry, y: h - 0.5 })];
  const n = Math.floor(len / 0.6);
  for (let i = 0; i <= n; i++) {
    const t = -len / 2 + i * (len / n);
    const px = x + Math.cos(ry) * t, pz = z - Math.sin(ry) * t;
    out.push(cyl(px, pz, 0.035, h, '#bdbfc4'));
  }
  return out;
}

/* ---------------- 室内布置 ---------------- */
function ldkProps() {
  return [
    item('kitchenCounter', -1.6, -2.6),
    item('fridge', 1.5, -2.7),
    item('table', 0.4, 0.7),
    item('chair', 0.4, 1.5, Math.PI), item('chair', 0.4, -0.1),
    item('chair', 1.2, 0.7, -Math.PI / 2), item('chair', -0.4, 0.7, Math.PI / 2),
    item('sofa', -1.5, 2.1, Math.PI / 2),
    item('lowTable', -0.3, 2.1),
    item('tv', 1.9, 2.1, -Math.PI / 2),
    box(0, 0, 3.0, 0.01, 2.4, '#ddd3c6'),
  ];
}
function sixTatamiProps() {
  const out = [];
  const w = 3.6, d = 3.6;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    out.push(box(-w / 2 + 0.62 + i * 1.22, -d / 2 + 0.9 + j * 1.8, 1.18, 0.06, 1.76, C.tatami));
  }
  out.push(item('lowTable', 0, 0.1));
  out.push(box(0, d / 2 - 0.45, 2.2, 1.9, 0.6, '#cbb8a0'));
  out.push(box(0, d / 2 - 0.45, 2.1, 1.6, 0.05, '#e4dccb', { y: 0.15 }));
  out.push(box(-w / 2 + 0.3, -0.6, 0.4, 0.45, 0.4, '#d9cdb6'));
  return out;
}
function classroomProps() {
  const out = [];
  out.push(box(0, -4.3, 6.4, 1.1, 0.1, '#3f4a4f', { y: 0.85 }));
  out.push(box(0, -4.25, 6.6, 0.1, 0.16, '#c8b48e', { y: 0.75 }));
  out.push(item('desk', 0, -3.3));
  out.push(item('chair', 0, -2.7, Math.PI));
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    const x = -1.6 + c * 1.6, z = -1.4 + r * 1.5;
    out.push(item('desk', x, z));
    out.push(item('chair', x, z + 0.6, Math.PI));
  }
  out.push(box(3.4, -0.2, 0.9, 0.9, 1.6, '#cfd3da'));
  return out;
}
function officeProps() {
  const out = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const x = -2.2 + c * 2.2, z = -1.6 + r * 2.6;
    out.push(item('desk', x, z));
    out.push(item('chair', x, z + 0.75, Math.PI));
    out.push(box(x, z - 0.3, 0.62, 0.4, 0.06, '#4c5563', { y: 0.78 }));
    out.push(box(x, z - 0.3, 0.16, 0.1, 0.14, '#6d7686', { y: 0.75 }));
    out.push(box(x + 1.1, z, 0.08, 1.35, 1.6, '#dfe2e8'));
  }
  out.push(box(-3.4, 1.4, 1.2, 1.9, 0.5, '#d7dae1'));
  out.push(box(-3.4, 0.6, 1.2, 1.9, 0.5, '#cfd3db'));
  out.push(item('bookshelf', 3.4, -2.4, -Math.PI / 2));
  return out;
}
function cafeProps() {
  const out = [];
  out.push(box(-1.4, -3.4, 2.6, 0.95, 0.7, '#c9a97e'));
  out.push(box(-1.4, -3.4, 2.7, 0.06, 0.8, '#e7e2d6', { y: 0.95 }));
  out.push(box(-1.4, -2.9, 2.5, 0.35, 0.06, '#b9946a', { y: 0.6 }));
  out.push(cyl(-1.4, -2.6, 0.05, 0.5, '#c8ccd2'));
  out.push(item('table', 0.9, -0.6));
  out.push(item('chair', -0.3, -0.6, Math.PI / 2)); out.push(item('chair', 2.1, -0.6, -Math.PI / 2));
  out.push(item('table', 0.9, 1.9));
  out.push(item('chair', -0.3, 1.9, Math.PI / 2)); out.push(item('chair', 2.1, 1.9, -Math.PI / 2));
  out.push(item('table', -2.3, 1.0));
  out.push(item('chair', -2.3, 1.9, Math.PI));
  out.push(box(-2.6, -3.85, 1.4, 1.8, 0.4, '#cbb08a'));
  out.push(item('bookshelf', 2.6, -3.6, -Math.PI / 2));
  return out;
}
function mansionProps() {
  const out = [];
  for (const x of [-2.6, 2.6]) for (const z of [-2.6, 2.6]) out.push(box(x, z, 0.42, 3.0, 0.42, '#efeae0'));
  out.push(box(0, 0.4, 3.6, 0.02, 2.6, '#c9a3ab'));
  out.push(item('table', 0, 0.4));
  for (const [x, z, ry] of [[0, 1.5, Math.PI], [0, -0.7, 0], [1.5, 0.4, -Math.PI / 2], [-1.5, 0.4, Math.PI / 2]]) out.push(item('chair', x, z, ry));
  out.push(item('sofa', -3.4, -1.0, Math.PI / 2));
  out.push(item('sofa', -3.4, 1.4, Math.PI / 2));
  out.push(item('lowTable', -2.3, 0.2));
  out.push(sph(0, 0, 0.42, '#efe6c8', { y: 2.6 }));
  out.push(box(0, 0, 0.08, 0.6, 0.08, '#d8cba6', { y: 2.0 }));
  return out;
}

// 雅典娜 · 帕特诺斯像（三级基座 + 约 11m 像体），内外景通用
function athenaStatue(x0, z0, o = {}) {
  const y0 = o.y || 0, S = '#f7f3e8', S2 = '#efe9d9';
  const Y = (v) => y0 + v;
  return [
    box(x0, z0, 6.0, 0.7, 5.0, '#eae4d7', { y: Y(0) }),
    box(x0, z0, 5.2, 0.6, 4.4, '#f2eee4', { y: Y(0.7) }),
    box(x0, z0, 3.6, 0.3, 3.0, '#eae4d7', { y: Y(1.3) }),
    // 长裙：三段收分，像垂坠的衣褶
    cyl(x0, z0, 1.72, 1.7, S, { y: Y(1.6) }),
    cyl(x0, z0, 1.5, 1.7, S, { y: Y(3.3) }),
    cyl(x0, z0, 1.28, 1.6, S, { y: Y(5.0) }),
    // 胸甲 / 肩 / 颈 / 头 / 头盔 / 冠羽
    box(x0, z0, 2.6, 1.6, 1.7, S, { y: Y(6.6) }),
    box(x0, z0, 2.5, 0.5, 1.5, S, { y: Y(8.2) }),
    cyl(x0, z0, 0.36, 0.45, S, { y: Y(8.7) }),
    box(x0, z0, 1.15, 1.3, 1.15, '#fbf8f0', { y: Y(9.15) }),
    box(x0, z0, 1.5, 0.72, 1.5, S2, { y: Y(10.45) }),
    box(x0, z0, 0.22, 0.8, 1.8, '#e2dac6', { y: Y(11.17) }),
    // 双臂
    box(x0 - 1.35, z0 + 0.05, 0.66, 2.8, 0.72, S, { y: Y(6.2) }),
    box(x0 + 1.35, z0 + 0.05, 0.66, 2.8, 0.72, S, { y: Y(6.2) }),
    // 圆盾（朝外，立在她左侧）+ 长枪
    cyl(x0 - 1.75, z0 + 0.35, 1.25, 0.24, '#efe9d9', { y: Y(4.5), rx: Math.PI / 2 }),
    cyl(x0 + 1.7, z0 - 0.25, 0.07, 9.2, '#ddd5c1', { y: Y(1.6) }),
    box(x0 + 0.75, z0 - 0.75, 0.45, 0.85, 0.45, S, { y: Y(8.35) }),
  ];
}

/* ---------------- 场景模块共享工具箱 ----------------
   独立场景文件（src/scenes/*.js）通过 kit 复用这里的建模助手：
   在这些模块里只在 build() 内部使用 kit，模块顶层不要调用，避免循环依赖。 */
export const kit = {
  uid, rng, prim, box, cyl, cone, sph, prism, slope, col, item, C,
  wallRun, room, house, goal, tree, pole, fence, athenaStatue,
};

/* ---------------- 场景表 ---------------- */
export const STAGES = [
  { id: 'street', group: 'outdoor', grid: 1, view: { pos: [0.6, 1.75, 13], target: [0, 1.35, -6], lens: 28 }, build: () => {
    const out = [box(0, 0, 40, 0.04, 46, C.grass2, { y: -0.04 }), box(0, 0, 6.4, 0.04, 46, C.road, { y: -0.01 })];
    for (const s of [-1, 1]) out.push(box(s * 4.4, 0, 2.4, 0.16, 46, C.sidewalk, { y: 0 }));
    for (let i = 0; i < 6; i++) {
      const z = -16 + i * 6.4;
      if (i !== 2) out.push(...house(-9, z, 5.5, 4.2 + (i % 3) * 0.9, 6.5, i, -Math.PI / 2));
      if (i !== 3) out.push(...house(9.5, z + 1.2, 5.8, 3.6 + (i % 2) * 1.4, 7, i + 3, Math.PI / 2));
      out.push(...fence(-6.1, z, 5.4, 0, 1.0));
      out.push(...fence(6.9, z + 1.2, 5.2, 0, 1.0));
    }
    out.push(...pole(-3.2, -6, 5.4), ...pole(-3.2, 4, 5.4), ...pole(3.2, -1, 5.4));
    out.push(...tree(-6.4, -9, 1.05), ...tree(6.6, 6.5, 1.15));
    out.push(box(0, -14, 6.0, 0.01, 0.5, '#eeeadf', { y: 0.01 }));
    return out;
  } },
  { id: 'shoppingStreet', group: 'outdoor', grid: 1, view: { pos: [0.5, 1.7, 9], target: [0, 1.4, -4], lens: 28 }, build: () => {
    const out = [box(0, 0, 40, 0.04, 46, '#d9d7d2', { y: -0.04 }), box(0, 0, 5.0, 0.04, 46, C.road, { y: -0.01 })];
    for (const s of [-1, 1]) out.push(box(s * 3.4, 0, 1.8, 0.14, 46, C.sidewalk, { y: 0 }));
    for (let i = 0; i < 5; i++) {
      const z = -12 + i * 5.6;
      for (const s of [-1, 1]) {
        out.push(box(s * 6.2, z, 4.6, 3.6 + (i % 2) * 0.5, 4.4, C.building[(i + (s > 0 ? 2 : 0)) % C.building.length]));
        out.push(box(s * 4.0, z, 1.6, 0.09, 4.0, C.awning[(i + (s > 0 ? 1 : 0)) % C.awning.length], { y: 2.45, rz: s > 0 ? -0.32 : 0.32 }));
        out.push(box(s * 4.0, z, 0.14, 0.7, 3.4, '#f0ece2', { y: 0.1 }));
        out.push(box(s * 4.02, z + 1.2, 0.12, 1.6, 0.5, i % 2 ? '#e0b3a8' : '#a8c0d8', { y: 2.6 }));
        out.push(box(s * 4.02, z - 1.3, 0.12, 1.2, 0.4, '#d9d3c4', { y: 2.4 }));
      }
    }
    out.push(...pole(-2.6, -5, 4.6), ...pole(-2.6, 5, 4.6), ...pole(2.6, 0, 4.6));
    out.push(box(0, 0, 5.0, 0.01, 0.4, '#efece4', { y: 0.01 }));
    return out;
  } },
  { id: 'intersection', group: 'outdoor', grid: 1, view: { pos: [-5.5, 4.6, 10.5], target: [0.5, 1.2, 0.5], lens: 32 }, build: () => {
    const out = [box(0, 0, 46, 0.04, 46, '#d6d4cf', { y: -0.04 }),
      box(0, 0, 8.0, 0.04, 46, C.road, { y: -0.01 }), box(0, 0, 46, 0.04, 8.0, C.road, { y: -0.005 })];
    for (const s of [-1, 1]) {
      out.push(box(s * 5.0, 0, 2.0, 0.14, 46, C.sidewalk, { y: 0 }));
      out.push(box(0, s * 5.0, 46, 0.14, 2.0, C.sidewalk, { y: 0 }));
    }
    for (let i = 0; i < 8; i++) {
      out.push(box(-4.0 + i * 1.15, -4.6, 0.6, 0.01, 1.6, '#f0efe9', { y: 0.01 }));
      out.push(box(-4.0 + i * 1.15, 4.6, 0.6, 0.01, 1.6, '#f0efe9', { y: 0.01 }));
      out.push(box(-4.6, -4.0 + i * 1.15, 1.6, 0.01, 0.6, '#f0efe9', { y: 0.01 }));
      out.push(box(4.6, -4.0 + i * 1.15, 1.6, 0.01, 0.6, '#f0efe9', { y: 0.01 }));
    }
    for (const [x, z, i] of [[-11, -11, 0], [11, -11, 1], [-11, 11, 2], [11, 11, 3]]) {
      const ry = Math.atan2(Math.sign(x), Math.sign(z));
      out.push(...house(x, z, 8, 6.5 + i * 1.6, 9, i, ry));
    }
    out.push(...pole(-6.2, -6.2, 6.2), ...pole(6.2, 6.2, 6.2));
    out.push(...tree(6.6, -6.6, 1.2), ...tree(-6.6, 6.6, 1.2));
    return out;
  } },
  { id: 'forest', group: 'outdoor', grid: 1, view: { pos: [0.5, 2.6, 17], target: [0, 1.3, -1], lens: 35 }, build: () => {
    const camPos = [0.5, 2.6, 17];
    const out = [box(0, 0, 44, 0.06, 44, C.grass, { y: -0.06 })];
    const r = rng(7);
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2, d = 2.5 + r() * 15;
      const x = Math.cos(a) * d, z = Math.sin(a) * d * 0.9;
      if (Math.hypot(x - camPos[0], z - camPos[2]) < 4.5) continue;   // 不挡预设机位
      out.push(...tree(x, z, 0.85 + r() * 0.6, r() > 0.55));
    }
    for (let i = 0; i < 10; i++) out.push(box((r() - 0.5) * 5, (r() - 0.5) * 5, 0.9 + r() * 0.6, 0.028, 0.9, '#d8c5a1', { y: 0.01, ry: r() * 3 }));
    for (let i = 0; i < 6; i++) out.push(sph((r() - 0.5) * 7, (r() - 0.5) * 7, 0.3 + r() * 0.4, C.stone));
    return out;
  } },
  { id: 'riverbank', group: 'outdoor', grid: 1, view: { pos: [2.0, 3.4, 10.5], target: [0, 0.6, -2], lens: 30 }, build: () => {
    const out = [box(0, 0, 44, 0.06, 44, C.grass2, { y: -0.06 }), box(0, -6, 44, 0.06, 12, C.water, { y: -0.12 })];
    out.push(slope(0, 0.6, 44, 1.2, 1.6, C.stone, { ry: Math.PI }));
    out.push(box(0, 2.0, 44, 0.16, 3.0, C.dirt, { y: 0 }));
    const r = rng(21);
    for (let i = 0; i < 16; i++) {
      const x = (r() - 0.5) * 22;
      out.push(sph(x, 1.0 + r() * 1.4, 0.22 + r() * 0.5, C.stone));
    }
    for (let i = 0; i < 6; i++) {
      const tx = -14 + i * 5.6 + r() * 1.4, tz = 3.4 + r() * 1.6;
      if (Math.hypot(tx - 2.0, tz - 10.5) < 4.0) continue;
      out.push(...tree(tx, tz, 0.95 + r() * 0.4));
    }
    out.push(...fence(0, 3.2, 12, 0, 0.8));
    return out;
  } },
  { id: 'schoolyard', group: 'outdoor', grid: 1, view: { pos: [6, 4, 12], target: [0, 1.4, 0], lens: 32 }, build: () => {
    const out = [box(0, 0, 46, 0.05, 46, '#d8cdb8', { y: -0.05 }), box(0, -13, 30, 0.03, 8, '#c8bda8', { y: -0.01 })];
    out.push(box(0, -18, 24, 7.2, 7, '#e6e0d4'), prism(0, -18, 7.4, 1.4, 24.4, '#c9a9a0', { ry: Math.PI / 2, y: 7.2 }));
    for (let i = 0; i < 10; i++) out.push(box(-9 + i * 2.0, -14.4, 1.4, 1.1, 0.06, '#bcd2e0', { y: 1.2 + (i % 2) * 2.0 }));
    out.push(...goal(0, 4.8, 0), ...goal(0, 13.5, 0));
    out.push(...fence(-15, 8, 16, Math.PI / 2, 1.3), ...fence(15, 8, 16, Math.PI / 2, 1.3));
    out.push(...tree(-16, -6, 1.5), ...tree(16, -7, 1.4), ...tree(14, 12, 1.2));
    return out;
  } },
  { id: 'platform', group: 'outdoor', grid: 1, view: { pos: [2.2, 1.65, 3.6], target: [-1, 1.2, -1.5], lens: 30 }, build: () => {
    const out = [box(0, 0, 30, 0.06, 26, '#d3d4d7', { y: -0.06 }),
      box(0, 2.4, 30, 0.9, 6.0, '#dfd9cc', { y: 0 }),
      box(0, -1.6, 30, 0.12, 2.0, '#8d9298', { y: -0.12 }),
      box(0, -1.0, 30, 0.02, 0.2, '#e8d98a', { y: 0.91 })];
    for (const z of [-1.9, -1.3]) out.push(box(0, z, 30, 0.08, 0.12, '#9aa0a6', { y: 0.02 }));
    for (let i = -1; i <= 1; i++) {
      out.push(cyl(i * 5, 3.4, 0.12, 3.4, '#c8cbd0'));
      out.push(box(i * 5, 2.2, 0.3, 0.12, 2.6, '#c8cbd0', { y: 3.4 }));
    }
    out.push(box(0, 2.2, 30, 0.12, 2.4, '#e2e5ea', { y: 3.5 }));
    out.push(item('bench', -3.5, 4.0), item('bench', 3.5, 4.0));
    out.push(box(0, 5.0, 30, 2.0, 0.4, '#dfe1e5', { y: 0 }));
    out.push(box(-6, 4.6, 1.0, 2.3, 0.5, '#c9ccd1'));
    return out;
  } },
  { id: 'mansionHall', group: 'room', grid: 0.1, view: { pos: [3.4, 1.9, 4.2], target: [-0.6, 1.2, -0.3], lens: 28 }, build: () => [
    ...room({ w: 9, d: 11, h: 3.4, floor: '#e4dccd', wall: '#f2eee6', door: { wall: 'south', at: 0, width: 1.4, height: 2.6 },
      windows: [{ wall: 'west', at: -2.6, width: 2.2, height: 2.2, sill: 0.9 }, { wall: 'west', at: 2.6, width: 2.2, height: 2.2, sill: 0.9 },
        { wall: 'east', at: -2.6, width: 2.2, height: 2.2, sill: 0.9 }, { wall: 'east', at: 2.6, width: 2.2, height: 2.2, sill: 0.9 },
        { wall: 'north', at: 0, width: 2.4, height: 2.2, sill: 0.9 }] }),
    ...mansionProps(),
  ] },
  { id: 'ldk', group: 'room', grid: 0.1, view: { pos: [2.75, 1.58, 3.62], target: [-0.5, 0.95, -0.7], lens: 24 }, build: () => [
    ...room({ w: 7, d: 8, floor: '#e6dccb', door: { wall: 'south', at: 1.6, width: 0.9, height: 2.0 },
      windows: [{ wall: 'west', at: 0.5, width: 2.4, height: 1.3, sill: 0.85 }, { wall: 'north', at: 0, width: 1.6, height: 1.2, sill: 0.9 }] }),
    ...ldkProps(),
  ] },
  { id: 'sixTatami', group: 'room', grid: 0.1, view: { pos: [1.3, 1.3, 1.5], target: [-0.3, 0.7, -0.3], lens: 24 }, build: () => [
    ...room({ w: 3.6, d: 3.6, h: 2.4, floor: '#ded4b8', wall: '#f0ebdd', door: { wall: 'south', at: 1.0, width: 0.8, height: 1.95 },
      windows: [{ wall: 'east', at: 0, width: 1.4, height: 1.2, sill: 0.85 }] }),
    ...sixTatamiProps(),
  ] },
  { id: 'classroom', group: 'room', grid: 0.1, view: { pos: [3.0, 1.85, 3.6], target: [-0.3, 1.0, -1.7], lens: 26 }, build: () => [
    ...room({ w: 8, d: 9, h: 3.0, floor: '#ded9cd', door: { wall: 'south', at: 2.8, width: 1.0, height: 2.1 },
      windows: [{ wall: 'east', at: -2.4, width: 2.0, height: 1.6, sill: 0.85 }, { wall: 'east', at: 0, width: 2.0, height: 1.6, sill: 0.85 },
        { wall: 'east', at: 2.4, width: 2.0, height: 1.6, sill: 0.85 }, { wall: 'west', at: -2.4, width: 2.0, height: 1.6, sill: 0.85 }, { wall: 'west', at: 0, width: 2.0, height: 1.6, sill: 0.85 }, { wall: 'west', at: 2.4, width: 2.0, height: 1.6, sill: 0.85 }] }),
    ...classroomProps(),
  ] },
  { id: 'office', group: 'room', grid: 0.1, view: { pos: [3.1, 1.8, 2.8], target: [-0.5, 1.0, -0.6], lens: 28 }, build: () => [
    ...room({ w: 8, d: 7, h: 2.8, floor: '#dcdee2', wall: '#eef0f2', door: { wall: 'south', at: 3.0, width: 0.9, height: 2.05 },
      windows: [{ wall: 'north', at: -2.2, width: 2.2, height: 1.4, sill: 0.9 }, { wall: 'north', at: 1.0, width: 2.2, height: 1.4, sill: 0.9 }] }),
    ...officeProps(),
  ] },
  { id: 'cafe', group: 'room', grid: 0.1, view: { pos: [2.9, 1.75, 3.2], target: [-0.4, 1.0, -0.9], lens: 28 }, build: () => [
    ...room({ w: 7, d: 8, floor: '#dcccb8', wall: '#f2ece1', door: { wall: 'south', at: -2.6, width: 1.0, height: 2.05 },
      windows: [{ wall: 'east', at: -1.4, width: 2.2, height: 1.5, sill: 0.8 }, { wall: 'east', at: 1.4, width: 2.2, height: 1.5, sill: 0.8 }] }),
    ...cafeProps(),
  ] },
  // ---- 希腊神庙（外景）：帕特农式，长 69.5m × 宽 30.9m，三层台基 + 8×17 多立克柱 ----
  { id: 'templeExterior', group: 'outdoor', grid: 5, view: { pos: [34, 8.0, 72], target: [0, 8.0, 16], lens: 30 }, build: () => {
    const W = 30.9, L = 69.5, step = 0.34, axial = 4.29;
    const out = [box(0, 0, 260, 0.06, 260, C.sand, { y: -0.06 })];
    // 三层台基 crepidoma
    out.push(box(0, 0, W + 3.2, step, L + 3.2, '#e4ded1', { y: 0 }));
    out.push(box(0, 0, W + 1.6, step, L + 1.6, '#ece7db', { y: step }));
    out.push(box(0, 0, W, step, L, '#f4f0e6', { y: step * 2 }));
    const base = step * 3;                        // 台基顶面 1.02m
    const halfW = (7 * axial) / 2, halfL = (16 * axial) / 2;
    const xs = [], zs = [];
    for (let i = 0; i < 8; i++) xs.push(-halfW + i * axial);
    for (let j = 0; j < 17; j++) zs.push(-halfL + j * axial);
    // 8×17 周柱（角柱共用）
    for (const x of xs) { out.push(col(x, zs[0], 1, { y: base })); out.push(col(x, zs[16], 1, { y: base })); }
    for (let j = 1; j <= 15; j++) { out.push(col(xs[0], zs[j], 1, { y: base })); out.push(col(xs[7], zs[j], 1, { y: base })); }
    // 额枋 / 中楣 / 檐口
    const colTop = base + 10.3, archY = colTop, friY = archY + 1.1, corY = friY + 0.9;
    for (const sx of [-1, 1]) {
      out.push(box(sx * halfW, 0, 1.9, 1.1, L + 1.9, C.marble, { y: archY }));
      out.push(box(sx * (halfW + 0.05), 0, 1.8, 0.9, L + 1.8, C.marble2, { y: friY }));
      out.push(box(sx * (halfW + 0.35), 0, 2.5, 0.45, L + 2.5, C.marble, { y: corY }));
    }
    for (const sz of [-1, 1]) {
      out.push(box(0, sz * halfL, 2 * halfW + 1.9, 1.1, 1.9, C.marble, { y: archY }));
      out.push(box(0, sz * (halfL + 0.05), 2 * halfW + 1.8, 0.9, 1.8, C.marble2, { y: friY }));
      out.push(box(0, sz * (halfL + 0.35), 2 * halfW + 2.5, 0.45, 2.5, C.marble, { y: corY }));
    }
    // 三陇板（每一柱轴上方一块）
    for (let j = 0; j < 17; j++) for (const sx of [-1, 1]) {
      out.push(box(sx * (halfW + 0.96), zs[j], 0.14, 0.7, 0.62, '#e8e2d4', { y: friY + 0.1 }));
    }
    for (let i = 0; i < 8; i++) for (const sz of [-1, 1]) {
      out.push(box(xs[i], sz * (halfL + 0.96), 0.62, 0.7, 0.14, '#e8e2d4', { y: friY + 0.1 }));
    }
    // 双坡屋顶（山花三角）
    const roofY = corY + 0.45;
    out.push(prim('prism', 0, 0, (W + 1.6) / 0.5, 3.4 / 0.5, (L + 1.6) / 0.5, '#e9e3d5', { y: roofY }));
    for (const sz of [-1, 1]) {
      out.push(prim('prism', 0, sz * (L / 2 + 0.98), (W + 1.0) / 0.5, 3.1 / 0.5, 0.22 / 0.5, '#f5f1e7', { y: roofY + 0.15 }));
    }
    // 内殿（naos）墙 + 前廊/后厅柱
    const cw = 9.6;
    out.push(...wallRun('z', -cw, -20, 21, { h: 12, t: 0.9, color: '#f3efe5', y: base }));
    out.push(...wallRun('z', cw, -20, 21, { h: 12, t: 0.9, color: '#f3efe5', y: base }));
    out.push(...wallRun('x', -20, -cw, cw, { h: 12, t: 0.9, color: '#f3efe5', y: base }));
    out.push(...wallRun('x', 21, -cw, cw, { h: 12, t: 0.9, color: '#f3efe5', y: base,
      openings: [{ start: -2.2, end: 2.2, y0: 0, y1: 9.6 }] }));
    for (let i = 0; i < 6; i++) {
      const x = -cw + 0.4 + i * ((cw * 2 - 0.8) / 5);
      out.push(col(x, 25.2, 1, { y: base }));     // 前廊 pronaos
      out.push(col(x, -23.6, 1, { y: base }));    // 后厅 opisthodomos
    }
    // 东面入口前的广场：雅典娜像（正对大门）
    out.push(...athenaStatue(0, 44));
    return out;
  } },

  // ---- 希腊神庙（内殿）：19.2×30m 内殿 + 双层 Π 形柱廊 + 11m 雅典娜像 + 反射水池 ----
  { id: 'templeInterior', group: 'room', grid: 1, view: { pos: [0, 1.68, 9.2], target: [0, 4.6, -10.5], lens: 24 }, build: () => {
    const W = 19.2, L = 30, wallH = 13.5, t = 0.9;
    const out = [box(0, 0, W + 2 * t, 0.24, L + 2 * t, '#f1ece1', { y: -0.24 })];
    // 四面墙（东面开 4.4×9.6m 大门）
    out.push(...wallRun('z', -W / 2 - t / 2, -L / 2 - t, L / 2 + t, { h: wallH, t, color: '#f3efe5' }));
    out.push(...wallRun('z', W / 2 + t / 2, -L / 2 - t, L / 2 + t, { h: wallH, t, color: '#f3efe5' }));
    out.push(...wallRun('x', -L / 2 - t / 2, -W / 2 - t, W / 2 + t, { h: wallH, t, color: '#f3efe5' }));
    out.push(...wallRun('x', L / 2 + t / 2, -W / 2 - t, W / 2 + t, { h: wallH, t, color: '#f3efe5',
      openings: [{ start: -2.2, end: 2.2, y0: 0, y1: 9.6 }] }));
    // 双层 Π 形柱廊
    const lo = 5.6 / 10.3, up = 4.2 / 10.3, ledgeY = 6.4, cx = W / 2 - 1.7;
    const zs = [];
    for (let i = 0; i < 9; i++) zs.push(-13.8 + i * 3.1);
    for (const z of zs) for (const sx of [-1, 1]) {
      out.push(col(sx * cx, z, lo));
      out.push(col(sx * cx, z, up, { y: ledgeY }));
    }
    for (const x of [-6.2, -2.1, 2.1, 6.2]) {
      out.push(col(x, -13.8, lo));
      out.push(col(x, -13.8, up, { y: ledgeY }));
    }
    // 二层楼板（Π 形）
    for (const sx of [-1, 1]) out.push(box(sx * cx, -1.3, 2.2, 0.5, 27.6, C.marble2, { y: ledgeY - 0.5, occlude: false }));
    out.push(box(0, -13.8, 2 * cx, 0.5, 2.2, C.marble2, { y: ledgeY - 0.5, occlude: false }));
    // 天花板 + 梁
    out.push(box(0, 0, W, 0.5, L, '#efeade', { y: wallH }));
    for (let i = 0; i < 6; i++) out.push(box(0, -12 + i * 4.8, W, 0.55, 0.7, C.marble2, { y: wallH - 0.55 }));
    for (const sx of [-1, 1]) out.push(box(sx * 4.8, 0, 0.7, 0.55, L, C.marble2, { y: wallH - 0.55 }));
    out.push(...athenaStatue(0, -10.5));   // 神像：雅典娜 · 帕特诺斯
    // 地面镶边（大理石分格线）
    for (const sx of [-1, 1]) out.push(box(sx * 6.6, 0, 0.22, 0.03, 27.5, '#e2dbca', { y: 0.005 }));
    for (const sz of [-1, 1]) out.push(box(0, sz * 13.6, 13.4, 0.03, 0.22, '#e2dbca', { y: 0.005 }));
    // 反射水池（浅浅一层水 + 边框）
    out.push(box(0, -4.4, 5.2, 0.03, 3.4, '#d7e3ea', { y: 0.03 }));
    out.push(box(0, -2.6, 5.6, 0.14, 0.22, '#e6e0d2', { y: 0.02 }));
    out.push(box(0, -6.2, 5.6, 0.14, 0.22, '#e6e0d2', { y: 0.02 }));
    for (const sx of [-1, 1]) out.push(box(sx * 2.8, -4.4, 0.22, 0.14, 3.6, '#e6e0d2', { y: 0.02 }));
    return out;
  } },

  jiangxiExteriorStage,
  lushanStage,
  jiangxiInteriorStage,
  iwasakiExteriorStage,
  iwasakiInteriorStage,
  iwasakiJapaneseStage,

  { id: 'peopleOnly', group: 'people', grid: 1, view: { pos: [3.4, 1.7, 4.4], target: [0, 0.95, 0], lens: 35 }, build: () => [] },
];

export const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.id, s]));
export const STAGE_GROUPS = [
  { key: 'stage.group.outdoor', stages: STAGES.filter((s) => s.group === 'outdoor') },
  { key: 'stage.group.room', stages: STAGES.filter((s) => s.group === 'room') },
  { key: 'stage.group.people', stages: STAGES.filter((s) => s.group === 'people') },
];

export function buildStageProps(id) {
  const s = STAGE_MAP[id];
  return s ? s.build() : [];
}
