// 首頁的 Minecraft 寶箱（three.js r170，ES module）
// three 和 GLTFLoader 的實際網址寫在 index.html 的 importmap 裡
//
// 玩法：滑鼠移上去寶箱會打開；點一下，作品會像掉落物一樣噴出來散在寶箱周圍，
// 寶箱底下同時長出一座浮空草地小島，左右冒出花草（見「開箱時長出來的浮空小島」）。
// 點某個作品，寶箱和掉落物滑到左邊、右邊滑出那個作品的卡片（手機是從下面滑上來）；
// 點空白處 / 按 Esc / 按 × 收起卡片；再點寶箱本身，作品會飛回去、蓋子關上。
// 網址 #projects 會自動開箱，#projects/<repo> 會再打開那個作品的卡片。
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// 從 r109 升級時，為了讓寶箱看起來跟原本一樣：
// 1. 關掉 r152 之後預設開啟的色彩管理（原本的顏色是照舊版的方式算的）
THREE.ColorManagement.enabled = false;

const container = document.getElementById("chest-section");
const hint = container.querySelector(".floating-label .line2");
const itemLabel = document.createElement("div");
itemLabel.className = "chest-item-label";
container.appendChild(itemLabel);

// 右邊（手機是下面）滑出來的作品卡片
const card = document.createElement("aside");
card.className = "chest-card";
card.setAttribute("aria-live", "polite");
card.innerHTML = '<button type="button" class="chest-card-close" aria-label="關閉">×</button><div class="chest-card-body"></div>';
container.appendChild(card);

const langNames = { python: "Python", dart: "Dart", react: "React", kotlin: "Kotlin", html: "HTML", java: "Java" };

const HINT_CLOSED = "Click to open";
const HINT_OPEN = "Pick one!";
const CAMERA_Z = 50; // 原本的鏡頭距離

// 背景色跟著深色 / 淺色主題（要跟 css/dark.css 的區塊底色一樣）
const sceneColor = () => (document.documentElement.dataset.theme === "dark" ? 0x181b21 : 0xf5f7fa);

let scene, camera, renderer, mixer, model;
let isHovered = false; // 滑鼠是否在寶箱區塊上
let actions = []; // 模型的開箱動畫
let openness = 0; // 0 = 關著（模型的靜止姿勢），1 = 完全套用開箱動畫
let chestVisible = false; // 寶箱是否在畫面上
let frame = null; // requestAnimationFrame 的 id，null 代表沒在渲染
let cameraTargetZ = CAMERA_Z;
let cameraTargetY = 0; // 只有直式螢幕、還沒開箱時不是 0（見 idleCameraY）

// ---- 掉落物 ----
let projects = []; // 從 data/projects.json 攤平成一個陣列
let items = []; // { mesh, project, from, to, start, duration, phase, state }
let dropped = false; // 作品是不是已經噴出來了
let hoveredItem = null;
let selected = null; // 目前打開卡片的作品
let pending = null; // 網址要求自動開箱：{ slug }
const now = () => performance.now() / 1000; // 秒；不用 THREE.Clock，因為停止渲染再開始時它會歸零

