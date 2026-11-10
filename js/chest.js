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
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 50;

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(2, 2, 2);
  scene.add(light);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const loader = new THREE.GLTFLoader();
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

// 新增這段變數
let mouseX = 0,
  mouseY = 0;

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
