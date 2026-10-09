// 漫画分镜 3D / マンガ レイアウト 3D — 主程序
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { makeT } from './i18n.js';
import {
  buildObject, boxOf, MANNEQUIN_TYPES, DEFAULT_HEIGHT, POSES, TYPE_GROUPS, iconFor,
  PALETTE, baseColorOf, outlineMaterial, setLabelText, OUTLINE_COLORS,
} from './objects.js';
import { STAGES, STAGE_MAP, STAGE_GROUPS, buildStageProps, uid } from './stages.js';
import { createNameModule, defaultNameState, normalizeNameState } from './name.js';
import { createBubbleModule, defaultBubbleState, normalizeBubbleState } from './bubble.js';

/* ============ 基础工具 ============ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

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

const LS = {
  lang: 'mangalayout.v1.lang',
  auto: 'mangalayout.v1.autosave',
  stages: 'mangalayout.v1.mystages',
  prefs: 'mangalayout.v1.prefs',
  mode: 'mangalayout.v1.mode',
};
function lsGet(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

/* ============ 状态 ============ */
const ASPECTS = [
  { id: '16:9', a: [16, 9] }, { id: '9:16', a: [9, 16] }, { id: '4:3', a: [4, 3] }, { id: '3:4', a: [3, 4] },
  { id: '1:1', a: [1, 1] }, { id: '3:2', a: [3, 2] }, { id: '2:3', a: [2, 3] }, { id: 'page', a: [1, 1.414] },
];
const GRID_OPTIONS = [0, 0.1, 0.5, 1, 5];
const ROTATE_OPTIONS = [0, 15, 45, 90];
const LOOK_OPTIONS = ['lineSoft', 'lineStrong', 'shaded', 'lineShaded'];

const state = {
  lang: lsGet(LS.lang, 'zh'),
  stageId: 'templeExterior',
  stageObjects: [],
  objects: [],
  frames: [],
  activeFrameId: null,
  frameSeq: 0,
  dirtyFrame: false,
  view: { pos: [34, 8, 72], target: [0, 8, 16] },
  lens: 30,
  roll: 0,
  lockSubject: false,   // 换焦段时是否自动前后移动机位，保持主体在画面里的大小
  aspect: [16, 9],
  grid: 5,
  rotateSnap: 90,
  look: 'lineShaded',
  show: { thirds: true, perspective: true, horizon: true, dim: true, onlyMan: false, labels: true, grid: true, noWalls: false },
  exportWidth: 1600,
  transparent: false,
  layers: false,
  selectedId: null,
  tool: 'translate',
  mode: '3d',
  name: defaultNameState(),
  bubble: defaultBubbleState(),
};

let t = makeT(state.lang);
const objMap = new Map();      // id -> { spec, object3D, layer }
let undoStack = [], redoStack = [];
let pendingBefore = null;

/* ============ 漫画分格（ネーム）模块 ============ */
const nameTool = createNameModule({
  state,
  getT: () => t,
  toast,
  commit,
  beginOp,
  endOp,
  renderToCanvas,
  downloadCanvas,
  frameById: (id) => state.frames.find((f) => f.id === id) || null,
  redraw3DFrames: () => renderFrames(),
  sceneSignature,
  openNameMode: () => setMode('name'),
});

/* ============ 对话气泡（ふきだし）模块 ============ */
const bubbleTool = createBubbleModule({
  state,
  getT: () => t,
  toast,
  commit,
  beginOp,
  endOp,
  downloadCanvas,
  paintPage: (ctx, page, scale, opts) => nameTool.paintPage(ctx, page, scale, opts),
  nameSync: () => nameTool.syncAll(),
  exportPages: (pages, opts) => nameTool.exportPages(pages, opts),
  addPage: () => nameTool.addPage(null),
  gotoPage: (d) => nameTool.gotoPage(d),
  scheduleAutosave: () => scheduleAutosave(),
});
// 页面（分格 / 页面顺序等）被「漫画分格」改动时，气泡编辑器同步刷新
nameTool.onChange(() => bubbleTool.syncAll());

/* ============ three.js 场景 ============ */
const viewportEl = $('#viewport');
const overlayEl = $('#overlay');
const frameRectEl = $('#frameRect');
const frameBadgeEl = $('#frameBadge');
const frameTagEl = $('#frameTag');
const guidesSvg = $('#guidesSvg');

const renderer = new THREE.WebGLRenderer({ antialias: true });
// 线稿的轮廓线是 1px 细线：转动相机时细线的「亚像素覆盖率」会一级一级跳，
// 看起来就是线在闪。这里在显示像素之上再做 1.5× 内部超采样（交给浏览器降采样），
// 覆盖率级数从 ~5 级（MSAA4）提高到 ~11 级，抖动明显变平滑；
// 像素总量超预算时自动退回 1:1，避免大屏/低端机掉帧。
const SSAA = 1.5;
const SSAA_MAX_PX = 8.2e6;
function pickPixelRatio() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = viewportEl.getBoundingClientRect();
  const px = r.width * r.height * (dpr * SSAA) ** 2;
  return px <= SSAA_MAX_PX ? dpr * SSAA : dpr;
}
renderer.setPixelRatio(pickPixelRatio());
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewportEl.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const groundGroup = new THREE.Group();
const stageGroup = new THREE.Group();
const objectsGroup = new THREE.Group();
const helperGroup = new THREE.Group();
scene.add(groundGroup, stageGroup, objectsGroup, helperGroup);

const camera = new THREE.PerspectiveCamera(40, 1, 0.08, 500);
camera.position.set(...state.view.pos);

const hemi = new THREE.HemisphereLight(0xffffff, 0xdfe4ec, 1.0);
const sun = new THREE.DirectionalLight(0xffffff, 0.85);
sun.position.set(6, 11, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 60;
sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
sun.shadow.bias = -0.0007;
scene.add(hemi, sun);

const floorPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshLambertMaterial({ color: 0xfbfbfc }),
);
floorPlane.rotation.x = -Math.PI / 2;
floorPlane.position.y = -0.004;
floorPlane.receiveShadow = true;
groundGroup.add(floorPlane);

let gridHelper = null;
function rebuildGrid() {
  if (gridHelper) { groundGroup.remove(gridHelper); gridHelper.geometry.dispose(); gridHelper.material.dispose(); gridHelper = null; }
  if (!state.grid || !state.show.grid) return;
  const size = state.grid <= 0.1 ? 24 : state.grid <= 0.5 ? 40 : state.grid <= 1 ? 60 : 80;
  const divisions = Math.round(size / state.grid);
  if (divisions > 400) return;
  gridHelper = new THREE.GridHelper(size, divisions, 0xb9c1cf, 0xdde1e8);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.85;
  gridHelper.position.y = 0.001;
  groundGroup.add(gridHelper);
}

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.target.set(...state.view.target);
orbit.maxPolarAngle = Math.PI * 0.497;
orbit.minDistance = 0.15;
orbit.maxDistance = 220;
orbit.screenSpacePanning = true;

const transform = new TransformControls(camera, renderer.domElement);
transform.setMode('translate');
transform.setSize(0.82);
helperGroup.add(transform.getHelper());

const selBox = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01)), 0x5b6bf0);
selBox.visible = false;
selBox.material.depthTest = false;
selBox.material.transparent = true;
helperGroup.add(selBox);

/* ============ 提示 ============ */
let toastTimer = null;
function toast(msg) {
  const node = $('#toast');
  node.textContent = msg;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2200);
}

/* ============ 命令 / 历史 ============ */
function clone(v) { return JSON.parse(JSON.stringify(v)); }

function serialize() {
  return {
    version: 1,
    lang: state.lang,
    stageId: state.stageId,
    stageObjects: clone(state.stageObjects),
    objects: clone(state.objects),
    frames: clone(state.frames),
    activeFrameId: state.activeFrameId,
    frameSeq: state.frameSeq,
    name: clone(state.name),
    bubble: clone(state.bubble),
    view: {
      pos: camera.position.toArray(),
      target: orbit.target.toArray(),
      lens: state.lens, roll: state.roll, aspect: [...state.aspect],
    },
    settings: {
      grid: state.grid, rotateSnap: state.rotateSnap, look: state.look,
      show: { ...state.show }, exportWidth: state.exportWidth,
      transparent: state.transparent, layers: state.layers,
    },
  };
}

function beginOp() { pendingBefore = serialize(); }

function endOp() {
  if (!pendingBefore) return;
  const before = pendingBefore;
  pendingBefore = null;
  if (JSON.stringify(before) === JSON.stringify(serialize())) return;
  undoStack.push(before);
  if (undoStack.length > 80) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
  scheduleAutosave();
}

function commit(fn) {
  beginOp();
  fn();
  endOp();
}

// 已下线的「体型人偶」：旧工程 / 自动存档里若还残留这两个类型，按同性别简易人偶恢复
const RETIRED_MANNEQUIN_TYPES = { figureMale: 'male', figureFemale: 'female' };
function migrateSpecs(list) {
  if (!Array.isArray(list)) return list;
  return list.map((sp) => (sp && RETIRED_MANNEQUIN_TYPES[sp.type]
    ? { ...sp, type: RETIRED_MANNEQUIN_TYPES[sp.type] }
    : sp));
}

function restore(data, opts = {}) {
  if (!data || typeof data !== 'object') return;
  if (data.lang && data.lang !== state.lang) {
    state.lang = data.lang;
    t = makeT(state.lang);
    applyStaticText();
  }
  state.stageId = STAGE_MAP[data.stageId] ? data.stageId : state.stageId;
  state.stageObjects = migrateSpecs(Array.isArray(data.stageObjects) ? data.stageObjects : buildStageProps(state.stageId));
  state.objects = migrateSpecs(Array.isArray(data.objects) ? data.objects : []);
  state.frames = Array.isArray(data.frames) ? data.frames : [];
  state.activeFrameId = data.activeFrameId ?? null;
  state.frameSeq = data.frameSeq ?? state.frames.length;
  state.dirtyFrame = false;
  state.name = normalizeNameState(data.name);
  state.bubble = normalizeBubbleState(data.bubble);
  const v = data.view || {};
  if (!opts.keepView) {
    if (Array.isArray(v.pos)) state.view.pos = v.pos;
    if (Array.isArray(v.target)) state.view.target = v.target;
    camera.position.set(...state.view.pos);
    orbit.target.set(...state.view.target);
  }
  state.lens = v.lens ?? state.lens;
  state.roll = v.roll ?? state.roll;
  state.aspect = Array.isArray(v.aspect) ? v.aspect : state.aspect;
  const s = data.settings || {};
  if (s.grid !== undefined) state.grid = s.grid;
  if (s.rotateSnap !== undefined) state.rotateSnap = s.rotateSnap;
  if (s.look !== undefined) state.look = s.look;
  if (s.show) state.show = { ...state.show, ...s.show };
  if (s.exportWidth) state.exportWidth = s.exportWidth;
  if (s.transparent !== undefined) state.transparent = s.transparent;
  if (s.layers !== undefined) state.layers = s.layers;
  state.selectedId = null;
  rebuildScene();
  syncAllUI();
}