// 選了作品時，畫面要往左（手機往上）讓出位置給卡片：用 camera.setViewOffset 平移整個畫面
const viewOffset = { x: 0, y: 0 };
const viewOffsetTarget = { x: 0, y: 0 };
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// 每個作品用 repo 名稱當代號，網址 #projects/<repo> 會用到
const slug = (project) =>
  project.links[0].url.replace(/\/+$/, "").split("/").pop().toLowerCase();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(sceneColor());
  window.addEventListener("themechange", () => {
    scene.background.setHex(sceneColor());
    if (frame === null && model) renderer.render(scene, camera); // 沒在播動畫時也要重畫一次
  });

  renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // 跟 r109 一樣，輸出時不做 sRGB 轉換
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = CAMERA_Z;

  // 2. r155 之後光源改成物理單位，強度乘上 π 才會跟原本一樣亮
  const light = new THREE.DirectionalLight(0xffffff, 1 * Math.PI);
  light.position.set(2, 2, 2);
  scene.add(light);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5 * Math.PI);
  scene.add(ambient);

  new GLTFLoader().load(
    "models/minecraft_chest.glb",
    function (gltf) {
      model = gltf.scene;
      model.scale.set(0.09, 0.09, 0.09);
      model.position.set(0, -7, 0);
      model.rotation.y = (Math.PI / 2) * -1;

      scene.add(model);

      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        // 模型的靜止姿勢是關著的，動畫則是「打開後蓋子晃一下」。
        // 用權重控制開關：權重 0 = 關著，1 = 打開並播動畫，中間的值 three.js 會自動補間成半開
        actions = gltf.animations.map((clip) => {
          const action = mixer.clipAction(clip);
          action.setEffectiveWeight(0);
          action.play();
          return action;
        });
      }

      frameIdle(true);
      renderer.render(scene, camera);
      if (chestVisible) startLoop();
      tryAutoOpen();
    },
    undefined,
    function (error) {
      console.error("❌ 模型載入失敗:", error);
    }
  );

  loadProjects();

  hint.textContent = HINT_CLOSED;

  // 滑鼠移上去打開、離開關上；實際的開合在 animate() 裡慢慢靠近目標
  // 用 pointer 事件才能分辨觸控：手機點一下會觸發 mouseenter 卻永遠不會 mouseleave，蓋子會一直開著
  container.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "touch") isHovered = true;
  });
  container.addEventListener("pointerleave", () => {
    isHovered = false;
    setHovered(null);
  });

  // 寶箱不在畫面上時停止渲染
  new IntersectionObserver(([entry]) => {
    chestVisible = entry.isIntersecting;
    if (chestVisible) startLoop();
    else stopLoop();
  }).observe(container);

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("click", onClick);
  card.querySelector(".chest-card-close").addEventListener("click", () => deselect());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") deselect();
  });

  // 導覽列的「作品」連到 ./#projects；在首頁點也要有反應
  readHash();
  window.addEventListener("hashchange", () => {
    readHash();
    tryAutoOpen();
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    applyViewOffset();
    if (dropped) layoutItems(false); // 換到新螢幕大小的位置
    else frameIdle();
  });
}

// ---- 讀作品資料、做成貼圖 ----
async function loadProjects() {
  try {
    const groups = await (await fetch("data/projects.json")).json();
    projects = groups.flatMap((g) => g.projects.map((p) => ({ ...p, category: g.category })));
  } catch (e) {
    console.error("無法讀取作品資料:", e);
  }
  tryAutoOpen();
}

// ---- 網址 #projects / #projects/<repo> ----
function readHash() {
  const m = decodeURIComponent(location.hash).match(/^#projects(?:\/(.+))?$/);
  if (m) pending = { slug: m[1] ? m[1].toLowerCase() : null };
}

function tryAutoOpen() {
  if (!pending || !model || !projects.length) return;
  const want = pending.slug;
  pending = null;
  container.scrollIntoView();
  const wasDropped = dropped;
  if (!dropped) dropItems();
  const item = want && items.find((i) => slug(i.project) === want);
  if (item) setTimeout(() => selectItem(item), wasDropped ? 0 : 900); // 等掉落物落地再打開卡片
}

// 每個作品畫成一塊深色圓角方塊，中間放作品 icon（沒有的話放程式語言 icon）
function makeTexture(project) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);

  ctx.fillStyle = "#2c2c2c";
  ctx.beginPath();
  ctx.roundRect(8, 8, size - 16, size - 16, 40);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#ffcc66";
  ctx.stroke();

  const img = new Image();
  img.onload = () => {
    const pad = 52;
    if (project.iconBg) {
      ctx.fillStyle = project.iconBg;
      ctx.beginPath();
      ctx.roundRect(pad - 8, pad - 8, size - 2 * pad + 16, size - 2 * pad + 16, 24);
      ctx.fill();
    }
    ctx.drawImage(img, pad, pad, size - 2 * pad, size - 2 * pad);
    texture.needsUpdate = true;
  };
  img.src = project.icon || `images/lang/${project.lang}.svg`;
  return texture;
}

// ---- 排版：在螢幕上找寶箱周圍的空位，再換算成 3D 座標 ----
// 寶箱和掉落物可以用的範圍：平常是整個畫面；打開卡片時桌機剩左邊、手機剩卡片上面
function viewRegion() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (!selected) return { x0: 0, x1: W, y0: 0, y1: H };
  // 手機：固定預留卡片的最大高度（CSS 的 max-height: 48%），換作品時掉落物才不會因為卡片高度不同而整個重排
  if (W < 600) return { x0: 0, x1: W, y0: 0, y1: H * 0.52 - 24 };
  return { x0: 0, x1: W * 0.55, y0: 0, y1: H };
}

// 還沒開箱時的鏡頭距離：直式手機的水平視角很窄，鏡頭固定在 CAMERA_Z 的話寶箱會比螢幕還寬，
// 所以窄螢幕要退後，讓寶箱大約佔畫面寬度的 6 成；桌機維持原本的距離
function idleCameraZ() {
  if (!model) return CAMERA_Z;
  const size = chestBox().getSize(new THREE.Vector3());
  const viewH1 = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return Math.max(CAMERA_Z, size.x / (0.6 * viewH1 * camera.aspect));
}

