// 首頁的 Minecraft 寶箱（three.js r170，ES module）
// three 和 GLTFLoader 的實際網址寫在 index.html 的 importmap 裡
//
// 玩法：滑鼠移上去寶箱會打開；點一下，作品會像掉落物一樣噴出來散在寶箱周圍，
// 同時整個區塊最底下長出一排草地，左右兩邊冒出樹和花草。
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

// ---- 開箱時：整個專案區塊的最底下長出一排草地方塊，畫面左右兩邊冒出樹和花草 ----
// 用 DOM 疊在 canvas 上（不是 3D），像素圖都是用 canvas 一格一格畫的（沒有用 Minecraft 的材質檔）
const groundEl = document.createElement("div"); // 草地方塊（overflow: hidden，往下藏起來的時候看不到）
groundEl.className = "chest-ground";
const decoEl = document.createElement("div"); // 左右兩邊的樹、花草
decoEl.className = "chest-decos";
container.append(groundEl, decoEl);
let groundBs = 0; // 一格方塊在螢幕上幾 px
let groundWidth = 0;
let decoRects = []; // 樹和花草佔的範圍（區塊座標），掉落物要避開

// 固定種子的亂數：每次畫出來的花紋都一樣
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRASS = ["#5d9e3a", "#67ab41", "#53913a", "#71b84a"];
const DIRT = ["#8b5a34", "#7a4e2d", "#966540", "#6e4528"];

// 一欄 = 上面一格草地方塊的側面 + 下面一格泥土，16×32
function groundColumn(rand) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 16; x++) {
      ctx.fillStyle = DIRT[Math.floor(rand() * DIRT.length)];
      ctx.fillRect(x, y, 1, 1);
    }
  for (let x = 0; x < 16; x++) {
    const h = 3 + (rand() < 0.45 ? 1 : 0) + (rand() < 0.2 ? 1 : 0); // 草往下垂的長度不一樣
    for (let y = 0; y < h; y++) {
      ctx.fillStyle = GRASS[Math.floor(rand() * GRASS.length)];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // 兩格中間一條淡淡的接縫
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  ctx.fillRect(0, 16, 16, 1);
  return canvas.toDataURL();
}

// 用字串畫的像素圖：一個字一格，"." 是透明
const DECOS = {
  tree: {
    pal: { l: "#4f9a36", L: "#3b7a29", d: "#2f6322", t: "#7a5532", T: "#5a3d22" },
    rows: [
      "......llll......", "....llLLllll....", "...lLLllllLll...", "..llllLLllllLl..",
      "..lLlllldllLLl..", ".lllLLllllllllL.", ".llllllLLlldlll.", ".lLLlldllllLLll.",
      ".llllllllllllll.", "..llLlllLLllll..", "..lllldllllLl...", "...llltTllll....",
      ".......tT.......", ".......tT.......", ".......tT.......", ".......tT.......",
      ".......tT.......", ".......tT.......", ".......tT.......", ".......tT.......",
      "......ttTT......",
    ],
  },
  redFlower: {
    pal: { r: "#e0352d", R: "#a8211c", c: "#3a2a1a", g: "#4c9c34", G: "#2f6e22" },
    rows: [
      "......rr........", ".....rRRr.......", "....rRccRr......", "....rRccRr......",
      ".....rRRr.......", "......rr........", ".......g........", "....gg.g........",
      ".....gGg..g.....", ".......g.gG.....", ".......gGg......", ".......g........",
    ],
  },
  yellowFlower: {
    pal: { y: "#f6d23a", Y: "#d9a520", o: "#e9821c", g: "#4c9c34", G: "#2f6e22" },
    rows: [
      "................", ".......y........", "......yYy.......", ".....yYoYy......",
      "......yYy.......", ".......y........", ".......g........", ".......g..g.....",
      "....gg.g.gG.....", ".....gGg.g......", ".......gGg......", ".......g........",
    ],
  },
  blueFlower: {
    pal: { b: "#5aa7f0", B: "#2f6fc4", g: "#4c9c34", G: "#2f6e22" },
    rows: [
      "................", "................", ".........b......", "...b....bBb.....",
      "..bBb....b......", "...b.....g......", "...g.....g......", "...g....g.......",
      "....g...g.......", "....gG.gG.......", ".....gGg........", "......g.........",
    ],
  },
  tuft: {
    pal: { g: "#6fb24a", G: "#4c8f33" },
    rows: [
      ".........g......", "..g......g......", "..g...g..G...g..", "..G...g.gG...g..",
      "...G..G.gG..gG..", "...GgGG.G...G...", "....gGg.G..gG...", "....GGgGG.gG....",
      ".....GGgGGgG....", "......GgGGG.....", "......GGGGG.....", ".......GGG......",
    ],
  },
  mushroom: {
    pal: { r: "#d8312b", R: "#a51f1c", w: "#ffffff", s: "#efe3c8", S: "#cdbb98" },
    rows: [
      "................", "................", "................", "......rrrr......",
      "....rrwrrrrr....", "...rrrrrrrwrr...", "...rwrRRrrrrr...", "...RRRRRRRRRR...",
      "......sssS......", "......sssS......", "......sssS......", "......sssS......",
    ],
  },
};

const decoImages = {};
function decoImage(kind) {
  if (!decoImages[kind]) {
    const { pal, rows } = DECOS[kind];
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = rows.length;
    const ctx = canvas.getContext("2d");
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === ".") return;
        ctx.fillStyle = pal[ch];
        ctx.fillRect(x, y, 1, 1);
      })
    );
    decoImages[kind] = canvas.toDataURL();
  }
  return decoImages[kind];
}