function undo() {
  if (!undoStack.length) { toast(t('toast.nothingUndo')); return; }
  redoStack.push(serialize());
  restore(undoStack.pop());
  updateHistoryButtons();
  toast(t('toast.undo'));
  scheduleAutosave();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(serialize());
  restore(redoStack.pop());
  updateHistoryButtons();
  toast(t('toast.redo'));
  scheduleAutosave();
}

let autosaveTimer = null;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => lsSet(LS.auto, serialize()), 700);
}

/* ============ 场景构建 ============ */
function layerGroup(layer) { return layer === 'stage' ? stageGroup : objectsGroup; }

function specById(id) {
  return state.stageObjects.find((s) => s.id === id) || state.objects.find((s) => s.id === id) || null;
}

function addObject3D(spec) {
  const obj = buildObject(spec);
  obj.userData.id = spec.id;
  obj.userData.kind2 = MANNEQUIN_TYPES.includes(spec.type) ? 'mannequin' : 'object';
  obj.userData.baseScale = obj.scale.clone();
  if (spec.color && obj.userData.kind === 'object') tintObject(obj, spec.color);
  applyTransform(obj, spec);
  if (spec.name && obj.userData.label) setLabelText(obj.userData.label, spec.name);
  if (obj.userData.label) obj.userData.label.visible = state.show.labels;
  const group = layerGroup(spec.layer || 'user');
  group.add(obj);
  obj.userData.isOccluder = spec.occlude !== undefined ? !!spec.occlude : detectOccluder(spec, obj);
  if ((state.show.onlyMan && obj.userData.kind2 !== 'mannequin') || (state.show.noWalls && obj.userData.isOccluder)) obj.visible = false;
  objMap.set(spec.id, { spec, object3D: obj, layer: spec.layer || 'user' });
  return obj;
}

// 自动识别「遮挡物」（墙 / 吊顶屋面）：既无标注也能用于新场景；
// 场景可用 spec.occlude = true/false 显式覆盖
function detectOccluder(spec, obj) {
  if (MANNEQUIN_TYPES.includes(spec.type)) return false;
  obj.updateWorldMatrix(true, true);
  const bb = new THREE.Box3().setFromObject(obj);
  const size = bb.getSize(new THREE.Vector3());
  const thin = Math.min(size.x, size.z), wide = Math.max(size.x, size.z);
  // 墙：落地、竖直方向有高度、一面很薄而另一面有长度（薄/长比够小，才不会把电视等薄家电算进来）
  if (size.y > 0.6 && bb.min.y < 2.5 && thin < 0.6 && wide > 1.0 && thin / wide < 0.25) return true;
  // 吊顶 / 屋面：方正的薄板（长宽比悬殊的楼板、厚屋顶体块不算），且整体在 2m 以上
  if ((spec.type === 'cube' || spec.type === 'prism') && bb.max.y > 2.0 && size.y < 0.8 && thin > 2.0 && wide / thin < 8) return true;
  return false;
}
// 「只显示人偶」/「去掉墙壁遮挡」都是预览辅助，统一在这里算显隐
function applyObjectVisibility() {
  const onlyMan = state.show.onlyMan, noWalls = state.show.noWalls;
  for (const { object3D, spec } of objMap.values()) {
    const man = MANNEQUIN_TYPES.includes(spec.type);
    object3D.visible = !((onlyMan && !man) || (noWalls && object3D.userData.isOccluder));
  }
}

function tintObject(obj, colorHex) {
  obj.traverse((o) => {
    if (o.isMesh && !o.userData.isOutline && o.userData.baseColor) {
      o.userData.baseColor = colorHex;
      o.material.color.set(colorHex);
    }
  });
}

function applyTransform(obj, spec) {
  obj.position.set(...(spec.position || [0, 0, 0]));
  const r = spec.rotation || [0, 0, 0];
  obj.rotation.set(rad(r[0] || 0), rad(r[1] || 0), rad(r[2] || 0));
  const s = spec.scale || [1, 1, 1];
  const base = obj.userData.baseScale || new THREE.Vector3(1, 1, 1);
  obj.scale.set(base.x * (s[0] ?? 1), base.y * (s[1] ?? 1), base.z * (s[2] ?? 1));
}

function clearGroup(group) {
  for (const child of [...group.children]) group.remove(child);
}

function rebuildScene() {
  clearGroup(stageGroup);
  clearGroup(objectsGroup);
  objMap.clear();
  for (const spec of state.stageObjects) addObject3D(spec);
  for (const spec of state.objects) addObject3D(spec);
  applyLook();
  selectObject(null);
  updateStageHint();
}

// 首次启动（本地没有自动保存的工程时）的初始状态：
// 希腊神庙（外景）＋ 线稿＋明暗，机位对准神殿正面，广场上站两个人偶当比例尺
function defaultProject() {
  const objs = [
    { id: uid('m'), type: 'male', layer: 'user', name: 'A', pose: 'stand', heightCm: 172,
      position: [4.2, 0, 50], rotation: [0, 186, 0], scale: [1, 1, 1] },
    { id: uid('m'), type: 'female', layer: 'user', name: 'B', pose: 'stand', heightCm: 158,
      position: [7.0, 0, 48.6], rotation: [0, 196, 0], scale: [1, 1, 1] },
  ];
  return {
    stageId: 'templeExterior', stageObjects: buildStageProps('templeExterior'), objects: objs,
    frames: [], activeFrameId: null,
    frameSeq: 0,
    view: { pos: [34, 8, 72], target: [0, 8, 16], lens: 30, roll: 0, aspect: [16, 9] },
    settings: { grid: 5, rotateSnap: 90, look: 'lineShaded', show: { ...state.show }, exportWidth: 1600 },
  };
}

/* ============ 外观 / 光线 ============ */
const SUN_OFFSET = new THREE.Vector3(6, 11, 7);
function applyLook() {
  const mode = state.look;
  const useLine = mode !== 'shaded';
  const flat = mode === 'lineSoft' || mode === 'lineStrong';
  outlineMaterial.color.setHex(mode === 'lineStrong' ? OUTLINE_COLORS.strong : OUTLINE_COLORS.soft);
  outlineMaterial.opacity = mode === 'lineStrong' ? 1 : 0.85;
  const white = new THREE.Color(0xffffff);
  const isMan = (x) => MANNEQUIN_TYPES.includes(x);
  for (const { object3D, spec } of objMap.values()) {
    const man = isMan(spec.type);
    object3D.traverse((o) => {
      if (!o.isMesh || o.userData.isOutline) return;
      if (o.userData.outline) o.userData.outline.visible = useLine;
      const base = o.userData.baseColor || baseColorOf(spec.type);
      if (flat) {
        // 线稿：面白 + 轮廓线；人偶留一点淡色，便于和背景区分
        if (man && mode === 'lineSoft') o.material.color.set(base).lerp(white, 0.45);
        else o.material.color.set(0xffffff);
      } else if (mode === 'lineShaded') {
        o.material.color.set(base).lerp(white, 0.5);
      } else {
        o.material.color.set(base);
      }
    });
  }
  floorPlane.material.color.set(flat ? 0xffffff : 0xfbfbfc);
  // three r155+ 物理光照单位：强度需按 π 量级放大，白面才会是纯白
  if (flat) {
    hemi.color.set(0xffffff); hemi.groundColor.set(0xf2f5fa);
    hemi.intensity = 3.1; sun.intensity = 0.4;
  } else if (mode === 'lineShaded') {
    hemi.color.set(0xffffff); hemi.groundColor.set(0xdfe4ec);
    hemi.intensity = 2.0; sun.intensity = 1.3;
  } else {
    hemi.color.set(0xffffff); hemi.groundColor.set(0xdfe4ec);
    hemi.intensity = 1.1; sun.intensity = 2.1;
  }
  const shadows = !flat;
  if (renderer.shadowMap.enabled !== shadows) {
    renderer.shadowMap.enabled = shadows;
    scene.traverse((o) => {
      if (!o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { m.needsUpdate = true; });
    });
  }
  sun.castShadow = shadows;
}

function applyLabels() {
  for (const { object3D } of objMap.values()) {
    if (object3D.userData.label) object3D.userData.label.visible = state.show.labels;
  }
}
function applyGridVisibility() {
  if (gridHelper) gridHelper.visible = state.show.grid;
  floorPlane.visible = STAGE_MAP[state.stageId]?.group !== 'room';
  rebuildGrid();
  if (gridHelper) gridHelper.visible = state.show.grid;
  groundGroup.visible = state.show.grid || floorPlane.visible;
}

/* ============ 选择 ============ */
function selectObject(id) {
  state.selectedId = id;
  const entry = id ? objMap.get(id) : null;
  if (entry) {
    transform.attach(entry.object3D);
    transform.setMode(state.tool);
    selBox.setFromObject(entry.object3D);
    selBox.visible = true;
  } else {
    transform.detach();
    selBox.visible = false;
  }
  renderInspector();
}
function updateSelectionHelper() {
  const entry = state.selectedId ? objMap.get(state.selectedId) : null;
  if (!entry) return;
  selBox.setFromObject(entry.object3D);
}