// 直式螢幕：寶箱本來偏下面，上方標題和寶箱中間空一大塊；把鏡頭上下移，讓寶箱落在標題下方空間的正中間。
// 橫式（桌機）維持原本的構圖
let closedCenter = null; // 關著的寶箱中心（chestBox() 量的是蓋子全開的樣子，蓋子翹起來，中心會偏高）
function closedChestCenter() {
  if (!closedCenter) {
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (o.isSkinnedMesh) {
        o.skeleton.update();
        o.computeBoundingBox();
      }
    });
    closedCenter = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  }
  return closedCenter;
}

function idleCameraY(z) {
  if (!model || camera.aspect >= 1) return 0;
  const H = window.innerHeight;
  const center = closedChestCenter();
  const worldPerPx = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (z - center.z)) / H;
  const label = container.querySelector(".floating-label").getBoundingClientRect();
  const labelBottom = label.bottom - container.getBoundingClientRect().top;
  const want = (labelBottom + H) / 2; // 寶箱中心想要在螢幕上的 y
  return center.y + (want - H / 2) * worldPerPx;
}

function frameIdle(immediate = false) {
  if (model) closedChestCenter(); // 第一次要在 chestBox() 把姿勢換成開蓋之前量
  cameraTargetZ = idleCameraZ();
  cameraTargetY = idleCameraY(cameraTargetZ);
  if (immediate) {
    camera.position.z = cameraTargetZ;
    camera.position.y = cameraTargetY;
  }
}

function applyViewOffset() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const idle = Math.abs(viewOffset.x) < 0.5 && Math.abs(viewOffset.y) < 0.5 && !viewOffsetTarget.x && !viewOffsetTarget.y;
  if (idle) {
    if (camera.view) camera.clearViewOffset();
  } else {
    camera.setViewOffset(W, H, viewOffset.x, viewOffset.y, W, H);
  }
}

