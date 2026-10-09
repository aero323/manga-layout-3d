// 素材库：基本形状 / 家具 / 家电 / 简易人偶 / 轮廓线
import * as THREE from 'three';

/* ---------------- 外观与颜色 ---------------- */
export const PALETTE = [
  '#e8ecf2', '#c9d0dc', '#9aa6bb', '#5c6678',
  '#e4c99a', '#c09a6b', '#d8a08f', '#c8b7dd',
  '#a8c8e8', '#8fd0c0', '#f2c86a', '#e08b9a',
];

const COLORS = {
  shape: '#d7dde8',
  shape2: '#c2cada',
  wood: '#dcb98c',
  wood2: '#c69c68',
  fabric: '#c8d3e6',
  fabric2: '#b3c0d8',
  metal: '#c9cfd9',
  dark: '#5c6472',
  white: '#f2f4f8',
  glass: '#cfe4f2',
  marble: '#efeade', marble2: '#e3dccd',
  mannequin: '#c8d3ef',
  mannequin2: '#aab7dd',
};

export function baseColorOf(type) {
  switch (type) {
    case 'sphere': case 'hemisphere': case 'cylinder': case 'cone':
    case 'pyramid': case 'prism': case 'slope': case 'stairs': case 'pole':
      return COLORS.shape2;
    case 'board': case 'wall': case 'lowWall': return COLORS.shape;
    case 'table': case 'lowTable': case 'desk': case 'bookshelf': case 'bench': return COLORS.wood;
    case 'chair': return COLORS.wood2;
    case 'sofa': return COLORS.fabric;
    case 'bed': return COLORS.white;
    case 'fridge': case 'kitchenCounter': return COLORS.white;
    case 'tv': return COLORS.dark;
    case 'door': return COLORS.wood2;
    case 'window': return COLORS.glass;
    case 'pillar': return COLORS.shape;
    case 'column': return COLORS.marble;
    default: return COLORS.shape;
  }
}

/* ---------------- 共享几何 ---------------- */
const G = {};
function geo(key, make) { if (!G[key]) G[key] = make(); return G[key]; }
const BOX = () => geo('box', () => new THREE.BoxGeometry(0.5, 0.5, 0.5));
const CYL = () => geo('cyl', () => new THREE.CylinderGeometry(0.15, 0.15, 0.6, 32));
const CONE = () => geo('cone', () => new THREE.ConeGeometry(0.2, 0.5, 32));
const SPH = () => geo('sph', () => new THREE.SphereGeometry(0.25, 32, 20));
const HEMI = () => geo('hemi', () => new THREE.SphereGeometry(0.3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2));
const PYRA = () => geo('pyra', () => new THREE.ConeGeometry(0.35, 0.5, 4));
const PRISM = () => geo('prism', () => {
  const s = new THREE.Shape();
  s.moveTo(-0.25, 0); s.lineTo(0.25, 0); s.lineTo(0, 0.5); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false });
  g.translate(0, -0.25, -0.25);
  return g;
});
const COL_SHAFT = () => geo('colshaft', () => new THREE.CylinderGeometry(0.74, 0.95, 9.65, 40, 1));
const COL_ECHINUS = () => geo('colech', () => new THREE.CylinderGeometry(1.0, 0.74, 0.35, 40, 1));
const WEDGE = () => geo('wedge', () => {
  const s = new THREE.Shape();
  s.moveTo(-0.25, -0.25); s.lineTo(0.25, -0.25); s.lineTo(0.25, 0.25); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false });
  g.translate(0, 0, -0.25);
  return g;
});

/* ---------------- 轮廓线 ---------------- */
export const outlineMaterial = new THREE.LineBasicMaterial({
  color: 0x6b7280, transparent: true, opacity: 0.95, fog: true,
  // 轮廓线不写深度：避免线之间 / 线与后续绘制互相遮挡造成逐帧闪烁
  depthWrite: false,
});

// 相机相关的侧影轮廓（silhouette）：EdgesGeometry(threshold=22°) 只保留硬边，
// 圆柱 / 圆锥 / 球的侧面几乎不产生线段，线稿模式下白面白底会糊成一片。
// 这里按当前相机在 mesh 局部空间实时算侧影母线 / 轮廓圆，顶点写进预分配的 Float32Array，
// 线作为 mesh 子节点自动继承变换与缩放。
// 更新时机：three r169 在每次绘制前调用 material.onBeforeRender(renderer, scene, camera, geometry, object)
// （见 three.module.js renderObject），主视图与导出（WebGLRenderTarget）两条路径都会走到。
const SILHOUETTE_K = 1.004;      // 半径微外扩，避免与表面 z-fighting
const SILHOUETTE_MIN_R = 0.025;  // 有效半径（几何半径 × max|scale.x|,|scale.z|）小于该值不加，避免鼻子 / 门把手等噪点
const SILHOUETTE_AXIAL_EPS = 1e-3;
const TAU = Math.PI * 2;
const RING_SEGMENTS = 32;        // 轮廓圆 32 段 = 33 个顶点（末点与首点重合）

