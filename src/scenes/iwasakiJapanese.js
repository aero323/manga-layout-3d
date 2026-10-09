// 旧岩崎邸 和館（内景）：書院造の大広間 — 48 帖畳 + 床の間 / 違い棚 / 欄間 + 格子障子 + 広縁 + 庭
// 场景任务产物：只依赖 kit（见 stages.js 末尾的 kit 导出），不 import 其它模块
import { kit } from '../stages.js';

export const iwasakiJapaneseStage = {
  id: 'iwasakiJapanese', group: 'room', grid: 0.1,
  view: { pos: [0.4, 1.3, 4.5], target: [-3.2, 1.05, -2.8], lens: 30 },
  build: () => {
    const { box, cyl, sph, prism, wallRun, tree, C } = kit;
    const out = [];
    /* 配色：14 种，低饱和（和室用木色 / 纸白 / 苔绿） */
    const tatami = C.tatami, edgeC = '#4a3a2a', wood = '#8a6440', woodD = '#5c4128', woodL = '#c9a06b',
      plaster = '#efe9dc', paper = '#f4f1e6', panel = '#ece8dc', stone = '#9aa0a0', brass = '#c9a45c',
      red = '#a04a3c', navy = '#3b4a63', moss = C.grass2, water = C.water;

    /* ===== 1. 地面：木基座 + 畳缘层 + 24 帖榻榻米（六畳 + 四畳 错缝铺） ===== */
    const U = 0.94, FW = 12 * U - 0.03, FD = 8 * U - 0.03;                 // 室内 11.25 × 7.49
    const X0 = -FW / 2, Z0 = -1.94, CZ = Z0 + FD / 2;
    out.push(box(0, CZ, FW + 0.7, 0.11, FD + 0.7, woodD, { y: 0, occlude: false }));   // 房间地板基座
    out.push(box(0, CZ, FW, 0.05, FD, edgeC, { y: 0.11, occlude: false }));            // 畳缘层（缝隙里露出深色边）
    const tatH = (a, b) => out.push(box(X0 + U * (a + 1), Z0 + U * (b + 0.5), 1.82, 0.06, 0.91, tatami, { y: 0.13, occlude: false }));
    const tatV = (a, b) => out.push(box(X0 + U * (a + 0.5), Z0 + U * (b + 1), 0.91, 0.06, 1.82, tatami, { y: 0.13, occlude: false }));
    const sixJo = (c, r0) => { tatH(c, r0); tatH(c + 2, r0); for (let i = 0; i < 4; i++) tatV(c + i, r0 + 1); };
    const fourJo = (c, r0) => { tatV(c, r0); tatH(c + 1, r0); tatV(c + 3, r0); tatH(c + 1, r0 + 1); };
    for (const c0 of [0, 4, 8]) { sixJo(c0, 0); fourJo(c0, 3); sixJo(c0, 5); }          // 18 + 12 + 18 = 48 帖

    /* ===== 2. 墙体：东 / 南 / 北 / 西（朝庭园一面为障子开口）+ 床の間凹间 ===== */
    out.push(...wallRun('z', 5.685, -2.1, 5.67, { h: 2.78, t: 0.12, color: plaster }));          // 东墙
    out.push(...wallRun('x', 5.61, -5.745, 5.745, { h: 2.78, t: 0.12, color: plaster }));        // 南墙
    out.push(...wallRun('x', -2.0, 2.8, 5.745, { h: 2.78, t: 0.12, color: plaster,              // 北墙东段（含襖洞）
      openings: [{ start: 3.35, end: 5.15, y0: 0, y1: 2.02 }] }));
    out.push(...wallRun('x', -2.0, -1.605, -1.0, { h: 2.78, t: 0.12, color: plaster }));         // 北墙短垛
    out.push(box(-3.615, -2.0, 4.02, 0.72, 0.12, plaster, { y: 2.06, occlude: true }));         // 障子开口上方
    out.push(box(-1.0, -2.29, 0.1, 2.37, 0.7, plaster, { y: 0, occlude: true }));               // 床の間西侧壁
    out.push(box(2.8, -2.29, 0.1, 2.37, 0.7, plaster, { y: 0, occlude: true }));                // 床脇东侧壁
    out.push(box(0.9, -2.6, 3.8, 2.37, 0.1, plaster, { y: 0, occlude: true }));                 // 床の間 / 床脇后壁
    out.push(box(0.9, -2.29, 3.8, 0.06, 0.7, panel, { y: 2.31, occlude: true }));               // 凹间落し天井
    out.push(...wallRun('z', -5.685, 0.0, 5.67, { h: 2.78, t: 0.12, color: plaster }));          // 西墙南段
    out.push(box(-5.685, -0.97, 0.12, 0.72, 1.94, plaster, { y: 2.06, occlude: true }));        // 西侧障子开口上方
    out.push(box(-5.615, 2.83, 0.07, 0.5, 5.6, wood, { y: 0.19 }));                              // 西墙腰板

    /* ===== 3. 竿縁天井（两方向细木条 + 回缘） ===== */
    out.push(box(0, 1.475, FW + 0.5, 0.1, FD + 0.86, panel, { y: 2.78, occlude: true }));
    for (let i = 0; i < 5; i++) out.push(box(0, -1.7 + i * 1.5, FW + 0.3, 0.05, 0.06, woodL, { y: 2.72, occlude: true }));
    for (const x of [-3.6, 3.6]) out.push(box(x, 1.475, 0.06, 0.05, FD + 0.7, woodL, { y: 2.72, occlude: true }));
    out.push(box(0, -2.58, FW + 0.3, 0.09, 0.1, wood, { y: 2.7, occlude: true }));
    out.push(box(0, 5.53, FW + 0.3, 0.09, 0.1, wood, { y: 2.7, occlude: true }));
    out.push(box(-5.62, 1.475, 0.1, 0.09, FD + 0.5, wood, { y: 2.7, occlude: true }));
    out.push(box(5.62, 1.475, 0.1, 0.09, FD + 0.5, wood, { y: 2.7, occlude: true }));

    /* ===== 4. 结构线：长押 + 柱（角柱 / 床柱） ===== */
    out.push(box(4.2125, -1.91, 2.825, 0.11, 0.06, wood, { y: 1.86 }));
    out.push(box(5.61, 1.755, 0.06, 0.11, 7.71, wood, { y: 1.86 }));
    out.push(box(0, 5.53, FW, 0.11, 0.06, wood, { y: 1.86 }));
    out.push(box(-5.61, 2.805, 0.06, 0.11, 5.61, wood, { y: 1.86 }));
    for (const [x, z] of [[5.62, -2.0], [5.62, 5.58], [-5.62, 5.58], [-5.62, -0.03], [-1.605, -2.0], [-5.62, -1.97]])
      out.push(box(x, z, 0.12, 2.78, 0.12, woodD, { y: 0 }));                      // 角柱（深木色）
    out.push(box(0.9, -1.99, 0.13, 2.37, 0.13, woodD, { y: 0 }));                       // 床柱

    /* ===== 5. 床の間（开口 1.8 × 进深 0.7、床框抬高 0.15）+ 掛軸 + 花瓶 + 落し掛 ===== */
    out.push(box(-0.1, -2.29, 1.8, 0.15, 0.7, woodL, { y: 0.05, occlude: false }));    // 床板
    out.push(box(-0.1, -1.98, 1.86, 0.07, 0.14, woodD, { y: 0.15 }));                   // 床框
    out.push(box(-0.1, -2.52, 0.66, 1.0, 0.03, paper, { y: 1.06 }));                    // 掛軸画心
    out.push(box(-0.1, -2.51, 0.8, 0.08, 0.06, woodD, { y: 2.06 }));                    // 上轴
    out.push(box(-0.1, -2.51, 0.8, 0.08, 0.06, woodD, { y: 1.0 }));                     // 下轴
    out.push(cyl(-0.62, -2.3, 0.12, 0.42, brass, { y: 0.2 }));                          // 花瓶
    out.push(box(-0.62, -2.3, 0.04, 0.46, 0.04, moss, { y: 0.62 }));                    // 花枝
    out.push(box(-0.1, -1.98, 1.9, 0.09, 0.16, woodD, { y: 2.28 }));                    // 落し掛

    /* ===== 6. 違い棚 + 地袋（床脇） ===== */
    out.push(box(1.875, -2.29, 1.85, 0.15, 0.7, wood, { y: 0.05, occlude: false }));   // 床脇底板
    out.push(box(2.0, -2.32, 1.7, 0.52, 0.56, woodD, { y: 0.19 }));                     // 地袋
    out.push(box(2.0, -2.03, 1.5, 0.4, 0.03, woodL, { y: 0.26 }));                      // 地袋引户
    out.push(box(1.72, -2.25, 1.3, 0.055, 0.44, woodL, { y: 0.86 }));                   // 下棚（低）
    out.push(box(2.3, -2.25, 0.8, 0.055, 0.44, woodL, { y: 1.44 }));                    // 上棚（高）
    out.push(box(2.0, -2.25, 0.06, 0.52, 0.42, woodL, { y: 0.91 }));                    // 仕切板
    out.push(box(1.14, -2.25, 0.07, 1.25, 0.07, woodL, { y: 0.19 }));                   // 支柱

    /* ===== 7. 欄間（透雕花格：上下框 + 中横木 + 竖条） ===== */
    out.push(box(0.9, -1.99, 3.8, 0.07, 0.1, woodD, { y: 2.36 }));
    out.push(box(0.9, -1.99, 3.8, 0.07, 0.1, woodD, { y: 2.71 }));
    out.push(box(0.9, -1.99, 3.8, 0.045, 0.06, woodL, { y: 2.51 }));
    for (let i = 0; i < 4; i++) out.push(box(-0.6 + i * 1.0, -1.99, 0.05, 0.28, 0.06, woodL, { y: 2.405 }));
    out.push(box(0.9, -2.12, 3.8, 0.42, 0.05, panel, { y: 2.36, occlude: true }));      // 欄間背板

    /* ===== 8. 襖（两扇 + 引手，北墙东段） ===== */
    out.push(box(3.8, -1.97, 0.88, 1.98, 0.05, panel, { y: 0.02 }));
    out.push(box(4.7, -1.97, 0.88, 1.98, 0.05, panel, { y: 0.02 }));
    out.push(box(3.53, -1.93, 0.06, 0.16, 0.05, brass, { y: 0.95 }));
    out.push(box(4.97, -1.93, 0.06, 0.16, 0.05, brass, { y: 0.95 }));

    /* ===== 9. 格子障子（3 列 × 6 行棂条 + 半透明白纸）+ 鸭居 / 敷居 ===== */
    const shoji = (px, pz, w, dir, full) => {
      const H0 = 0.21, HH = 1.72, thin = 0.05;
      const B = (u, y, len, h, col, t = thin, o = 0) => {
        if (dir === 'x') out.push(box(px + u, pz + o, len, h, t, col, { y }));
        else out.push(box(px + o, pz + u, t, h, len, col, { y }));
      };
      B(0, H0 + HH - 0.07, w, 0.07, woodL);                                            // 上框
      B(0, H0, w, 0.09, woodL);                                                        // 下框
      B(-w / 2 + 0.03, H0, 0.06, HH, woodL);                                           // 左框
      B(w / 2 - 0.03, H0, 0.06, HH, woodL);                                            // 右框
      B(0, H0 + 0.06, w - 0.12, HH - 0.12, paper, 0.012, -0.012);                      // 障子纸
      if (full) {
        for (const k of [-1, 1]) B(k * (w - 0.12) / 6, H0 + 0.06, 0.028, HH - 0.12, woodL, 0.03, 0.012);
        for (let k = 1; k <= 5; k++) B(0, H0 + 0.06 + k * (HH - 0.12) / 6, w - 0.12, 0.028, woodL, 0.03, 0.012);
      }
    };
    out.push(box(-3.615, -1.98, 4.02, 0.05, 0.3, woodD, { y: 0.16 }));                 // 北：敷居
    out.push(box(-3.615, -1.98, 4.02, 0.1, 0.3, woodD, { y: 1.96 }));                  // 北：鸭居
    out.push(box(-5.685, -0.97, 0.3, 0.05, 1.94, woodD, { y: 0.16 }));                 // 西：敷居
    out.push(box(-5.685, -0.97, 0.3, 0.1, 1.94, woodD, { y: 1.96 }));                  // 西：鸭居
    shoji(-5.12, -1.9, 1.005, 'x', true);                                              // 北：正面 2 扇
    shoji(-4.115, -1.9, 1.005, 'x', true);
    shoji(-5.19, -2.06, 1.005, 'x', false);                                            // 北：拉开推在后轨的 2 扇
    shoji(-4.185, -2.06, 1.005, 'x', false);
    shoji(-5.685, -1.455, 0.97, 'z', true);                                            // 西：1 扇，南半留开口

    /* ===== 10. 広縁（木廊 1.2m + 缘梁 + 4 檐柱 + 低栏杆） ===== */
    out.push(box(-3.615, -2.54, 4.02, 0.14, 1.2, wood, { y: 0, occlude: false }));     // 北段
    out.push(box(-6.225, -1.07, 1.2, 0.14, 4.14, wood, { y: 0, occlude: false }));     // 西段
    out.push(box(-3.615, -3.08, 4.14, 0.16, 0.12, woodD, { y: 0.02 }));                // 北缘梁
    out.push(box(-6.79, -1.07, 0.12, 0.16, 4.2, woodD, { y: 0.02 }));                  // 西缘梁
    for (const [x, z] of [[-1.75, -3.0], [-4.3, -3.0], [-6.79, -3.0], [-6.79, 0.5]])
      out.push(box(x, z, 0.12, 2.6, 0.12, wood, { y: 0.14 }));                         // 4 檐柱
    out.push(box(-4.27, -3.0, 5.16, 0.14, 0.14, woodD, { y: 2.6 }));                   // 北檐枋
    out.push(box(-6.79, -1.25, 0.14, 0.14, 3.64, woodD, { y: 2.6 }));                  // 西檐枋
    out.push(box(-5.98, -3.0, 1.85, 0.08, 0.08, woodD, { y: 0.6 }));                   // 栏杆扶手（北）
    out.push(box(-6.79, -1.05, 0.08, 0.08, 3.7, woodD, { y: 0.6 }));                   // 栏杆扶手（西）
    for (let i = 0; i < 2; i++) out.push(box(-6.79, 0.15 + i * 1.7, 0.06, 0.46, 0.06, wood, { y: 0.14 }));

    /* ===== 11. 庭：苔地 + 池（石护岸）+ 雪見灯籠 + 飛石 + 松 + 竹篱 ===== */
    out.push(box(-6, -9.6, 26, 0.05, 12.9, moss, { y: 0, occlude: false }));           // 北侧苔地
    // 苔地上留出池口，池水抬到苔面之上（否则水面会被苔地整块盖住）
    out.push(box(-3.2, -8.4, 6.9, 0.05, 6.1, '#8e9a8a', { y: 0.048, occlude: false }));  // 池底
    out.push(box(-11.9, 2.4, 10.2, 0.05, 11.2, moss, { y: 0.001, occlude: false }));   // 西侧苔地
    out.push(box(-3.2, -8.4, 6.4, 0.03, 5.6, water, { y: 0.10, occlude: false }));     // 池水（在苔面之上）
    out.push(box(-3.2, -5.52, 6.8, 0.14, 0.34, stone, { y: 0.05 }));
    out.push(box(-3.2, -11.28, 6.8, 0.14, 0.34, stone, { y: 0.05 }));
    out.push(box(-6.55, -8.4, 0.34, 0.14, 5.94, stone, { y: 0.05 }));
    out.push(box(-4.6, -5.0, 0.72, 0.16, 0.72, stone, { y: 0.05 }));                    // 灯籠基座
    out.push(cyl(-4.6, -5.0, 0.11, 0.54, stone, { y: 0.21 }));                          // 灯籠脚
    out.push(box(-4.6, -5.0, 0.48, 0.44, 0.48, stone, { y: 0.75 }));                    // 火袋
    out.push(prism(-4.6, -5.0, 0.94, 0.36, 0.94, stone, { y: 1.19 }));                  // 笠
    out.push(sph(-4.6, -5.0, 0.11, stone, { y: 1.55 }));                                // 宝珠
    out.push(box(-2.5, -3.62, 0.58, 0.05, 0.46, stone, { y: 0.05 }));                   // 飛石 ×3
    out.push(box(-2.95, -4.36, 0.58, 0.05, 0.46, stone, { y: 0.05 }));
    out.push(box(-3.5, -5.06, 0.58, 0.05, 0.46, stone, { y: 0.05 }));
    out.push(...tree(-3.6, -6.6, 1.5, true));                                           // 松 ×2
    out.push(...tree(-7.4, -5.2, 1.7, true));
    out.push(box(-4, -12, 13, 0.06, 0.06, wood, { y: 1.1 }));                           // 竹篱横杆
    for (let i = 0; i < 4; i++) out.push(cyl(-8.6 + i * 2.5, -12, 0.05, 1.4, woodL, { y: 0 }));

    /* ===== 12. 室内陈设：座布団 / 火鉢 / 箪笥 / 行灯 / 香炉 / 茶具 ===== */
    out.push(box(-0.3, 2.9, 0.62, 0.08, 0.62, red, { y: 0.19, occlude: false }));
    out.push(box(1.15, 3.0, 0.62, 0.08, 0.62, navy, { y: 0.19, occlude: false }));
    out.push(box(2.5, 2.75, 0.62, 0.08, 0.62, red, { y: 0.19, occlude: false }));
    out.push(box(2.2, 2.2, 0.62, 0.34, 0.62, wood, { y: 0.19 }));                       // 火鉢木框
    out.push(box(2.2, 2.2, 0.48, 0.08, 0.48, stone, { y: 0.45 }));                      // 灰
    out.push(cyl(2.2, 2.2, 0.17, 0.26, brass, { y: 0.53 }));                            // 鉄瓶
    out.push(box(5.2, 0.6, 0.6, 1.0, 1.7, wood, { y: 0.19 }));                          // 箪笥
    out.push(box(4.9, 0.6, 0.03, 0.04, 1.5, woodD, { y: 0.62 }));
    out.push(box(4.5, 4.5, 0.44, 0.06, 0.44, woodD, { y: 0.19 }));                      // 行灯
    out.push(box(4.5, 4.5, 0.34, 0.46, 0.34, paper, { y: 0.25 }));
    out.push(box(4.5, 4.5, 0.44, 0.05, 0.44, woodD, { y: 0.71 }));
    out.push(cyl(5.2, 0.6, 0.1, 0.14, brass, { y: 1.19 }));                             // 香炉（箪笥上）
    out.push(cyl(3.6, 1.6, 0.3, 0.05, woodL, { y: 0.19 }));                             // 茶具小圆台
    out.push(sph(3.6, 1.6, 0.14, panel, { y: 0.24 }));                                  // 壶
    return out;
  },
};