function layoutItems(fromChest) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const mobile = W < 600;
  const region = viewRegion();
  const regionW = region.x1 - region.x0;
  const regionH = region.y1 - region.y0;

  // 把整個畫面平移，讓寶箱出現在可用範圍的正中間
  viewOffsetTarget.x = W / 2 - (region.x0 + region.x1) / 2;
  viewOffsetTarget.y = H / 2 - (region.y0 + region.y1) / 2;

  // 1. 決定鏡頭要退多遠：讓寶箱縮到可用範圍高度的 3 成左右，窄的時候還要看寬度
  const box = chestBox();
  const size = box.getSize(new THREE.Vector3());
  const all = island.box ? box.clone().union(island.box) : box; // 寶箱 + 小島
  const allSize = all.getSize(new THREE.Vector3());
  const viewH = (z) => 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * z;
  // 鏡頭在 y = 0（大約是寶箱中間，比草地高，才看得到草地表面）：上下兩邊比較遠的那邊要放得進畫面
  const halfH = Math.max(all.max.y, -all.min.y);
  const zForHeight = (Math.max(size.y / 0.3, (2 * halfH) / 0.85) * H) / (regionH * viewH(1));
  // 直式手機小島只佔 6 成寬，兩邊才留得下一排掉落物
  const islandFrac = camera.aspect < 1 ? 0.6 : 0.8;
  const zForWidth = (Math.max(size.x / 0.42, allSize.x / islandFrac) * W) / (regionW * viewH(1) * camera.aspect);
  cameraTargetZ = Math.max(CAMERA_Z, zForHeight, zForWidth);
  cameraTargetY = 0; // 開箱後的構圖用 viewOffset 置中，鏡頭回到原本的高度

  // 用「退好、平移好之後」的鏡頭來算位置
  const cam = camera.clone();
  cam.position.z = cameraTargetZ;
  cam.position.y = cameraTargetY;
  cam.setViewOffset(W, H, viewOffsetTarget.x, viewOffsetTarget.y, W, H);
  cam.updateMatrixWorld();

  // 2. 寶箱和標題在螢幕上佔的範圍，掉落物要避開
  const toScreen = (v) => {
    const p = v.clone().project(cam);
    return { x: ((p.x + 1) / 2) * W, y: ((1 - p.y) / 2) * H };
  };
  const corners = [];
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) corners.push(toScreen(new THREE.Vector3(x, y, z)));
  const chestScreen = {
    left: Math.min(...corners.map((c) => c.x)),
    right: Math.max(...corners.map((c) => c.x)),
    top: Math.min(...corners.map((c) => c.y)),
    bottom: Math.max(...corners.map((c) => c.y)),
  };
  let islandScreen = null;
  if (island.box) {
    const pts = [];
    for (const x of [island.box.min.x, island.box.max.x])
      for (const y of [island.box.min.y, island.box.max.y])
        for (const z of [island.box.min.z, island.box.max.z]) pts.push(toScreen(new THREE.Vector3(x, y, z)));
    islandScreen = {
      left: Math.min(...pts.map((c) => c.x)),
      right: Math.max(...pts.map((c) => c.x)),
      top: Math.min(...pts.map((c) => c.y)),
      bottom: Math.max(...pts.map((c) => c.y)),
    };
  }
  // 手機打開卡片時標題會淡出，不用避開
  const label = container.querySelector(".floating-label").getBoundingClientRect();
  const sectionTop = container.getBoundingClientRect().top;
  const labelBottom = mobile && selected ? region.y0 : label.bottom - sectionTop;
  const center = { x: (chestScreen.left + chestScreen.right) / 2, y: (chestScreen.top + chestScreen.bottom) / 2 };

  // 3. 以寶箱為中心往外鋪一張對稱的格子，挑離寶箱最近的格子；
  //    不夠放就先縮小間距、再縮小掉落物
  const basePx = mobile ? 54 : 78; // 掉落物在螢幕上的大小
  let spots = [];
  let itemPx = basePx;
  for (const shrink of [1, 0.85, 0.7, 0.6]) {
    itemPx = basePx * shrink;
    const pad = itemPx * 0.4;
    const topLimit = Math.max(region.y0, labelBottom) + pad;
    spots = [];
    for (let gap = 1.6; gap >= 1.05 && spots.length < projects.length; gap -= 0.1) {
      const step = itemPx * gap;
      spots = [];
      const nx = Math.ceil(W / step);
      const ny = Math.ceil(H / step);
      for (let j = -ny; j <= ny; j++) {
        const y = center.y + j * step;
        if (y - itemPx / 2 < topLimit || y + itemPx / 2 > region.y1 - 8) continue;
        for (let k = -nx; k <= nx; k++) {
          const x = center.x + k * step;
          if (x - itemPx / 2 < region.x0 + 8 || x + itemPx / 2 > region.x1 - 8) continue;
          const hits = (r) => r && x + itemPx / 2 > r.left - pad && x - itemPx / 2 < r.right + pad &&
            y + itemPx / 2 > r.top - pad && y - itemPx / 2 < r.bottom + pad;
          const inside = hits(chestScreen) || hits(islandScreen);
          // 距離相同時讓左右交替，兩邊才會一樣多
          if (!inside) spots.push({ x, y, d: Math.hypot((x - center.x) * 0.8, y - center.y) + (k > 0 ? 0.01 : 0) });
        }
      }
    }
    if (spots.length >= projects.length) break;
  }
  spots.sort((a, b) => a.d - b.d);
  spots = spots.slice(0, projects.length).sort((a, b) => a.y - b.y || a.x - b.x);

  // 4. 螢幕座標 → 寶箱前方那個平面上的 3D 座標
  const planeZ = box.max.z + 2;
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
  const worldPerPx = viewH(cameraTargetZ - planeZ) / H;
  const itemSize = itemPx * worldPerPx;
  const mouth = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);

  items.forEach((item, i) => {
    const s = spots[i] || spots[spots.length - 1];
    raycaster.setFromCamera(new THREE.Vector2((s.x / W) * 2 - 1, -(s.y / H) * 2 + 1), cam);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    item.size = itemSize;
    item.from = fromChest ? mouth.clone() : item.mesh.position.clone();
    item.to = target;
    item.start = now() + (fromChest ? i * 0.06 : 0);
    item.duration = fromChest ? 0.9 : 0.5;
    item.arc = fromChest ? itemSize * 3 : 0;
    item.state = "flying";
  });
}

// 寶箱「蓋子全開、沒有跟著滑鼠轉」時的範圍，排版用
function chestBox() {
  const rx = model.rotation.x;
  const ry = model.rotation.y;
  model.rotation.set(0, -Math.PI / 2, 0);
  // 動畫時間 0 的姿勢其實是關著的，蓋子在動畫一半時開最大，所以用那一刻來量
  const times = actions.map((action) => action.time);
  actions.forEach((action) => {
    action.time = action.getClip().duration / 2;
    action.setEffectiveWeight(1);
  });
  mixer?.update(0);
  model.updateMatrixWorld(true);
  // 蒙皮模型的外框會被快取，而且骨架矩陣平常要到渲染時才更新，兩個都要手動算
  model.traverse((o) => {
    if (o.isSkinnedMesh) {
      o.skeleton.update();
      o.computeBoundingBox();
    }
  });
  const box = new THREE.Box3().setFromObject(model);

  model.rotation.set(rx, ry, 0);
  actions.forEach((action, i) => {
    action.time = times[i];
    action.setEffectiveWeight(openness);
  });
  mixer?.update(0);
  return box;
}

