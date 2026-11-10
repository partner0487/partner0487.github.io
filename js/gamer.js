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

function showDetailImage(url) {
    const show = () => {
        productImage.classList.add('show');
        productImage.classList.remove('hidden');
    };
    const hide = () => {
        productImage.classList.add('hidden');
        productImage.classList.remove('show');
    };
    productImage.onload = show;
    productImage.onerror = hide;
    productImage.src = url;
    if (productImage.complete && productImage.naturalWidth > 0) show();
}

function selectGame(game) {
    const data = contentData[game];
    if (!data) return;
    const clickId = ++currentClick;
    const videoUrl = `videos/games/${game}.mp4`;
    const imageUrl = `images/games/${game}_detail.webp`; // 沒有詳細圖的遊戲會觸發 onerror，不顯示

    // 0ms：左側卡片往上捲、右側選單收起、背景影片淡出
    contentWrapper.style.transform = isMobile() ? 'translateY(-150%)' : 'translateY(-100%)';
    colorPicker.style.transform = isMobile() ? 'translateY(100%)' : 'translateX(100%)';
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

    // 600ms：更新內容，卡片和選單回到原位
    setTimeout(() => {
        if (clickId !== currentClick) return;
        productTitle.textContent = data.title;
        productSubtitle.textContent = data.subtitle;
        productDesc.textContent = data.desc;
        productDesc.style.color = data.color;
        showDetailImage(imageUrl);
        contentWrapper.style.transform = 'translateY(0)';
        colorPicker.style.transform = isMobile() ? 'translateY(0)' : 'translateX(0)';
    }, 600);
}

videoItems.forEach(item => {
    const game = item.dataset.game;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', contentData[game] ? contentData[game].title : game);
    item.addEventListener('click', () => selectGame(game));
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