function buildGround() {
  const W = container.clientWidth;
  const bs = W < 600 ? 32 : 48;
  if (W === groundWidth && bs === groundBs) return;
  groundWidth = W;
  groundBs = bs;
  const rand = seeded(487);

  // 草地：一欄一個 div，從中間往兩邊依序長上來
  const variants = [0, 1, 2, 3].map(() => groundColumn(rand));
  const cols = Math.ceil(W / bs);
  const offset = (W - cols * bs) / 2; // 置中，兩邊切掉的一樣多
  const mid = (cols - 1) / 2;
  groundEl.style.height = `${bs * 2}px`;
  groundEl.replaceChildren(
    ...Array.from({ length: cols }, (_, i) => {
      const col = document.createElement("div");
      col.className = "chest-ground-col";
      col.style.cssText = `left:${offset + i * bs}px;width:${bs}px;height:${bs * 2}px;` +
        `background-image:url(${variants[Math.floor(rand() * variants.length)]});--d:${(Math.abs(i - mid) * 0.025).toFixed(3)}s`;
      return col;
    })
  );

  // 左右兩邊：樹在最外面，花草往中間排；手機少放幾個
  const u = bs / 16; // 像素圖的一格
  const side = W < 600 ? ["tree", "redFlower", "tuft"] : ["tree", "tuft", "redFlower", "mushroom", "tuft"];
  const otherSide = W < 600 ? ["tree", "yellowFlower", "tuft"] : ["tree", "blueFlower", "yellowFlower", "tuft", "redFlower"];
  decoRects = [];
  const decos = [];
  [[side, "left"], [otherSide, "right"]].forEach(([kinds, edge]) => {
    let x = bs * 0.3;
    kinds.forEach((kind, n) => {
      const scale = kind === "tree" ? 1.6 : 1.3; // 樹比方塊大一點，花草也放大一點才看得清楚
      const h = DECOS[kind].rows.length * u * scale;
      const w = 16 * u * scale;
      const el = document.createElement("div");
      el.className = "chest-deco";
      el.style.cssText = `${edge}:${x}px;bottom:${bs * 2}px;width:${w}px;height:${h}px;` +
        `--d:${(0.35 + n * 0.09).toFixed(2)}s;--sway:${(-rand() * 2.6).toFixed(2)}s`;
      const img = document.createElement("img");
      img.src = decoImage(kind);
      img.alt = "";
      if (kind === "tree") img.className = "tree";
      el.append(img);
      decos.push(el);
      const left = edge === "left" ? x : W - x - w;
      decoRects.push({ left, right: left + w, top: container.clientHeight - bs * 2 - h, bottom: container.clientHeight });
      x += w * (kind === "tree" ? 0.85 : 0.75);
    });
  });
  decoEl.replaceChildren(...decos);
}

function showGround(show) {
  if (show) {
    buildGround();
    void groundEl.offsetHeight; // 剛建好的元素先算一次樣式，加上 grown 時才會播長出來的動畫
  }
  container.classList.toggle("grown", show);
}