// ---- 開箱時長出來的浮空小島 ----
// 寶箱底下從下面長出草地方塊，左右兩側再冒出花、草、蘑菇。
// 方塊和植物的 16×16 像素圖都是用程式畫的（沒有用 Minecraft 的材質檔）
const island = { stage: null, blocks: [], plants: [], state: "hidden", t0: 0, box: null };
const STAGE_YAW = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

// 固定種子的亂數：每次畫出來的方塊花紋都一樣
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pixelTexture(draw) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  draw(canvas.getContext("2d"));
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter; // 放大時保持一格一格的像素感
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

const GRASS = ["#5d9e3a", "#67ab41", "#53913a", "#71b84a"];
const DIRT = ["#8b5a34", "#7a4e2d", "#966540", "#6e4528"];

function speckle(ctx, colors, rand, rows = 16) {
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < 16; x++) {
      ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
      ctx.fillRect(x, y, 1, 1);
    }
}

// 用字串畫植物：一個字一格，"." 是透明
const PLANTS = {
  redFlower: {
    pal: { r: "#e0352d", R: "#a8211c", c: "#3a2a1a", g: "#4c9c34", G: "#2f6e22" },
    rows: [
      "................", "................", "................", "................",
      "......rr........", ".....rRRr.......", "....rRccRr......", "....rRccRr......",
      ".....rRRr.......", "......rr........", ".......g........", "....gg.g........",
      ".....gGg..g.....", ".......g.gG.....", ".......gGg......", ".......g........",
    ],
  },
  yellowFlower: {
    pal: { y: "#f6d23a", Y: "#d9a520", o: "#e9821c", g: "#4c9c34", G: "#2f6e22" },
    rows: [
      "................", "................", "................", "................",
      "................", ".......y........", "......yYy.......", ".....yYoYy......",
      "......yYy.......", ".......y........", ".......g........", ".......g..g.....",
      "....gg.g.gG.....", ".....gGg.g......", ".......gGg......", ".......g........",
    ],
  },
  blueFlower: {
    pal: { b: "#5aa7f0", B: "#2f6fc4", w: "#ffffff", g: "#4c9c34", G: "#2f6e22" },
    rows: [
      "................", "................", "................", "................",
      "................", "................", ".........b......", "...b....bBb.....",
      "..bBb....b......", "...b.....g......", "...g.....g......", "...g....g.......",
      "....g...g.......", "....gG.gG.......", ".....gGg........", "......g.........",
    ],
  },
  tuft: {
    pal: { g: "#6fb24a", G: "#4c8f33" },
    rows: [
      "................", "................", "................", "................",
      ".........g......", "..g......g......", "..g...g..G...g..", "..G...g.gG...g..",
      "...G..G.gG..gG..", "...GgGG.G...G...", "....gGg.G..gG...", "....GGgGG.gG....",
      ".....GGgGGgG....", "......GgGGG.....", "......GGGGG.....", ".......GGG......",
    ],
  },
  mushroom: {
    pal: { r: "#d8312b", R: "#a51f1c", w: "#ffffff", s: "#efe3c8", S: "#cdbb98" },
    rows: [
      "................", "................", "................", "................",
      "................", "................", "................", "......rrrr......",
      "....rrwrrrrr....", "...rrrrrrrwrr...", "...rwrRRrrrrr...", "...RRRRRRRRRR...",
      "......sssS......", "......sssS......", "......sssS......", "......sssS......",
    ],
  },
};

function plantTexture({ pal, rows }) {
  return pixelTexture((ctx) =>
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === ".") return;
        ctx.fillStyle = pal[ch];
        ctx.fillRect(x, y, 1, 1);
      })
    )
  );
}

