// 庐山民居（外景）：赣派民居（造型复用江西民居做法）+ 直瀑 + 溪流
// 场景模块只依赖 stages.js 导出的 kit（见 docs/scene-authoring.md）
import { kit } from '../stages.js';

export const lushanStage = {
  id: 'lushan', group: 'outdoor', grid: 1,
  // 民居在画面右前景、瀑布在左中景（已按 16:9 逐点投影核算取景）
  view: { pos: [33, 10.5, 40], target: [-8, 15.5, -11], lens: 25 },
  build: () => {
    const { box, cyl, cone, sph, prism, wallRun, tree, rng } = kit;
    // 克制配色（岩 / 苔 / 水 / 云 / 民居木瓦石）
    const rock = '#8d8f8a', rock2 = '#a5a7a1', rock3 = '#7c8079';
    const moss = '#8e9a86', moss2 = '#7d8a76';
    const water = '#b7d6e8', ice = '#eaf5fb', ice2 = '#d5e9f4', white = '#ffffff';
    const brick = '#77828a', brick2 = '#69737a', plaster = '#ece7dc';
    const tile = '#5f676e', tile2 = '#4b525a', wood = '#6b4a2f', wood2 = '#8a6440';
    const stone = '#9aa0a0', red = '#a3352c';
    const r = rng(77);
    const out = [];
    // 岩体 / 水面一律显式 occlude:false —— 不被「去掉墙壁遮挡」吞掉

    /* ===== 0. 谷地地面 ===== */
    out.push(box(0, 0, 150, 0.06, 150, moss, { y: -0.06, occlude: false }));
    out.push(box(-8, 2, 34, 0.05, 26, moss2, { y: 0.01, occlude: false }));
    out.push(box(17, -9, 30, 0.05, 20, moss, { y: 0.02, occlude: false }));
    out.push(box(-26, -8, 15, 0.04, 9, moss2, { y: 0.02, occlude: false }));

    /* ===== 1. 崖壁：三级岩层 + 崖顶后倾 + 岩层棱线 / 裂隙 ===== */
    const cliff = (x, z, w, h, d, c, y) => out.push(box(x, z, w, h, d, c, { y, occlude: false }));
    // 崖脚 y 0~8（面 z=-20）
    cliff(-46, -25, 12, 8.4, 10, rock, 0);
    cliff(-35, -25.5, 10.5, 8, 11, rock2, 0);
    cliff(-25.4, -24.6, 9.6, 8.6, 9.4, rock, 0);
    cliff(-16.4, -25, 9, 7.8, 10, rock3, 0);
    cliff(-8, -25.4, 8, 8.2, 10.6, rock, 0);
    // 二层 y 7~21（面 z=-22）
    cliff(-44, -27, 13, 14, 11, rock3, 7);
    cliff(-32, -27.5, 12, 14.6, 12, rock, 6.6);
    cliff(-22, -26.5, 11, 13.6, 10, rock2, 7);
    cliff(-12, -27, 10, 14.2, 11, rock3, 6.8);
    // 三层 y 20~38（面 z=-24）
    cliff(-42, -30, 15, 18, 12, rock2, 20);
    cliff(-28, -30.5, 14, 18.6, 13, rock, 19.6);
    cliff(-14, -29.5, 13, 17.6, 11, rock3, 20);
    // 崖顶平台 y 38~45（面 z=-27，整体后倾）
    cliff(-38, -33, 20, 7, 12, rock, 38);
    cliff(-20, -33.5, 18, 6.6, 13, rock2, 38.4);
    // 崖背山体补体积
    cliff(-30, -44, 52, 44, 14, rock3, 0);
    // 岩层棱线：按高度落在对应岩层面上，且避开瀑布 x 范围（-30.6~-20.4）
    const faceZ = (y) => (y < 8 ? -19.5 : y < 21 ? -21.5 : y < 38 ? -23.5 : -26.5);
    for (const [x, y, w] of [[-46, 4.2, 20], [-43, 13, 22], [-42, 26, 22], [-42, 34, 22], [-15, 5, 13], [-14, 13.5, 13], [-14, 25, 13]])
      cliff(x, faceZ(y), w, 0.34, 0.8, rock2, y);
    // 竖向裂隙
    for (const [x, y, h] of [[-49.4, 3, 9], [-39, 16, 11], [-11.6, 12, 10]]) cliff(x, faceZ(y) - 0.1, 0.3, h, 0.5, rock3, y);

    /* ===== 2. 瀑布：一道直瀑（纵向水帘 + 瀑口岩唇 + 瀑底水台）===== */
    // 瀑道岩壁：把三级岩层的退进补平，直瀑沿同一面岩壁垂落（贴着岩面，不悬空）
    out.push(box(-25.5, -24.5, 11.2, 22, 8, rock3, { y: 8, occlude: false }));
    out.push(box(-25.5, -24, 11.2, 14.4, 7, rock3, { y: 29.6, occlude: false }));
    out.push(box(-25.5, -19.6, 10.8, 2.2, 1.6, rock2, { y: 42.6, occlude: false }));   // 瀑口岩唇（水从崖顶翻出）
    const fall = (x0, x1, y0, y1, zc, n) => {
      const step = (x1 - x0) / n;
      for (let i = 0; i < n; i++) {
        const cx = x0 + step * (i + 0.5);
        out.push(box(cx, zc + (r() - 0.5) * 0.6, step * (0.84 + r() * 0.22), y1 - y0,
          0.16 + r() * 0.2, [white, ice, ice2, ice][i % 4], { y: y0, occlude: false }));
      }
      out.push(box((x0 + x1) / 2, zc + 0.5, x1 - x0 + 0.9, 0.46, 1.0, white, { y: y0 - 0.24, occlude: false }));
    };
    fall(-30.6, -20.4, 0.5, 44, -19.3, 11);
    out.push(box(-25.5, -18.1, 7.4, 0.36, 1.2, white, { y: 0.46, occlude: false }));   // 瀑底水帘底缘

    /* ===== 2.5 崖肩凸台：瀑布两侧的悬挑岩台（左高右低，台面平整、可站人偶）===== */
    // 左凸台（高，苔顶面 y≈22.6）：从左侧崖面斜插到瀑布左缘，台尖悬在瀑面前
    out.push(box(-35.2, -19.2, 11.2, 2.2, 10.4, rock3, { y: 20, ry: -0.1, occlude: false }));   // 悬挑主岩板
    out.push(box(-36.4, -19.6, 9.6, 3.6, 7.6, rock2, { y: 16.6, ry: -0.1, occlude: false }));  // 根部支撑（贴回崖面）
    out.push(box(-35.2, -19.2, 10.4, 0.42, 9.6, moss, { y: 22.2, ry: -0.1, occlude: false })); // 苔顶台面（人偶站位）
    out.push(box(-39.6, -21.4, 2.2, 1.1, 2.4, rock3, { y: 22.6, ry: 0.4, occlude: false }));   // 台面碎石
    out.push(box(-31.8, -15.9, 1.8, 0.7, 1.9, moss2, { y: 22.6, ry: -0.3, occlude: false }));  // 台缘草丛
    // 右凸台（低，苔顶面 y≈12.8）：从右侧崖面斜插到瀑布右缘
    out.push(box(-16.6, -18.4, 10.2, 1.9, 9.6, rock3, { y: 10.5, ry: 0.1, occlude: false }));  // 悬挑主岩板
    out.push(box(-12.6, -20.2, 6.4, 4.2, 6.4, rock2, { y: 6.6, ry: 0.1, occlude: false }));    // 根部支撑
    out.push(box(-16.6, -18.4, 9.4, 0.4, 8.8, moss, { y: 12.4, ry: 0.1, occlude: false }));    // 苔顶台面（人偶站位）
    out.push(box(-11.6, -21.6, 1.9, 0.9, 2.1, rock3, { y: 12.8, ry: -0.35, occlude: false })); // 台面碎石

    /* ===== 3. 瀑底水潭：水面 + 泡沫环 + 水花 + 潭边岩 ===== */
    const PX = -25.5, PZ = -15;
    out.push(box(PX, PZ, 13, 0.12, 8.6, water, { y: 0.1, occlude: false }));
    out.push(cyl(PX - 5.4, PZ - 0.5, 3.6, 0.12, water, { y: 0.1, occlude: false }));
    out.push(cyl(PX + 5.8, PZ + 0.7, 3.2, 0.12, water, { y: 0.1, occlude: false }));
    out.push(box(PX, -18.3, 8.8, 0.1, 1.8, white, { y: 0.17, occlude: false }));
    out.push(box(PX - 1.4, -17.1, 5.2, 0.08, 1.2, ice, { y: 0.22, occlude: false }));
    for (let i = 0; i < 6; i++) out.push(sph(PX - 2.8 + i * 1.1, -17.2 - r() * 0.9, 0.42 + r() * 0.5, white, { y: 0.18, occlude: false }));
    for (const [x, z, w, ry] of [[-32, -14.6, 3.6, 0.18], [-28.8, -10.4, 3.2, -0.5], [-22.6, -10.3, 3.4, 0.4], [-18.8, -14.2, 3.2, -0.2], [-26.8, -18.6, 3, 0.1]])
      out.push(box(x, z, w, 0.08, 0.9, white, { y: 0.15, ry, occlude: false }));
    out.push(cyl(-33.4, -17.2, 1.9, 1.7, rock3, { occlude: false }));
    out.push(cyl(-30.6, -10.6, 1.4, 2.1, rock3, { occlude: false }));
    out.push(box(-20.6, -18, 3.2, 1.8, 2.2, rock3, { ry: 0.3, occlude: false }));
    out.push(cyl(-17.8, -15.4, 1.6, 1.5, rock3, { occlude: false }));
    out.push(box(-26.4, -9.8, 2.8, 1.2, 1.6, rock3, { ry: -0.2, occlude: false }));

    /* ===== 4. 右侧山坡 / 岩体（在民居之后，做纵深层次）===== */
    out.push(box(-4, -21, 22, 9, 14, moss, { ry: 0.16, occlude: false }));
    out.push(box(16, -14, 22, 6, 12, moss, { ry: -0.12, occlude: false }));
    out.push(box(-10, -23.5, 14, 11, 9, rock, { ry: 0.12, occlude: false }));
    out.push(box(4, -12, 12, 3.2, 9, moss2, { ry: 0.2, occlude: false }));
    out.push(box(-5, -19.6, 4.2, 2.6, 3.4, rock2, { y: 8.4, ry: 0.3, occlude: false }));
    out.push(cyl(11, -15.4, 2.2, 2.4, rock3, { y: 5.6, occlude: false }));

    /* ===== 5. 溪流：从水潭引向民居前（逐渐变宽）+ 卵石岸 ===== */
    const S0 = [-20, -12.2], S1 = [6, 6.6];
    const segAng = Math.atan2(S1[1] - S0[1], S1[0] - S0[0]);
    const dir = [Math.cos(segAng), Math.sin(segAng)], perp = [-dir[1], dir[0]];
    const span = Math.hypot(S1[0] - S0[0], S1[1] - S0[1]);
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6;
      out.push(box(S0[0] + (S1[0] - S0[0]) * t, S0[1] + (S1[1] - S0[1]) * t, span / 6 + 0.9, 0.09,
        2.0 + i * 0.28, water, { y: 0.08, ry: -segAng, occlude: false }));
    }
    for (let i = 0; i < 6; i++) {
      const t = 0.12 + i * 0.16, s = i % 2 ? 1 : -1, off = 1.5 + i * 0.26 + r() * 0.5;
      out.push(sph(S0[0] + (S1[0] - S0[0]) * t + perp[0] * off * s, S0[1] + (S1[1] - S0[1]) * t + perp[1] * off * s,
        0.4 + r() * 0.3, i % 3 ? rock2 : rock3, { y: 0, occlude: false }));
    }

    /* ===== 6. 石砌台地 + 五级石阶 ===== */
    const HX = 16.5, HZ = 0, B = 1.2, FZ = HZ + 4.5, gz = HZ + 4.68, gb = HZ - 4.68;
    out.push(box(HX, HZ + 1.5, 13, B, 16, stone, { y: 0, occlude: false }));
    out.push(box(HX, 9.62, 13.3, 0.22, 0.5, rock2, { y: B - 0.22, occlude: false }));
    out.push(box(23.12, HZ + 1.5, 0.5, 0.22, 16.3, rock2, { y: B - 0.22, occlude: false }));
    for (let i = 0; i < 3; i++) out.push(box(HX, 9.62, 13.1, 0.07, 0.26, i % 2 ? rock3 : rock2, { y: 0.16 + i * 0.34, occlude: false }));
    for (let i = 0; i < 5; i++) out.push(box(HX, 9.66 + i * 0.42, 3.0, 1.0 - i * 0.2, 0.42, stone, { y: 0, occlude: false }));

    /* ===== 7. 民居主体：白灰墙 + 青砖墙裙 + 双坡青瓦 + 五级马头墙 ===== */
    out.push(box(HX, HZ, 7.5, 4.2, 9, plaster, { y: B, occlude: false }));
    out.push(box(HX, FZ + 0.02, 7.56, 1.35, 0.14, brick, { y: B, occlude: false }));
    out.push(box(HX + 3.77, HZ, 0.14, 1.35, 9.06, brick, { y: B, occlude: false }));
    out.push(box(HX, FZ + 0.06, 7.7, 0.1, 0.22, stone, { y: B + 1.35, occlude: false }));
    out.push(box(HX + 3.78, HZ, 0.22, 0.1, 9.1, stone, { y: B + 1.35, occlude: false }));
    // 正面马头墙：五级跌级（墙身 + 两道叠涩 + 瓦压顶）
    const gseg = (x0, x1, top) => {
      const cx = (x0 + x1) / 2, w = x1 - x0;
      out.push(box(cx, gz, w, top - 4.2, 0.36, brick2, { y: B + 4.2 }));
      out.push(box(cx, gz, w + 0.14, 0.09, 0.5, rock2, { y: B + top - 0.5 }));
      out.push(box(cx, gz, w + 0.26, 0.09, 0.58, rock2, { y: B + top - 0.29 }));
      out.push(box(cx, gz, w + 0.4, 0.12, 0.62, tile2, { y: B + top }));
    };
    gseg(12.75, 13.95, 4.95);
    gseg(13.95, 15.25, 5.5);
    gseg(15.25, 17.75, 6.05);
    gseg(17.75, 19.05, 5.5);
    gseg(19.05, 20.25, 4.95);
    for (const x of [12.75, 20.25]) out.push(box(x, gz, 0.66, 0.66, 0.86, brick2, { y: B + 4.34 }));
    out.push(box(HX, gz + 0.22, 0.62, 0.62, 0.08, brick2, { y: B + 4.62 }));   // 马头墙心漏窗
    out.push(box(HX, gz + 0.27, 0.4, 0.4, 0.06, tile2, { y: B + 4.72 }));
    // 背面跌级剪影（简化三段）
    for (const [x0, x1, top] of [[12.75, 14.1, 4.9], [14.1, 18.9, 5.9], [18.9, 20.25, 4.9]]) {
      out.push(box((x0 + x1) / 2, gb, x1 - x0, top - 4.2, 0.36, brick2, { y: B + 4.2 }));
      out.push(box((x0 + x1) / 2, gb, x1 - x0 + 0.4, 0.12, 0.62, tile2, { y: B + top }));
    }
    // 双坡青瓦：脊 x=HX（沿 z），出檐 0.35m + 瓦垄 + 屋脊翘角 + 檐口封边
    const half = 4.1, rise = 1.4, slen = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    out.push(box(HX - half / 2, HZ, slen, 0.14, 9.4, tile, { y: B + 4.2 + rise / 2, rz: ang, occlude: true }));
    out.push(box(HX + half / 2, HZ, slen, 0.14, 9.4, tile, { y: B + 4.2 + rise / 2, rz: -ang, occlude: true }));
    out.push(box(HX, HZ, 0.3, 0.26, 9.6, tile2, { y: B + 5.6, occlude: true }));
    out.push(box(HX, FZ + 0.36, 0.3, 0.3, 0.5, tile2, { y: B + 5.66, rx: -0.4, occlude: true }));
    out.push(box(HX, HZ - 4.86, 0.3, 0.3, 0.5, tile2, { y: B + 5.66, rx: 0.4, occlude: true }));
    for (let i = 0; i < 5; i++) {
      const z = HZ - 3.6 + i * 1.8;
      out.push(box(HX - half / 2, z, slen + 0.1, 0.06, 0.09, tile2, { y: B + 4.2 + rise / 2 + 0.1, rz: ang, occlude: true }));
      out.push(box(HX + half / 2, z, slen + 0.1, 0.06, 0.09, tile2, { y: B + 4.2 + rise / 2 + 0.1, rz: -ang, occlude: true }));
    }
    out.push(box(HX - 4.1, HZ, 0.16, 0.2, 9.4, tile2, { y: B + 4.12, occlude: true }));
    out.push(box(HX + 4.1, HZ, 0.16, 0.2, 9.4, tile2, { y: B + 4.12, occlude: true }));
    // 檐下木构：檐檩 + 椽条 + 檐枋（可预制的两侧檐口）
    out.push(box(HX + 3.95, HZ, 0.16, 0.16, 9.2, wood2, { y: B + 4.06, occlude: true }));
    for (let i = 0; i < 6; i++) out.push(box(HX + 3.95, HZ - 3.5 + i * 1.4, 0.7, 0.09, 0.08, wood2, { y: B + 4.1, occlude: true }));
    out.push(box(HX + 3.84, HZ, 0.16, 0.3, 9.2, wood, { y: B + 3.85 }));

    /* ===== 8. 正面：石库门 + 砖雕门罩 + 木格窗 + 灯笼 ===== */
    for (const s of [-1, 1]) out.push(box(HX + s * 0.72, FZ + 0.04, 0.18, 2.36, 0.2, wood, { y: B, occlude: false }));
    out.push(box(HX, FZ + 0.04, 1.62, 0.18, 0.22, wood2, { y: B + 2.3 }));
    for (const s of [-1, 1]) out.push(box(HX + s * 0.32, FZ + 0.02, 0.6, 2.2, 0.1, wood2, { y: B, occlude: false }));
    out.push(box(HX, FZ + 0.06, 1.66, 0.16, 0.42, stone, { y: B, occlude: false }));
    for (const s of [-1, 1]) out.push(box(HX + s * 0.34, FZ + 0.16, 0.16, 0.18, 0.22, wood2, { y: B + 2.5 }));
    out.push(box(HX, FZ + 0.2, 3.8, 0.26, 0.4, brick, { y: B + 2.72 }));
    out.push(box(HX, FZ + 0.25, 4.2, 0.22, 0.5, rock2, { y: B + 2.98 }));
    out.push(box(HX, FZ + 0.3, 4.6, 0.2, 0.6, brick, { y: B + 3.2 }));
    out.push(box(HX, FZ + 0.36, 4.9, 0.12, 0.72, tile2, { y: B + 3.4 }));
    out.push(box(HX - 2.45, FZ + 0.36, 0.5, 0.3, 0.34, tile2, { y: B + 3.46, rz: 0.4 }));
    out.push(box(HX + 2.45, FZ + 0.36, 0.5, 0.3, 0.34, tile2, { y: B + 3.46, rz: -0.4 }));
    out.push(box(HX, FZ + 0.22, 1.5, 0.36, 0.08, plaster, { y: B + 2.68 }));
    for (const s of [-1, 1]) {
      const x = HX + s * 2.6;
      out.push(box(x, FZ + 0.05, 1.44, 1.24, 0.14, wood, { y: B + 1.5, occlude: false }));
      out.push(box(x, FZ + 0.1, 1.16, 0.98, 0.06, tile2, { y: B + 1.63 }));
      for (const d of [-0.3, 0.3]) out.push(box(x + d, FZ + 0.13, 0.06, 0.98, 0.05, wood2, { y: B + 1.63 }));
      out.push(box(x, FZ + 0.13, 1.16, 0.05, 0.05, wood2, { y: B + 2.12 }));
      out.push(box(x, FZ + 0.08, 1.62, 0.1, 0.3, stone, { y: B + 1.4 }));
      out.push(box(x, FZ + 0.12, 1.72, 0.12, 0.24, brick2, { y: B + 2.74 }));
    }
    for (const s of [-1, 1]) {
      const x = HX + s * 1.15;
      out.push(cyl(x, FZ + 0.34, 0.014, 0.5, wood, { y: B + 2.18 }));
      out.push(cyl(x, FZ + 0.34, 0.22, 0.06, wood2, { y: B + 2.08 }));
      out.push(cyl(x, FZ + 0.34, 0.19, 0.34, red, { y: B + 1.74 }));
    }
    // 右侧山墙木格窗
    out.push(box(HX + 3.79, HZ + 1.6, 0.12, 1.24, 1.5, wood, { y: B + 1.7, occlude: false }));
    out.push(box(HX + 3.84, HZ + 1.6, 0.06, 0.98, 1.3, tile2, { y: B + 1.83 }));
    for (const d of [-0.42, 0, 0.42]) out.push(box(HX + 3.87, HZ + 1.6 + d, 0.05, 0.98, 0.05, wood2, { y: B + 1.83 }));

    /* ===== 9. 屋前小院：矮石墙 + 竹篱 + 石缸 + 柴垛 ===== */
    out.push(...wallRun('x', 9.38, 10, 15, { h: 0.66, t: 0.3, color: stone, y: B }));
    out.push(...wallRun('x', 9.38, 18, 23, { h: 0.66, t: 0.3, color: stone, y: B }));
    out.push(box(12.5, 9.38, 5, 0.1, 0.42, rock2, { y: B + 0.66 }));
    out.push(box(20.5, 9.38, 5, 0.1, 0.42, rock2, { y: B + 0.66 }));
    for (const y of [0.5, 0.9]) out.push(box(22.9, 7.2, 0.06, 0.06, 4.2, wood2, { y: B + y }));
    for (let i = 0; i < 5; i++) out.push(box(22.9, 5.4 + i * 0.9, 0.07, 1.05, 0.07, wood2, { y: B }));
    out.push(cyl(11.4, 7.6, 0.55, 0.7, stone));
    out.push(cyl(11.4, 7.6, 0.48, 0.06, water, { y: B + 0.7 }));
    out.push(sph(11.3, 7.5, 0.14, moss2, { y: B + 0.74 }));
    for (let j = 0; j < 2; j++) for (let k = 0; k < 3; k++)
      out.push(cyl(20.2 + k * 0.26, 7.6 - j * 0.14, 0.11, 1.1, (j + k) % 2 ? wood : wood2, { y: B + 0.11 + j * 0.2, rz: Math.PI / 2 }));

    /* ===== 10. 植被：崖顶 / 坡上松树 + 阔叶树 + 灌木苔石 + 崖缝草 ===== */
    for (const [x, z, s, b] of [[-44, -33, 1.5, 45], [-35, -32, 1.3, 45], [-24, -33, 1.45, 45], [-16, -31, 1.2, 45]])
      out.push(...tree(x, z, s, true, b));
    for (const [x, z, s, b] of [[-8, -22, 1.2, 9], [1, -19, 1.0, 9], [11, -16, 1.1, 6], [20, -12, 1.0, 6]])
      out.push(...tree(x, z, s, true, b));
    out.push(...tree(-9, 7, 1.3));
    out.push(...tree(5, 13, 1.1));
    out.push(sph(-14, -6, 1.1, moss2, { y: 0 }));
    out.push(sph(-13.2, -8, 0.85, moss2, { y: 0 }));
    out.push(sph(7, 10.5, 0.9, moss2, { y: 0 }));
    out.push(cyl(-3, 9, 1.1, 0.9, rock2, { occlude: false }));
    out.push(box(-16, 3, 2.2, 0.8, 1.8, rock3, { ry: 0.4, occlude: false }));
    out.push(cyl(8, 13, 0.9, 0.7, rock2, { occlude: false }));
    out.push(box(24.2, 6, 2.6, 1.0, 2.0, rock3, { ry: -0.3, occlude: false }));
    for (const [x, y, h] of [[-47, 6.4, 1.5], [-36, 13, 1.3], [-15, 8.4, 1.4], [-11, 22, 1.2]])
      out.push(cone(x, faceZ(y) + 0.3, 0.7, h, moss2, { y, occlude: false }));

    /* ===== 11. 远山剪影（在崖壁之后 / 两侧）===== */
    out.push(prism(-34, -58, 54, 58, 22, rock2, { occlude: false }));
    out.push(prism(-4, -54, 40, 50, 18, rock2, { ry: 0.22, occlude: false }));
    out.push(prism(24, -46, 38, 34, 16, rock2, { ry: -0.18, occlude: false }));

    return out;
  },
};
