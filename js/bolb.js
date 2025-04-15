const MIN_SPEED = 2;
const MAX_SPEED = 3;

function randomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

class BouncingBlob {
  constructor(el) {
    this.el = el;
    const boundingRect = this.el.getBoundingClientRect();
    this.size = boundingRect.width;
    // 初始位置與速度...
    this.initialX = randomNumber(0, window.innerWidth - this.size);
    this.initialY = randomNumber(0, window.innerHeight - this.size);
    this.el.style.top = `${this.initialY}px`;
    this.el.style.left = `${this.initialX}px`;
    this.vx = randomNumber(MIN_SPEED, MAX_SPEED) * (Math.random() > 0.5 ? 1 : -1);
    this.vy = randomNumber(MIN_SPEED, MAX_SPEED) * (Math.random() > 0.5 ? 1 : -1);
    this.x = this.initialX;
    this.y = this.initialY;
  }

  update() {
    // 跑跑跑 + 邊界反彈
    this.x += this.vx;
    this.y += this.vy;

    if (this.x >= window.innerWidth - this.size || this.x <= 0) this.vx *= -1;
    if (this.y >= window.innerHeight - this.size || this.y <= 0) this.vy *= -1;

    this.x = Math.max(0, Math.min(this.x, window.innerWidth - this.size));
    this.y = Math.max(0, Math.min(this.y, window.innerHeight - this.size));

    this.el.style.transform = `translate(${this.x - this.initialX}px, ${this.y - this.initialY}px)`;
  }
}

function initBlobs() {
  const blobEls = document.querySelectorAll(".blob");
  const blobs = Array.from(blobEls).map((blobEl) => new BouncingBlob(blobEl));

  function update() {
    requestAnimationFrame(update);
    blobs.forEach((blob) => blob.update());
  }
  requestAnimationFrame(update);
}

initBlobs();