// 复用临时量，保证每帧零分配
const _camLocal = new THREE.Vector3();
const _ringNormal = new THREE.Vector3();
const _ringU = new THREE.Vector3();
const _ringV = new THREE.Vector3();

outlineMaterial.onBeforeRender = (renderer, scene, camera, geometry, object) => {
  object.userData.updateSilhouette?.(camera);
};

const edgeCache = new Map();
function edgesOf(geometry, threshold = 22) {
  const key = geometry.uuid + ':' + threshold;
  if (!edgeCache.has(key)) edgeCache.set(key, new THREE.EdgesGeometry(geometry, threshold));
  return edgeCache.get(key);
}

function outlineLine(geometry, loop) {
  const line = loop
    ? new THREE.LineLoop(geometry, outlineMaterial)
    : new THREE.LineSegments(geometry, outlineMaterial);
  line.userData.isOutline = true;
  line.raycast = () => {};
  line.renderOrder = 1;
  return line;
}

function dynamicPositions(count) {
  const arr = new Float32Array(count * 3);
  const attr = new THREE.BufferAttribute(arr, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', attr);
  return { arr, attr, geometry };
}

// 圆柱 / 圆锥：两条母线（generator）画侧影
function makeGeneratorSilhouette(mesh, radiusBottom, radiusTop, height) {
  const { arr, attr, geometry } = dynamicPositions(4);
  const maxR = Math.max(radiusBottom, radiusTop) * SILHOUETTE_K;
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.hypot(maxR, height * 0.5) + 0.01);
  const line = outlineLine(geometry, false);
  line.userData.isSilhouette = true;
  line.frustumCulled = false;    // 顶点随相机每帧变化，静态包围球会过期，关掉剔除避免被误裁
  const yBottom = -height / 2, yTop = height / 2;
  const rb = radiusBottom * SILHOUETTE_K, rt = radiusTop * SILHOUETTE_K;
  const update = (camera) => {
    _camLocal.copy(camera.position);
    mesh.worldToLocal(_camLocal);          // 相机 → mesh 局部空间；渲染时 matrixWorld 已更新
    const ux = _camLocal.x, uz = _camLocal.z;
    const uLen = Math.hypot(ux, uz);
    if (uLen < SILHOUETTE_AXIAL_EPS) {     // 几乎沿轴看：母线退化，隐藏
      line.visible = false;
      return;
    }
    line.visible = true;
    const inv = 1 / uLen;
    const wx = -uz * inv, wz = ux * inv;   // w = (-u.z, 0, u.x)，与视线水平垂直
    // 两条母线沿 ±w，半径随高度线性收分
    arr[0] = wx * rb;  arr[1] = yBottom; arr[2] = wz * rb;
    arr[3] = wx * rt;  arr[4] = yTop;    arr[5] = wz * rt;
    arr[6] = -arr[0];  arr[7] = yBottom; arr[8] = -arr[2];
    arr[9] = -arr[3];  arr[10] = yTop;   arr[11] = -arr[5];
    attr.needsUpdate = true;
  };
  return { line, update };
}

// 完整球：在垂直于视线的平面上画一个朝向相机的圆
function makeRingSilhouette(mesh, radius) {
  const { arr, attr, geometry } = dynamicPositions(RING_SEGMENTS + 1);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * SILHOUETTE_K + 0.01);
  const line = outlineLine(geometry, true);
  line.userData.isSilhouette = true;
  line.frustumCulled = false;
  const r = radius * SILHOUETTE_K;
  const update = (camera) => {
    _camLocal.copy(camera.position);
    mesh.worldToLocal(_camLocal);
    const len = _camLocal.length();
    if (len > 1e-9) _ringNormal.copy(_camLocal).multiplyScalar(1 / len);
    else _ringNormal.set(0, 0, 1);
    // 取一组垂直于视线的正交基（挑与法线最不平行的坐标轴起手，避免退化）
    const ax = Math.abs(_ringNormal.x), ay = Math.abs(_ringNormal.y), az = Math.abs(_ringNormal.z);
    if (ax <= ay && ax <= az) _ringU.set(1, 0, 0);
    else if (ay <= az) _ringU.set(0, 1, 0);
    else _ringU.set(0, 0, 1);
    _ringV.crossVectors(_ringNormal, _ringU).normalize();
    _ringU.crossVectors(_ringV, _ringNormal).normalize();
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const a = (i / RING_SEGMENTS) * TAU;
      const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      const o = i * 3;
      arr[o] = _ringU.x * ca + _ringV.x * sa;
      arr[o + 1] = _ringU.y * ca + _ringV.y * sa;
      arr[o + 2] = _ringU.z * ca + _ringV.z * sa;
    }
    arr[RING_SEGMENTS * 3] = arr[0];       // 闭合：末点与首点重合
    arr[RING_SEGMENTS * 3 + 1] = arr[1];
    arr[RING_SEGMENTS * 3 + 2] = arr[2];
    attr.needsUpdate = true;
  };
  return { line, update };
}