// 開箱後掉落物不要蓋到草地
const groundHeight = () => (dropped && groundBs ? groundBs * 2 : 0);

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
let holdOpenUntil = 0; // 收起來時：作品飛回寶箱之前蓋子都保持打開（秒，跟 now() 同一個時鐘）
// 等蓋子到全開才起飛："drop" = 等著噴出來、"recall" = 等著飛回去、null = 沒在等
// （蓋子正在往下關的時候點，不能直接跳到全開；倒著播回全開，到了再讓作品動）
let pendingLaunch = null;
// 鏡頭和草地也要跟著作品的時間：作品起飛時才退後、長草；作品全部飛回去之後才拉近、收草
let pendingCam = null; // 開箱後要用的鏡頭位置（等作品起飛才套用）
let settleAt = 0; // 收起來時，作品全部回到寶箱的時間（到了才拉近鏡頭、收草地）
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
    if (dropped) buildGround(); // 草地的欄數、花草的位置跟著寬度重排
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
  const bottom = H - groundHeight(); // 最下面的草地不能放東西
  // 上面的 My Project 標題也不能放：寶箱要擺在「標題下面到草地上面」的正中間，
  // 不然矮的螢幕上寶箱上方塞不下掉落物、下方很多，看起來整圈歪掉
  const label = container.querySelector(".floating-label").getBoundingClientRect();
  const top = Math.max(0, label.bottom - container.getBoundingClientRect().top + 8);
  if (!selected) return { x0: 0, x1: W, y0: top, y1: bottom };
  // 手機：固定預留卡片的最大高度（CSS 的 max-height: 48%），換作品時掉落物才不會因為卡片高度不同而整個重排；標題會淡出，不用避開
  if (W < 600) return { x0: 0, x1: W, y0: 0, y1: H * 0.52 - 24 };
  return { x0: 0, x1: W * 0.55, y0: top, y1: bottom };
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
let closedTop = 0; // 關著的寶箱頂面高度 = 箱口，掉落物從這裡飛出來 / 飛回去
function closedChestCenter() {
  if (!closedCenter) {
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (o.isSkinnedMesh) {
        o.skeleton.update();
        o.computeBoundingBox();
      }
    });
    const closed = new THREE.Box3().setFromObject(model);
    closedCenter = closed.getCenter(new THREE.Vector3());
    closedTop = closed.max.y;
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
  const prevCam = { z: cameraTargetZ, y: cameraTargetY, ox: viewOffsetTarget.x, oy: viewOffsetTarget.y };

  // 把整個畫面平移，讓寶箱出現在可用範圍的正中間
  viewOffsetTarget.x = W / 2 - (region.x0 + region.x1) / 2;
  viewOffsetTarget.y = H / 2 - (region.y0 + region.y1) / 2;

  // 1. 決定鏡頭要退多遠：讓寶箱縮到可用範圍高度的 3 成左右，窄的時候還要看寬度
  const box = chestBox();
  const size = box.getSize(new THREE.Vector3());
  const viewH = (z) => 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * z;
  const zForHeight = (size.y * H) / (0.3 * regionH * viewH(1));
  const zForWidth = (size.x * W) / (0.42 * regionW * viewH(1) * camera.aspect);
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
          const hits = (r) => x + itemPx / 2 > r.left - pad && x - itemPx / 2 < r.right + pad &&
            y + itemPx / 2 > r.top - pad && y - itemPx / 2 < r.bottom + pad;
          const inside = hits(chestScreen) || decoRects.some(hits); // 也要避開左右兩邊的樹和花草
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
  const mouth = chestMouth(box);

  items.forEach((item, i) => {
    const s = spots[i] || spots[spots.length - 1];
    raycaster.setFromCamera(new THREE.Vector2((s.x / W) * 2 - 1, -(s.y / H) * 2 + 1), cam);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    item.size = itemSize;
    // 從寶箱噴出來的先等蓋子全開（animate() 裡的 launch）；還在等的時候重排（打開卡片、改視窗大小）也一樣繼續等
    const fromMouth = fromChest || pendingLaunch === "drop";
    item.from = fromMouth ? mouth.clone() : item.mesh.position.clone();
    item.to = target;
    item.start = fromMouth ? Infinity : now();
    item.duration = fromMouth ? 0.9 : 0.5;
    item.arc = fromMouth ? itemSize * 3 : 0;
    if (fromMouth) item.mesh.visible = false;
    item.state = "flying";
  });

  // 作品還在箱子裡等蓋子全開：鏡頭先不要動，記下來等起飛時再套用
  if (fromChest || pendingLaunch === "drop") {
    pendingCam = { z: cameraTargetZ, y: cameraTargetY, ox: viewOffsetTarget.x, oy: viewOffsetTarget.y };
    cameraTargetZ = prevCam.z;
    cameraTargetY = prevCam.y;
    viewOffsetTarget.x = prevCam.ox;
    viewOffsetTarget.y = prevCam.oy;
  }
}

