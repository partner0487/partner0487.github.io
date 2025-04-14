//數字雨
const canvas = document.getElementById("matrix");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*";
const fontSize = 15;
let columns, drops;

function resetMatrix() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  columns = Math.floor(canvas.width / fontSize);
  drops = Array(columns).fill(1);
}
resetMatrix(); // 初始設定
window.addEventListener("resize", resetMatrix); // 視窗改變時更新


function draw() {
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)"; // 淡淡黑背景，創造拖影感
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#111"; // 螢光綠
  ctx.font = fontSize + "px monospace";

  for (let i = 0; i < drops.length; i++) {
    const text = letters.charAt(Math.floor(Math.random() * letters.length) * 2);
    ctx.fillText(text, i * fontSize, drops[i] * fontSize);

    if (drops[i] * fontSize > canvas.height || Math.random() > 0.975) {
      drops[i] = 0;
    }
    drops[i]++;
  }
}

setInterval(draw, 66); // 每秒30次畫面更新

//能力條
function animateSkillBars() {
  const bars = document.querySelectorAll(".skill-progress");
  bars.forEach((bar) => {
    const percent = bar.getAttribute("data-percent");
    const percentText = bar.querySelector(".skill-percent");
    let current = 0;

    bar.style.width = percent + "%";

    const stepTime = 20;
    const interval = setInterval(() => {
      if (current < percent && percent >= 15) {
        current++;
        percentText.textContent = current + "%";
      } else {
        clearInterval(interval);
      }
    }, stepTime);
  });
}

function animateEXPBars() {
  const bars = document.querySelectorAll(".exp-progress");
  bars.forEach((bar) => {
    const percent = bar.getAttribute("data-percent");
    const container = bar.closest(".character-stats");
    const currentExp = container.querySelector(".current-exp");
    const expText = container.querySelector(".exp-text");
    let current = 0;

    bar.style.width = percent + "%";

    const stepTime = 20;
    const interval = setInterval(() => {
      if (current < percent) {
        current++;
        currentExp.innerHTML = "<strong>Total Experience:</strong> " + current*2200*0.01 + " exp";
        expText.textContent = "Lv. 4 → Lv. 5 (" + current*2200*0.01 + " / 2200 exp)";;

    } else {
        clearInterval(interval);
      }
    }, stepTime);
  });
}

// 使用 IntersectionObserver 監聽滑入
const observer = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateSkillBars();
        animateEXPBars();
        observer.disconnect(); // 執行一次後就不再監聽
      }
    });
  },
  { threshold: 0.7 }
);

observer.observe(document.querySelector(".character-card")); // 監聽技能條的容器