function makeSilhouette(mesh) {
  const geo = mesh.geometry;
  const params = geo && geo.parameters;
  if (!params) return null;
  const scaleR = Math.max(Math.abs(mesh.scale.x), Math.abs(mesh.scale.z));
  if (geo.type === 'CylinderGeometry' || geo.type === 'ConeGeometry') {
    const radiusBottom = geo.type === 'ConeGeometry' ? params.radius : params.radiusBottom;
    const radiusTop = geo.type === 'ConeGeometry' ? 0 : params.radiusTop;
    if (Math.max(radiusBottom, radiusTop) * scaleR < SILHOUETTE_MIN_R) return null;
    return makeGeneratorSilhouette(mesh, radiusBottom, radiusTop, params.height);
  }
  if (geo.type === 'SphereGeometry' && params.thetaLength >= Math.PI - 1e-6) {  // 半球跳过
    if (params.radius * scaleR < SILHOUETTE_MIN_R) return null;
    return makeRingSilhouette(mesh, params.radius);
  }
  return null;
}

function attachOutlines(root) {
  const list = [];
  root.traverse((o) => { if (o.isMesh) list.push(o); });
  for (const mesh of list) {
    const group = new THREE.Group();
    const edges = outlineLine(edgesOf(mesh.geometry), false);
    group.add(edges);

    const silhouette = makeSilhouette(mesh);
    if (silhouette) {
      group.add(silhouette.line);
      // onBeforeRender 里按 object.userData.updateSilhouette 触发更新：mesh / 阈值边 / 侧影线
      // 都挂同一函数。母线在沿轴视角下 visible=false 后自身不再渲染、不再触发回调，
      // 需要始终可见的阈值边把它唤醒。
      mesh.userData.updateSilhouette = silhouette.update;
      silhouette.line.userData.updateSilhouette = silhouette.update;
      edges.userData.updateSilhouette = silhouette.update;
    }

    mesh.add(group);
    mesh.userData.outline = group;   // .visible 语义不变（app.js 按整组切换显隐）
  }
  return root;
}

function addMesh(parent, geometry, color, opts = {}) {
  const mat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(color),
    polygonOffset: true, polygonOffsetFactor: 1.2, polygonOffsetUnits: 1.2,
  });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.baseColor = '#' + new THREE.Color(color).getHexString();
  if (opts.pos) mesh.position.set(...opts.pos);
  if (opts.rot) mesh.rotation.set(...opts.rot);
  if (opts.scale) mesh.scale.set(...opts.scale);
  parent.add(mesh);
  return mesh;
}

/* ---------------- 简易人偶 ---------------- */
const RIG = {
  male:   { shoulder: 0.205, hip: 0.095, torsoW: 0.36, torsoD: 0.21, headScale: 1.00, legScale: 1.00, bust: 1.00 },
  female: { shoulder: 0.175, hip: 0.105, torsoW: 0.32, torsoD: 0.20, headScale: 1.02, legScale: 0.98, bust: 1.08 },
  child:  { shoulder: 0.150, hip: 0.085, torsoW: 0.28, torsoD: 0.18, headScale: 1.22, legScale: 0.90, bust: 0.98 },
};
export const MANNEQUIN_TYPES = ['male', 'female', 'child'];
export const DEFAULT_HEIGHT = { male: 175, female: 160, child: 115 };

export const POSES = ['stand', 'sit', 'walk', 'point', 'lie'];

