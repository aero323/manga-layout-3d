// 旧岩崎邸（外景）：洋館（英国雅各布样式・木造 2 階）+ 和館 + 撞球室 + 洋風庭園
// 参考：東京都文京区湯島「旧岩崎邸庭園」。1896 年竣工、設計ジョサイア・コンドル、三菱岩崎家本邸。
// 建模助手统一通过 kit 取得（见 stages.js 末尾的 kit 导出）；模块顶层调用 kit 之外的 import 一律禁止。
import { kit } from '../stages.js';

// 平面布局（米）：洋館 中心 (-10,-9) 24×15 南面朝庭园；和館 中心 (16,-8) 19×11.5；
// 撞球室 中心 (-22,2.75) 8×7（洋館南西角，连接廊相连）；池 中心 (-17,13) 12×8；
// 碎石路自南门 (x=-8) 直通玄関前，再向东折往和館。
export const iwasakiExteriorStage = {
  id: 'iwasakiExterior', group: 'outdoor', grid: 1,
  view: { pos: [20, 5.2, 22], target: [-5, 3.2, -3], lens: 26 },
  build: () => {
    const { box, cyl, cone, sph, prism, rng, tree } = kit;
    /* 调色板 14 色（奶油灰泥 / 灰蓝瓦 / 砖 / 木 / 玻璃 / 石铁 / 草 / 水 / 碎石） */
    const cream = '#ece7dc', cream2 = '#f3efe5';
    const tile = '#4b525a', tile2 = '#5f676e', brick = '#a9705f';
    const wood = '#6b4a2f', wood2 = '#8a6440', wood3 = '#573e28';
    const gl = '#cfe4f2', stone = '#9aa0a0', iron = '#8b9296';
    const grass = '#cbd9b4', water = '#b7d6e8', gravel = '#d8d2c4';
    const hedge = '#a8c59b';
    const r = rng(1896);
    const out = [];

    /* ===================== 1. 用地・草坪・碎石路 ===================== */
    out.push(box(0, 0, 56, 0.04, 50, gravel, { y: 0 }));                       // 基地
    out.push(box(0, 7, 52, 0.06, 34, grass, { y: 0.04 }));                          // 主草坪
    out.push(box(16, -18, 22, 0.06, 6, grass, { y: 0.04 }));                        // 和館北侧芝地
    out.push(box(-8, 13.5, 3.4, 0.07, 22, gravel, { y: 0.05 }));                    // 表门 → 玄関前
    out.push(box(-8, 1.0, 6.4, 0.07, 5.0, gravel, { y: 0.05 }));                    // 玄関前広場
    out.push(box(4.5, -0.4, 21, 0.07, 2.2, gravel, { y: 0.05 }));                   // 和館への中庭路

    /* ===================== 2. 池・雪見灯籠・飞石 ===================== */
    out.push(box(-17, 13, 12, 0.1, 8, water, { y: 0.06 }));                      // 池 12×8m
    out.push(box(-17, 17.35, 13.4, 0.3, 0.7, stone, { y: 0.04 }));                  // 石护岸（前）
    out.push(box(-17, 8.65, 13.4, 0.3, 0.7, stone, { y: 0.04 }));                   // 石护岸（後）
    out.push(box(-23.35, 13, 0.7, 0.3, 8, stone, { y: 0.04 }));                     // 石护岸（西）
    out.push(box(-10.65, 13, 0.7, 0.3, 8, stone, { y: 0.04 }));                     // 石护岸（東）
    for (const [bx, bz] of [[-23.9, 16.9], [-10.1, 9.1], [-23.8, 9.2], [-10.2, 16.8]]) {
      out.push(box(bx, bz, 0.9 + r() * 0.4, 0.5, 0.8 + r() * 0.3, stone, { y: 0.06, ry: r() * 1.2 }));   // 景石
    }
    for (const [lx, lz] of [[-24.3, 15.5], [-9.6, 9.4], [-18.5, 18.3]]) {        // 雪見石灯籠 ×3
      out.push(cyl(lx, lz, 0.35, 0.3, stone, { y: 0.06 }));
      out.push(cyl(lx, lz, 0.3, 0.55, stone, { y: 0.36 }));
      out.push(cyl(lx, lz, 0.62, 0.22, stone, { y: 0.91 }));
      out.push(cone(lx, lz, 0.5, 0.35, stone, { y: 1.13 }));
    }
    for (const [sx, sz] of [[-9.0, 6.0], [-9.8, 7.6], [-10.4, 9.4], [-10.6, 11.2], [-10.4, 13.0]]) {
      out.push(cyl(sx, sz, 0.34, 0.08, stone, { y: 0.10 }));                     // 飞石
    }

    /* ===================== 3. 樹木・生垣 ===================== */
    out.push(...tree(-25.8, 9.5, 1.35, true), ...tree(-3.5, 20.5, 1.15, true), ...tree(18.4, 10.2, 1.25, true));  // 松
    out.push(...tree(-1.5, 22, 1.4), ...tree(21, 6, 1.2));                        // 桜
    for (const [bx, bz, bs] of [[-24.6, 11.4, 0.75], [-9.4, 13.6, 0.6], [-2.6, 10.4, 0.85], [8.5, 8.0, 0.7]]) {
      out.push(sph(bx, bz, bs, hedge, { y: 0.06 }));                                // 植え込み
    }
    out.push(box(-18.9, 24.1, 18.0, 1.0, 1.0, hedge, { y: 0.04 }));                 // 表门西の生垣
    out.push(box(10.9, 24.1, 34.0, 1.0, 1.0, hedge, { y: 0.04 }));                  // 表门東の生垣

    /* ===================== 4. 洋館（英国雅各布样式・木造 2 階） ===================== */
    const MX = -10, MZ = -9, MW = 24, MD = 15;         // 24×15m・1 階檐口 6.2m・屋脊 11m
    const MIDX = MX + MW / 2, MIDZ = MZ + MD / 2;      // 东立面 x=2 / 南立面 z=-1.5
    // 上下推拉窗（成对：每扇 0.9×1.5m・白框 + 玻璃 + 中槛 + 窗台线脚）
    const win = (x, z, faceX, y0) => {
      const W = 2.0, H = 1.62, sy = y0 + 0.08;
      if (!faceX) {
        out.push(box(x, z, W, H, 0.18, cream2, { y: y0, occlude: false }));
        out.push(box(x - 0.55, z + 0.12, 0.9, H - 0.16, 0.06, gl, { y: sy }));
        out.push(box(x + 0.55, z + 0.12, 0.9, H - 0.16, 0.06, gl, { y: sy }));
        out.push(box(x, z + 0.14, W - 0.1, 0.08, 0.08, cream2, { y: y0 + H / 2 }));
        out.push(box(x, z + 0.06, W + 0.36, 0.1, 0.34, cream2, { y: y0 - 0.11 }));
      } else {
        out.push(box(x, z, 0.18, H, W, cream2, { y: y0, occlude: false }));
        out.push(box(x + 0.12, z - 0.55, 0.06, H - 0.16, 0.9, gl, { y: sy }));
        out.push(box(x + 0.12, z + 0.55, 0.06, H - 0.16, 0.9, gl, { y: sy }));
        out.push(box(x + 0.14, z, 0.08, 0.08, W - 0.1, cream2, { y: y0 + H / 2 }));
        out.push(box(x + 0.06, z, 0.34, 0.1, W + 0.36, cream2, { y: y0 - 0.11 }));
      }
    };
    // 台基・主体（下见板张：主体 + 分层板缝线）・楼层线脚・檐口
    out.push(box(MX, MZ, MW + 1.0, 0.45, MD + 1.0, stone, { y: 0 }));
    out.push(box(MX, MZ, MW, 6.2, MD, cream, { y: 0, occlude: false }));
    out.push(box(MX, MZ, MW + 0.34, 0.26, MD + 0.34, cream2, { y: 3.34, occlude: false }));      // 楼层分隔线脚
    out.push(box(MX, MZ, MW + 0.5, 0.1, MD + 0.5, cream2, { y: 3.6, occlude: false }));         // 滴水线
    out.push(box(MX, MZ, MW + 0.7, 0.3, MD + 0.7, cream2, { y: 6.2, occlude: false }));         // 檐口
    out.push(box(MX, MZ, MW + 0.95, 0.14, MD + 0.95, cream2, { y: 6.5, occlude: false }));      // 檐口滴水
    for (const y of [1.15, 2.05, 4.15, 5.05]) {                                  // 横向板缝（下见板张）
      out.push(box(MX, MIDZ + 0.05, MW - 1.7, 0.08, 0.1, cream2, { y }));
      out.push(box(MIDX + 0.05, MZ, 0.1, 0.08, MD - 1.7, cream2, { y }));
    }
    for (const [px, pz] of [[MIDX, MIDZ], [MIDX, MZ - MD / 2], [MX - MW / 2, MIDZ], [MX - MW / 2, MZ - MD / 2]]) {
      out.push(box(px, pz, 0.72, 6.2, 0.72, cream2, { y: 0 }));                  // 转角壁柱
    }
    // 窗（東立面 1・2 階 ×2 組、南立面 2 階 ×2 組）＋ ベランダ背面の法式落地窗 ×2
    win(MIDX, -5.0, 1, 1.8); win(MIDX, -11.0, 1, 1.8);
    win(MIDX, -5.0, 1, 3.62); win(MIDX, -11.0, 1, 3.62);
    win(-14.4, MIDZ, 0, 3.62); win(-11.2, MIDZ, 0, 3.62);
    for (const x of [-13.5, -10.5]) {
      out.push(box(x, MIDZ + 0.06, 2.1, 2.5, 0.16, cream2, { y: 0.72 }));
      out.push(box(x - 0.55, MIDZ + 0.14, 0.9, 2.28, 0.06, gl, { y: 0.82 }));
      out.push(box(x + 0.55, MIDZ + 0.14, 0.9, 2.28, 0.06, gl, { y: 0.82 }));
    }
    // 急坡切妻屋面（脊沿 x・11m）＋ 屋脊 ＋ 东西破风山墙 ＋ 博风板 ＋ 山墙窗
    out.push(prism(MX, MZ, MD + 1.2, 4.8, MW + 1.2, tile, { ry: Math.PI / 2, y: 6.2, occlude: false }));
    out.push(box(MX, MZ, MW + 1.3, 0.3, 0.36, tile2, { y: 11.0 }));
    out.push(prism(MIDX + 0.65, MZ, MD + 0.9, 4.5, 0.14, cream, { ry: Math.PI / 2, y: 6.3 }));
    out.push(prism(MX - MW / 2 - 0.65, MZ, MD + 0.9, 4.5, 0.14, cream, { ry: Math.PI / 2, y: 6.3 }));
    out.push(box(2.72, -5.0, 0.16, 0.26, 9.5, cream2, { rx: 0.535, y: 8.49 }));
    out.push(box(2.72, -13.0, 0.16, 0.26, 9.5, cream2, { rx: -0.535, y: 8.49 }));
    out.push(box(2.72, MZ, 0.16, 1.15, 1.0, cream2, { y: 7.5 }));
    out.push(box(2.78, MZ, 0.08, 0.9, 0.76, gl, { y: 7.62 }));
    // 砖砌烟囱 ×2（高出屋脊）+ 老虎窗 ×2
    for (const cx of [-17, -3]) {
      out.push(box(cx, MZ, 1.5, 6.0, 1.5, brick, { y: 5.8 }));
      out.push(box(cx, MZ, 1.8, 0.3, 1.8, cream2, { y: 9.6 }));
      out.push(box(cx, MZ, 1.9, 0.34, 1.9, cream2, { y: 11.8 }));
    }
    for (const dx of [-14.5, -5.5]) {
      out.push(box(dx, -3.2, 1.7, 1.4, 2.6, cream, { y: 6.4 }));
      out.push(prism(dx, -3.2, 2.1, 0.7, 2.8, tile, { y: 7.8, occlude: false }));
      out.push(box(dx, -1.88, 1.1, 1.02, 0.12, cream2, { y: 6.75 }));
      out.push(box(dx, -1.79, 0.84, 0.78, 0.06, gl, { y: 6.87 }));
    }
    // 玄関门廊：4 柱 + 三角形山花 + 3 级台阶 + 双开木门
    out.push(box(-5, 0.1, 5.6, 0.5, 3.4, stone, { y: 0 }));                     // 门廊台
    out.push(box(-5, 1.95, 5.2, 0.17, 0.6, stone, { y: 0.33 }));
    out.push(box(-5, 2.5, 5.2, 0.17, 0.6, stone, { y: 0.16 }));
    out.push(box(-5, 3.05, 5.2, 0.17, 0.6, stone, { y: 0 }));                   // 3 级台阶
    for (const [px, pz] of [[-7.4, 1.35], [-2.6, 1.35], [-7.4, -1.2], [-2.6, -1.2]]) {
      out.push(box(px, pz, 0.36, 4.28, 0.36, cream2, { y: 0.5 }));               // 柱身
      out.push(box(px, pz, 0.54, 0.24, 0.54, cream2, { y: 4.78 }));              // 柱头
    }
    out.push(box(-5, 0.1, 5.9, 0.42, 3.5, cream2, { y: 5.02, occlude: false }));                // 门廊额枋
    out.push(box(-5, 0.1, 6.2, 0.16, 3.8, cream2, { y: 5.34, occlude: false }));
    out.push(prism(-5, 0.1, 5.9, 1.05, 3.5, cream, { y: 5.44, occlude: false })); // 三角形山花
    out.push(box(-5, MIDZ + 0.04, 2.4, 2.9, 0.2, cream2, { y: 0.5 }));          // 门套
    for (const s of [-1, 1]) out.push(box(-5 + s * 0.55, MIDZ + 0.16, 1.05, 2.6, 0.1, wood, { y: 0.6 }));   // 双开木门
    out.push(box(-5, MIDZ + 0.16, 2.0, 0.42, 0.06, gl, { y: 3.0 }));            // 门顶采光窗
    // 庭园侧外廊（ベランダ）＋ 上层阳台（细木柱贯通两层・间距 1.55m）
    out.push(box(-12, -0.4, 8, 0.22, 2.24, wood2, { y: 0.5, occlude: false }));                // 外廊地板
    out.push(box(-12, -0.4, 8, 0.5, 2.14, wood3, { y: 0 }));                   // 外廊裙板
    for (let i = 0; i < 6; i++) out.push(cyl(-16 + i * 1.6, 0.58, 0.085, 3.9, wood, { y: 0.72 }));      // 细木柱
    for (const y of [1.34, 1.08, 0.82]) out.push(box(-12, 0.58, 8, 0.08, 0.08, wood, { y }));              // 栏杆横档
    out.push(box(-12, -0.4, 8.1, 0.24, 2.3, cream2, { y: 3.16, occlude: false }));             // 2 层阳台楼板
    for (const y of [3.98, 3.62]) out.push(box(-12, 0.6, 8.1, 0.1, 0.1, cream2, { y }));                   // 阳台栏杆
    for (const px of [-16, -8]) out.push(box(px, -0.4, 0.1, 0.1, 2.2, cream2, { y: 3.98 }));
    out.push(box(-15.2, 0.95, 1.8, 0.24, 0.5, wood2, { y: 0.48 }));               // 外廊阶
    out.push(box(-15.2, 1.4, 1.8, 0.24, 0.5, wood2, { y: 0.24 }));

    /* ===================== 5. 和館（木造平屋・書院造） ===================== */
    const JX = 16, JZ = -8, JW = 19, JD = 11.5, JH = 3.2;
    const JSZ = JZ + JD / 2;                    // 南面（庭园侧）z = -2.25
    out.push(box(JX, JZ, JW + 1.0, 0.4, JD + 1.0, stone, { y: 0 }));
    out.push(box(JX, JZ, JW, JH, JD, cream2, { y: 0, occlude: false }));
    out.push(prism(JX, JZ, JD + 2.9, 2.4, JW + 2.4, tile, { ry: Math.PI / 2, y: JH, occlude: false }));      // 瓦屋面（深檐）
    out.push(box(JX, JZ, JW + 2.4, 0.14, JD + 2.9, wood2, { y: JH - 0.14, occlude: false }));                // 軒裏板
    out.push(box(JX, JZ, JW + 2.5, 0.26, 0.4, tile2, { y: JH + 2.4 }));         // 屋脊
    for (let i = 0; i < 9; i++) out.push(box(8.0 + i * 2.0, -1.55, 0.1, 0.14, 1.45, wood3, { y: 2.94 }));   // 垂木（南）
    for (let i = 0; i < 3; i++) out.push(box(26.1, -4.5 - i * 2.6, 1.1, 0.14, 0.1, wood3, { y: 2.94 }));    // 垂木（東）
    for (let i = 0; i < 7; i++) out.push(box(6.5 + i * 3.1667, JSZ + 0.23, 0.26, JH, 0.26, wood3, { y: 0 })); // 深木柱 3m 间距
    out.push(box(JX, JSZ + 0.07, JW - 1.4, 2.3, 0.12, gl, { y: 0.55 }));        // 玻璃障子
    for (let i = 0; i < 9; i++) out.push(box(7.7 + i * 2.07, JSZ + 0.13, 0.07, 2.3, 0.1, wood3, { y: 0.55 })); // 格子棂条
    for (const y of [1.15, 2.15]) out.push(box(JX, JSZ + 0.13, JW - 1.4, 0.07, 0.1, wood3, { y }));
    out.push(box(JX, -1.25, JW, 0.16, 1.2, wood2, { y: 0.42 }));                // 広縁（1.2m 木廊）
    out.push(box(JX, -1.25, JW, 0.42, 1.2, wood3, { y: 0 }));
    out.push(box(JX, -0.68, JW, 0.09, 0.09, wood3, { y: 1.0 }));                // 広縁栏杆
    out.push(box(JX, -0.68, JW, 0.07, 0.07, wood3, { y: 0.62 }));
    for (const z of [-5.0, -9.5]) {                                             // 東面の障子
      out.push(box(25.58, z, 0.12, 2.2, 1.9, gl, { y: 0.55 }));
      out.push(box(25.66, z - 0.47, 0.08, 2.2, 0.07, wood3, { y: 0.55 }));
      out.push(box(25.66, z + 0.47, 0.08, 2.2, 0.07, wood3, { y: 0.55 }));
      out.push(box(25.66, z, 0.08, 0.07, 1.9, wood3, { y: 1.6 }));
    }
    out.push(prism(26.65, JZ, JD + 2.5, 2.2, 0.14, cream2, { ry: Math.PI / 2, y: JH }));   // 東側破風
    out.push(box(12.0, -0.35, 2.4, 0.24, 0.7, stone, { y: 0 }));                // 玄関踏石

    /* ===================== 6. 撞球室 + 连接廊 ===================== */
    const BX = -22, BZ = 2.75, BW = 8, BD = 7, BH = 3.0;
    out.push(box(BX, BZ, BW + 0.9, 0.35, BD + 0.9, stone, { y: 0 }));
    out.push(box(BX, BZ, BW, BH, BD, cream, { y: 0, occlude: false }));
    // 四坡（方形）瓦屋面：4 枚三角面片绕檐口线旋转拼成金字塔面（kit 无四坡图元）
    out.push(prism(BX, BZ + 4.0, 9.0, 4.614, 0.3, tile, { rx: -1.049, y: BH, occlude: false }));
    out.push(prism(BX, BZ - 4.0, 9.0, 4.614, 0.3, tile, { rx: 1.049, y: BH, occlude: false }));
    out.push(prism(BX + 4.5, BZ, 8.0, 5.054, 0.3, tile, { rx: 1.5708, ry: -0.4725, rz: 1.5708, y: BH, occlude: false }));
    out.push(prism(BX - 4.5, BZ, 8.0, 5.054, 0.3, tile, { rx: -1.5708, ry: -0.4725, rz: -1.5708, y: BH, occlude: false }));
    out.push(box(BX, BZ, 0.9, 0.18, 0.9, tile2, { y: 5.36 }));                  // 顶瓦
    out.push(box(BX - 1.8, BZ + 2.55, 1.3, 1.2, 1.4, cream, { y: 3.1 }));      // 小老虎窗
    out.push(prism(BX - 1.8, BZ + 2.55, 1.6, 0.5, 1.6, tile, { y: 4.3 }));
    out.push(box(BX - 1.8, BZ + 3.23, 0.9, 0.85, 0.12, cream2, { y: 3.45 }));
    out.push(box(BX - 1.8, BZ + 3.3, 0.66, 0.6, 0.06, gl, { y: 3.57 }));
    out.push(box(BX + 4.1, BZ, 0.18, 1.5, 1.9, cream2, { y: 1.0 }));            // 東面窓
    out.push(box(BX + 4.2, BZ, 0.07, 1.28, 1.66, gl, { y: 1.12 }));
    out.push(box(-19.5, -1.1, 2.4, 2.5, 1.2, cream, { y: 0, occlude: false })); // 洋館との連接廊
    out.push(box(-19.5, -1.1, 2.8, 0.22, 1.6, tile2, { y: 2.5 }));

    /* ===================== 7. 敷地境界（砖墙・生垣・表门） ===================== */
    out.push(box(-18.9, 25, 18.2, 1.6, 0.42, brick, { y: 0 }));
    out.push(box(10.9, 25, 34.2, 1.6, 0.42, brick, { y: 0 }));
    out.push(box(-18.9, 25, 18.4, 0.14, 0.56, cream2, { y: 1.6 }));
    out.push(box(10.9, 25, 34.4, 0.14, 0.56, cream2, { y: 1.6 }));
    out.push(box(0, -25, 56, 1.6, 0.42, brick, { y: 0 }));
    out.push(box(0, -25, 56.2, 0.14, 0.56, cream2, { y: 1.6 }));
    out.push(box(28, 0, 0.42, 1.6, 50, brick, { y: 0 }));
    out.push(box(28, 0, 0.56, 0.14, 50.2, cream2, { y: 1.6 }));
    out.push(box(-28, 0, 0.42, 1.6, 50, brick, { y: 0 }));
    for (const gx of [-10.0, -6.0]) {                                           // 表门门柱
      out.push(box(gx, 25, 0.9, 2.5, 0.9, brick, { y: 0 }));
      out.push(box(gx, 25, 1.15, 0.3, 1.15, cream2, { y: 2.5 }));
    }
    out.push(box(-9.0, 25, 1.6, 1.9, 0.1, iron, { y: 0.15 }));                  // 铁门扇
    out.push(box(-7.0, 25, 1.6, 1.9, 0.1, iron, { y: 0.15 }));
    out.push(box(-8.0, 25, 3.6, 0.12, 0.16, iron, { y: 2.1 }));                 // 门上横档

    return out;
  },
};