/* ============ 相机 / 画幅 ============ */
function frameRectPx() {
  const r = viewportEl.getBoundingClientRect();
  const W = Math.max(1, r.width), H = Math.max(1, r.height);
  const a = state.aspect[0] / state.aspect[1];
  const maxW = W * 0.9, maxH = H * 0.9;
  let fw = maxW, fh = fw / a;
  if (fh > maxH) { fh = maxH; fw = fh * a; }
  return { W, H, fw, fh, x: (W - fw) / 2, y: (H - fh) / 2, a };
}
function vfovFrameDeg(lens = state.lens, aspect = state.aspect) {
  const a = aspect[0] / aspect[1];
  const sensorH = 36 / a;
  return deg(2 * Math.atan(sensorH / (2 * lens)));
}
function updateCameraFov() {
  const { W, H, fw, fh } = frameRectPx();
  const vf = rad(vfovFrameDeg());
  const viewFov = 2 * Math.atan(Math.tan(vf / 2) * (H / fh));
  camera.aspect = W / H;
  camera.fov = deg(viewFov);
  camera.updateProjectionMatrix();
}
function aspectLabel(aspect = state.aspect) {
  const found = ASPECTS.find((x) => Math.abs(x.a[0] / x.a[1] - aspect[0] / aspect[1]) < 1e-4);
  return found ? t('aspect.' + found.id) : `${aspect[0]}:${aspect[1]}`;
}
function lensSubjectCenter() {
  const entry = state.selectedId ? objMap.get(state.selectedId) : null;
  if (entry) return boxOf(entry.object3D).getCenter(new THREE.Vector3());
  return orbit.target.clone();   // 没选中物体时以注视点为准
}
// 「锁定主体大小」：换焦段时把整台相机（机位 + 注视点）以主体为中心按 k = 新焦段 / 旧焦段 缩放。
// 主体到镜头的角度不变 → 主体在画面里的大小不变，变的是拍摄距离 —— 这才是「24mm 夸张 / 85mm 压平」的真正来源。
function dollyForLens(k) {
  if (!Number.isFinite(k) || Math.abs(k - 1) < 1e-6) return;
  const c = lensSubjectCenter();
  const distNow = camera.position.distanceTo(c);
  if (!(distNow > 1e-4)) return;
  const s = clamp(distNow * k, 0.35, 160) / distNow;
  camera.position.sub(c).multiplyScalar(s).add(c);
  orbit.target.sub(c).multiplyScalar(s).add(c);
  orbit.update();
}
function setLens(v, silent = false) {
  const next = clamp(Math.round(v), 12, 200);
  const prev = state.lens;
  state.lens = next;
  $('#lensRange').value = String(state.lens);
  $('#lensOut').value = state.lens + 'mm';
  for (const b of $$('#lensPresets .chip')) b.classList.toggle('active', Number(b.dataset.lens) === state.lens);
  if (!silent && state.lockSubject && next !== prev) dollyForLens(next / prev);
  updateCameraFov();
  updateOverlay();
  if (!silent) markFrameDirty();
}
function setAspect(a) {
  state.aspect = [...a];
  for (const b of $$('#aspectPresets .chip')) {
    b.classList.toggle('active', String(b.dataset.aspect) === `${a[0]}:${a[1]}`);
  }
  updateCameraFov();
  markFrameDirty();
}
function setRoll(v) {
  state.roll = clamp(v, -45, 45);
  $('#rollRange').value = String(state.roll);
  $('#rollOut').value = Math.round(state.roll) + '°';
  markFrameDirty();
}
function applyEyePreset(kind) {
  const target = orbit.target.clone();
  const horiz = new THREE.Vector3(camera.position.x - target.x, 0, camera.position.z - target.z);
  if (kind === 'standing') { camera.position.y = 1.5; target.y = 1.5; }
  else if (kind === 'sitting') { camera.position.y = 1.1; target.y = 1.1; }
  else if (kind === 'low') { camera.position.y = 0.32; target.y = 1.55; }
  else if (kind === 'bird') { camera.position.y = Math.max(3.6, orbit.target.y + 3.0); target.y = 0.5; }
  camera.position.x = target.x + horiz.x;
  camera.position.z = target.z + horiz.z;
  orbit.target.copy(target);
  orbit.update();
  markFrameDirty();
  updateOverlay();
}
function focusSelection() {
  const entry = state.selectedId ? objMap.get(state.selectedId) : null;
  if (!entry) { toast(t('toast.needSelection')); return; }
  const b = boxOf(entry.object3D);
  const c = b.getCenter(new THREE.Vector3());
  const size = Math.max(0.4, b.getSize(new THREE.Vector3()).length() * 0.5);
  const dist = size / Math.tan(rad(camera.fov) / 2) * 1.25;
  const dir = camera.position.clone().sub(orbit.target).normalize();
  orbit.target.copy(c);
  camera.position.copy(c).add(dir.multiplyScalar(clamp(dist, 0.5, 40)));
  orbit.update();
  markFrameDirty();
  toast(t('toast.focused'));
}

/* ============ 画面（カット） ============ */
const thumbRefs = new Map();
function activeFrame() { return state.frames.find((f) => f.id === state.activeFrameId) || null; }
function frameFromView(name) {
  return {
    id: uid('fr'), name, nameAuto: true,
    aspect: [...state.aspect], lens: state.lens, roll: state.roll,
    position: camera.position.toArray(), target: orbit.target.toArray(),
  };
}
function markFrameDirty() {
  if (!state.activeFrameId) return;
  if (!state.dirtyFrame) {
    state.dirtyFrame = true;
    const ref = thumbRefs.get(state.activeFrameId);
    if (ref && !ref.dirty) { ref.dirty = h('span', { class: 'frame-dirty' }); ref.card.querySelector('.frame-meta').prepend(ref.dirty); }
  }
}
function saveShot() {
  commit(() => {
    state.frameSeq += 1;
    const f = frameFromView(t('frames.defaultName', { n: state.frameSeq }));
    state.frames.push(f);
    state.activeFrameId = f.id;
    state.dirtyFrame = false;
    renderFrames();
  });
  nameTool.syncAll();
  toast(t('toast.frameSaved'));
}
function updateShot() {
  const f = activeFrame();
  if (!f) { saveShot(); return; }
  commit(() => {
    f.aspect = [...state.aspect]; f.lens = state.lens; f.roll = state.roll;
    f.position = camera.position.toArray(); f.target = orbit.target.toArray();
    state.dirtyFrame = false;
    const ref = thumbRefs.get(f.id);
    if (ref) { if (ref.dirty) { ref.dirty.remove(); ref.dirty = null; } drawThumb(f, ref.canvas); }
    renderFrames();
  });
  nameTool.invalidate();
  nameTool.syncAll();
  toast(t('toast.frameUpdated'));
}
function applyFrame(id) {
  const f = state.frames.find((x) => x.id === id);
  if (!f) return;
  state.activeFrameId = id;
  state.dirtyFrame = false;
  state.aspect = [...f.aspect];
  state.lens = f.lens;
  state.roll = f.roll || 0;
  camera.position.fromArray(f.position);
  orbit.target.fromArray(f.target);
  orbit.update();
  syncFramesUI();
  setLens(f.lens, true);
  setRoll(f.roll || 0);
  for (const b of $$('#aspectPresets .chip')) b.classList.toggle('active', String(b.dataset.aspect) === `${f.aspect[0]}:${f.aspect[1]}`);
  updateCameraFov();
  updateOverlay();
}
function deleteFrame(id) {
  commit(() => {
    state.frames = state.frames.filter((f) => f.id !== id);
    if (state.activeFrameId === id) { state.activeFrameId = null; state.dirtyFrame = false; }
    for (const page of state.name.pages) {
      for (const panel of page.panels) if (panel.frame && panel.frame.frameId === id) panel.frame = null;
    }
    renderFrames();
  });
  nameTool.syncAll();
  toast(t('toast.frameDeleted'));
}
function renderFrames() {
  const list = $('#frameList');
  list.replaceChildren();
  thumbRefs.clear();
  if (!state.frames.length) {
    list.append(h('div', { class: 'muted', text: t('frames.empty') }));
    return;
  }
  for (const f of state.frames) {
    const canvas = h('canvas', { class: 'frame-thumb' });
    const placed = nameTool.locateFrame(f.id);
    const meta = h('div', { class: 'frame-meta' },
      h('div', { class: 'frame-name', text: f.name }),
      h('div', { class: 'frame-sub', text: t('frames.sub', { a: aspectLabel(f.aspect || state.aspect), lens: Math.round(f.lens) }) }),
      placed ? h('div', { class: 'frame-placed', text: t('name.placedAt', { at: placed }) }) : null,
    );
    const card = h('div', {
      class: 'frame-card' + (f.id === state.activeFrameId ? ' active' : ''),
      draggable: 'true',
      onclick: () => applyFrame(f.id),
      title: t('frames.dragHint'),
    }, canvas, meta, h('button', {
      class: 'del', title: t('insp.delete'),
      onclick: (e) => { e.stopPropagation(); deleteFrame(f.id); },
    }, '✕'));
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-manga-frame', 'frame:' + f.id);
      e.dataTransfer.setData('text/plain', 'frame:' + f.id);
      e.dataTransfer.effectAllowed = 'copy';
    });
    list.append(card);
    thumbRefs.set(f.id, { card, canvas, dirty: null, frame: f });
    drawThumb(f, canvas);
  }
}
function syncFramesUI() {
  for (const [id, ref] of thumbRefs) ref.card.classList.toggle('active', id === state.activeFrameId);
}

/* ============ 离屏渲染（缩略图 / 导出） ============ */
function exportCamera(frame, W, H) {
  const a = (frame.aspect || state.aspect);
  const cam = new THREE.PerspectiveCamera(vfovFrameDeg(frame.lens || state.lens, a), W / H, 0.03, 800);
  cam.position.fromArray(frame.position);
  cam.up.set(0, 1, 0);
  cam.lookAt(new THREE.Vector3().fromArray(frame.target));
  if (frame.roll) cam.rotateZ(rad(frame.roll));
  return cam;
}

function keepLabels(visible) {
  for (const { object3D } of objMap.values()) {
    if (object3D.userData.label) object3D.userData.label.visible = visible;
  }
}

