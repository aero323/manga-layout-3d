// 江西古建筑民居（赣派民居）：外景 + 内景
// 由 src/stages.js 拆分而来；共享建模助手通过 kit 取得（见 stages.js 末尾的 kit 导出）
import { kit } from '../stages.js';

// ---- 江西古建筑民居（外景）：赣派青砖民居 · 马头墙跌级 + 砖雕门罩 + 青石巷 ----
export const jiangxiExteriorStage = { id: 'jiangxiExterior', group: 'outdoor', grid: 1, view: { pos: [-0.6, 2.5, 9.6], target: [1.6, 2.35, -6.5], lens: 26 }, build: () => {
    const { prim, box, cyl, cone, sph, prism, slope, col, item, C, wallRun, room, rng, tree, pole, fence, house, goal, athenaStatue } = kit;
    const brick = '#77828a', brick2 = '#69737a', plaster = '#ece7dc', tile = '#5f676e', tile2 = '#4b525a',
      stone = '#9aa0a0', stone2 = '#8b9296', stone3 = '#a8adad', wood = '#6b4a2f', wood2 = '#8a6440';
    const r = rng(41);
    const out = [box(0, 0, 64, 0.06, 64, '#c8c0ae', { y: -0.06 })];
    // 巷道：青石板左右交替错缝 + 东侧排水明沟
    const cols = [stone, stone3, stone2];
    for (let i = 0; i < 21; i++) {
      const z = 9.4 - i * 1.32, dl = i % 2 ? 1.92 : 1.36, dr = 3.28 - dl;
      out.push(box(-1.64 + dl / 2, z, dl, 0.05, 1.24, cols[Math.floor(r() * 3)], { y: 0 }));
      out.push(box(1.64 - dr / 2, z, dr, 0.05, 1.24, cols[Math.floor(r() * 3)], { y: 0 }));
    }
    out.push(box(2.04, -4.2, 0.3, 0.05, 27.3, '#6d7378', { y: -0.02 }));
    for (const x of [1.86, 2.22]) out.push(box(x, -4.2, 0.15, 0.14, 27.3, stone2, { y: 0 }));
    // 主屋：面阔 10.8m（三间各 3.6）· 进深 8.4m · 檐口 4.4m · 屋脊 5.9m
    out.push(box(6.8, -7, 8.4, 4.4, 10.8, brick, { y: 0 }));
    const gable = (zc, segs, detail) => {
      for (const [x0, x1, top] of segs) {
        const cx = (x0 + x1) / 2, w0 = x1 - x0;
        out.push(box(cx, zc, w0, top - 4.2, 0.36, brick2, { y: 4.2 }));
        if (detail) {   // 叠涩线脚出挑 2 道 + 瓦压顶（压顶瓦 + 脊条）
          out.push(box(cx, zc, w0 + 0.14, 0.09, 0.5, '#8a949b', { y: top - 0.52 }));
          out.push(box(cx, zc, w0 + 0.24, 0.09, 0.56, '#8a949b', { y: top - 0.3 }));
          out.push(box(cx, zc, w0 + 0.34, 0.12, 0.6, tile2, { y: top }));
          out.push(box(cx, zc, w0 + 0.14, 0.07, 0.46, tile2, { y: top + 0.12 }));
        } else {
          out.push(box(cx, zc, w0 + 0.36, 0.12, 0.64, tile2, { y: top }));
        }
      }
    };
    gable(-1.42, [[2.6, 3.9, 4.95], [3.9, 5.35, 5.45], [5.35, 8.25, 5.95], [8.25, 9.7, 5.45], [9.7, 11.0, 4.95]], true);   // 正面马头墙：三级跌级 + 叠涩线脚 + 瓦压顶
    gable(-12.58, [[2.6, 4.8, 4.9], [4.8, 8.8, 5.95], [8.8, 11.0, 4.9]]);                                                // 背面跌级剪影
    for (const x of [2.6, 11.0]) out.push(box(x, -1.42, 0.6, 0.62, 0.8, brick2, { y: 4.38 }));                          // 墀头：两端加厚墙墩
    // 双坡小青瓦：脊 x=6.8m + 屋脊翘角 + 沿坡向瓦垄（前坡 0.62m / 后坡 1.3m 一道）+ 檐口瓦当滴水
    out.push(box(4.7, -7, 4.48, 0.14, 11.6, tile, { y: 5.12, rz: 0.343, occlude: true }));
    out.push(box(8.9, -7, 4.48, 0.14, 11.6, tile, { y: 5.12, rz: -0.343, occlude: true }));
    out.push(box(6.8, -7, 0.28, 0.26, 11.7, tile2, { y: 5.9, occlude: true }));
    out.push(box(6.8, -1.15, 0.26, 0.3, 0.5, tile2, { y: 5.98, rx: -0.4, occlude: true }));
    out.push(box(6.8, -12.85, 0.26, 0.3, 0.5, tile2, { y: 5.98, rx: 0.4, occlude: true }));
    for (let i = 0; i < 19; i++) out.push(box(4.65, -12.45 + i * 0.62, 4.6, 0.06, 0.09, tile2, { y: 5.25, rz: 0.343, occlude: true }));
    for (let i = 0; i < 7; i++) out.push(box(8.95, -12.2 + i * 1.75, 4.6, 0.06, 0.09, tile2, { y: 5.25, rz: -0.343, occlude: true }));
    out.push(box(2.62, -7, 0.22, 0.18, 11.6, tile2, { y: 4.32, occlude: true }));
    out.push(box(10.98, -7, 0.22, 0.18, 11.6, tile2, { y: 4.32, occlude: true }));
    for (let i = 0; i < 11; i++) out.push(cyl(2.46, -12.1 + i * 1.09, 0.1, 0.07, tile2, { y: 4.36, rz: Math.PI / 2, occlude: true }));   // 檐口滴水 / 瓦当一列
    // 门面：木檐柱石础 + 檐枋、青砖墙裙 + 白灰粉墙、木格窗（十字/井字棂）
    for (const z of [-1.9, -5.2, -8.8, -12.1]) {
      out.push(cyl(2.36, z, 0.24, 0.2, stone2, { y: 0 }));
      out.push(cyl(2.36, z, 0.13, 4.2, wood, { y: 0.18 }));
    }
    out.push(box(2.34, -7, 0.16, 0.28, 10.5, wood2, { y: 4.05 }));
    // 檐下木构：椽条（顺出檐方向）+ 牛腿（柱头托木）+ 挂落（檐下花格双条）
    for (let i = 0; i < 6; i++) out.push(box(2.2, -12.0 + i * 1.75, 0.7, 0.09, 0.08, wood2, { y: 3.9, occlude: true }));
    for (const z of [-1.9, -5.2, -8.8, -12.1]) out.push(box(2.3, z, 0.3, 0.5, 0.3, wood, { y: 3.55 }));
    for (const z of [-3.55, -10.45]) out.push(box(2.3, z, 0.14, 0.06, 3.1, wood2, { y: 4.0 }));
    for (const y of [4.0, 3.8]) out.push(box(2.3, -7.0, 0.14, 0.06, 3.1, wood2, { y }));
    out.push(box(2.55, -7, 0.12, 1.25, 10.9, brick2, { y: 0 }));
    for (const z of [-3.4, -10.6]) {
      out.push(box(2.55, z, 0.1, 2.5, 3.2, plaster, { y: 1.75 }));
      out.push(box(2.52, z, 0.12, 1.36, 1.72, wood, { y: 1.45 }));
      out.push(box(2.45, z, 0.1, 1.06, 1.42, '#3a3a38', { y: 1.6 }));
      for (const dz of [-0.42, 0, 0.42]) out.push(box(2.42, z + dz, 0.06, 1.06, 0.05, wood2, { y: 1.6 }));
      for (const y of [1.87, 2.07, 2.27]) out.push(box(2.42, z, 0.06, 0.05, 1.42, wood2, { y }));
      out.push(box(2.48, z, 0.24, 0.1, 1.9, stone2, { y: 1.33 }));
      out.push(box(2.46, z, 0.2, 0.08, 1.8, brick2, { y: 2.84 }));     // 窗楣叠涩（两层线脚）
      out.push(box(2.5, z, 0.28, 0.12, 2.0, stone2, { y: 2.94 }));
    }
    // 石库门：石框门槛 + 双扇门 + 门环 + 抱鼓石 + 两级踏步
    for (const s of [-1, 1]) {
      const zc = -7 + s * 0.48;
      out.push(box(2.44, -7 + s * 1.05, 0.32, 2.65, 0.32, stone2, { y: 0 }));
      out.push(box(2.5, zc, 0.08, 2.3, 0.92, '#4a3628', { y: 0.18 }));
      for (const dz of [-0.3, 0.3]) out.push(box(2.42, zc + dz, 0.06, 1.7, 0.05, wood2, { y: 0.62 }));   // 格扇竖棂
      out.push(box(2.42, zc, 0.06, 0.05, 0.9, wood2, { y: 2.15 }));                                      // 中横棂
      out.push(box(2.42, zc, 0.06, 0.6, 0.86, wood, { y: 0.2 }));                                        // 下部裙板
      out.push(cyl(2.44, -7 + s * 0.62, 0.09, 0.05, '#c9a24a', { y: 1.25, rz: Math.PI / 2 }));
      out.push(box(2.42, -7 + s * 1.38, 0.5, 0.34, 0.55, stone2, { y: 0 }));
      out.push(cyl(2.42, -7 + s * 1.38, 0.27, 0.26, stone, { y: 0.42, rz: Math.PI / 2 }));
    }
    out.push(box(2.42, -7, 0.38, 0.42, 2.7, stone2, { y: 2.62 }));
    out.push(box(2.46, -7, 0.4, 0.2, 2.1, stone, { y: 0 }));
    out.push(box(2.1, -7, 1.0, 0.1, 2.6, stone3, { y: 0 }));
    out.push(box(2.32, -7, 0.4, 0.2, 2.2, stone2, { y: 0 }));
    // 砖雕门罩：三层逐层外挑 + 瓦压顶 + 翘角 + 门额
    out.push(box(2.42, -7, 0.4, 0.26, 3.8, brick2, { y: 3.1 }));
    out.push(box(2.32, -7, 0.5, 0.22, 4.2, stone2, { y: 3.36 }));
    out.push(box(2.22, -7, 0.6, 0.2, 4.6, brick2, { y: 3.58 }));
    out.push(box(2.18, -7, 0.72, 0.12, 4.9, tile2, { y: 3.78, occlude: true }));
    out.push(box(2.2, -4.55, 0.34, 0.3, 0.5, tile2, { y: 3.84, rx: -0.4, occlude: true }));
    out.push(box(2.2, -9.45, 0.34, 0.3, 0.5, tile2, { y: 3.84, rx: 0.4, occlude: true }));
    out.push(box(2.19, -7, 0.06, 0.34, 1.5, '#d9d3c6', { y: 3.03 }));
    // 巷子细节：墙脚散水 + 雨水口 + 墙面斑驳 + 檐下灯笼 + 门槛石
    out.push(box(2.4, -7, 0.3, 0.07, 12.6, stone3, { y: 0 }));
    for (const z of [-6.0, -9.2]) out.push(box(2.04, z, 0.3, 0.06, 0.5, '#4f5559', { y: 0.02 }));
    for (const [z, w, hh] of [[-4.6, 0.6, 0.8], [-2.28, 0.35, 0.9], [-11.7, 0.4, 0.7]])
      out.push(box(2.47, z, 0.04, hh, w, '#c9c3b6', { y: 2.3 }));
    for (const s of [-1, 1]) {
      out.push(cyl(2.3, -7 + s * 1.6, 0.012, 0.6, '#4a382a', { y: 3.3 }));
      out.push(cyl(2.3, -7 + s * 1.6, 0.24, 0.06, '#4a382a', { y: 3.24 }));
      out.push(cyl(2.3, -7 + s * 1.6, 0.2, 0.34, '#a3352c', { y: 2.9 }));
    }
    out.push(box(2.42, -7, 0.42, 0.06, 1.7, stone3, { y: 0.2 }));
    // 山墙小漏窗
    for (const x of [4.1, 8.3]) {
      out.push(box(x, -1.22, 0.95, 0.95, 0.08, '#5f6a71', { y: 3.2 }));
      out.push(box(x, -1.16, 0.7, 0.7, 0.06, '#3c4449', { y: 3.32 }));
      out.push(box(x, -1.12, 0.06, 0.72, 0.05, stone2, { y: 3.31 }));
      out.push(box(x, -1.12, 0.72, 0.06, 0.05, stone2, { y: 3.63 }));
    }
    // 巷侧民居（青砖/白灰二式）：双坡青瓦 + 马头墙跌级 + 临巷木窗
    const laneHouse = (xc, zc, w, d, hb, bodyColor, ridge) => {
      out.push(box(xc, zc, w, hb, d, bodyColor, { y: 0 }));
      const half = w / 2, rise = ridge - hb, len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
      out.push(box(xc - half / 2, zc, len, 0.12, d + 0.4, tile, { y: hb + rise / 2, rz: ang, occlude: true }));
      out.push(box(xc + half / 2, zc, len, 0.12, d + 0.4, tile, { y: hb + rise / 2, rz: -ang, occlude: true }));
      out.push(box(xc, zc, 0.24, 0.22, d + 0.5, tile2, { y: ridge, occlude: true }));
    };
    const gable2 = (zc, xa, xb, hb, tops) => {
      const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), n = tops.length, step = (x1 - x0) / n;
      for (let i = 0; i < n; i++) {
        const cx = x0 + step * (i + 0.5), top = tops[i];
        out.push(box(cx, zc, step, top - hb + 0.2, 0.32, brick2, { y: hb - 0.2 }));
        out.push(box(cx, zc, step + 0.3, 0.1, 0.58, tile2, { y: top }));
      }
    };
    laneHouse(-6.15, -9.2, 5.5, 8.4, 4.0, plaster, 5.35);
    gable2(-4.86, -3.4, -8.9, 4.0, [4.65, 5.6, 5.6, 4.65]);
    for (const z of [-6.6, -11.2]) {
      out.push(box(-3.33, z, 0.12, 1.2, 1.5, wood, { y: 1.6 }));
      out.push(box(-3.25, z, 0.08, 0.96, 1.3, '#3a3a38', { y: 1.72 }));
      out.push(box(-3.2, z, 0.05, 0.96, 0.05, wood2, { y: 1.72 }));
      out.push(box(-3.2, z, 0.05, 0.05, 1.3, wood2, { y: 2.1 }));
    }
    out.push(box(-3.32, -9.0, 0.14, 2.1, 1.1, wood, { y: 0 }));
    out.push(box(-3.3, -9.0, 0.2, 0.12, 1.3, stone2, { y: 0 }));
    laneHouse(-6.0, -17.6, 5.4, 7.4, 4.3, brick, 5.5);
    gable2(-13.76, -3.3, -8.7, 4.3, [4.9, 5.75, 4.9]);
    out.push(box(-3.23, -15.6, 0.12, 1.2, 1.5, wood, { y: 1.6 }));
    out.push(box(-3.15, -15.6, 0.08, 0.96, 1.3, '#3a3a38', { y: 1.72 }));
    out.push(box(-3.1, -15.6, 0.05, 0.96, 0.05, wood2, { y: 1.72 }));
    out.push(box(-3.1, -15.6, 0.05, 0.05, 1.3, wood2, { y: 2.1 }));
    laneHouse(-1.5, -25.5, 7.0, 6.0, 3.8, plaster, 5.0);
    gable2(-22.44, -5.0, 2.0, 3.8, [4.5, 5.25, 4.5]);
    // 老樟树：粗干 + 多球大冠幅
    out.push(cyl(-5.6, -1.9, 0.34, 3.9, '#7a6248'));
    out.push(sph(-5.8, -1.9, 2.15, '#7f9b6f', { y: 5.3 }));
    out.push(sph(-7.5, -1.3, 1.55, '#8aa878', { y: 5.7 }));
    out.push(sph(-4.4, -2.3, 1.45, '#759064', { y: 6.0 }));
    out.push(sph(-5.9, -3.2, 1.5, '#88a476', { y: 5.6 }));
    out.push(sph(-7.0, -2.9, 1.25, '#7f9b6f', { y: 6.7 }));
    out.push(sph(-5.0, -0.7, 1.25, '#8fae7d', { y: 6.6 }));
    // 生活细节：石臼 + 靠墙竹竿 + 柴垛
    out.push(cyl(1.55, -3.8, 0.36, 0.42, stone2));
    out.push(cyl(1.55, -3.8, 0.24, 0.1, '#5f676e', { y: 0.36 }));
    out.push(box(1.4, -3.55, 0.1, 0.5, 0.1, wood2, { y: 0.4, rz: 0.35 }));
    for (let i = 0; i < 3; i++) out.push(cyl(2.28 - i * 0.06, -1.75 - i * 0.25, 0.03, 3.4, '#b7a86a', { y: 0.15, rz: -0.09 }));
    for (let j = 0; j < 3; j++) for (let k = 0; k < 3 - j; k++) {
      out.push(cyl(-4.3 - j * 0.24, -3.8 - k * 0.26 - j * 0.13, 0.11, 1.3, ['#8a6440', '#6b4a2f', '#96714a'][Math.floor(r() * 3)], { y: 0.11 + j * 0.21, rz: Math.PI / 2 }));
    }
    // 巷尾水塘：石岸 + 卵石 + 两级石阶
    out.push(box(-0.4, -20.5, 9.0, 0.05, 5.5, '#a9c6d4', { y: -0.02 }));
    out.push(box(-0.4, -17.55, 9.2, 0.16, 0.4, stone2, { y: 0 }));
    out.push(box(-5.0, -20.5, 0.4, 0.16, 5.5, stone2, { y: 0 }));
    out.push(box(4.2, -20.5, 0.4, 0.16, 5.6, stone2, { y: 0 }));
    for (let i = 0; i < 3; i++) out.push(sph(-3.2 + i * 2.6, -18.1 + r() * 0.4, 0.3 + r() * 0.3, stone3));
    out.push(box(-0.8, -16.85, 2.2, 0.28, 0.4, stone2, { y: 0 }));
    out.push(box(-0.8, -17.18, 2.2, 0.14, 0.4, stone3, { y: 0 }));
    return out;
  } };