function buildIsland() {
  const box = chestBox();
  const bs = ((box.max.x - box.min.x) * 16) / 14; // 寶箱寬度是一格的 14/16（深度會被打開的蓋子撐大，不能用）
  const base = model.position;
  const cx = (box.min.x + box.max.x) / 2 - base.x;
  const cz = (box.min.z + box.max.z) / 2 - base.z;
  const top = box.min.y - base.y; // 寶箱底部 = 草地表面

  const rand = seeded(487);
  const topTex = pixelTexture((ctx) => speckle(ctx, GRASS, rand));
  const dirtTex = pixelTexture((ctx) => speckle(ctx, DIRT, rand));
  const sideTex = pixelTexture((ctx) => {
    speckle(ctx, DIRT, rand);
    for (let x = 0; x < 16; x++) {
      const h = 3 + (rand() < 0.45 ? 1 : 0) + (rand() < 0.2 ? 1 : 0); // 草往下垂的長度不一樣
      for (let y = 0; y < h; y++) {
        ctx.fillStyle = GRASS[Math.floor(rand() * GRASS.length)];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
  const mat = (map) => new THREE.MeshLambertMaterial({ map });
  const side = mat(sideTex), dirt = mat(dirtTex);
  const grassMats = [side, side, mat(topTex), dirt, side, side];
  const geo = new THREE.BoxGeometry(bs, bs, bs);

  const stage = new THREE.Group();
  stage.position.copy(base);
  scene.add(stage);

  // 上面一層 3×3 草地，底下掛兩格泥土（故意不對稱），看起來像浮空島
  const layout = [];
  for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++) layout.push([i, 0, k, true]);
  layout.push([-1, -1, 0, false], [0, -1, 0, false]);
  island.blocks = layout.map(([i, j, k, grass]) => {
    const mesh = new THREE.Mesh(geo, grass ? grassMats : dirt);
    const to = new THREE.Vector3(cx + i * bs, top - bs / 2 + j * bs, cz + k * bs);
    mesh.visible = false;
    stage.add(mesh);
    // 從最下面那格開始往上長，最上層再從中間往外擴散
    const delay = (1 + j) * 0.1 + (j === 0 ? (Math.abs(i) + Math.abs(k)) * 0.06 : 0);
    return { mesh, to, delay };
  });

  // 植物：左右兩側的草地上，寶箱正前方和後面不放（會擋到寶箱）
  const spots = [
    [-1, 1, "redFlower"], [-1, 0, "tuft"], [-1, -1, "mushroom"],
    [1, 1, "yellowFlower"], [1, 0, "blueFlower"], [1, -1, "tuft"],
  ];
  island.plants = spots.map(([i, k, kind], n) => {
    const material = new THREE.MeshBasicMaterial({ map: plantTexture(PLANTS[kind]), alphaTest: 0.5, side: THREE.DoubleSide });
    const plane = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0); // 底部當支點，長出來和搖擺都從根部開始
    const group = new THREE.Group();
    const a = new THREE.Mesh(plane, material);
    const b = new THREE.Mesh(plane, material);
    a.rotation.y = Math.PI / 4; // 兩片交叉，從哪個角度看都有東西
    b.rotation.y = -Math.PI / 4;
    group.add(a, b);
    const jitter = () => (rand() - 0.5) * bs * 0.3;
    group.position.set(cx + i * bs + jitter(), top, cz + k * bs + jitter());
    group.visible = false;
    stage.add(group);
    return { group, size: bs * (0.75 + rand() * 0.25), delay: 0.5 + n * 0.07, phase: rand() * Math.PI * 2 };
  });

  // 排版要避開的範圍（寶箱沒轉的時候）：方塊 + 植物的高度
  island.box = new THREE.Box3(
    new THREE.Vector3(base.x + cx - 1.5 * bs, base.y + top - 2 * bs, base.z + cz - 1.5 * bs),
    new THREE.Vector3(base.x + cx + 1.5 * bs, base.y + top + bs, base.z + cz + 1.5 * bs)
  );
  island.stage = stage;
}

function showIsland(show) {
  if (!model) return;
  if (show && !island.stage) buildIsland();
  if (!island.stage) return;
  island.state = show ? "growing" : "shrinking";
  island.t0 = now();
}

const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

function updateIsland() {
  if (!island.stage || island.state === "hidden") return;
  // 小島跟著寶箱一起轉（寶箱本身多轉了 -90 度，要扣回來）
  island.stage.quaternion.copy(model.quaternion).multiply(STAGE_YAW);
  const t = now() - island.t0;
  const growing = island.state === "growing";
  const bs = island.blocks[0].mesh.geometry.parameters.width;
  let done = true;

  island.blocks.forEach(({ mesh, to, delay }) => {
    // 收起來的時候倒過來、而且要快：鏡頭會同時拉近，慢了方塊會在畫面上被放得很大
    const k = growing
      ? Math.min(1, Math.max(0, (t - delay) / 0.5))
      : Math.min(1, Math.max(0, (t - (0.3 - delay) * 0.3) / 0.22));
    if (k < 1) done = false;
    const p = growing ? easeOutBack(k) : (1 - k) * (1 - k);
    mesh.visible = p > 0.01;
    mesh.position.copy(to);
    mesh.position.y -= (1 - Math.min(p, 1)) * bs * 2.5;
    mesh.scale.setScalar(Math.max(0.01, Math.min(p, 1.08)));
  });

  island.plants.forEach(({ group, size, delay, phase }) => {
    const k = growing ? Math.min(1, Math.max(0, (t - delay) / 0.35)) : Math.min(1, t / 0.12);
    if (k < 1) done = false;
    const p = growing ? easeOutBack(k) : 1 - k;
    group.visible = p > 0.01;
    group.scale.setScalar(Math.max(0.01, p) * size);
    group.rotation.z = Math.sin(now() * 1.8 + phase) * 0.08; // 風吹的搖擺
  });

  if (done && !growing) {
    island.state = "hidden";
    island.blocks.forEach((b) => (b.mesh.visible = false));
    island.plants.forEach((p) => (p.group.visible = false));
  }
}

function dropItems() {
  if (!projects.length || !model) return;
  dropped = true;
  hint.textContent = HINT_OPEN;
  showIsland(true);
  if (!items.length) {
    items = projects.map((project) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        // depthTest 關掉：寶箱跟著滑鼠轉時，小島的方塊不會擋住作品
        new THREE.MeshBasicMaterial({ map: makeTexture(project), transparent: true, side: THREE.DoubleSide, depthTest: false })
      );
      mesh.renderOrder = 10;
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, project, phase: Math.random() * Math.PI * 2 };
    });
  }
  layoutItems(true);
}