// 关节角度（度）。x: 前后摆动（+ 向后 / - 向前），z: 左右张开
const POSE_DEF = {
  stand: {},
  sit: {
    spineDrop: 0.44,
    hipL: { x: -85, z: 4 }, hipR: { x: -85, z: 4 },
    kneeL: { x: 85 }, kneeR: { x: 85 },
    // 上臂垂下，前臂向前水平（正好搭在椅子扶手上）
    shoulderL: { x: 4, z: -4 }, shoulderR: { x: 4, z: 4 },
    elbowL: { x: -88 }, elbowR: { x: -88 },
    spine: { x: 6 },
  },
  walk: {
    hipL: { x: -28 }, hipR: { x: 22 },
    kneeL: { x: 16 }, kneeR: { x: 34 },
    shoulderL: { x: 26, z: -5 }, shoulderR: { x: -26, z: 5 },
    elbowL: { x: -18 }, elbowR: { x: -30 },
    spine: { x: 4 },
  },
  point: {
    shoulderR: { x: -105, z: 8 }, elbowR: { x: -6 },
    shoulderL: { x: 14, z: -8 }, elbowL: { x: -22 },
    spine: { x: 2, y: -6 }, head: { y: -10 },
    hipL: { x: -4, z: -3 }, hipR: { x: 6, z: 3 },
  },
  lie: { rootRotX: -90 },
};

function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 999;
  sprite.userData.canvas = canvas;
  sprite.userData.tex = tex;
  setLabelText(sprite, text);
  return sprite;
}

export function setLabelText(sprite, text) {
  const canvas = sprite.userData.canvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const label = text || '';
  ctx.font = '600 54px "PingFang SC", "Hiragino Sans", system-ui, sans-serif';
  const w = Math.min(canvas.width - 24, Math.max(96, ctx.measureText(label).width + 56));
  const x = (canvas.width - w) / 2, y = 16, h = 96, r = 40;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(96,106,140,0.85)';
  ctx.stroke();
  ctx.fillStyle = '#2f3549';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvas.width / 2, y + h / 2 + 2);
  sprite.userData.tex.needsUpdate = true;
  sprite.scale.set(0.62, 0.155, 1);
}

export function buildMannequin(type, pose = 'stand', heightCm, name = 'A') {
  const rig = RIG[type] || RIG.male;
  const scale = rig.legScale;
  const hipY = 0.92 * scale;   // 脚底为 0，脚踝≈0
  const body = new THREE.Group();
  const root = new THREE.Group();
  root.add(body);

  const c1 = COLORS.mannequin;
  const c2 = COLORS.mannequin2;
  const thighLen = 0.48 * scale, shinLen = 0.44 * scale;

  // ---- 腿 ----
  const legGroups = {};
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const hip = new THREE.Group();
    hip.position.set(sx * rig.hip, hipY, 0);
    hip.userData.joint = 'hip' + side;
    body.add(hip);
    addMesh(hip, BOX(), c1, { pos: [0, -thighLen / 2, 0], scale: [0.27, thighLen / 0.5, 0.29] });
    const knee = new THREE.Group();
    knee.position.set(0, -thighLen, 0);
    knee.userData.joint = 'knee' + side;
    hip.add(knee);
    addMesh(knee, BOX(), c2, { pos: [0, -shinLen / 2, 0], scale: [0.23, shinLen / 0.5, 0.25] });
    const ankle = new THREE.Group();
    ankle.position.set(0, -shinLen, 0);
    knee.add(ankle);
    addMesh(ankle, BOX(), c1, { pos: [0, 0.035, 0.045], scale: [0.21, 0.13, 0.46] });
    legGroups[side] = { hip, knee };
  }

  // ---- 躯干 ----
  const spine = new THREE.Group();
  spine.position.set(0, hipY + 0.10, 0);
  spine.userData.joint = 'spine';
  body.add(spine);
  addMesh(spine, BOX(), c2, { pos: [0, -0.03, 0], scale: [rig.hip * 2 + 0.12, 0.3, 0.4] });   // 骨盆
  addMesh(spine, BOX(), c1, { pos: [0, 0.235, 0], scale: [rig.torsoW / 0.5, 0.74, rig.torsoD / 0.5] }); // 胸
  const shoulderY = 0.40;
  const shoulderHalf = rig.shoulder;
  const armGroups = {};
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const sh = new THREE.Group();
    sh.position.set(sx * shoulderHalf, shoulderY, 0);
    sh.userData.joint = 'shoulder' + side;
    spine.add(sh);
    addMesh(sh, BOX(), c1, { pos: [0, -0.15, 0], scale: [0.19, 0.6, 0.2] });
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.30, 0);
    elbow.userData.joint = 'elbow' + side;
    sh.add(elbow);
    addMesh(elbow, BOX(), c2, { pos: [0, -0.13, 0], scale: [0.16, 0.52, 0.17] });
    addMesh(elbow, BOX(), c2, { pos: [0, -0.30, 0.01], scale: [0.15, 0.2, 0.22] });
    armGroups[side] = { shoulder: sh, elbow };
  }
  const neckTop = shoulderY + 0.15;          // 相对 spine 组
  addMesh(spine, CYL(), c2, { pos: [0, neckTop - 0.02, 0], scale: [0.3, 0.2, 0.3] });
  const headScale = rig.headScale;
  const headH = 0.23 * headScale, headW = 0.17 * headScale, headD = 0.19 * headScale;
  const headY = neckTop + headH / 2;
  const head = new THREE.Group();
  head.position.set(0, headY, 0);
  head.userData.joint = 'head';
  spine.add(head);
  addMesh(head, BOX(), c1, { scale: [headW / 0.5, headH / 0.5, headD / 0.5] });
  // 鼻（朝向标记，+Z 为正面）
  addMesh(head, CONE(), c2, { pos: [0, -0.01, headD / 2 + 0.005], rot: [Math.PI / 2, 0, 0], scale: [0.12, 0.12, 0.12] });

  // ---- 姿势 ----
  const p = POSE_DEF[pose] || POSE_DEF.stand;
  const deg = (d) => THREE.MathUtils.degToRad(d || 0);
  const apply = (joint, def) => {
    if (!joint || !def) return;
    joint.rotation.set(deg(def.x), deg(def.y), deg(def.z));
  };
  apply(legGroups.L.hip, p.hipL); apply(legGroups.R.hip, p.hipR);
  apply(legGroups.L.knee, p.kneeL); apply(legGroups.R.knee, p.kneeR);
  apply(armGroups.L.shoulder, p.shoulderL); apply(armGroups.R.shoulder, p.shoulderR);
  apply(armGroups.L.elbow, p.elbowL); apply(armGroups.R.elbow, p.elbowR);
  apply(head, p.head);
  apply(spine, p.spine);
  if (p.spineDrop) {
    spine.position.y -= p.spineDrop;
    legGroups.L.hip.position.y -= p.spineDrop;
    legGroups.R.hip.position.y -= p.spineDrop;
  }
  if (p.rootRotX) {
    body.rotation.x = deg(p.rootRotX);
    // 整体旋转的姿势（如躺）：抬高身体，让旋转后的最低点贴地，避免半埋进地面
    body.updateWorldMatrix(false, true);
    const rb = new THREE.Box3().setFromObject(body);
    body.position.y -= rb.min.y;
  }

  // 身体总高（body 本地坐标 = 绝对米数，用于换算身高比例）
  const spineY = hipY + 0.10;
  const topY = spineY + neckTop + headH;
  const height = (heightCm || DEFAULT_HEIGHT[type] || 170) / 100;
  root.scale.setScalar(height / topY);
  const half = 0.10 * (height / topY);
  if (p.rootRotX) root.position.y += half;

  const label = makeLabel(name);
  label.position.set(0, topY + 0.16, 0);
  label.userData.isLabel = true;
  root.add(label);

  root.userData = {
    kind: 'mannequin', type, pose, heightCm: heightCm || DEFAULT_HEIGHT[type], name,
    label, topY, isRoot: true,
  };
  return attachOutlines(root);
}

