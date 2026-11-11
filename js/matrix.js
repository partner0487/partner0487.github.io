// 關於頁面板後面的數字雨背景
const canvas = document.getElementById("matrix");
const ctx = canvas.getContext("2d");
const matrixSection = canvas.closest("section");

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*";

// 跟著深色 / 淺色主題換顏色（主題切換時 js/site.js 會發 themechange 事件）
const matrixColors = () =>
  document.documentElement.dataset.theme === "dark"
    ? { fade: "rgba(18, 20, 24, 0.2)", text: "#4a515c" } // 深色：深底、灰字
    : { fade: "rgba(255, 255, 255, 0.2)", text: "#111" };
let colors = matrixColors();
const fontSize = 15;
let columns, drops;

// canvas 跟著面板區塊的大小（原本用視窗大小，手機上區塊比視窗高，底部會留一條白邊）
function resetMatrix() {
  canvas.width = matrixSection.clientWidth;
  canvas.height = matrixSection.clientHeight;
  columns = Math.floor(canvas.width / fontSize);
  drops = Array(columns).fill(1);
  // 先快轉一段，捲到這裡時數字雨已經鋪滿，不會從一片空白開始往下長
  for (let i = 0; i < 150; i++) draw();
}


function draw() {
  ctx.fillStyle = colors.fade; // 半透明底色蓋上一層，留下拖影
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = colors.text; // 字元顏色
  ctx.font = fontSize + "px monospace";

  for (let i = 0; i < drops.length; i++) {
    const text = letters.charAt(Math.floor(Math.random() * letters.length));
    ctx.fillText(text, i * fontSize, drops[i] * fontSize);

    if (drops[i] * fontSize > canvas.height || Math.random() > 0.975) {
      drops[i] = 0;
    }
    drops[i]++;
  }
}

// 區塊大小改變時（面板讀完 JSON 才畫出來、對話框文字變長變短、視窗大小改變）：
// 第一次整個重設；之後把已經畫好的字留著，只補上 / 切掉多出來的邊，數字雨不會整片刷新
function resizeMatrix() {
  const w = matrixSection.clientWidth;
  const h = matrixSection.clientHeight;
  if (w === canvas.width && h === canvas.height) return;
  if (!drops) return resetMatrix();
  const old = document.createElement("canvas");
  old.width = canvas.width;
  old.height = canvas.height;
  old.getContext("2d").drawImage(canvas, 0, 0);
  canvas.width = w; // 改寬高會清空 canvas，再把舊的畫回去
  canvas.height = h;
  ctx.drawImage(old, 0, 0);
  columns = Math.floor(w / fontSize);
  // 變寬：新的欄從隨機高度開始下；變窄：多的欄拿掉
  drops = Array.from({ length: columns }, (_, i) => drops[i] ?? Math.floor((Math.random() * h) / fontSize));
}
new ResizeObserver(resizeMatrix).observe(matrixSection);
window.addEventListener("themechange", () => {
  colors = matrixColors();
  resetMatrix(); // 重畫一次，舊顏色的字不會殘留
});

// 約每秒 15 次更新；技能面板不在畫面上時暫停
let matrixTimer = null;
new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting && matrixTimer === null) {
    matrixTimer = setInterval(draw, 66);
  } else if (!entry.isIntersecting && matrixTimer !== null) {
    clearInterval(matrixTimer);
    matrixTimer = null;
  }
}).observe(matrixSection);
