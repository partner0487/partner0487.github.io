// 首頁自我介紹的翻面卡：點一下會先彈起來、在空中轉兩圈半、落地時壓扁一下再回彈
(() => {
  const SPIN = 900; // 每次轉幾度：要是 180 的奇數倍才會換面（900 = 兩圈半）
  const card = document.querySelector(".intro-card");
  if (!card) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let angle = 0; // 目前轉到幾度：180 的偶數倍 = 兔兔，奇數倍 = 本人，一直往同一個方向轉
  let anim = null;

  card.addEventListener("click", () => {
    if (anim) anim.finish(); // 連點：上一次直接轉完，再接著轉下一次
    const from = angle;
    angle += SPIN;
    const showingMe = (angle / 180) % 2 === 1;
    card.setAttribute("aria-pressed", String(showingMe));
    card.setAttribute("aria-label", showingMe ? "翻回兔兔" : "翻面看本人照片");

    const end = `translateY(0) rotateY(${angle}deg) scale(1)`;
    if (reduceMotion.matches) {
      card.style.transform = end; // 使用者關掉動畫：直接換面
      return;
    }
    anim = card.animate(
      [
        // 往上彈的時候轉最快，到最高點慢下來；掉下來時把剩下的圈數轉完，落地壓扁再回彈
        { transform: `translateY(0) rotateY(${from}deg) scale(1)`, easing: "cubic-bezier(.25,.8,.4,1)" },
        { transform: `translateY(-18%) rotateY(${from + SPIN * 0.6}deg) scale(1.08)`, offset: 0.45, easing: "cubic-bezier(.5,0,.75,.5)" },
        { transform: `translateY(2%) rotateY(${from + SPIN}deg) scale(1.03, 0.95)`, offset: 0.84 },
        { transform: end },
      ],
      { duration: 1300 }
    );
    card.style.transform = end;
    anim.onfinish = () => (anim = null);
  });
})();