function renderToCanvas(frame, W, H, opts = {}) {
  const layer = opts.layer || 'all';
  const transparent = !!opts.transparent;
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const cam = exportCamera(frame, W, H);
  const restore = [];
  const keep = (o, v) => { restore.push([o, o.visible]); o.visible = v; };
  keep(helperGroup, false);
  keepLabels(false);
  // 导出图始终按完整场景渲染（「显示」里的勾选项只是预览辅助）
  for (const { object3D } of objMap.values()) keep(object3D, true);
  // 圆柱 / 圆锥的侧影线是按「当前相机」算的，导出用的是另一台相机：
  // 先按导出相机预算一遍，避免第一帧（此前被隐藏、从未绘制过的物体）拿到过期顶点
  scene.updateMatrixWorld(true);
  for (const { object3D } of objMap.values()) {
    object3D.traverse((o) => o.userData.updateSilhouette?.(cam));
  }
  const isChar = (spec) => MANNEQUIN_TYPES.includes(spec.type);
  if (layer === 'all' && transparent) keep(groundGroup, false);
  if (layer === 'char') {
    keep(groundGroup, false);
    keep(stageGroup, false);
    for (const { object3D, spec } of objMap.values()) if (!isChar(spec)) keep(object3D, false);
  }
  if (layer === 'bg') {
    if (transparent) keep(groundGroup, false);
    for (const { object3D, spec } of objMap.values()) if (isChar(spec)) keep(object3D, false);
  }
  const prevBg = scene.background;
  const prevAlpha = renderer.getClearAlpha();
  const prevClear = new THREE.Color();
  renderer.getClearColor(prevClear);
  scene.background = transparent || layer === 'char' ? null : new THREE.Color(0xffffff);
  renderer.setClearColor(0xffffff, transparent || layer === 'char' ? 0 : 1);
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(scene, cam);
  const buf = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  renderer.setRenderTarget(null);
  renderer.setClearColor(prevClear, prevAlpha);
  scene.background = prevBg;
  for (const [o, v] of restore.reverse()) o.visible = v;
  keepLabels(state.show.labels);
  rt.dispose();

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const row = W * 4;
  for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * row, (H - y) * row), y * row);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function drawThumb(frame, canvas) {
  try {
    const src = renderToCanvas(frame, 200, Math.max(1, Math.round(200 / ((frame.aspect || state.aspect)[0] / (frame.aspect || state.aspect)[1]))), {});
    canvas.width = src.width; canvas.height = src.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = state.look === 'shaded' ? '#eef1f6' : '#ffffff';
    ctx.fillRect(0, 0, src.width, src.height);
    ctx.drawImage(src, 0, 0);
  } catch (e) { console.warn('thumb failed', e); }
}

/* ============ 覆盖层（画幅框 / 辅助线） ============ */
let guideSig = '';
function updateOverlay() {
  const { W, H, fw, fh, x, y } = frameRectPx();
  const st = frameRectEl.style;
  st.width = fw + 'px'; st.height = fh + 'px';
  st.left = x + 'px'; st.top = y + 'px';
  overlayEl.classList.toggle('no-dim', !state.show.dim);
  $('#thirds').classList.toggle('hidden', !state.show.thirds);
  frameBadgeEl.textContent = `${aspectLabel()} · ${state.lens}mm`;
  const dirty = state.dirtyFrame && activeFrame();
  frameTagEl.style.display = dirty ? 'block' : 'none';
  frameTagEl.textContent = t('frames.dirtyHint');
  $('#hudCamera').textContent = `${Math.round(camera.position.y * 100)}cm · ${state.lens}mm · ${aspectLabel()}`;
  drawGuides(W, H);
}
function drawGuides(W, H) {
  const sig = [W, H, state.show.perspective, state.show.horizon,
    camera.position.x.toFixed(3), camera.position.y.toFixed(3), camera.position.z.toFixed(3),
    camera.quaternion.x.toFixed(4), camera.quaternion.y.toFixed(4), camera.quaternion.z.toFixed(4), camera.quaternion.w.toFixed(4)].join('|');
  if (sig === guideSig) return;
  guideSig = sig;
  const parts = [];
  if (state.show.horizon) {
    const line = horizonLine(W, H);
    if (line) parts.push(`<line x1="${line[0].x.toFixed(1)}" y1="${line[0].y.toFixed(1)}" x2="${line[1].x.toFixed(1)}" y2="${line[1].y.toFixed(1)}" stroke="#efa231" stroke-width="1.2" stroke-dasharray="7 5" opacity="0.92"/>`);
  }
  if (state.show.perspective) {
    const axes = [
      [new THREE.Vector3(1, 0, 0), '#e0546d', 'X'],
      [new THREE.Vector3(0, 1, 0), '#3fa87a', 'Y'],
      [new THREE.Vector3(0, 0, 1), '#4a7fe0', 'Z'],
    ];
    for (const [dir, color, label] of axes) {
      const p = projectDir(dir, W, H) || projectDir(dir.clone().negate(), W, H);
      if (!p) continue;
      const cx = clamp(p.x, 14, W - 14), cy = clamp(p.y, 14, H - 14);
      const off = p.offscreen;
      parts.push(`<g opacity="${off ? 0.55 : 1}">
        <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${off ? 4 : 5}" fill="none" stroke="${color}" stroke-width="1.6"/>
        <line x1="${cx - 8}" y1="${cy}" x2="${cx + 8}" y2="${cy}" stroke="${color}" stroke-width="1"/>
        <line x1="${cx}" y1="${cy - 8}" x2="${cx}" y2="${cy + 8}" stroke="${color}" stroke-width="1"/>
        <text x="${(cx + 9).toFixed(1)}" y="${(cy - 8).toFixed(1)}" font-size="10" font-family="system-ui" fill="${color}" font-weight="600">${label} VP</text>
      </g>`);
    }
  }
  guidesSvg.innerHTML = parts.join('');
}
function horizonLine(W, H) {
  const camQ = camera.quaternion.clone().invert();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camQ);
  const tanV = Math.tan(rad(camera.fov) / 2);
  const tanH = tanV * camera.aspect;
  const A = up.x * tanH, B = up.y * tanV, C = up.z;
  if (Math.abs(A) < 1e-6 && Math.abs(B) < 1e-6) return null;
  const toPx = (xn, yn) => ({ x: (xn * 0.5 + 0.5) * W, y: (-yn * 0.5 + 0.5) * H });
  let p1, p2;
  if (Math.abs(B) >= Math.abs(A)) {
    p1 = toPx(-1, -(A * -1 + C) / B);
    p2 = toPx(1, -(A * 1 + C) / B);
  } else {
    p1 = toPx(-(B * -1 + C) / A, -1);
    p2 = toPx(-(B * 1 + C) / A, 1);
  }
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  return [{ x: p1.x - dx * 6, y: p1.y - dy * 6 }, { x: p2.x + dx * 6, y: p2.y + dy * 6 }];
}
function projectDir(dir, W, H) {
  const camQ = camera.quaternion.clone().invert();
  const d = dir.clone().normalize().applyQuaternion(camQ);
  if (d.z > -1e-4) return null;
  const tanV = Math.tan(rad(camera.fov) / 2);
  const tanH = tanV * camera.aspect;
  const xn = (d.x / -d.z) / tanH;
  const yn = (d.y / -d.z) / tanV;
  if (Math.abs(xn) > 8 || Math.abs(yn) > 8) return null;
  return {
    x: (xn * 0.5 + 0.5) * W,
    y: (-yn * 0.5 + 0.5) * H,
    offscreen: Math.abs(xn) > 1 || Math.abs(yn) > 1,
  };
}

/* ============ 素材 / 选择面板 ============ */
const round3 = (v) => Math.round(v * 1000) / 1000;
const round1 = (v) => Math.round(v * 10) / 10;

function displayName(spec) { return spec.name || t(spec.nameKey || `object.${spec.type}`); }

function nextMannequinName() {
  const used = new Set(state.objects.concat(state.stageObjects).filter((s) => MANNEQUIN_TYPES.includes(s.type)).map((s) => s.name));
  for (let i = 0; i < 26; i++) {
    const n = String.fromCharCode(65 + i);
    if (!used.has(n)) return n;
  }
  return 'A' + (state.objects.length + 1);
}

function makeSpec(type, position, pose) {
  const isMan = MANNEQUIN_TYPES.includes(type);
  const spec = {
    id: uid(isMan ? 'm' : 'o'),
    type, layer: 'user',
    position: position ? [...position] : [0, 0, 0],
    rotation: [0, 0, 0], scale: [1, 1, 1],
  };
  if (isMan) {
    spec.name = nextMannequinName();
    spec.pose = pose || 'stand';
    spec.heightCm = DEFAULT_HEIGHT[type];
  } else {
    spec.nameKey = `object.${type}`;
    spec.color = baseColorOf(type);
  }
  return spec;
}

function placementPoint() {
  const p = orbit.target.clone();
  p.y = 0;
  return p;
}
function snapVal(v) { return state.grid ? Math.round(v / state.grid) * state.grid : v; }

function addSpecToScene(spec) {
  state.objects.push(spec);
  addObject3D(spec);
  applyLook();
  applyLabels();
  selectObject(spec.id);
}

function addFromLibrary(type, position) {
  let px, pz, py = 0;
  if (Array.isArray(position)) { px = Number(position[0]); pz = Number(position[2]); py = Number(position[1]) || 0; }
  else if (position && position.isVector3) { px = position.x; pz = position.z; py = Number(position.y) || 0; }
  else { const p = placementPoint(); px = p.x; pz = p.z; }
  if (!Number.isFinite(px)) px = orbit.target.x;
  if (!Number.isFinite(pz)) pz = orbit.target.z;
  if (!Number.isFinite(py) || py < 0) py = 0;
  const spec = makeSpec(type, [snapVal(px), py, snapVal(pz)], libraryPose);
  if (MANNEQUIN_TYPES.includes(type)) {
    const dx = camera.position.x - spec.position[0], dz = camera.position.z - spec.position[2];
    spec.rotation = [0, round1(deg(Math.atan2(dx, dz))), 0];
  }
  commit(() => addSpecToScene(spec));
  toast(t('toast.added', { name: displayName(spec) }));
}

function refreshObject(spec) {
  const old = objMap.get(spec.id);
  if (old) { old.object3D.parent?.remove(old.object3D); objMap.delete(spec.id); }
  addObject3D(spec);
  applyLook();
  applyLabels();
  if (state.selectedId === spec.id) selectObject(spec.id);
}