// 箱口：掉落物從這裡飛出來、飛回去
// （原本用 box.max.y，那是蓋子全開時翹起來的蓋子頂端，看起來像從寶箱上方冒出來）
function chestMouth(box) {
  closedChestCenter();
  return new THREE.Vector3((box.min.x + box.max.x) / 2, closedTop - (closedTop - box.min.y) * 0.15, (box.min.z + box.max.z) / 2);
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

function dropItems() {
  if (!projects.length || !model) return;
  dropped = true;
  hint.textContent = HINT_OPEN;
  settleAt = 0; // 收到一半又打開：不要等一下又把鏡頭拉近
  buildGround(); // 先建好（排版要知道草地多高），長出來的動畫等作品起飛
  if (!items.length) {
    items = projects.map((project) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: makeTexture(project), transparent: true, side: THREE.DoubleSide })
      );
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, project, phase: Math.random() * Math.PI * 2 };
    });
  }
  layoutItems(true);
  pendingLaunch = "drop";
}

function recallItems() {
  // 鏡頭先停在原地（關掉卡片也不要先平移），等作品全部飛回寶箱才拉近
  const keepOffset = { x: viewOffsetTarget.x, y: viewOffsetTarget.y };
  deselect(false);
  viewOffsetTarget.x = keepOffset.x;
  viewOffsetTarget.y = keepOffset.y;
  dropped = false;
  hint.textContent = HINT_CLOSED;
  pendingCam = null;
  setHovered(null);
  const box = chestBox();
  const mouth = chestMouth(box);
  pendingLaunch = "recall";
  items.forEach((item, i) => {
    item.from = item.mesh.position.clone();
    item.to = mouth;
    item.start = Infinity; // 先停在原地，等蓋子全開再飛回去（animate() 裡的 launch）
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
    // 作品要噴出來 / 正在飛 / 還有作品在飛回來的路上：蓋子要停在全開
    const flying = items.some((item) => item.state === "flying" || item.state === "returning");
    const hold = pendingLaunch !== null || flying || now() < holdOpenUntil;
    const target = isHovered || dropped || hold ? 1 : 0;
    openness += (target - openness) * 0.12; // 每一幀往目標靠近一點，開合比較自然
    if (target === 0 && openness < 0.001) {
      openness = 0;
      actions.forEach((action) => (action.time = 0)); // 關好了，下次從頭開始晃
    }
    // 開箱動畫本身是「打開 → 一半時開最大 → 關回去」一直重播。
    // hold 的時候：還在往上開就照常播到全開；已經在往下關就倒著播回全開（看起來是蓋子又掀起來，不會瞬間跳過去）
    actions.forEach((action) => {
      const peak = action.getClip().duration / 2;
      action.timeScale = hold && action.time > peak ? -1.5 : 1;
      action.setEffectiveWeight(openness);
    });
    mixer.update(0.02);
    let lidOpen = openness > 0.95;
    if (hold) {
      actions.forEach((action) => {
        const peak = action.getClip().duration / 2;
        // 剛好越過全開那一刻就停在那裡
        if ((action.timeScale > 0 && action.time > peak) || (action.timeScale < 0 && action.time < peak)) {
          action.time = peak;
          mixer.update(0);
        }
        if (Math.abs(action.time - peak) > 1e-4) lidOpen = false;
      });
    }
    // 蓋子到全開了：作品這時才起飛 / 飛回去
    if (pendingLaunch && lidOpen) {
      const t = now();
      if (pendingLaunch === "drop") {
        items.forEach((item, i) => (item.start = t + i * 0.06));
        // 作品起飛的同時鏡頭退後、草地長出來
        if (pendingCam) {
          cameraTargetZ = pendingCam.z;
          cameraTargetY = pendingCam.y;
          viewOffsetTarget.x = pendingCam.ox;
          viewOffsetTarget.y = pendingCam.oy;
          pendingCam = null;
        }
        showGround(true);
      } else {
        items.forEach((item, i) => (item.start = t + (items.length - 1 - i) * 0.03));
        settleAt = t + (items.length - 1) * 0.03 + 0.5; // 最後一個飛回去的時間
        holdOpenUntil = settleAt + 0.15; // 最後一個飛回去再關
      }
      pendingLaunch = null;
    }
    // 作品全部回到寶箱：鏡頭拉近回原本的構圖、草地收起來
    if (settleAt && now() >= settleAt) {
      settleAt = 0;
      frameIdle();
      viewOffsetTarget.x = viewOffsetTarget.y = 0;
      showGround(false);
    }
  }

  // 鏡頭慢慢退到（或回到）目標距離，畫面慢慢平移到目標位置
  camera.position.z += (cameraTargetZ - camera.position.z) * 0.08;
  camera.position.y += (cameraTargetY - camera.position.y) * 0.08;
  viewOffset.x += (viewOffsetTarget.x - viewOffset.x) * 0.1;
  viewOffset.y += (viewOffsetTarget.y - viewOffset.y) * 0.1;
  applyViewOffset();

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