/* ---------------- 基本形状 / 家具 / 设备 ---------------- */
function parts(type) {
  const g = new THREE.Group();
  const b = (w, h, d, x, y, z, color, ry = 0) =>
    addMesh(g, BOX(), color, { pos: [x, y, z], scale: [w / 0.5, h / 0.5, d / 0.5], rot: [0, ry, 0] });
  const c = (r, h, x, y, z, color, rot) =>
    addMesh(g, CYL(), color, { pos: [x, y, z], scale: [r / 0.15, h / 0.6, r / 0.15], rot: rot || [0, 0, 0] });

  switch (type) {
    case 'cube': addMesh(g, BOX(), COLORS.shape); break;
    case 'sphere': addMesh(g, SPH(), COLORS.shape2); break;
    case 'hemisphere': addMesh(g, HEMI(), COLORS.shape2); break;
    case 'cylinder': addMesh(g, CYL(), COLORS.shape2); break;
    case 'cone': addMesh(g, CONE(), COLORS.shape2); break;
    case 'pyramid': addMesh(g, PYRA(), COLORS.shape2, { rot: [0, Math.PI / 4, 0] }); break;
    case 'prism': addMesh(g, PRISM(), COLORS.shape2); break;
    case 'slope': addMesh(g, WEDGE(), COLORS.shape2); break;
    case 'stairs': {
      const steps = 5, sh = 0.45 / steps, sd = 0.6 / steps;
      for (let i = 0; i < steps; i++) {
        b(0.8, sh * (i + 1), sd, 0, sh * (i + 1) / 2, -0.3 + sd * i + sd / 2, COLORS.shape);
      }
      break;
    }
    case 'board': b(0.9, 0.03, 0.6, 0, 0, 0, COLORS.shape); break;
    case 'wall': b(2.0, 2.4, 0.1, 0, 0, 0, COLORS.shape); break;
    case 'lowWall': b(2.0, 0.8, 0.1, 0, 0, 0, COLORS.shape); break;
    case 'pole': c(0.04, 2.0, 0, 0, 0, COLORS.shape2); break;

    case 'table':
      b(1.2, 0.06, 0.7, 0, 0.34, 0, COLORS.wood);
      [[-0.54, -0.29], [0.54, -0.29], [-0.54, 0.29], [0.54, 0.29]].forEach(([x, z]) => b(0.07, 0.68, 0.07, x, 0, z, COLORS.wood2));
      break;
    case 'lowTable':
      b(0.9, 0.05, 0.5, 0, 0.17, 0, COLORS.wood);
      [[-0.4, -0.19], [0.4, -0.19], [-0.4, 0.19], [0.4, 0.19]].forEach(([x, z]) => b(0.06, 0.34, 0.06, x, 0, z, COLORS.wood2));
      break;
    case 'chair': {
      // 椅脚（底面 y=0，整件不再被平移）
      const legs = [[-0.185, -0.185], [0.185, -0.185], [-0.185, 0.185], [0.185, 0.185]];
      for (const [x, z] of legs) b(0.045, 0.42, 0.045, x, 0.21, z, COLORS.wood);
      // 坐面
      b(0.44, 0.04, 0.44, 0, 0.44, 0, COLORS.wood2);
      // 靠背：两根立梃 + 上下横档
      for (const x of [-0.18, 0.18]) b(0.045, 0.46, 0.05, x, 0.69, -0.2, COLORS.wood2);
      b(0.42, 0.08, 0.03, 0, 0.82, -0.2, COLORS.wood2);
      b(0.42, 0.06, 0.03, 0, 0.62, -0.2, COLORS.wood2);
      // 扶手：细横杆 + 前后支撑柱
      for (const s of [-1, 1]) {
        b(0.045, 0.035, 0.42, s * 0.225, 0.66, 0, COLORS.wood2);
        b(0.04, 0.2, 0.04, s * 0.225, 0.54, 0.17, COLORS.wood2);
        b(0.04, 0.18, 0.04, s * 0.225, 0.55, -0.16, COLORS.wood2);
      }
      break;
    }
    case 'sofa':
      b(1.8, 0.3, 0.85, 0, 0.15, 0, COLORS.fabric2);
      b(1.66, 0.16, 0.72, 0, 0.38, 0.02, COLORS.fabric);
      b(1.8, 0.45, 0.2, 0, 0.34, -0.33, COLORS.fabric);
      b(0.16, 0.34, 0.85, -0.82, 0.34, 0, COLORS.fabric2);
      b(0.16, 0.34, 0.85, 0.82, 0.34, 0, COLORS.fabric2);
      break;
    case 'bed':
      b(1.0, 0.28, 2.0, 0, 0.14, 0, COLORS.wood);
      b(1.02, 0.2, 2.02, 0, 0.38, 0, COLORS.white);
      b(0.52, 0.12, 0.34, -0.2, 0.54, -0.75, COLORS.fabric);
      b(1.04, 0.14, 1.2, 0, 0.5, 0.32, COLORS.fabric2);
      b(1.0, 0.5, 0.06, 0, 0.55, -1.0, COLORS.wood2);
      break;
    case 'desk':
      b(1.2, 0.05, 0.6, 0, 0.36, 0, COLORS.wood);
      b(0.05, 0.68, 0.6, -0.58, 0, 0, COLORS.wood2);
      b(0.05, 0.68, 0.6, 0.58, 0, 0, COLORS.wood2);
      b(1.16, 0.36, 0.05, 0, 0.08, -0.28, COLORS.wood2);
      b(0.34, 0.32, 0.54, 0.36, 0.02, 0.01, COLORS.wood2);
      b(0.34, 0.03, 0.5, 0.36, 0.11, 0.01, COLORS.wood);
      break;
    case 'bookshelf':
      b(0.9, 1.8, 0.04, 0, 0, -0.15, COLORS.wood2);
      b(0.04, 1.8, 0.32, -0.43, 0, 0, COLORS.wood);
      b(0.04, 1.8, 0.32, 0.43, 0, 0, COLORS.wood);
      for (let i = 0; i < 4; i++) b(0.86, 0.03, 0.32, 0, -0.7 + i * 0.55, 0, COLORS.wood);
      b(0.2, 0.28, 0.24, -0.25, -0.55, 0.02, COLORS.fabric);
      b(0.2, 0.3, 0.24, 0.05, -0.54, 0.02, COLORS.wood2);
      break;
    case 'bench':
      b(1.5, 0.08, 0.42, 0, 0.22, 0, COLORS.wood);
      b(0.09, 0.44, 0.4, -0.62, 0, 0, COLORS.wood2);
      b(0.09, 0.44, 0.4, 0.62, 0, 0, COLORS.wood2);
      break;

    case 'fridge':
      b(0.65, 1.7, 0.65, 0, 0, 0, COLORS.white);
      b(0.66, 0.025, 0.67, 0, 0.35, 0, COLORS.dark);
      b(0.05, 0.3, 0.05, 0.28, 0.55, 0.33, COLORS.dark);
      b(0.05, 0.5, 0.05, 0.28, -0.05, 0.33, COLORS.dark);
      break;
    case 'kitchenCounter':
      b(1.8, 0.85, 0.6, 0, 0, 0, COLORS.white);
      b(1.86, 0.05, 0.64, 0, 0.44, 0, COLORS.shape);
      b(0.5, 0.06, 0.4, -0.4, 0.46, 0, COLORS.metal);
      c(0.02, 0.24, -0.4, 0.58, -0.22, COLORS.metal);
      b(0.14, 0.03, 0.03, -0.34, 0.71, -0.22, COLORS.metal);
      break;
    case 'tv':
      b(1.0, 0.58, 0.04, 0, 0.62, 0, COLORS.dark);
      b(0.94, 0.52, 0.01, 0, 0.62, 0.03, COLORS.glass);
      b(0.5, 0.04, 0.3, 0, 0.3, 0, COLORS.dark);
      b(0.34, 0.03, 0.22, 0, 0.02, 0, COLORS.dark);
      break;
    case 'door':
      b(0.9, 2.0, 0.06, 0, 1.0, 0, COLORS.wood2);
      b(0.76, 1.86, 0.04, 0, 0.99, 0.03, COLORS.wood);
      c(0.03, 0.06, -0.3, 0.95, 0.06, COLORS.metal, [Math.PI / 2, 0, 0]);
      break;
    case 'window':
      b(1.6, 1.2, 0.07, 0, 0.6, 0, COLORS.white);
      b(1.46, 1.06, 0.03, 0, 0.6, 0.02, COLORS.glass);
      b(0.05, 1.06, 0.05, 0, 0.6, 0.03, COLORS.white);
      b(1.46, 0.05, 0.05, 0, 0.6, 0.03, COLORS.white);
      break;
    case 'column':
      addMesh(g, COL_SHAFT(), COLORS.marble, { pos: [0, 4.825, 0] });     // 柱身（下粗上细）
      addMesh(g, COL_ECHINUS(), COLORS.marble, { pos: [0, 9.825, 0] });   // 柱头圆盘
      addMesh(g, BOX(), COLORS.marble2, { pos: [0, 10.15, 0], scale: [2.1 / 0.5, 0.3 / 0.5, 2.1 / 0.5] }); // 冠板
      break;
    case 'pillar':
      b(0.3, 2.4, 0.3, 0, 0.0, 0, COLORS.shape);
      b(0.4, 0.1, 0.4, 0, -1.15, 0, COLORS.shape2);
      b(0.4, 0.1, 0.4, 0, 1.15, 0, COLORS.shape2);
      break;
    default: addMesh(g, BOX(), COLORS.shape);
  }
  return g;
}