function duplicateSelection() {
  const spec = state.selectedId ? specById(state.selectedId) : null;
  if (!spec) { toast(t('toast.needSelection')); return; }
  const copy = clone(spec);
  copy.id = uid(MANNEQUIN_TYPES.includes(spec.type) ? 'm' : 'o');
  copy.position = [spec.position[0] + 0.3, spec.position[1], spec.position[2] + 0.3];
  if (MANNEQUIN_TYPES.includes(spec.type)) copy.name = nextMannequinName();
  commit(() => addSpecToScene(copy));
  toast(t('toast.duplicated'));
}

function deleteSelection() {
  const spec = state.selectedId ? specById(state.selectedId) : null;
  if (!spec) { toast(t('toast.needSelection')); return; }
  commit(() => {
    const entry = objMap.get(spec.id);
    if (entry) { entry.object3D.parent?.remove(entry.object3D); objMap.delete(spec.id); }
    state.objects = state.objects.filter((s) => s.id !== spec.id);
    state.stageObjects = state.stageObjects.filter((s) => s.id !== spec.id);
    state.selectedId = null;
    selectObject(null);
  });
  toast(t('toast.deleted'));
}

let inspRefs = null;
function renderInspector() {
  const host = $('#inspector');
  if (!host) return;
  host.replaceChildren();
  inspRefs = null;
  const spec = state.selectedId ? specById(state.selectedId) : null;
  if (!spec) {
    host.append(h('div', { class: 'insp-empty', text: t('insp.empty') }));
    return;
  }
  const isMan = MANNEQUIN_TYPES.includes(spec.type);
  const fields = {};
  const numBox = (key, get, set, step = 1) => {
    const input = h('input', { class: 'num', type: 'number', step, value: String(round3(get())) });
    input.addEventListener('change', () => {
      const v = parseFloat(input.value);
      if (!Number.isFinite(v)) { input.value = String(round3(get())); return; }
      commit(() => { set(v); });
      applyTransform(objMap.get(spec.id).object3D, spec);
      updateSelectionHelper();
    });
    fields[key] = input;
    return input;
  };

  const nameInput = h('input', { class: 'input', type: 'text', value: displayName(spec) });
  nameInput.addEventListener('change', () => {
    const v = nameInput.value.trim();
    commit(() => {
      spec.name = v || null;
      if (!v && !isMan) spec.nameKey = `object.${spec.type}`;
      const entry = objMap.get(spec.id);
      if (entry?.object3D.userData.label) setLabelText(entry.object3D.userData.label, displayName(spec));
    });
  });

  const posRow = h('div', { class: 'vec' },
    h('label', {}, 'X', numBox('px', () => spec.position[0] * 100, (v) => { spec.position[0] = v / 100; })),
    h('label', {}, 'Y', numBox('py', () => spec.position[1] * 100, (v) => { spec.position[1] = v / 100; })),
    h('label', {}, 'Z', numBox('pz', () => spec.position[2] * 100, (v) => { spec.position[2] = v / 100; })),
  );
  const rotRow = h('div', { class: 'vec' },
    h('label', {}, 'X', numBox('rx', () => spec.rotation[0], (v) => { spec.rotation[0] = v; })),
    h('label', {}, 'Y', numBox('ry', () => spec.rotation[1], (v) => { spec.rotation[1] = v; })),
    h('label', {}, 'Z', numBox('rz', () => spec.rotation[2], (v) => { spec.rotation[2] = v; })),
  );
  const scaleRow = h('div', { class: 'vec' },
    h('label', {}, 'X', numBox('sx', () => spec.scale[0], (v) => { spec.scale[0] = v; }, 0.1)),
    h('label', {}, 'Y', numBox('sy', () => spec.scale[1], (v) => { spec.scale[1] = v; }, 0.1)),
    h('label', {}, 'Z', numBox('sz', () => spec.scale[2], (v) => { spec.scale[2] = v; }, 0.1)),
  );

  host.append(
    h('div', { class: 'insp-name' }, nameInput),
    h('div', { class: 'field-label', text: t('insp.position') }), posRow,
    h('div', { class: 'field-label', text: t('insp.rotation') }), rotRow,
  );

  if (isMan) {
    host.append(
      h('div', { class: 'field-label', text: t('insp.height') }),
      (() => {
        const input = h('input', { class: 'num', type: 'number', step: 1, value: String(spec.heightCm) });
        input.addEventListener('change', () => {
          const v = clamp(parseFloat(input.value) || spec.heightCm, 60, 220);
          commit(() => { spec.heightCm = v; refreshObject(spec); });
        });
        return input;
      })(),
      h('div', { class: 'field-label', text: t('insp.pose') }),
      h('div', { class: 'grid-btns' }, ...POSES.map((p) => h('button', {
        class: 'chip' + (spec.pose === p ? ' active' : ''),
        onclick: () => commit(() => { spec.pose = p; refreshObject(spec); }),
      }, t('pose.' + p)))),
    );
  } else {
    host.append(h('div', { class: 'field-label', text: t('insp.scale') }), scaleRow);
    host.append(
      h('div', { class: 'field-label', text: t('insp.color') }),
      h('div', { class: 'swatches' }, ...PALETTE.map((c) => h('button', {
        class: 'swatch' + (spec.color === c ? ' active' : ''),
        style: `background:${c}`,
        title: c,
        onclick: () => {
          commit(() => { spec.color = c; tintObject(objMap.get(spec.id).object3D, c); });
          renderInspector();
        },
      }))),
    );
  }

  host.append(
    h('div', { class: 'field-label', text: t('insp.layer') }),
    h('div', { class: 'muted', text: spec.layer === 'stage' ? t('insp.layerStage') : t('insp.layerUser') }),
    h('div', { class: 'row', style: 'margin-top:10px' },
      h('button', { class: 'btn block', onclick: duplicateSelection }, t('insp.duplicate')),
      h('button', { class: 'btn block danger', onclick: deleteSelection }, t('insp.delete')),
    ),
  );
  inspRefs = { id: spec.id, fields };
}
function updateInspectorValues() {
  if (!inspRefs) return;
  const spec = specById(inspRefs.id);
  if (!spec) return;
  const set = (key, v) => {
    const el = inspRefs.fields[key];
    if (el && document.activeElement !== el) el.value = String(round3(v));
  };
  set('px', spec.position[0] * 100); set('py', spec.position[1] * 100); set('pz', spec.position[2] * 100);
  set('rx', spec.rotation[0]); set('ry', spec.rotation[1]); set('rz', spec.rotation[2]);
  set('sx', spec.scale[0]); set('sy', spec.scale[1]); set('sz', spec.scale[2]);
}

/* ============ 左侧素材栏 ============ */
// 「人物」区：类型按钮 + 新建姿势选择器（站 / 坐 / 走 / 指 / 躺，与属性面板一致）
let libraryPose = 'stand';
function mannequinBlock() {
  const chips = POSES.map((p) => h('button', {
    class: 'chip' + (libraryPose === p ? ' active' : ''),
    onclick: (ev) => {
      libraryPose = p;
      for (const el of ev.currentTarget.parentElement.children) el.classList.toggle('active', el === ev.currentTarget);
    },
  }, t('pose.' + p)));
  return h('section', { class: 'pblock' },
    h('h2', { class: 'pblock-title' }, t('library.mannequins')),
    h('div', { class: 'lib-grid cols-3' }, ...TYPE_GROUPS.mannequins.map(libButton)),
    h('div', { class: 'field-label' }, t('library.poseForNew')),
    h('div', { class: 'grid-btns', style: 'margin:8px 0 0' }, ...chips),
  );
}
function libButton(type) {
  const btn = h('button', {
    class: 'lib-btn', draggable: 'true', title: t('library.hint'),
    onclick: () => addFromLibrary(type),
  }, h('span', { html: iconFor(type) }), h('span', { text: t('object.' + type) }));
  btn.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = 'copy';
  });
  return btn;
}
function libBlock(titleKey, types, cols = 2) {
  return h('section', { class: 'pblock' },
    h('h2', { class: 'pblock-title' }, t(titleKey)),
    h('div', { class: 'lib-grid' + (cols === 3 ? ' cols-3' : ''), style: cols === 3 ? '' : '' }, ...types.map(libButton)),
  );
}
function myStages() { return lsGet(LS.stages, []) || []; }

function renderLibrary() {
  const lib = $('#library');
  lib.replaceChildren();
  lib.append(
    h('section', { class: 'pblock' },
      h('h2', { class: 'pblock-title' }, t('tool.title')),
      h('div', { class: 'grid-btns', style: 'grid-template-columns:repeat(3,1fr);margin:0 0 8px' },
        h('button', { class: 'chip' + (state.tool === 'translate' ? ' active' : ''), id: 'toolMove', onclick: () => setTool('translate') }, t('tool.move')),
        h('button', { class: 'chip' + (state.tool === 'rotate' ? ' active' : ''), id: 'toolRotate', onclick: () => setTool('rotate') }, t('tool.rotate')),
        h('button', { class: 'chip' + (state.tool === 'scale' ? ' active' : ''), id: 'toolScale', onclick: () => setTool('scale') }, t('tool.scale')),
      ),
    ),
    mannequinBlock(),
    libBlock('library.shapes', TYPE_GROUPS.shapes, 2),
    libBlock('library.furniture', TYPE_GROUPS.furniture, 2),
    libBlock('library.fixtures', TYPE_GROUPS.fixtures, 2),
    myStagesBlock(),
    h('section', { class: 'pblock' },
      h('h2', { class: 'pblock-title' }, t('library.selected')),
      h('div', { id: 'inspector' }),
      h('p', { class: 'note', text: t('insp.editHint') }),
    ),
  );
  renderInspector();
  updateToolButtons();
}

function myStagesBlock() {
  const list = myStages();
  const kids = [
    h('div', { class: 'row', style: 'margin-bottom:8px' },
      h('button', { class: 'btn block', onclick: () => openMyStageDialog() }, t('library.saveMyStage'))),
  ];
  if (!list.length) kids.push(h('div', { class: 'muted', text: t('library.emptyMyStages') }));
  else {
    kids.push(h('div', { class: 'stage-list' }, ...list.map((s) => h('div', { class: 'stage-item' },
      h('span', { text: s.name, title: s.name }),
      h('button', { class: 'btn icon', title: t('myStages.load'), onclick: () => loadMyStage(s.id) }, '↧'),
      h('button', { class: 'btn icon danger', title: t('myStages.delete'), onclick: () => removeMyStage(s.id) }, '✕'),
    ))));
  }
  return h('section', { class: 'pblock' }, h('h2', { class: 'pblock-title' }, t('library.myStages')), ...kids);
}

