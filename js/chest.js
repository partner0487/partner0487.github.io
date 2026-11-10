// 首頁的 Minecraft 寶箱（three.js r170，ES module）
// three 和 GLTFLoader 的實際網址寫在 index.html 的 importmap 裡
//
// 玩法：滑鼠移上去寶箱會打開；點一下，作品會像掉落物一樣噴出來散在寶箱周圍，
// 點作品會跳到作品頁的那張卡片；再點寶箱本身，作品會飛回去、蓋子關上。
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

const HINT_CLOSED = "Click to open";
const HINT_OPEN = "Pick one!";
const CAMERA_Z = 50; // 原本的鏡頭距離

let scene, camera, renderer, mixer, model;
let isHovered = false; // 滑鼠是否在寶箱區塊上
let actions = []; // 模型的開箱動畫
let openness = 0; // 0 = 關著（模型的靜止姿勢），1 = 完全套用開箱動畫
let chestVisible = false; // 寶箱是否在畫面上
let frame = null; // requestAnimationFrame 的 id，null 代表沒在渲染
let cameraTargetZ = CAMERA_Z;

// ---- 掉落物 ----
let projects = []; // 從 data/projects.json 攤平成一個陣列
let items = []; // { mesh, project, from, to, start, duration, phase, state }
let dropped = false; // 作品是不是已經噴出來了
let hoveredItem = null;
let tappedItem = null; // 手機：第一次點顯示名稱，第二次點才跳頁
const now = () => performance.now() / 1000; // 秒；不用 THREE.Clock，因為停止渲染再開始時它會歸零
let lastPointerType = "mouse";
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// 作品頁的卡片 id 用 repo 名稱，跟 js/project.js 的 slug() 一樣
const slug = (project) =>
  project.links[0].url.replace(/\/+$/, "").split("/").pop().toLowerCase();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f7fa);

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

      renderer.render(scene, camera);
      if (chestVisible) startLoop();
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
  renderer.domElement.addEventListener("pointerdown", (e) => (lastPointerType = e.pointerType));
  renderer.domElement.addEventListener("click", onClick);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (dropped) layoutItems(false); // 換到新螢幕大小的位置
  });
}

// ---- 讀作品資料、做成貼圖 ----
async function loadProjects() {
  try {
    const groups = await (await fetch("data/projects.json")).json();
    projects = groups.flatMap((g) => g.projects);
  } catch (e) {
    console.error("無法讀取作品資料:", e);
  }
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
function layoutItems(fromChest) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const mobile = W < 600;
  const itemPx = mobile ? 54 : 78; // 掉落物在螢幕上的大小

  // 1. 決定鏡頭要退多遠：讓寶箱縮到畫面高度的 3 成左右，手機還要看寬度
  const box = chestBox();
  const size = box.getSize(new THREE.Vector3());
  const viewH = (z) => 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * z;
  const zForHeight = (size.y / 0.3) / viewH(1);
  const zForWidth = (size.x / 0.42) / (viewH(1) * camera.aspect);
  cameraTargetZ = Math.max(CAMERA_Z, zForHeight, zForWidth);

  // 用「退好之後」的鏡頭來算位置
  const cam = camera.clone();
  cam.position.z = cameraTargetZ;
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();

  // 2. 寶箱和標題在螢幕上佔的範圍，掉落物要避開
  const toScreen = (v) => {
    const p = v.clone().project(cam);
    return { x: ((p.x + 1) / 2) * W, y: ((1 - p.y) / 2) * H };
  };
  const corners = [];
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) corners.push(toScreen(new THREE.Vector3(x, y, z)));
  const pad = itemPx * 0.4;
  const chestRect = {
    left: Math.min(...corners.map((c) => c.x)) - pad,
    right: Math.max(...corners.map((c) => c.x)) + pad,
    top: Math.min(...corners.map((c) => c.y)) - pad,
    bottom: Math.max(...corners.map((c) => c.y)) + pad,
  };
  const label = container.querySelector(".floating-label").getBoundingClientRect();
  const sectionTop = container.getBoundingClientRect().top;
  const topLimit = label.bottom - sectionTop + itemPx * 0.4;
  const center = { x: (chestRect.left + chestRect.right) / 2, y: (chestRect.top + chestRect.bottom) / 2 };

  // 3. 以寶箱為中心往外鋪一張對稱的格子，挑離寶箱最近的格子；不夠放就把間距縮小再試
  let spots = [];
  for (let gap = 1.6; gap >= 1.05 && spots.length < projects.length; gap -= 0.1) {
    const step = itemPx * gap;
    spots = [];
    const nx = Math.ceil(W / step);
    const ny = Math.ceil(H / step);
    for (let j = -ny; j <= ny; j++) {
      const y = center.y + j * step;
      if (y - itemPx / 2 < topLimit || y + itemPx / 2 > H - 8) continue;
      for (let k = -nx; k <= nx; k++) {
        const x = center.x + k * step;
        if (x - itemPx / 2 < 8 || x + itemPx / 2 > W - 8) continue;
        const inside = x + itemPx / 2 > chestRect.left && x - itemPx / 2 < chestRect.right &&
          y + itemPx / 2 > chestRect.top && y - itemPx / 2 < chestRect.bottom;
        // 距離相同時讓左右交替，兩邊才會一樣多
        if (!inside) spots.push({ x, y, d: Math.hypot((x - center.x) * 0.8, y - center.y) + (k > 0 ? 0.01 : 0) });
      }
    }
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

function dropItems() {
  if (!projects.length || !model) return;
  dropped = true;
  hint.textContent = HINT_OPEN;
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
}

function recallItems() {
  dropped = false;
  hint.textContent = HINT_CLOSED;
  setHovered(null);
  cameraTargetZ = CAMERA_Z;
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

    if (item === hoveredItem) scale *= 1.2;
    mesh.scale.setScalar(scale);
    mesh.rotation.y = item === hoveredItem ? 0 : Math.sin(t0 * 1.2 + item.phase) * 0.6; // 像掉落物一樣左右轉
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
  if (!item) {
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
    // 手機沒有 hover：第一次點先顯示名稱，再點一次才跳頁
    if (lastPointerType === "touch" && tappedItem !== item) {
      tappedItem = item;
      setHovered(item);
      return;
    }
    window.location.href = `project.html#${slug(item.project)}`;
    return;
  }
  tappedItem = null;
  if (pickChest(event)) recallItems();
  else setHovered(null);
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

  // 鏡頭慢慢退到（或回到）目標距離
  camera.position.z += (cameraTargetZ - camera.position.z) * 0.08;

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
