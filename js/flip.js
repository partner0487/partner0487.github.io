// 首頁自我介紹的翻面卡：點一下會先彈起來、在空中翻半圈、落地時壓扁一下再回彈
(() => {
  const card = document.querySelector(".intro-card");
  if (!card) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let angle = 0; // 目前轉到幾度：0 = 兔兔，180 = 本人，一直往同一個方向轉
  let anim = null;

  card.addEventListener("click", () => {
    if (anim) anim.finish(); // 連點：上一次直接轉完，再接著轉下一次
    const from = angle;
    angle += 180;
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
        { transform: `translateY(0) rotateY(${from}deg) scale(1)`, easing: "cubic-bezier(.2,.7,.4,1)" },
        { transform: `translateY(-14%) rotateY(${from + 90}deg) scale(1.06)`, offset: 0.45, easing: "cubic-bezier(.6,0,.8,.4)" },
        { transform: `translateY(2%) rotateY(${from + 180}deg) scale(1.02, 0.96)`, offset: 0.82 },
        { transform: end },
      ],
      { duration: 850 }
    );
    card.style.transform = end;
    anim.onfinish = () => (anim = null);
  });
})();