function openMyStageDialog() {
  const dlg = $('#myStageDialog');
  const input = $('#myStageName');
  input.value = t('stage.' + state.stageId);
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  setTimeout(() => { input.focus(); input.select(); }, 40);
}

function saveMyStage(name) {
  const list = myStages();
  list.push({ id: uid('ms'), name, stageId: state.stageId, objects: clone(state.stageObjects), grid: state.grid });
  lsSet(LS.stages, list);
  renderLibrary(); renderStageSelect();
  toast(t('toast.myStageSaved'));
}
function loadMyStage(id) {
  const s = myStages().find((x) => x.id === id);
  if (!s) return;
  commit(() => {
    state.stageId = STAGE_MAP[s.stageId] ? s.stageId : state.stageId;
    state.stageObjects = clone(s.objects);
    if (s.grid !== undefined) state.grid = s.grid;
    rebuildScene();
    syncAllUI();
  });
  toast(t('toast.myStageLoaded', { name: s.name }));
}
function removeMyStage(id) {
  lsSet(LS.stages, myStages().filter((x) => x.id !== id));
  renderLibrary(); renderStageSelect();
  toast(t('toast.myStageDeleted'));
}

/* ============ 工具栏 / 右侧面板 ============ */
function renderStageSelect() {
  const sel = $('#stageSelect');
  sel.replaceChildren();
  for (const g of STAGE_GROUPS) {
    const og = h('optgroup', { label: t(g.key) });
    for (const s of g.stages) og.append(h('option', { value: s.id, text: t('stage.' + s.id) }));
    sel.append(og);
  }
  const mine = myStages();
  if (mine.length) {
    const og = h('optgroup', { label: t('stage.group.mine') });
    for (const s of mine) og.append(h('option', { value: 'mine:' + s.id, text: '★ ' + s.name }));
    sel.append(og);
  }
  sel.value = state.stageId;
}
function renderSelect(id, options, current, labelFn) {
  const sel = $(id);
  sel.replaceChildren(...options.map((v) => h('option', { value: String(v), text: labelFn(v) })));
  sel.value = String(current);
}
function renderPanelControls() {
  renderStageSelect();
  renderSelect('#gridSelect', GRID_OPTIONS, state.grid, (v) => t('grid.' + (v === 0 ? 'off' : String(v))));
  renderSelect('#rotateSelect', ROTATE_OPTIONS, state.rotateSnap, (v) => t('rotate.' + (v === 0 ? 'off' : String(v))));
  renderSelect('#lookSelect', LOOK_OPTIONS, state.look, (v) => t('look.' + v));
  renderSelect('#exportWidth', [1024, 1600, 2048, 2560, 3840], state.exportWidth, (v) => `${v} px`);
  $('#lensPresets').replaceChildren(...[24, 35, 50, 85].map((v) => h('button', {
    class: 'chip', 'data-lens': v, onclick: () => setLens(v),
  }, v + 'mm')));
  $('#eyePresets').replaceChildren(...[
    ['standing', t('camera.standing')], ['sitting', t('camera.sitting')],
    ['low', t('camera.low')], ['bird', t('camera.bird')],
  ].map(([k, label]) => h('button', { class: 'chip', onclick: () => applyEyePreset(k) }, label)));
  $('#aspectPresets').replaceChildren(...ASPECTS.map((a) => h('button', {
    class: 'chip', 'data-aspect': `${a.a[0]}:${a.a[1]}`, onclick: () => setAspect(a.a),
  }, t('aspect.' + a.id))));
}
function updateToolButtons() {
  for (const [id, mode] of [['#toolMove', 'translate'], ['#toolRotate', 'rotate'], ['#toolScale', 'scale']]) {
    const el = $(id);
    if (el) el.classList.toggle('active', state.tool === mode);
  }
}
function setTool(mode) {
  state.tool = mode;
  transform.setMode(mode);
  updateToolButtons();
}
function updateHistoryButtons() {
  $('#undoBtn').disabled = !undoStack.length;
  $('#redoBtn').disabled = !redoStack.length;
}
function updateStageHint() {
  $('#hudStage').textContent = t('stage.' + state.stageId);
}

/* ============ 交互：变换 / 吸附 ============ */
let shiftDown = false;
const SNAP_THRESHOLD = 0.16;

function writeTransformToSpec() {
  const entry = state.selectedId ? objMap.get(state.selectedId) : null;
  if (!entry) return;
  const { object3D: o, spec } = entry;
  spec.position = [round3(o.position.x), round3(o.position.y), round3(o.position.z)];
  spec.rotation = [round1(deg(o.rotation.x)), round1(deg(o.rotation.y)), round1(deg(o.rotation.z))];
  const base = o.userData.baseScale || new THREE.Vector3(1, 1, 1);
  spec.scale = [round3(o.scale.x / base.x), round3(o.scale.y / base.y), round3(o.scale.z / base.z)];
  updateInspectorValues();
}

function applySnapDuringDrag() {
  const entry = state.selectedId ? objMap.get(state.selectedId) : null;
  if (!entry || transform.mode !== 'translate') return;
  if (shiftDown) return;
  const o = entry.object3D;
  o.updateMatrixWorld(true);
  const self = boxOf(o);
  const center = self.getCenter(new THREE.Vector3());
  let stack = null, dx = null, dz = null;
  for (const [id, other] of objMap) {
    if (id === entry.spec.id) continue;
    const oc = other.object3D.position;
    if (Math.abs(oc.x - center.x) > 6 || Math.abs(oc.z - center.z) > 6) continue;
    const b = boxOf(other.object3D);
    const overlapX = Math.min(self.max.x, b.max.x) - Math.max(self.min.x, b.min.x);
    const overlapZ = Math.min(self.max.z, b.max.z) - Math.max(self.min.z, b.min.z);
    const overlapY = Math.min(self.max.y, b.max.y) - Math.max(self.min.y, b.min.y);
    // 高度吸附：放到家具上面
    if (overlapX > 0.02 && overlapZ > 0.02) {
      const gap = self.min.y - b.max.y;
      if (gap > -0.03 && gap < SNAP_THRESHOLD && (!stack || gap < stack.gap)) stack = { gap, delta: -gap };
    }
    // 墙面吸附：贴到别的物体侧面
    if (overlapY > 0.05) {
      if (overlapZ > 0.02) {
        const g1 = b.min.x - self.max.x, g2 = self.min.x - b.max.x;
        if (g1 > 0 && g1 < SNAP_THRESHOLD && (dx === null || g1 < Math.abs(dx))) dx = g1;
        if (g2 > 0 && g2 < SNAP_THRESHOLD && (dx === null || g2 < Math.abs(dx))) dx = -g2;
      }
      if (overlapX > 0.02) {
        const g1 = b.min.z - self.max.z, g2 = self.min.z - b.max.z;
        if (g1 > 0 && g1 < SNAP_THRESHOLD && (dz === null || g1 < Math.abs(dz))) dz = g1;
        if (g2 > 0 && g2 < SNAP_THRESHOLD && (dz === null || g2 < Math.abs(dz))) dz = -g2;
      }
    }
  }
  if (stack) o.position.y += stack.delta;
  if (dx !== null) o.position.x += dx;
  if (dz !== null) o.position.z += dz;
  const after = boxOf(o);
  if (after.min.y < -0.001) o.position.y -= after.min.y;
}

function pickAt(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const p = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(p, camera);
  const hits = ray.intersectObjects([objectsGroup, stageGroup], true);
  for (const hit of hits) {
    let node = hit.object;
    while (node && !node.userData.isRoot) node = node.parent;
    if (node?.userData.id) return node;
  }
  return null;
}
function groundPointAt(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const p = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(p, camera);
  // 先落在「朝上的面」上：家具顶、石砌台地、崖顶凸台…这样可以直接把人偶/道具放到高台上
  const n = new THREE.Vector3();
  for (const hit of ray.intersectObjects([objectsGroup, stageGroup], true)) {
    if (!hit.face) continue;
    n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    if (n.y > 0.75) return hit.point.clone().setY(hit.point.y + 0.002);
  }
  const pt = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  if (ray.ray.intersectPlane(plane, pt)) return pt;
  return null;
}

function bindViewport() {
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    const start = down; down = null;
    if (!start) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4) return;
    if (transform.axis || transform.dragging) return;
    const hit = pickAt(e.clientX, e.clientY);
    selectObject(hit ? hit.userData.id : null);
  });
  renderer.domElement.addEventListener('dblclick', (e) => {
    const hit = pickAt(e.clientX, e.clientY);
    if (hit) { selectObject(hit.userData.id); focusSelection(); }
  });
  viewportEl.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  viewportEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plain');
    if (!type) return;
    const pt = groundPointAt(e.clientX, e.clientY) || placementPoint();
    addFromLibrary(type, [pt.x, pt.y || 0, pt.z]);
  });
  const onContext = (e) => e.preventDefault();
  renderer.domElement.addEventListener('contextmenu', onContext);
}

function bindTransform() {
  transform.addEventListener('dragging-changed', (e) => {
    orbit.enabled = !e.value;
    if (e.value) beginOp();
    else {
      applySnapDuringDrag();
      writeTransformToSpec();
      updateSelectionHelper();
      endOp();
    }
  });
  transform.addEventListener('objectChange', () => {
    applySnapDuringDrag();
    writeTransformToSpec();
    updateSelectionHelper();
  });
}

/* ---- 相机键盘操作：方向键平移；按住 R + 方向键环绕旋转 ---- */
const camKeys = new Set();
let rHeld = false, rUsedForCamera = false;
const CAM_ORBIT_H = Math.PI / 2;    // 水平环绕速度 rad/s
const CAM_ORBIT_V = Math.PI / 3;    // 俯仰速度 rad/s
const codeOf = (ev) => ev.code || (ev.key.startsWith('Arrow') ? ev.key
  : /^[a-z]$/i.test(ev.key) ? 'Key' + ev.key.toUpperCase() : ev.key);
