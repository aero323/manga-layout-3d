// 旧岩崎邸 洋館（室内 1 层）：玄関ホール + 中央大階段 + 大広間 + 食堂 + 廊下
// 参考：東京都文京区湯島「旧岩崎邸庭園」洋館（1896 竣工 / Josiah Conder 设计，英国雅各布样式）
//   特征：玄関ホール两层通高 + 木制大階段（格子状手摺子）· 金唐革纸壁纸 + 格天井 + 枝形吊灯
//        大理石拼花地坪 + 寄木细工廊下 + 成对上下推拉窗
// 平面 18m(x) × 14m(z)：南侧玄関ホール（南 = +z，入口在 z=7）、北侧大広間 / 食堂，中间 2.2m 廊下
// 说明：重复构件（踏步 / 手摺子 / 格天井 / 拼板 / 窗）都用循环生成，总数控制在 240 个 spec 以内；
//      「格子手摺子」在 spec 预算内按约 0.6m 间距简化（真实建筑为 12cm）。
import { kit } from '../stages.js';

export const iwasakiInteriorStage = {
  id: 'iwasakiInterior', group: 'room', grid: 0.1,
  view: { pos: [-0.2, 1.7, 7.7], target: [-2.3, 2.5, 0.0], lens: 24 },
  build: () => {
    const { box, cyl, cone, sph, item, C } = kit;
    // 配色（13 色）：墙 / 木三档 / 金唐革纸 / 大理石 / 玻璃 / 暗部 / 地毯
    const cream = '#ece7dc', cream2 = '#e2dccd',
      wood = '#7a5738', wood2 = '#8a6440', woodL = '#a9855c', woodD = '#573e28',
      gold = '#c9a45c', marble = '#efeade', marble2 = '#e3dccd',
      glass = '#cfe4f2', darkB = '#4b4640', rug = '#b9a891';
    const out = [];
    // 素材库 item 只能落在 y=0：这里把窗抬到窗台高度、把家具/门抬到各自地坪面上
    const on = (spec, y) => { spec.position[1] = y; return spec; };
    // 墙段生成器：接口与 kit.wallRun 相同，但 position.y 写「墙面底面」。
    // 背景：kit.wallRun 目前把「墙段中心高度」写进 position.y，而本 app 的约定是
    // position.y = 底面（objects.js 的 buildObject 会把原点挪到底面 / 素材库落地也是 y=0）
    // → 用 wallRun 生成的墙会整体浮起「半个段高」。内景墙角一眼可见，所以这里自带一份
    // 正确实现（语义与 wallRun 完全一致）；上游修正 stages.js 后也可以换回 wallRun。
    const wall = (axis, fixed, from, to, o = {}) => {
      const { h, t = 0.12, color, y: baseY = 0, openings = [] } = o;
      const res = [];
      const put = (a, b, y0, y1) => {
        if (b - a < 0.02 || y1 - y0 < 0.02) return;
        const len = b - a, mid = (a + b) / 2;
        if (axis === 'x') res.push(box(mid, fixed, len, y1 - y0, t, color, { y: baseY + y0, occlude: true }));
        else res.push(box(fixed, mid, t, y1 - y0, len, color, { y: baseY + y0, occlude: true }));
      };
      let cursor = from;
      for (const op of openings.slice().sort((a, b) => a.start - b.start)) {
        const st = Math.max(from, op.start), en = Math.min(to, op.end);
        if (st > cursor) put(cursor, st, 0, h);
        put(st, en, 0, op.y0 ?? 0);
        put(st, en, op.y1 ?? 2.0, h);
        cursor = en;
      }
      if (cursor < to) put(cursor, to, 0, h);
      return res;
    };
    const winAt = (x, z, ry) => {
      const w = item('window', x, z, ry);
      w.position[1] = 1.0;
      w.scale = [1, 1.833, 1];
      return w;
    };

    /* ---------- 1. 场地 / 地坪（大理石拼花 + 木地板 + 寄木细工） ---------- */
    out.push(box(0, 0, 46, 0.08, 42, C.grass, { y: 0, occlude: false }));
    // 玄関ホール：大理石 + 四边镶边 + 中央圆花饰
    out.push(box(-1.2, 3.8, 8.4, 0.06, 6.4, marble, { y: 0.08, occlude: false }));
    for (const [x, z, w, d] of [[-1.2, 1.0, 7.2, 0.24], [-1.2, 6.6, 7.2, 0.24]])
      out.push(box(x, z, w, 0.03, d, marble2, { y: 0.14, occlude: false }));
    out.push(cyl(-1.2, 3.8, 1.05, 0.03, marble2, { y: 0.14, occlude: false }));
    // 廊下：寄木细工（0.6×0.2 薄板深浅交错，循环 2 组控制总量）
    out.push(box(-1.5, -0.5, 15, 0.05, 2.2, wood2, { y: 0.06, occlude: false }));
    for (let i = 0; i < 2; i++) {
      const bx = -5.2 + i * 5.8;
      out.push(box(bx, -1.15, 0.6, 0.02, 0.2, woodL, { y: 0.11, occlude: false }));
      out.push(box(bx + 0.3, -0.15, 0.6, 0.02, 0.2, woodD, { y: 0.11, occlude: false }));
    }
    // 大広間 / 食堂：木地板 + 板缝
    out.push(box(-5, -4.3, 8, 0.06, 5.4, wood2, { y: 0.06, occlude: false }));
    out.push(box(2.5, -4.3, 7, 0.06, 5.4, wood2, { y: 0.06, occlude: false }));
    out.push(box(-5, -4.3, 7.9, 0.02, 0.05, woodD, { y: 0.11, occlude: false }));      // 板缝
    out.push(box(2.5, -4.3, 6.9, 0.02, 0.05, woodD, { y: 0.11, occlude: false }));

    /* ---------- 2. 墙体 ---------- */
    // 玄関ホール（两层通高 7.6m）
    out.push(...wall('x', 0.6, -5.4, 3.0, { h: 7.6, t: 0.24, color: cream, openings: [{ start: -2.2, end: 1.4, y0: 0, y1: 3.0 }] }));
    out.push(...wall('z', -5.4, 0.6, 7.0, { h: 7.6, t: 0.24, color: cream }));
    out.push(...wall('z', 3.0, 0.6, 7.0, { h: 7.6, t: 0.24, color: cream, openings: [{ start: 3.4, end: 5.0, y0: 1.0, y1: 3.2 }] }));
    out.push(...wall('x', 7.0, -5.4, 3.0, { h: 7.6, t: 0.24, color: cream, openings: [{ start: -2.8, end: 0.4, y0: 0, y1: 3.8 }] }));
    // 廊下（净宽 2.2m，北墙两樘双开门通大広間 / 食堂）
    out.push(...wall('x', 0.6, -9, -5.4, { h: 5.2, t: 0.24, color: cream }));
    out.push(...wall('x', 0.6, 3.0, 6, { h: 5.2, t: 0.24, color: cream }));
    out.push(...wall('x', -1.6, -9, 6, { h: 5.2, t: 0.2, color: cream, openings: [{ start: -3.4, end: -1.6, y0: 0, y1: 3.0 }, { start: 0.5, end: 2.3, y0: 0, y1: 3.0 }] }));
    // 外墙 + 大広間 / 食堂隔墙
    out.push(...wall('z', -9, -7, 0.6, { h: 5.2, t: 0.24, color: cream, openings: [{ start: -6.5, end: -3.3, y0: 1.0, y1: 3.2 }] }));
    out.push(...wall('z', 6, -7, 0.6, { h: 5.2, t: 0.24, color: cream, openings: [{ start: -5.6, end: -2.4, y0: 1.0, y1: 3.2 }] }));
    out.push(...wall('x', -7, -9, -1, { h: 5.2, t: 0.24, color: cream, openings: [{ start: -8.9, end: -5.7, y0: 1.0, y1: 3.2 }] }));
    out.push(...wall('x', -7, -1, 6, { h: 5.2, t: 0.24, color: cream, openings: [{ start: 2.8, end: 6.0, y0: 1.0, y1: 3.2 }] }));
    out.push(...wall('z', -1, -7, -1.6, { h: 5.2, t: 0.2, color: cream }));

    /* ---------- 3. 成对上下推拉窗（白框 + 玻璃 + 大理石窗台） ---------- */
    out.push(winAt(3.0, 4.2, Math.PI / 2));                                     // 玄関ホール东墙
    out.push(winAt(-9.0, -5.7, Math.PI / 2), winAt(-9.0, -4.1, Math.PI / 2));   // 大広間西墙（庭园侧）
    out.push(winAt(6.0, -4.8, Math.PI / 2), winAt(6.0, -3.2, Math.PI / 2));     // 食堂东墙
    out.push(winAt(-8.1, -7.0, 0), winAt(-6.5, -7.0, 0));                       // 大広間北墙（壁炉东侧）
    out.push(winAt(3.6, -7.0, 0), winAt(5.2, -7.0, 0));                         // 食堂北墙
    out.push(box(2.82, 4.2, 0.32, 0.12, 3.5, marble, { y: 0.94, occlude: true }));
    out.push(box(-8.82, -4.9, 0.32, 0.12, 3.5, marble, { y: 0.94, occlude: true }));
    out.push(box(5.82, -4.0, 0.32, 0.12, 3.5, marble, { y: 0.94, occlude: true }));
    out.push(box(-7.3, -6.82, 3.5, 0.12, 0.32, marble, { y: 0.94, occlude: true }));
    out.push(box(4.4, -6.82, 3.5, 0.12, 0.32, marble, { y: 0.94, occlude: true }));

    /* ---------- 4. 格天井 / 井字梁 ---------- */
    // 玄関ホール（7.6m 双层通高）
    out.push(box(-1.2, 3.8, 8.4, 0.4, 6.4, cream, { y: 7.6, occlude: true }));
    for (const z of [2.4, 5.2]) out.push(box(-1.2, z, 8.4, 0.3, 0.22, cream2, { y: 7.3, occlude: true }));
    out.push(box(-3.6, 3.8, 0.22, 0.3, 6.4, cream2, { y: 7.3, occlude: true }));
    out.push(box(-1.2, 0.78, 8.2, 0.28, 0.3, cream2, { y: 7.05, occlude: true }));
    out.push(box(-5.22, 3.8, 0.3, 0.28, 6.2, cream2, { y: 7.05, occlude: true }));
    // 廊下
    out.push(box(-1.5, -0.5, 15, 0.3, 2.2, cream, { y: 5.2, occlude: true }));
    // 大広間：格天井
    out.push(box(-5, -4.3, 8, 0.4, 5.4, cream, { y: 5.2, occlude: true }));
    for (const z of [-6.2, -5.1, -4.0]) out.push(box(-5, z, 8, 0.3, 0.2, cream2, { y: 4.9, occlude: true }));
    for (const x of [-7.5, -5.3, -3.1]) out.push(box(x, -4.3, 0.2, 0.3, 5.4, cream2, { y: 4.9, occlude: true }));
    // 食堂：格天井
    out.push(box(2.5, -4.3, 7, 0.4, 5.4, cream, { y: 5.2, occlude: true }));
    for (const z of [-6.2, -5.1, -4.0]) out.push(box(2.5, z, 7, 0.3, 0.2, cream2, { y: 4.9, occlude: true }));
    for (const x of [0.25, 2.5, 4.75]) out.push(box(x, -4.3, 0.2, 0.3, 5.4, cream2, { y: 4.9, occlude: true }));

    /* ---------- 5. 木制大階段（14 级 + 中间平台，riser 0.28 / 踏面 0.30，宽 2.4m）+ 格子手摺子 ---------- */
    const SX = -3.96, SW = 2.4, RISE = 0.28, TREAD = 0.3, Z0 = 6.6, Y0 = 0.08;
    for (let i = 1; i <= 7; i++) {                     // 下段 7 级（实心深木 + 浅木踏步面）
      const zc = Z0 - TREAD * i + TREAD / 2, top = Y0 + RISE * i;
      out.push(box(SX, zc, SW, top, TREAD, wood2, { y: 0, occlude: false }));
      out.push(box(SX, zc, SW, 0.05, TREAD + 0.04, woodL, { y: top - 0.05, occlude: false }));
    }
    out.push(box(SX, 3.9, SW, 0.28, 1.2, wood2, { y: Y0 + RISE * 7 - 0.28, occlude: false }));   // 中间平台
    out.push(box(SX, 3.9, SW, 0.05, 1.24, woodL, { y: Y0 + RISE * 7 - 0.05, occlude: false }));
    for (let k = 1; k <= 7; k++) {                     // 上段 7 级
      const zc = 3.3 - TREAD * k + TREAD / 2, top = Y0 + RISE * (7 + k);
      out.push(box(SX, zc, SW, top, TREAD, wood2, { y: 0, occlude: false }));
      out.push(box(SX, zc, SW, 0.05, TREAD + 0.04, woodL, { y: top - 0.05, occlude: false }));
    }
    // 木扶手 3 段 + 中横档（格子感）+ 细木条立柱 + 起柱
    out.push(box(-2.7, 5.55, 0.12, 0.12, 3.06, woodD, { y: 1.96, rx: -0.75, occlude: false }));
    out.push(box(-2.7, 2.25, 0.12, 0.12, 3.06, woodD, { y: 3.92, rx: -0.75, occlude: false }));
    out.push(box(-2.7, 3.9, 0.12, 0.12, 1.3, woodD, { y: 2.94, occlude: false }));
    out.push(box(-2.7, 5.55, 0.08, 0.07, 3.06, woodD, { y: 1.51, rx: -0.75, occlude: false }));
    out.push(box(-2.7, 2.25, 0.08, 0.07, 3.06, woodD, { y: 3.47, rx: -0.75, occlude: false }));
    for (let i = 1; i <= 7; i += 2) {
      out.push(box(-2.7, Z0 - TREAD * i + TREAD / 2, 0.05, 0.85, 0.05, woodD, { y: Y0 + RISE * i, occlude: false }));
      out.push(box(-2.7, 3.3 - TREAD * i + TREAD / 2, 0.05, 0.85, 0.05, woodD, { y: Y0 + RISE * (7 + i), occlude: false }));
    }
    out.push(box(-2.7, 3.9, 0.05, 0.85, 0.05, woodD, { y: Y0 + RISE * 7, occlude: false }));
    out.push(box(-2.71, 3.9, 0.1, 0.18, 5.38, woodD, { y: 0, occlude: false }));   // 楼梯侧面踢脚
    out.push(box(-2.7, 6.75, 0.22, 1.05, 0.22, woodD, { y: 0.08, occlude: false }));
    out.push(sph(-2.7, 6.75, 0.15, woodD, { y: 1.13, occlude: false }));
    // 二层平台（大厅北侧通廊楼板）+ 栏杆
    out.push(box(-1.2, 0.5, 8.4, 0.32, 1.4, wood2, { y: 3.68, occlude: false }));
    out.push(box(-1.2, 1.12, 8.4, 0.14, 0.16, woodD, { y: 3.68, occlude: false }));
    out.push(box(0.06, 1.2, 5.64, 0.1, 0.12, woodD, { y: 4.78, occlude: false }));
    for (const x of [-2.2, -1.2, -0.2, 0.8, 1.8]) out.push(box(x, 1.2, 0.05, 0.78, 0.05, woodD, { y: 4.0, occlude: false }));

    /* ---------- 6. 枝形吊灯（黄铜吊杆 + 灯罩） ---------- */
    const chandelier = (x, z, yTop, ring, shades) => {
      out.push(cyl(x, z, 0.04, 1.2, woodD, { y: yTop }));
      out.push(cyl(x, z, ring, 0.1, gold, { y: yTop - 0.1 }));
      for (let i = 0; i < shades; i++) {
        const a = (i / shades) * Math.PI * 2;
        out.push(cone(x + Math.cos(a) * ring * 0.7, z + Math.sin(a) * ring * 0.7, 0.15, 0.3, cream2, { y: yTop - 0.3 }));
      }
    };
    // 灯罩数受 spec 预算限制（真实建筑 6~8 个）：大厅 4 / 大広間 3 / 食堂 3
    chandelier(0.2, 3.6, 6.4, 0.6, 4);      // 玄関ホール
    chandelier(-4.4, -4.4, 4.4, 0.5, 3);    // 大広間
    chandelier(2.5, -4.3, 4.4, 0.5, 3);     // 食堂

    /* ---------- 7. 暖炉（大理石壁炉台 + 瓷砖内胆 + 木制壁炉架） ---------- */
    // 大広間：北墙
    out.push(box(-4.2, -6.83, 1.9, 3.6, 0.34, cream2, { y: 0.1, occlude: false }));
    out.push(box(-5.02, -6.62, 0.28, 1.3, 0.26, marble, { y: 0.1, occlude: false }));
    out.push(box(-3.38, -6.62, 0.28, 1.3, 0.26, marble, { y: 0.1, occlude: false }));
    out.push(box(-4.2, -6.58, 2.4, 0.14, 0.42, marble2, { y: 1.4, occlude: false }));
    out.push(box(-4.2, -6.62, 1.7, 1.15, 0.12, marble2, { y: 0.2, occlude: false }));   // 瓷砖内胆
    out.push(box(-4.2, -6.54, 1.1, 0.95, 0.08, darkB, { y: 0.28, occlude: false }));   // 炉膛
    out.push(box(-4.2, -6.2, 2.2, 0.1, 0.72, marble, { y: 0.1, occlude: false }));     // 炉台
    out.push(box(-4.2, -6.58, 1.7, 1.0, 0.14, wood, { y: 1.6, occlude: false }));     // 木制壁炉架
    out.push(box(-4.2, -6.5, 0.5, 0.44, 0.16, woodD, { y: 1.54, occlude: false }));
    // 食堂：北墙
    out.push(box(1.0, -6.83, 1.9, 3.4, 0.34, cream2, { y: 0.1, occlude: false }));
    out.push(box(1.0, -6.58, 2.3, 0.14, 0.42, marble2, { y: 1.35, occlude: false }));
    out.push(box(1.0, -6.62, 1.5, 1.05, 0.12, marble2, { y: 0.2, occlude: false }));
    out.push(box(1.0, -6.54, 1.0, 0.9, 0.08, darkB, { y: 0.28, occlude: false }));
    out.push(box(1.0, -6.2, 1.9, 0.1, 0.68, marble, { y: 0.1, occlude: false }));

    /* ---------- 8. 大広間：金唐革纸壁纸（分格 + 木压条）+ 家具 ---------- */
    out.push(box(-5, -6.87, 8, 3.0, 0.06, gold, { y: 1.3, occlude: true }));
    out.push(box(-8.87, -4.3, 0.06, 3.0, 5.4, gold, { y: 1.3, occlude: true }));
    out.push(box(-1.13, -4.3, 0.06, 3.0, 5.4, gold, { y: 1.3, occlude: true }));
    out.push(box(-5, -1.73, 8, 3.0, 0.06, gold, { y: 1.3, occlude: true }));
    for (const x of [-8.4, -7.3, -6.2, -2.4]) out.push(box(x, -6.78, 0.08, 2.9, 0.08, wood, { y: 1.35, occlude: true }));
    for (const z of [-6.2, -4.9]) out.push(box(-8.78, z, 0.08, 2.9, 0.08, wood, { y: 1.35, occlude: true }));
    out.push(box(-4.4, -4.4, 4.6, 0.03, 3.2, rug, { y: 0.12, occlude: false }));
    out.push(on(item('sofa', -4.4, -3.2, Math.PI), 0.12));
    out.push(on(item('chair', -6.0, -5.4, 2.23), 0.12));
    out.push(on(item('chair', -2.8, -5.4, -2.36), 0.12));
    out.push(on(item('lowTable', -4.4, -4.6, 0), 0.12));
    out.push(cyl(-8.3, -6.2, 0.22, 0.06, gold, { y: 0.12 }));
    out.push(cyl(-8.3, -6.2, 0.035, 1.5, gold, { y: 0.18 }));
    out.push(cone(-8.3, -6.2, 0.26, 0.34, cream2, { y: 1.7 }));
    out.push(cyl(-1.7, -6.2, 0.26, 0.4, marble2, { y: 0.12 }));
    out.push(sph(-1.7, -6.2, 0.42, C.grass2, { y: 0.62 }));
    out.push(box(-8.86, -2.4, 0.08, 1.7, 1.3, gold, { y: 1.5 }));
    out.push(box(-8.8, -2.4, 0.04, 1.35, 1.0, wood, { y: 1.68 }));

    /* ---------- 9. 食堂：长餐桌 2.4×1.1 + 8 椅 + 餐具柜 + 地毯 ---------- */
    out.push(box(2.5, -4.3, 5.0, 0.03, 3.4, rug, { y: 0.12, occlude: false }));
    const table = item('table', 2.5, -4.3, 0);
    table.scale = [2, 1, 1.57];
    out.push(on(table, 0.12));
    for (const x of [1.7, 2.5, 3.3]) out.push(on(item('chair', x, -3.45, Math.PI), 0.12));
    for (const x of [1.7, 2.5, 3.3]) out.push(on(item('chair', x, -5.15, 0), 0.12));
    out.push(on(item('chair', 0.95, -4.3, Math.PI / 2), 0.12));
    out.push(on(item('chair', 4.05, -4.3, -Math.PI / 2), 0.12));
    out.push(box(5.35, -4.3, 0.66, 0.95, 2.0, wood2, { y: 0.12 }));
    out.push(box(5.35, -4.3, 0.72, 0.08, 2.06, woodD, { y: 1.07 }));

    /* ---------- 10. 廊下：木门 + 门套 + 壁灯 + 挂画 ---------- */
    out.push(box(-1.5, -0.5, 12, 0.02, 1.2, rug, { y: 0.12, occlude: false }));
    out.push(on(item('door', -3.35, -1.95, Math.PI / 2), 0.11));
    out.push(on(item('door', -1.65, -1.95, Math.PI / 2), 0.11));
    out.push(on(item('door', 0.55, -1.95, Math.PI / 2), 0.11));
    out.push(on(item('door', 2.25, -1.95, Math.PI / 2), 0.11));
    out.push(box(-2.5, -1.46, 1.9, 0.3, 0.14, wood, { y: 3.05 }));
    out.push(box(1.4, -1.46, 1.9, 0.3, 0.14, wood, { y: 3.05 }));
    for (const x of [-6.6, 4.3]) {
      out.push(box(x, -1.48, 0.1, 0.3, 0.1, gold, { y: 2.2 }));
      out.push(cone(x, -1.34, 0.18, 0.24, cream2, { y: 2.35 }));
    }
    out.push(box(-7.0, -1.44, 1.2, 1.5, 0.08, gold, { y: 1.4 }));

    /* ---------- 11. 玄関：大门 + 门厅家具 + 壁柱 / 木裙板 / 腰线 ---------- */
    out.push(on(item('door', -3.25, 6.8, 0), 0.14));   // 双扇门全开，贴墙
    out.push(on(item('door', 0.85, 6.8, 0), 0.14));
    out.push(box(-1.2, 6.92, 3.2, 0.22, 0.12, woodD, { y: 3.8 }));
    // 条案 + 镜子贴东墙（不挡玄関视线）
    out.push(box(2.72, 5.6, 0.42, 0.08, 1.3, wood2, { y: 1.0 }));
    out.push(box(2.72, 5.05, 0.36, 1.0, 0.1, woodD, { y: 0.14 }));
    out.push(box(2.72, 6.15, 0.36, 1.0, 0.1, woodD, { y: 0.14 }));
    out.push(box(2.9, 5.6, 0.1, 1.8, 1.4, gold, { y: 1.5 }));
    out.push(box(2.84, 5.6, 0.05, 1.55, 1.15, glass, { y: 1.62 }));
    out.push(cyl(2.5, 6.5, 0.26, 0.4, marble2, { y: 0.14 }));
    out.push(sph(2.5, 6.5, 0.42, C.grass2, { y: 0.64 }));
    out.push(box(-2.55, 0.72, 0.34, 4.8, 0.18, cream2, { y: 0.14, occlude: true }));
    out.push(box(1.7, 0.72, 0.34, 4.8, 0.18, cream2, { y: 0.14, occlude: true }));
    out.push(box(-5.22, 3.8, 0.14, 1.1, 6.3, wood2, { y: 0.14, occlude: true }));
    out.push(box(-3.8, 0.74, 3.2, 1.1, 0.14, wood2, { y: 0.14, occlude: true }));
    out.push(box(2.2, 0.74, 1.6, 1.1, 0.14, wood2, { y: 0.14, occlude: true }));
    out.push(box(-5.2, 3.8, 0.1, 0.08, 6.3, woodD, { y: 1.24, occlude: true }));
    out.push(box(2.2, 0.74, 1.6, 0.08, 0.1, woodD, { y: 1.24, occlude: true }));

    /* ---------- 12. 踢脚线 + 腰线（大広間 / 食堂 / 廊下） ---------- */
    out.push(box(-5, -6.86, 8, 0.22, 0.1, wood, { y: 0.12, occlude: true }));
    out.push(box(-8.86, -4.3, 0.1, 0.22, 5.4, wood, { y: 0.12, occlude: true }));
    out.push(box(-8.8, -4.3, 0.1, 0.08, 5.4, woodD, { y: 1.18, occlude: true }));
    out.push(box(2.5, -6.86, 7, 0.22, 0.1, wood, { y: 0.12, occlude: true }));
    out.push(box(5.86, -4.3, 0.1, 0.22, 5.4, wood, { y: 0.12, occlude: true }));
    out.push(box(-7.2, 0.48, 3.6, 0.22, 0.1, wood, { y: 0.12, occlude: true }));
    return out;
  },
};