function recallItems() {
  deselect(false);
  dropped = false;
  hint.textContent = HINT_CLOSED;
  showIsland(false);
  setHovered(null);
  // 等作品飛回寶箱再把鏡頭拉近：一邊飛一邊拉近，作品會在畫面上被放得很大
  setTimeout(() => {
    if (!dropped) frameIdle();
  }, 500);
  const box = chestBox();
  const mouth = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
  items.forEach((item, i) => {
    item.from = item.mesh.position.clone();
    item.to = mouth;
    item.start = now() + (items.length - 1 - i) * 0.03;
    item.duration = 0.5;
    item.arc = item.size * 1.5;
    item.state = "returning";
  });
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function updateItems() {
  const t0 = now();
  for (const item of items) {
    if (item.state === undefined || item.state === "hidden") continue;
    const { mesh } = item;
    const t = Math.min(1, Math.max(0, (t0 - item.start) / item.duration));
    let scale = item.size;

    if (item.state === "flying" || item.state === "returning") {
      if (t0 < item.start) continue;
      mesh.visible = true;
      // 水平方向等速、垂直方向加一段拋物線，看起來像被拋出來
      const k = item.state === "flying" ? easeOut(t) : t * t;
      mesh.position.lerpVectors(item.from, item.to, k);
      mesh.position.y += item.arc * 4 * t * (1 - t);
      scale *= item.state === "flying" ? 0.3 + 0.7 * easeOut(t) : 1 - 0.8 * t;
      if (t >= 1) {
        if (item.state === "flying") item.state = "landed";
        else {
          item.state = "hidden";
          mesh.visible = false;
        }
      }
    } else if (item.state === "landed") {
      // 落地之後上下浮動
      mesh.position.copy(item.to);
      mesh.position.y += Math.sin(t0 * 2 + item.phase) * item.size * 0.08;
    }

    const focus = item === hoveredItem || item === selected;
    if (focus) scale *= item === selected ? 1.3 : 1.2;
    mesh.scale.setScalar(scale);
    mesh.rotation.y = focus ? 0 : Math.sin(t0 * 1.2 + item.phase) * 0.6; // 像掉落物一樣左右轉
  }
}

// ---- 滑鼠 / 觸控 ----
function pickItem(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const meshes = items.filter((i) => i.state === "landed").map((i) => i.mesh);
  const hit = raycaster.intersectObjects(meshes)[0];
  return hit ? items.find((i) => i.mesh === hit.object) : null;
}

function pickChest(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(model, true).length > 0;
}

function setHovered(item) {
  hoveredItem = item;
  renderer.domElement.style.cursor = item ? "pointer" : "";
  if (!item || item === selected) {
    // 已經打開卡片的作品不用再顯示名稱
    itemLabel.classList.remove("show");
    return;
  }
  itemLabel.textContent = item.project.name;
  itemLabel.classList.add("show");
}

function onPointerMove(event) {
  if (event.pointerType === "touch") return;
  if (!dropped) {
    setHovered(null);
    return;
  }
  setHovered(pickItem(event));
  if (!hoveredItem && model) renderer.domElement.style.cursor = pickChest(event) ? "pointer" : "";
}

function onClick(event) {
  if (!model) return;
  if (!dropped) {
    dropItems();
    return;
  }
  const item = pickItem(event);
  if (item) {
    if (item !== selected) selectItem(item);
    return;
  }
  if (pickChest(event)) recallItems();
  else deselect();
}

// ---- 作品卡片 ----
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function fillCard(project) {
  const body = card.querySelector(".chest-card-body");
  body.replaceChildren();
  body.append(el("p", "chest-card-category", project.category));

  const head = el("div", "chest-card-head");
  if (project.icon) {
    const icon = el("img", "chest-card-icon");
    icon.src = project.icon;
    icon.alt = "";
    if (project.iconBg) icon.style.background = project.iconBg;
    head.append(icon);
  }
  head.append(el("h3", "", project.name));
  body.append(head, el("p", "chest-card-desc", project.desc));

  const footer = el("div", "chest-card-footer");
  const lang = el("span", "chest-card-lang");
  const langIcon = el("img");
  langIcon.src = `images/lang/${project.lang}.svg`;
  langIcon.alt = "";
  lang.append(langIcon, langNames[project.lang] || project.lang);
  const links = el("div", "chest-card-links");
  for (const link of project.links) {
    const a = el("a", "", link.label);
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener";
    links.append(a);
  }
  footer.append(lang, links);
  body.append(footer);
}

function selectItem(item) {
  const switching = !!selected;
  selected = item;
  fillCard(item.project);
  if (switching) {
    // 換作品時內容淡入一下
    card.querySelector(".chest-card-body").animate(
      [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
      { duration: 250, easing: "ease-out" }
    );
  }
  card.classList.add("open");
  container.classList.add("focused");
  layoutItems(false);
}

function deselect(relayout = true) {
  if (!selected) return;
  selected = null;
  card.classList.remove("open");
  container.classList.remove("focused");
  viewOffsetTarget.x = viewOffsetTarget.y = 0;
  if (relayout && dropped) layoutItems(false);
}

// 名稱標籤跟著作品走
function updateLabel() {
  if (!hoveredItem) return;
  const p = hoveredItem.mesh.position.clone().project(camera);
  const x = ((p.x + 1) / 2) * renderer.domElement.clientWidth;
  const y = ((1 - p.y) / 2) * renderer.domElement.clientHeight;
  const half = (hoveredItem.size * 1.2) / 2;
  const top = hoveredItem.mesh.position.clone().setY(hoveredItem.mesh.position.y + half).project(camera);
  const w = itemLabel.offsetWidth;
  const W = renderer.domElement.clientWidth;
  itemLabel.style.left = `${Math.min(Math.max(x, w / 2 + 8), W - w / 2 - 8)}px`; // 不要超出畫面
  itemLabel.style.top = `${((1 - top.y) / 2) * renderer.domElement.clientHeight - 8}px`;
}

function animate() {
  frame = requestAnimationFrame(animate);

  if (mixer) {
    const target = isHovered || dropped ? 1 : 0; // 作品噴出來的時候蓋子保持打開
    openness += (target - openness) * 0.12; // 每一幀往目標靠近一點，開合比較自然
    if (target === 0 && openness < 0.001) {
      openness = 0;
      actions.forEach((action) => (action.time = 0)); // 關好了，下次從頭開始晃
    }
    actions.forEach((action) => action.setEffectiveWeight(openness));
    mixer.update(0.02);
  }

  // 鏡頭慢慢退到（或回到）目標距離，畫面慢慢平移到目標位置
  camera.position.z += (cameraTargetZ - camera.position.z) * 0.08;
  camera.position.y += (cameraTargetY - camera.position.y) * 0.08;
  viewOffset.x += (viewOffsetTarget.x - viewOffset.x) * 0.1;
  viewOffset.y += (viewOffsetTarget.y - viewOffset.y) * 0.1;
  applyViewOffset();

  updateIsland();
  updateItems();
  updateLabel();
  renderer.render(scene, camera);
}

function startLoop() {
  if (frame === null && model) frame = requestAnimationFrame(animate);
}

function stopLoop() {
  if (frame !== null) {
    cancelAnimationFrame(frame);
    frame = null;
  }
}

init();

// 寶箱跟著滑鼠轉
document.body.addEventListener("mousemove", (event) => {
  const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
  const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

  if (model) {
    const rotationX = mouseY * -1;
    const rotationY = mouseX * 0.4 + Math.PI / -2;

    model.rotation.x += (rotationX - model.rotation.x) * 0.08;
    model.rotation.y += (rotationY - model.rotation.y) * 0.08;
  }
});