function keyboardCameraUpdate(dt) {
  let ax = 0, ay = 0;
  if (camKeys.has('ArrowLeft')) ax -= 1;
  if (camKeys.has('ArrowRight')) ax += 1;
  if (camKeys.has('ArrowUp')) ay -= 1;
  if (camKeys.has('ArrowDown')) ay += 1;
  if (!ax && !ay) return;
  const boost = shiftDown ? 2.6 : 1;
  if (rHeld) {
    rUsedForCamera = true;
    const off = camera.position.clone().sub(orbit.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta -= ax * CAM_ORBIT_H * boost * dt;
    sph.phi = THREE.MathUtils.clamp(sph.phi + ay * CAM_ORBIT_V * boost * dt, 0.05, Math.PI / 2 - 0.02);
    off.setFromSpherical(sph);
    camera.position.copy(orbit.target).add(off);
    camera.lookAt(orbit.target);
  } else {
    const dist = Math.max(0.2, camera.position.distanceTo(orbit.target));
    const viewH = 2 * dist * Math.tan(rad(camera.fov) / 2);
    const step = viewH * 0.5 * boost * dt;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const move = right.multiplyScalar(ax * step).add(up.multiplyScalar(-ay * step));
    camera.position.add(move);
    orbit.target.add(move);
  }
}

function bindKeys() {
  window.addEventListener('keydown', (e) => {
    const tag = (e.target?.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (e.key === 'Shift' && !shiftDown) {
      shiftDown = true;
      transform.translationSnap = null;
      transform.rotationSnap = null;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveFile(); return; }
    if (state.mode === 'bubble') {
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); bubbleTool.duplicateSelected(); return; }
      if (typing) return;
      if (e.key === 'PageDown') { nameTool.gotoPage(1); bubbleTool.syncAll(); }
      else if (e.key === 'PageUp') { nameTool.gotoPage(-1); bubbleTool.syncAll(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { bubbleTool.removeSelected(); }
      else if (e.key === 'Escape') { state.bubble.selectId = null; bubbleTool.syncAll(); }
      else if (e.key.startsWith('Arrow')) {
        const step = e.shiftKey ? 20 : 2;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        if (bubbleTool.nudgeSelected(dx, dy)) e.preventDefault();
      }
      return;
    }
    if (state.mode === 'name') {
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); nameTool.addPage(nameTool.activePage()); return; }
      if (typing) return;
      const kn = e.key.toLowerCase();
      if (kn === 'l') nameTool.setTool('line');
      else if (kn === 'v') nameTool.setTool('select');
      else if (kn === 'e') nameTool.setTool('erase');
      else if (e.key === 'PageDown') nameTool.gotoPage(1);
      else if (e.key === 'PageUp') nameTool.gotoPage(-1);
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        const panel = nameSelectedPanel();
        if (panel && panel.frame) { commit(() => { panel.frame = null; }); nameTool.syncAll(); }
      } else if (e.key === 'Escape') {
        state.name.selectedPanelId = null;
        state.name.selectFrameId = null;
        nameTool.syncAll();
      }
      return;
    }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelection(); return; }
    if (typing) return;
    const code = codeOf(e);
    // 方向键平移视角；按住 R 时方向键改成环绕旋转（R 单独按下仍是缩放工具）
    if (code === 'KeyR') {
      if (!rHeld) { rHeld = true; rUsedForCamera = false; }
      e.preventDefault();
      return;
    }
    if (code.startsWith('Arrow')) {
      camKeys.add(code);
      e.preventDefault();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'g') setTool('translate');
    else if (k === 'e') setTool('rotate');
    else if (k === 'r') setTool('scale');
    else if (k === 'f') focusSelection();
    else if (k === 'v') selectObject(null);
    else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelection();
    else if (e.key === 'Escape') { selectObject(null); }
  });
  window.addEventListener('keyup', (e) => {
    const tag = (e.target?.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (!typing && state.mode === '3d') {
      const code = codeOf(e);
      if (code === 'KeyR' && rHeld) {
        rHeld = false;
        if (!rUsedForCamera) setTool('scale');   // 单独按 R：切换缩放工具
        rUsedForCamera = false;
        return;
      }
      if (code.startsWith('Arrow')) { camKeys.delete(code); return; }
    }
    if (e.key === 'Shift') {
      shiftDown = false;
      updateSnaps();
    }
  });
  window.addEventListener('blur', () => {
    camKeys.clear();
    rHeld = false;
    rUsedForCamera = false;
  });
}
function updateSnaps() {
  transform.translationSnap = (state.grid && !shiftDown) ? state.grid : null;
  transform.rotationSnap = (state.rotateSnap && !shiftDown) ? rad(state.rotateSnap) : null;
}