// ---- 江西古建筑民居（内景）：三开间厅堂 + 四水归堂天井，深木 / 青灰 / 白灰 ----
export const jiangxiInteriorStage = { id: 'jiangxiInterior', group: 'room', grid: 0.1, view: { pos: [0.7, 2.3, 6.6], target: [-0.2, 2.1, -4.6], lens: 24 }, build: () => {
    const { prim, box, cyl, cone, sph, prism, slope, col, item, C, wallRun, room, rng, tree, pole, fence, house, goal, athenaStatue } = kit;
    const brick = '#7c868c', plaster = '#ece7dc', tile2 = '#4b525a',
      stone = '#9aa0a0', stone2 = '#8b9296', stone3 = '#a8adad', wood = '#6b4a2f', wood2 = '#8a6440', woodD = '#573e28';
    const r = rng(63);
    // 地面：厅堂青石地坪（抬一级）+ 天井石板 + 两级石阶 + 四周排水沟 + 石缸
    const out = [box(0, 0.6, 12.0, 0.12, 12.6, '#8f9596', { y: -0.12 })];
    out.push(box(0, -2.45, 10.8, 0.16, 5.7, '#909696', { y: 0 }));
    const cols = [stone, stone3, '#949a9a'];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
      out.push(box(-4.3 + j * 2.15 + (i % 2) * 0.5, -4.4 + i * 1.55, 2.0, 0.04, 1.44, cols[Math.floor(r() * 3)], { y: 0.16 }));
    }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
      out.push(box(-1.05 + j * 0.7, 1.75 + i, 0.66, 0.03, 0.95, [stone3, stone, '#a2a7a7'][(i + j) % 3], { y: 0.02 }));
    }
    out.push(box(0, 0.62, 2.6, 0.12, 0.34, stone2, { y: 0 }));
    out.push(box(0, 0.9, 2.6, 0.07, 0.34, stone3, { y: 0 }));
    out.push(box(0, 0.56, 2.9, 0.05, 0.24, '#6d7378', { y: 0.02 }));
    out.push(box(0, 4.24, 3.3, 0.05, 0.24, '#6d7378', { y: 0.02 }));
    for (const sx of [-1, 1]) out.push(box(sx * 1.62, 2.4, 0.24, 0.05, 3.6, '#6d7378', { y: 0.02 }));
    out.push(cyl(-1.15, 1.75, 0.46, 0.52, '#848b8c'));
    out.push(cyl(-1.15, 1.75, 0.5, 0.1, stone2, { y: 0.52 }));
    out.push(cyl(-1.15, 1.75, 0.37, 0.06, '#7fa3b0', { y: 0.6 }));
    // 缸内游鱼 + 明沟盖石 + 卵石带
    for (const [fx, fz, fy] of [[-1.05, 1.85, 0.5], [-1.25, 1.68, -0.4]])
      out.push(prim('sphere', fx, fz, 0.5, 0.12, 0.8, '#c0704f', { y: 0.625, ry: fy }));
    for (const x of [-0.62, 0.62]) out.push(box(x, 0.56, 0.5, 0.05, 0.3, stone2, { y: 0.06 }));
    out.push(sph(-1.35, 0.95, 0.15, stone3, { y: 0.02 }));
    // 三面白灰墙（青砖墙裙）+ 前墙大门洞
    out.push(...wallRun('z', -5.46, -5.52, 6.72, { h: 5.0, t: 0.12, color: plaster }));
    out.push(...wallRun('z', 5.46, -5.52, 6.72, { h: 5.0, t: 0.12, color: plaster }));
    out.push(...wallRun('x', -5.46, -5.52, 5.52, { h: 5.0, t: 0.12, color: plaster }));
    out.push(...wallRun('x', 6.66, -5.52, 5.52, { h: 5.0, t: 0.12, color: plaster, openings: [{ start: -1.6, end: 1.6, y0: 0, y1: 3.2 }] }));
    out.push(box(0, -5.36, 10.8, 0.9, 0.07, brick, { y: 0 }));
    for (const sx of [-1, 1]) out.push(box(sx * 5.36, -0.5, 0.07, 0.9, 9.6, brick, { y: 0 }));
    // 屋面：中央留 3.5×4m 天井洞口，四面向天井披水（四水归堂）+ 檐口木枋 + 檩条
    for (const p of [[0, -2.5, 10.8, 5.8], [-3.575, 3.5, 3.65, 6.2], [3.575, 3.5, 3.65, 6.2], [0, 5.5, 3.5, 2.2]]) {
      out.push(box(p[0], p[1], p[2], 0.3, p[3], '#5a4430', { y: 5.0, occlude: true }));
    }
    out.push(box(0, -0.08, 3.5, 0.1, 0.95, tile2, { y: 4.8, rx: 0.42, occlude: true }));
    out.push(box(0, 4.88, 3.5, 0.1, 0.95, tile2, { y: 4.8, rx: -0.42, occlude: true }));
    out.push(box(-2.22, 2.4, 0.95, 0.1, 4.0, tile2, { y: 4.8, rz: -0.42, occlude: true }));
    out.push(box(2.22, 2.4, 0.95, 0.1, 4.0, tile2, { y: 4.8, rz: 0.42, occlude: true }));
    // 天井檐口一圈瓦口（四边压瓦条，呼应外观小青瓦）
    out.push(box(0, 0.34, 3.62, 0.09, 0.15, tile2, { y: 4.5, occlude: true }));
    out.push(box(0, 4.46, 3.62, 0.09, 0.15, tile2, { y: 4.5, occlude: true }));
    for (const sx of [-1, 1]) out.push(box(sx * 1.78, 2.4, 0.15, 0.09, 4.24, tile2, { y: 4.5, occlude: true }));
    out.push(box(0, 0.3, 3.9, 0.18, 0.2, wood2, { y: 4.46 }));
    out.push(box(0, 4.5, 3.9, 0.18, 0.2, wood2, { y: 4.46 }));
    for (const sx of [-1, 1]) out.push(box(sx * 1.86, 2.4, 0.2, 0.18, 4.4, wood2, { y: 4.46 }));
    for (const sx of [-1, 1]) out.push(box(sx * 1.74, 2.4, 0.06, 0.24, 3.6, wood2, { y: 4.26 }));   // 梁下挂落
    out.push(box(0, -1.6, 10.6, 0.16, 0.16, woodD, { y: 4.7 }));
    out.push(box(0, -4.5, 10.6, 0.16, 0.16, woodD, { y: 4.7 }));
    for (const sx of [-1, 1]) out.push(box(sx * 4.0, 3.0, 0.16, 0.16, 5.6, woodD, { y: 4.7 }));
    // 木柱 + 石础（檐柱 4 + 金柱 2）
    for (const [x, z] of [[-2.15, 0.1], [2.15, 0.1], [-2.15, 4.5], [2.15, 4.5], [-2.3, -4.8], [2.3, -4.8]]) {
      out.push(cyl(x, z, 0.24, 0.2, stone2, { y: 0 }));
      out.push(cyl(x, z, 0.15, 4.5, wood, { y: 0.18 }));
      if (z > 0) {                                                     // 檐柱：鼓形柱础 + 柱头雀替
        out.push(cyl(x, z, 0.2, 0.17, stone, { y: 0.2 }));
        out.push(box(x, z, 0.46, 0.3, 0.46, wood2, { y: 3.9 }));
      }
    }
    // 冬瓜梁 / 月梁 + 梁托 + 童柱 + 穿枋
    for (const sx of [-1, 1]) {
      out.push(box(sx * 2.25, -2.35, 0.28, 0.4, 5.2, wood2, { y: 3.55 }));
      out.push(box(sx * 2.15, 2.3, 0.26, 0.34, 4.6, wood2, { y: 3.66 }));
      out.push(box(sx * 2.25, -0.3, 0.5, 0.22, 0.3, wood, { y: 3.3 }));
      out.push(box(sx * 2.25, -4.3, 0.5, 0.22, 0.3, wood, { y: 3.3 }));
      out.push(box(sx * 2.25, -1.6, 0.18, 0.7, 0.18, woodD, { y: 3.95 }));
      out.push(box(sx * 2.15, 2.3, 0.15, 0.46, 0.15, woodD, { y: 4.0 }));
    }
    out.push(box(0, 0.1, 4.8, 0.3, 0.24, wood2, { y: 3.6 }));
    out.push(box(0, -4.8, 5.0, 0.32, 0.26, wood2, { y: 3.54 }));
    out.push(box(0, 4.5, 4.8, 0.28, 0.22, wood2, { y: 3.7 }));
    // 太师壁（三扇板壁）+ 匾额 + 楹联
    out.push(box(0, -4.98, 4.3, 3.3, 0.12, wood, { y: 0 }));
    out.push(box(0, -4.91, 4.3, 0.16, 0.07, woodD, { y: 3.14 }));
    for (const x of [-0.72, 0.72]) out.push(box(x, -4.91, 0.06, 3.0, 0.06, woodD, { y: 0.12 }));
    out.push(box(0, -4.7, 2.3, 0.72, 0.1, '#4a3520', { y: 3.5 }));
    out.push(box(0, -4.62, 1.8, 0.42, 0.05, '#c9a24a', { y: 3.65 }));
    for (const sx of [-1, 1]) out.push(box(sx * 2.3, -4.6, 0.18, 2.2, 0.07, '#8c2f28', { y: 1.05 }));
    // 条案（瓶/炉）+ 八仙桌 + 太师椅 + 两侧条凳
    out.push(box(0, -4.42, 3.0, 0.1, 0.52, '#7b5738', { y: 0.86 }));
    out.push(box(0, -4.42, 2.8, 0.16, 0.4, wood, { y: 0.6 }));
    for (const sx of [-1, 1]) out.push(box(sx * 1.32, -4.42, 0.14, 0.8, 0.14, wood, { y: 0 }));
    out.push(cyl(0.95, -4.42, 0.14, 0.55, '#6d7f88', { y: 0.96 }));
    out.push(cyl(-0.95, -4.42, 0.14, 0.45, '#7d6c55', { y: 0.96 }));
    out.push(cyl(0, -4.42, 0.16, 0.22, '#7a6a52', { y: 0.96 }));
    // 陈设细化：中堂挂画 + 翘头案 + 落地大瓷瓶（收分）+ 三扇屏风 + 香案烛台
    out.push(box(0, -4.86, 1.5, 1.7, 0.06, wood2, { y: 1.5 }));
    out.push(box(0, -4.82, 1.28, 1.48, 0.04, '#d9d3c6', { y: 1.61 }));
    for (const sx of [-1, 1]) out.push(box(sx * 1.52, -4.42, 0.18, 0.16, 0.5, wood, { y: 0.96 }));
    for (const sx of [-1, 1]) {
      out.push(cyl(sx * 1.95, -4.6, sx < 0 ? 0.2 : 0.17, sx < 0 ? 0.92 : 0.66, '#6d7f88', { y: 0 }));
      if (sx < 0) out.push(cyl(-1.95, -4.6, 0.1, 0.28, '#7d6c55', { y: 0.92 }));
      out.push(cyl(sx * 0.55, -4.42, 0.05, 0.5, '#c9a24a', { y: 0.96 }));
    }
    for (const [zc, ry] of [[-4.6, 0.12], [-3.75, -0.12]]) out.push(box(4.3, zc, 0.07, 1.9, 0.86, wood, { ry }));
    out.push(box(0, -2.4, 1.02, 0.1, 1.02, '#7b5738', { y: 0.76 }));
    for (const s of [-1, 1]) {
      out.push(box(0, -2.4 + s * 0.42, 0.86, 0.14, 0.06, wood, { y: 0.6 }));
      out.push(box(s * 0.42, -2.4, 0.06, 0.14, 0.86, wood, { y: 0.6 }));
      for (const t of [-1, 1]) out.push(cyl(s * 0.42, -2.4 + t * 0.42, 0.055, 0.76, '#5d4028'));
    }
    const chair = (x, z, dir) => {
      out.push(box(x, z, 0.62, 0.1, 0.6, '#7b5738', { y: 0.46 }));
      out.push(box(x, z, 0.5, 0.1, 0.5, wood, { y: 0.36 }));
      out.push(box(x + dir * 0.28, z, 0.07, 0.75, 0.62, wood, { y: 0.5 }));
      for (const s of [-1, 1]) {
        out.push(box(x, z + s * 0.25, 0.55, 0.07, 0.06, wood, { y: 0.72 }));
        out.push(box(x, z + s * 0.23, 0.5, 0.36, 0.08, woodD, { y: 0 }));
      }
    };
    chair(1.55, -2.4, 1); chair(-1.55, -2.4, -1);
    for (const sx of [-1, 1]) {
      out.push(box(sx * 3.5, -2.4, 0.34, 0.08, 1.1, wood, { y: 0.45 }));
      for (const t of [-1, 1]) out.push(box(sx * 3.5, -2.4 + t * 0.42, 0.26, 0.42, 0.1, woodD, { y: 0 }));
    }
    // 两侧隔扇门窗（通厢房 / 走廊）
    const geshan = (sx, z, dress) => {
      const x = sx * 5.34;
      out.push(box(x, z, 0.12, 2.7, 1.6, wood, { y: 0 }));
      out.push(box(x - sx * 0.09, z, 0.08, 2.35, 1.4, '#3f3a33', { y: 0.15 }));
      for (const dz of [-0.35, 0.35]) out.push(box(x - sx * 0.14, z + dz, 0.06, 2.3, 0.05, wood2, { y: 0.18 }));
      for (const y of [0.75, 1.4, 2.05]) out.push(box(x - sx * 0.14, z, 0.06, 0.05, 1.36, wood2, { y }));
      if (dress) {   // 格扇（远端两扇精做）：格心加中棂 + 下部裙板 + 门楣线脚
        out.push(box(x - sx * 0.14, z, 0.06, 2.3, 0.05, wood2, { y: 0.18 }));
        out.push(box(x - sx * 0.16, z, 0.08, 0.62, 1.34, wood, { y: 0.16 }));
        out.push(box(x - sx * 0.2, z, 0.12, 0.14, 1.86, wood2, { y: 2.72 }));
      }
    };
    for (const z of [2.4, -0.8]) { geshan(-1, z, z < 0); geshan(1, z, z < 0); }
    // 厢房之间的槛墙 + 美人靠（座面 + 靠背）
    for (const sx of [-1, 1]) {
      out.push(box(sx * 5.3, 0.8, 0.16, 1.05, 1.6, brick, { y: 0 }));
      out.push(box(sx * 4.95, 0.8, 0.5, 0.08, 1.5, wood, { y: 0.42 }));
      out.push(box(sx * 5.16, 0.8, 0.06, 0.5, 1.5, wood2, { y: 0.5 }));
    }
    // 天井檐下两只六角宫灯（薄板拼）+ 挂绳 / 上下盖
    for (const sx of [-1, 1]) {
      out.push(cyl(sx * 1.3, 0.1, 0.012, 0.9, '#4a382a', { y: 3.0 }));
      out.push(cyl(sx * 1.3, 0.1, 0.26, 0.07, '#4a382a', { y: 2.98 }));
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3;
        out.push(box(sx * 1.3 + 0.24 * Math.cos(a), 0.1 + 0.24 * Math.sin(a), 0.28, 0.5, 0.03, '#a3352c', { y: 2.5, ry: -(a + Math.PI / 2) }));
      }
      out.push(cyl(sx * 1.3, 0.1, 0.2, 0.08, '#4a382a', { y: 2.46 }));
    }
    // 二层跑马廊窄楼板（天井三面）+ 木栏杆（沿天井三面）
    out.push(box(0, 0.36, 3.8, 0.1, 0.6, wood, { y: 3.9 }));
    for (const sx of [-1, 1]) out.push(box(sx * 1.78, 2.4, 0.6, 0.1, 4.0, wood, { y: 3.9 }));
    const rail = (axis, fixed, a0, a1, n) => {
      const c = (a0 + a1) / 2, len = a1 - a0, bw = len / n - 0.02;
      if (axis === 'x') {
        out.push(box(c, fixed, len, 0.07, 0.07, woodD, { y: 4.34 }));
        out.push(box(c, fixed, len, 0.06, 0.06, woodD, { y: 4.04 }));
        for (let i = 0; i < n; i++) out.push(box(a0 + (i + 0.5) * (len / n), fixed, bw, 0.4, 0.05, wood2, { y: 4.0 }));
      } else {
        out.push(box(fixed, c, 0.07, 0.07, len, woodD, { y: 4.34 }));
        out.push(box(fixed, c, 0.06, 0.06, len, woodD, { y: 4.04 }));
        for (let i = 0; i < n; i++) out.push(box(fixed, a0 + (i + 0.5) * (len / n), 0.05, 0.4, bw, wood2, { y: 4.0 }));
      }
    };
    rail('x', 0.36, -1.75, 1.75, 6);
    rail('z', -1.72, 0.4, 4.4, 7);
    rail('z', 1.72, 0.4, 4.4, 7);
    // 跑马廊栏杆加万字纹斜棂（细条，控制总量）
    for (const sx of [-1, 1]) for (const [zc, rx] of [[1.4, 0.75], [2.8, -0.75]])
      out.push(box(sx * 1.76, zc, 0.05, 0.3, 0.07, woodD, { y: 4.02, rx }));
    return out;
  } };
