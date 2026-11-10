// 首頁的 Minecraft 寶箱（three.js r170，ES module）
// three 和 GLTFLoader 的實際網址寫在 index.html 的 importmap 裡
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// 從 r109 升級時，為了讓寶箱看起來跟原本一樣：
// 1. 關掉 r152 之後預設開啟的色彩管理（原本的顏色是照舊版的方式算的）
THREE.ColorManagement.enabled = false;

let scene, camera, renderer, mixer, model;
let isHovered = false; // 變數來記錄是否處於 hover 狀態
let actions = []; // 模型的開箱動畫
let chestVisible = false; // 寶箱是否在畫面上
let frame = null; // requestAnimationFrame 的 id，null 代表沒在渲染

function init() {
  const container = document.getElementById("chest-section");

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f7fa);

  renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // 跟 r109 一樣，輸出時不做 sRGB 轉換
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 50;

  // 2. r155 之後光源改成物理單位，強度乘上 π 才會跟原本一樣亮
  const light = new THREE.DirectionalLight(0xffffff, 1 * Math.PI);
  light.position.set(2, 2, 2);
  scene.add(light);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5 * Math.PI);
  scene.add(ambient);

  const loader = new GLTFLoader();
  loader.load(
    "models/minecraft_chest.glb",
    function (gltf) {
      model = gltf.scene;
      model.scale.set(0.09, 0.09, 0.09);
      model.position.set(0, -7, 0);
      model.rotation.y = (Math.PI / 2) * -1;

      scene.add(model);

      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        actions = gltf.animations.map((clip) => {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopOnce); // 開箱動畫一次播一輪
          action.clampWhenFinished = true; // 播完停在打開的樣子
          action.play();
          action.paused = true; // 初始時暫停動畫
          return action;
        });
        // 播完一輪時滑鼠還在寶箱上，就再播一次
        mixer.addEventListener("finished", (e) => {
          if (isHovered) e.action.reset().play();
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

  container.addEventListener("mouseenter", () => {
    isHovered = true;
    actions.forEach((action) => {
      if (!action.isRunning()) action.reset().play(); // 只有動畫沒在跑時才重播
    });
  });

  // 離開時不打斷動畫，讓這一輪播完
  container.addEventListener("mouseleave", () => {
    isHovered = false;
  });

  // 寶箱不在畫面上時停止渲染
  new IntersectionObserver(([entry]) => {
    chestVisible = entry.isIntersecting;
    if (chestVisible) startLoop();
    else stopLoop();
  }).observe(container);

  container.addEventListener("click", () => {
    showLoadingScreen();
  });  

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function showLoadingScreen() {
    const overlay = document.getElementById("loading-overlay");
    overlay.classList.add("active");
  
    setTimeout(() => {
      window.location.href = "project.html"; // 專案頁面
    }, 3000); // 播個3秒再跳頁
  }
  

function animate() {
  frame = requestAnimationFrame(animate);
  if (mixer) {
    mixer.update(0.02); // ✨ 無論是否 hover，都讓動畫更新
  }

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

// 監聽滑鼠移動事件
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