/* ============ 导出 / 文件 ============ */
function fileNameFor(frame, W, H, suffix = '') {
  const raw = `${frame.name || 'cut'}`.replace(/[\\/:*?"<>|\s]+/g, '_');
  return `layout_${state.stageId}_${raw}_${W}x${H}${suffix}.png`;
}
function downloadCanvas(canvas, name) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(); return; }
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      resolve();
    }, 'image/png');
  });
}
function exportFrameSpec() {
  const active = activeFrame();
  return {
    id: 'export',
    name: active ? active.name : t('frames.defaultName', { n: state.frameSeq + 1 }),
    aspect: [...state.aspect], lens: state.lens, roll: state.roll,
    position: camera.position.toArray(), target: orbit.target.toArray(),
  };
}
async function exportCurrent() {
  const frame = exportFrameSpec();
  const W = state.exportWidth;
  const H = Math.max(1, Math.round((W * frame.aspect[1]) / frame.aspect[0]));
  const jobs = [{ suffix: '', layer: 'all', transparent: state.transparent }];
  if (state.layers) {
    jobs.push({ suffix: '_bg', layer: 'bg', transparent: state.transparent });
    jobs.push({ suffix: '_char', layer: 'char', transparent: true });
  }
  try {
    for (const job of jobs) {
      const canvas = renderToCanvas(frame, W, H, job);
      await downloadCanvas(canvas, fileNameFor(frame, W, H, job.suffix));
      await new Promise((r) => setTimeout(r, 300));
    }
    toast(t('toast.exported', { n: jobs.length }));
  } catch (err) {
    console.error(err);
    toast(t('toast.exportFailed'));
  }
}
function saveFile() {
  const data = JSON.stringify(serialize(), null, 1);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  const a = h('a', { href: url, download: `manga-layout-${stamp}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(t('toast.fileSaved'));
}
function openFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      commit(() => restore(data));
      toast(t('toast.fileOpened'));
    } catch (err) {
      console.error(err);
      toast(t('toast.openFailed'));
    }
  };
  reader.readAsText(file);
}
function newProject() {
  commit(() => {
    state.stageId = 'peopleOnly';
    state.stageObjects = [];
    state.objects = [];
    state.frames = [];
    state.activeFrameId = null;
    state.frameSeq = 0;
    state.dirtyFrame = false;
    state.name = defaultNameState();
    state.bubble = defaultBubbleState();
    state.grid = 1;
    state.aspect = [16, 9];
    state.lens = 35;
    state.roll = 0;
    camera.position.set(3.4, 1.7, 4.4);
    orbit.target.set(0, 0.95, 0);
    orbit.update();
    rebuildScene();
    syncAllUI();
  });
  toast(t('toast.fresh'));
}

/* ============ 语言切换 ============ */
function applyStaticText() {
  for (const el of $$('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of $$('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  document.documentElement.lang = state.lang === 'ja' ? 'ja' : 'zh-CN';
  document.title = `${t('app.title')} · Storyboard · Panels · Balloons`;
  for (const b of $$('#langSeg button')) b.classList.toggle('active', b.dataset.lang === state.lang);
}
function setLang(lang) {
  if (lang === state.lang) return;
  state.lang = lang;
  t = makeT(lang);
  lsSet(LS.lang, lang);
  applyStaticText();
  renderLibrary();
  renderPanelControls();
  renderFrames();
  renderHelp();
  updateStageHint();
  nameTool.syncAll();
  bubbleTool.syncAll();
  scheduleAutosave();
}

/* ============ 帮助 ============ */
function renderHelp() {
  const keyRows = [
    [t('help.k1a'), t('help.k1b')],
    [t('help.k2a'), t('help.k2b')],
    [t('help.k3a'), t('help.k3b')],
    [t('help.k4a'), t('help.k4b')],
    [t('help.k5a'), t('help.k5b')],
    [t('help.k6a'), t('help.k6b')],
    [t('help.k7a'), t('help.k7b')],
    [t('help.k8a'), t('help.k8b')],
    [t('help.k9a'), t('help.k9b')],
    [t('help.k10a'), t('help.k10b')],
    [t('help.k11a'), t('help.k11b')],
  ];
  $('#helpBody').replaceChildren(
    h('p', { text: t('help.intro') }),
    h('h3', { text: t('help.flowTitle') }),
    h('ul', {}, ...[1, 2, 3, 4, 5].map((i) => h('li', { text: t('help.flow' + i) }))),
    h('h3', { text: t('help.nameTitle') }),
    h('ul', {}, ...[1, 2, 3, 4].map((i) => h('li', { text: t('help.name' + i) }))),
    h('h3', { text: t('help.bubbleTitle') }),
    h('ul', {}, ...[1, 2, 3, 4, 5].map((i) => h('li', { text: t('help.bubble' + i) }))),
    h('h3', { text: t('help.keysTitle') }),
    h('table', {},
      h('tbody', {}, ...keyRows.map(([a, b]) => h('tr', {}, h('th', { html: `<kbd>${a}</kbd>` }), h('td', { text: b })))),
    ),
    h('h3', { text: t('help.insightTitle') }),
    h('div', { class: 'tip' }, h('ul', { style: 'margin:0;padding-left:16px' },
      h('li', { text: t('help.insight1') }),
      h('li', { text: t('help.insight2') }),
      h('li', { text: t('help.insight3') }),
      h('li', { text: t('help.insight4') }),
    )),
    h('h3', { text: t('help.dataTitle') }),
    h('p', { text: t('help.data1') }),
    h('p', { text: t('help.data2') }),
  );
}

/* ============ 全局同步 ============ */
function syncAllUI() {
  renderPanelControls();
  renderLibrary();
  $('#lensRange').value = String(state.lens);
  $('#lensOut').value = state.lens + 'mm';
  $('#rollRange').value = String(state.roll);
  $('#rollOut').value = Math.round(state.roll) + '°';
  $('#cbLockSubject').checked = state.lockSubject;
  $('#exportWidth').value = String(state.exportWidth);
  $('#cbThirds').checked = state.show.thirds;
  $('#cbPerspective').checked = state.show.perspective;
  $('#cbHorizon').checked = state.show.horizon;
  $('#cbDim').checked = state.show.dim;
  $('#cbOnlyMan').checked = state.show.onlyMan;
  $('#cbLabels').checked = state.show.labels;
  $('#cbGrid').checked = state.show.grid;
  $('#cbNoWalls').checked = state.show.noWalls;
  $('#cbTransparent').checked = state.transparent;
  $('#cbLayers').checked = state.layers;
  for (const b of $$('#lensPresets .chip')) b.classList.toggle('active', Number(b.dataset.lens) === state.lens);
  for (const b of $$('#aspectPresets .chip')) b.classList.toggle('active', String(b.dataset.aspect) === `${state.aspect[0]}:${state.aspect[1]}`);
  updateSnaps();
  applyLook();
  applyLabels();
  applyObjectVisibility();
  applyGridVisibility();
  updateCameraFov();
  updateOverlay();
  updateStageHint();
  renderFrames();
  renderInspector();
  updateHistoryButtons();
  nameTool.syncAll();
  bubbleTool.syncAll();
  savePrefs();
}
function savePrefs() {
  lsSet(LS.prefs, { show: state.show, look: state.look, lang: state.lang, exportWidth: state.exportWidth, lockSubject: state.lockSubject });
}

/* ============ 绑定 UI ============ */
function bindUI() {
  $('#stageSelect').addEventListener('change', (e) => {
    const v = e.target.value;
    if (v.startsWith('mine:')) { loadMyStage(v.slice(5)); return; }
    switchStage(v);
  });
  $('#gridSelect').addEventListener('change', (e) => {
    state.grid = Number(e.target.value);
    updateSnaps(); applyGridVisibility(); scheduleAutosave();
  });
  $('#rotateSelect').addEventListener('change', (e) => {
    state.rotateSnap = Number(e.target.value);
    updateSnaps(); scheduleAutosave();
  });
  $('#lookSelect').addEventListener('change', (e) => {
    commit(() => { state.look = e.target.value; applyLook(); savePrefs(); });
  });
  $('#lensRange').addEventListener('input', (e) => setLens(Number(e.target.value)));
  $('#cbLockSubject').addEventListener('change', (e) => {
    state.lockSubject = e.target.checked;
    savePrefs();
    toast(t(state.lockSubject ? 'toast.lockSubjectOn' : 'toast.lockSubjectOff'));
  });
  $('#rollRange').addEventListener('input', (e) => { setRoll(Number(e.target.value)); });
  $('#saveShotBtn').addEventListener('click', saveShot);
  $('#updateShotBtn').addEventListener('click', updateShot);
  $('#addFrameBtn').addEventListener('click', saveShot);
  $('#exportBtn').addEventListener('click', exportCurrent);
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);
  $('#newBtn').addEventListener('click', newProject);
  $('#saveBtn').addEventListener('click', saveFile);
  $('#openBtn').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) openFile(f);
    e.target.value = '';
  });
  $('#helpBtn').addEventListener('click', () => { renderHelp(); $('#helpDialog').showModal(); });
  $('#myStageName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('#myStageConfirm').click(); }
  });
  $('#myStageConfirm').addEventListener('click', () => {
    const name = $('#myStageName').value.trim() || t('stage.' + state.stageId);
    $('#myStageDialog').close();
    saveMyStage(name);
  });
  for (const b of $$('[data-close]')) b.addEventListener('click', (e) => e.target.closest('dialog')?.close());
  for (const b of $$('#langSeg button')) b.addEventListener('click', () => setLang(b.dataset.lang));
  $('#railToggle').addEventListener('click', () => $('#rail').classList.toggle('expanded'));
  for (const b of $$('#rail .rail-item[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));
  $('#railHelp').addEventListener('click', () => { renderHelp(); $('#helpDialog').showModal(); });
  $('#leftToggle').addEventListener('click', () => $('#leftPanel').classList.toggle('collapsed'));
  $('#rightToggle').addEventListener('click', () => $('#rightPanel').classList.toggle('collapsed'));
  const checks = [
    ['#cbThirds', 'thirds'], ['#cbPerspective', 'perspective'], ['#cbHorizon', 'horizon'],
    ['#cbDim', 'dim'], ['#cbOnlyMan', 'onlyMan'], ['#cbLabels', 'labels'], ['#cbGrid', 'grid'],
    ['#cbNoWalls', 'noWalls'],
  ];
  for (const [sel, key] of checks) {
    $(sel).addEventListener('change', (e) => {
      state.show[key] = e.target.checked;
      if (key === 'labels') applyLabels();
      if (key === 'onlyMan') applyObjectVisibility();
      if (key === 'grid') applyGridVisibility();
      if (key === 'noWalls') applyObjectVisibility();
      guideSig = '';
      savePrefs(); scheduleAutosave();
    });
  }
  $('#cbTransparent').addEventListener('change', (e) => { state.transparent = e.target.checked; scheduleAutosave(); });
  $('#cbLayers').addEventListener('change', (e) => { state.layers = e.target.checked; scheduleAutosave(); });
  $('#exportWidth').addEventListener('change', (e) => { state.exportWidth = Number(e.target.value); savePrefs(); scheduleAutosave(); });
  orbit.addEventListener('change', () => { markFrameDirty(); scheduleAutosave(); });
  transform.addEventListener('mouseUp', () => scheduleAutosave());
}

/* ============ 功能模式（3D 分镜 / 漫画分格） ============ */
function sceneSignature() {
  return JSON.stringify([
    state.look, state.stageId,
    state.objects, state.stageObjects,
    state.frames.map((f) => [f.id, f.lens, f.roll, f.aspect, f.position, f.target]),
  ]);
}
function setMode(mode) {
  state.mode = ['name', 'bubble'].includes(mode) ? mode : '3d';
  document.body.dataset.mode = state.mode;
  for (const b of $$('#rail .rail-item[data-mode]')) b.classList.toggle('active', b.dataset.mode === state.mode);
  lsSet(LS.mode, state.mode);
  if (state.mode === 'name') {
    nameTool.setMode('name');
  } else if (state.mode === 'bubble') {
    bubbleTool.setMode('bubble');
  } else {
    resizeViewport();
    guideSig = '';
  }
}
function nameSelectedPanel() {
  const page = nameTool.activePage();
  if (!page) return null;
  return page.panels.find((p) => p.id === state.name.selectedPanelId) || null;
}

function switchStage(id) {
  const s = STAGE_MAP[id];
  if (!s) return;
  commit(() => {
    state.stageId = id;
    state.stageObjects = buildStageProps(id);
    state.grid = s.grid;
    if (s.view) {
      camera.position.fromArray(s.view.pos);
      orbit.target.fromArray(s.view.target);
      state.view.pos = [...s.view.pos];
      state.view.target = [...s.view.target];
      state.lens = s.view.lens || state.lens;
      orbit.update();
    }
    rebuildScene();
    syncAllUI();
  });
  toast(t('toast.stage', { name: t('stage.' + id) }));
}

/* ============ 渲染循环 / 启动 ============ */
function resizeViewport() {
  const r = viewportEl.getBoundingClientRect();
  const W = Math.max(1, Math.floor(r.width)), H = Math.max(1, Math.floor(r.height));
  // 窗口尺寸变化时重新评估超采样倍率（像素总量超预算就退回 1:1）
  const pr = pickPixelRatio();
  if (Math.abs(renderer.getPixelRatio() - pr) > 1e-6) renderer.setPixelRatio(pr);
  renderer.setSize(W, H, false);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  updateCameraFov();
}
let shadowSpan = 14;
function updateSunShadow() {
  const dist = camera.position.distanceTo(orbit.target);
  // 场景尺度自适应：小房间阴影更锐利，神庙这种大场景也能覆盖
  const want = clamp(dist * 0.9, 6, 110);
  if (Math.abs(want - shadowSpan) > shadowSpan * 0.15) {
    shadowSpan = want;
    const c = sun.shadow.camera;
    c.left = -want; c.right = want; c.top = want; c.bottom = -want;
    c.near = 0.5; c.far = want * 4 + 60;
    c.updateProjectionMatrix();
  }
  sun.position.copy(orbit.target).add(SUN_OFFSET);
  sun.target.position.copy(orbit.target);
  sun.target.updateMatrixWorld();
}
let lastTick = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0, (now - lastTick) / 1000));
  lastTick = now;
  if (state.mode !== '3d') return;
  keyboardCameraUpdate(dt);
  orbit.update();
  if (state.roll) camera.rotateZ(rad(state.roll));
  updateSunShadow();
  updateOverlay();
  renderer.render(scene, camera);
}

// 调试钩子（自动化测试 / 控制台调试用）
window.MangaLayout = { THREE, scene, camera, renderer, orbit, transform, state, objMap, selBox, boxOf, undo, redo, serialize, restore, renderToCanvas, exportFrameSpec, applyLook, applySnapDuringDrag, setTool, setLens, setAspect, nameTool, bubbleTool, setMode };

function boot() {
  applyStaticText();
  bindUI();
  bindViewport();
  bindTransform();
  bindKeys();
  renderPanelControls();
  renderLibrary();
  renderHelp();

  if (window.innerWidth < 1180) {
    $('#leftPanel').classList.add('collapsed');
    $('#rightPanel').classList.add('collapsed');
  }

  const prefs = lsGet(LS.prefs, null);
  if (prefs) {
    if (prefs.show) state.show = { ...state.show, ...prefs.show };
    if (LOOK_OPTIONS.includes(prefs.look)) state.look = prefs.look;
    if (prefs.exportWidth) state.exportWidth = prefs.exportWidth;
    if (typeof prefs.lockSubject === 'boolean') state.lockSubject = prefs.lockSubject;
  }
  const saved = lsGet(LS.auto, null);
  if (saved && saved.stageObjects) {
    restore(saved);
    toast(t('toast.restored'));
  } else {
    restore(defaultProject());
  }
  resizeViewport();
  const ro = new ResizeObserver(() => { resizeViewport(); guideSig = ''; });
  ro.observe(viewportEl);
  const savedMode = lsGet(LS.mode, '3d');
  setMode(['name', 'bubble'].includes(savedMode) ? savedMode : '3d');
  animate();
}

boot();