// 只统计 mesh 的包围盒（排除轮廓线、名称标签）
export function boxOf(object, target = new THREE.Box3()) {
  target.makeEmpty();
  const tmp = new THREE.Box3();
  object.updateWorldMatrix(true, true);
  object.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    tmp.copy(o.geometry.boundingBox);
    tmp.applyMatrix4(o.matrixWorld);
    target.union(tmp);
  });
  return target;
}

export function buildObject(spec) {
  const type = spec.type;
  if (MANNEQUIN_TYPES.includes(type)) {
    const obj = buildMannequin(type, spec.pose || 'stand', spec.heightCm || DEFAULT_HEIGHT[type], spec.name || 'A');
    obj.userData.specType = type;
    return obj;
  }
  const g = attachOutlines(parts(type));
  // 统一把原点挪到底面中心：方便落地 / 叠放 / 吸附
  const b = boxOf(g);
  const minY = b.min.y;
  for (const child of g.children) child.position.y -= minY;
  g.userData = {
    kind: 'object', type, isRoot: true,
    height: b.max.y - b.min.y,
    footprint: { w: b.max.x - b.min.x, d: b.max.z - b.min.z },
  };
  return g;
}

/* ---------------- 图标 ---------------- */
const S = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}${extra}</svg>`;
const ICONS = {
  cube: S('<path d="M12 3l7 4v10l-7 4-7-4V7z"/><path d="M12 12l7-4M12 12v9M12 12L5 8"/>'),
  sphere: S('<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="8" ry="3.2"/>'),
  hemisphere: S('<path d="M4 14a8 8 0 0 1 16 0z"/><ellipse cx="12" cy="14" rx="8" ry="2.6"/>'),
  cylinder: S('<ellipse cx="12" cy="6" rx="6" ry="2.6"/><path d="M6 6v12a6 2.6 0 0 0 12 0V6"/>'),
  cone: S('<path d="M12 4l6 14"/><path d="M12 4L6 18"/><ellipse cx="12" cy="18" rx="6" ry="2.4"/>'),
  pyramid: S('<path d="M12 4l7 15H5z"/><path d="M12 4v15M5 19l7-6 7 6"/>'),
  prism: S('<path d="M8 5l6 2 4 9-6 2-4-9z"/><path d="M8 5v3l4 9v3"/>'),
  slope: S('<path d="M5 19V8l14 11z"/>'),
  stairs: S('<path d="M3 20v-4h4v-4h4V8h4V4h6"/>'),
  board: S('<path d="M3 14l18-6v3l-18 6z"/>'),
  wall: S('<rect x="3" y="6" width="18" height="12"/><path d="M3 12h18M9 6v6M15 12v6"/>'),
  lowWall: S('<rect x="3" y="12" width="18" height="6"/><path d="M3 15h18"/>'),
  pole: S('<path d="M12 3v18"/><ellipse cx="12" cy="20" rx="5" ry="1.6"/>'),
  table: S('<path d="M3 9h18"/><path d="M5 9v10M19 9v10"/><path d="M3 11h18"/>'),
  lowTable: S('<path d="M4 14h16"/><path d="M6 14v5M18 14v5"/>'),
  chair: S('<path d="M7 4v9h9"/><path d="M7 13v7M16 13v7"/><path d="M6 10h11"/>'),
  sofa: S('<path d="M4 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M4 12h16v5H4z"/><path d="M6 17v2M18 17v2"/>'),
  bed: S('<path d="M3 17v-7h18v7"/><path d="M3 12h18"/><path d="M7 10h4"/><path d="M4 17v2M20 17v2"/>'),
  desk: S('<path d="M3 9h18v3H3z"/><path d="M5 12v8M19 12v8"/><path d="M13 12v5h6"/>'),
  bookshelf: S('<rect x="5" y="3" width="14" height="18"/><path d="M5 9h14M5 15h14"/>'),
  bench: S('<path d="M3 11h18"/><path d="M5 11v3M19 11v3"/><path d="M6 14v4M18 14v4"/>'),
  fridge: S('<rect x="7" y="3" width="10" height="18" rx="1"/><path d="M7 9h10"/><path d="M14.5 11v3M14.5 5v2"/>'),
  kitchenCounter: S('<rect x="3" y="9" width="18" height="10"/><path d="M3 9h18"/><rect x="6" y="11" width="5" height="4"/>'),
  tv: S('<rect x="3" y="5" width="18" height="12" rx="1"/><path d="M8 21h8M12 17v4"/>'),
  door: S('<rect x="6" y="3" width="12" height="18"/><circle cx="15" cy="12" r="1"/>'),
  window: S('<rect x="4" y="4" width="16" height="16"/><path d="M12 4v16M4 12h16"/>'),
  pillar: S('<rect x="8" y="3" width="8" height="18"/><path d="M6 3h12M6 21h12"/>'),
  column: S('<path d="M4 4h16M6 7h12"/><path d="M9 20V8M15 20V8"/><path d="M7 20h10"/>'),
  male: S('<circle cx="12" cy="5" r="2.6"/><path d="M8.5 21v-5H7l1-6h8l1 6h-1.5v5z"/>'),
  female: S('<circle cx="12" cy="5" r="2.6"/><path d="M12 9l4 6h-2.5l2 6h-7l2-6H8z"/>'),
  child: S('<circle cx="12" cy="7" r="3"/><path d="M9.5 21v-4H8l1-5h6l1 5h-1.5v4z"/>'),
};
export const iconFor = (type) => ICONS[type] || ICONS.cube;
export const TYPE_GROUPS = {
  mannequins: MANNEQUIN_TYPES,
  shapes: ['cube', 'sphere', 'hemisphere', 'cylinder', 'cone', 'pyramid', 'prism', 'slope', 'stairs', 'board', 'wall', 'lowWall', 'pole', 'column'],
  furniture: ['table', 'lowTable', 'chair', 'sofa', 'bed', 'desk', 'bookshelf', 'bench'],
  fixtures: ['fridge', 'kitchenCounter', 'tv', 'door', 'window', 'pillar'],
};

export const OUTLINE_COLORS = { soft: 0x6f7889, strong: 0x1f2430 };
