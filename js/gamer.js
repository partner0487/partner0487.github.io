const videoItems = document.querySelectorAll('.video-item');
const backgroundVideo = document.getElementById('background-video');
const contentWrapper = document.querySelector('.content-wrapper');
const colorPicker = document.querySelector('.video-picker');
const productTitle = document.querySelector('.product-title');
const productSubtitle = document.querySelector('.product-subtitle');
const productDesc = document.querySelector('.product-desc');
const productImage = document.querySelector('.product-image');

// 影片對應內容
const contentData = {
    'genshin': {
        title: '原神',
        subtitle: 'UID：900498591',
        desc: '刻晴main',
        color: "purple"
    },
    'star_rail': {
        title: '崩壞：星穹鐵道',
        subtitle: 'UID：802859889',
        desc: '雀門',
        color: "lightgreen"
    },
    'lol': {
        title: '英雄聯盟',
        subtitle: 'ID：夥伴 Partnero#0487',
        desc: '李星OTP',
        color: "lightblue"
    },
    'ow': {
        title: '鬥陣特攻',
        subtitle: 'ID：PARTNER#4280',
        desc: '白金輔助',
        color: "blue"
    },
    'apex': {
        title: 'Apex 英雄',
        subtitle: 'ID：夥伴 P4RTNER',
        desc: '尋血犬main',
        color: "crimson"
    },
    'elden_ring': {
        title: '艾爾登法環',
        subtitle: 'steam：1192053283',
        desc: '新手法師',
        color: "gold"
    },
    'monster_hunter': {
        title: '魔物獵人荒野',
        subtitle: 'ID：YW45P7K4',
        desc: '雙刀俠',
        color: "darkslateblue"
    }
};

const isMobile = () => window.innerWidth <= 980;
let currentClick = 0; // 連點時只讓最後一次點擊生效

// 詳細圖先在背景載好，卡片才彈回來；不然第一次點的時候卡片會先出現，圖片過一下才跳出來
const detailCache = {};
function loadDetail(game) {
    if (!detailCache[game]) {
        detailCache[game] = new Promise((resolve) => {
            const img = new Image();
            img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(true));
            img.onerror = () => resolve(false); // 沒有詳細圖的遊戲
            img.src = `images/games/${game}_detail.webp`;
        });
    }
    return detailCache[game];
}

function showDetailImage(game, ok) {
    productImage.classList.toggle('show', ok);
    productImage.classList.toggle('hidden', !ok);
    if (ok) productImage.src = `images/games/${game}_detail.webp`;
    else productImage.removeAttribute('src');
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function selectGame(game) {
    const data = contentData[game];
    if (!data) return;
    const clickId = ++currentClick;
    const videoUrl = `videos/games/${game}.mp4`;
    const detail = loadDetail(game); // 現在就開始載詳細圖

    // 0ms：左側卡片往上捲、右側選單收起、背景影片淡出
    contentWrapper.style.transform = isMobile() ? 'translateY(-150%)' : 'translateY(-100%)';
    colorPicker.style.transform = isMobile() ? 'translateY(100%)' : 'translateX(calc(100% + 40px))'; // 40px = 右邊的 margin，整條收到畫面外
    backgroundVideo.classList.add('hidden');

    // 300ms：淡出結束後換影片，載入完成再淡入
    setTimeout(() => {
        if (clickId !== currentClick) return;
        backgroundVideo.addEventListener('loadeddata', () => {
            if (clickId !== currentClick) return;
            backgroundVideo.classList.remove('hidden');
            backgroundVideo.play();
        }, { once: true });
        backgroundVideo.src = videoUrl;
    }, 300);

    // 至少等 600ms（收回去的動畫跑完），而且詳細圖載好了，才更新內容、卡片和選單回到原位；
    // 網路太慢的話最多等 3 秒，圖片之後再自己出現
    Promise.all([wait(600), Promise.race([detail, wait(3000).then(() => null)])]).then(([, ok]) => {
        if (clickId !== currentClick) return;
        productTitle.textContent = data.title;
        productSubtitle.textContent = data.subtitle;
        productDesc.textContent = data.desc;
        productDesc.style.color = data.color;
        if (ok === null) {
            showDetailImage(game, false);
            detail.then((late) => clickId === currentClick && showDetailImage(game, late));
        } else {
            showDetailImage(game, ok);
        }
        contentWrapper.style.transform = 'translateY(0)';
        colorPicker.style.transform = isMobile() ? 'translateY(0)' : 'translateX(0)';
    });
}

videoItems.forEach(item => {
    const game = item.dataset.game;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', contentData[game] ? contentData[game].title : game);
    item.addEventListener('click', () => selectGame(game));
    item.addEventListener('pointerenter', () => loadDetail(game)); // 滑鼠移上去就先載，點下去通常已經好了
    item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectGame(game);
        }
    });
});

// 圖片放大
const zoomables = document.querySelectorAll('.zoomable');
const overlay = document.getElementById('overlay');
const overlayImg = document.getElementById('overlay-img');

// 點擊圖片時顯示 overlay 並換圖
zoomables.forEach(img => {
  img.addEventListener('click', () => {
    overlayImg.src = img.src;
    overlay.classList.add('show');
  });
});

// 點 overlay 任意區域時關閉
overlay.addEventListener('click', () => {
  overlay.classList.remove('show');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') overlay.classList.remove('show');
});
