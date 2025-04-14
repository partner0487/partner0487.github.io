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
    'MH': {
        title: '魔物獵人荒野',
        subtitle: 'ID：YW45P7K4',
        desc: '雙刀俠',
        color: "darkslateblue"
    }
};

videoItems.forEach(item => {
    item.addEventListener('click', function () {
        const selectedFileName = item.getAttribute('data');
        const selectedVideoUrl = `images/${selectedFileName}.mp4`; // Dynamically generate the full path
        const selectedImageUrl = `images/${selectedFileName}_detail.jpg`; // Dynamically generate the full path

        // Function to check if the file exists
        async function fileExists(url) {
            try {
                const response = await fetch(url, { method: 'HEAD' }); // Make a HEAD request to check the file
                return response.ok; // If the response is OK (status 200-299), the file exists
            } catch (error) {
                console.error('Error checking file existence:', error);
                return false;
            }
        }

        // Ensure your function is asynchronous
        async function updateContentAndAnimate() {
            // Start the upward animation
            contentWrapper.style.transform = 'translateY(-100%)';

            // Wait for the animation duration (600ms)
            await new Promise((resolve) => setTimeout(resolve, 600));

            // Proceed to update the content
            productTitle.textContent = contentData[selectedFileName].title;
            productSubtitle.textContent = contentData[selectedFileName].subtitle;
            productDesc.textContent = contentData[selectedFileName].desc;
            productDesc.style.color = contentData[selectedFileName].color;

            // Check if the image exists
            const exists = await fileExists(selectedImageUrl);

            if (exists) {
                // If the file exists, update the image source and show it
                if (productImage) {
                    productImage.src = selectedImageUrl;
                    productImage.classList.add('show'); // Show the image
                    productImage.classList.remove('hidden'); // Ensure it's not hidden
                }
            } else {
                // If the file does not exist, hide the image
                if (productImage) {
                    productImage.classList.add('hidden'); // Hide the image
                    productImage.classList.remove('show'); // Ensure it's not visible
                }
            }

            // Finally, execute the downward animation
            contentWrapper.style.transform = 'translateY(0)';
        }

        // Call the asynchronous function
        updateContentAndAnimate();

        // 將背景影片設為隱藏 (淡出)
        backgroundVideo.classList.add('hidden');

        // 左側滾輪動畫
        if (window.innerWidth <= 980) {
            contentWrapper.style.transform = 'translateY(-150%)';
        } else {
            contentWrapper.style.transform = 'translateY(-100%)';
        }
        setTimeout(() => {
            contentWrapper.style.transform = 'translateY(0)'; // 更新內容 

            productTitle.textContent = contentData[selectedFileName].title;
            productSubtitle.textContent = contentData[selectedFileName].subtitle;
            productDesc.textContent = contentData[selectedFileName].desc;
            productDesc.style.color = contentData[selectedFileName].color;

            productImage.src = selectedImageUrl; // Update the source
            fileExists(selectedImageUrl).then((exists) => {
                if (exists) {
                    // If the file exists, update the image source and show it
                    if (productImage) {
                        productImage.classList.add('show'); // Show the image
                        productImage.classList.remove('hidden'); // Ensure it's not hidden
                    }
                } else {
                    // If the file does not exist, hide the image
                    if (productImage) {
                        productImage.classList.add('hidden'); // Hide the image
                        productImage.classList.remove('show'); // Ensure it's not visible
                    }
                }
            });
        }, 600);

        // 右側收起動畫
        if (window.innerWidth <= 980) {
            // 螢幕小於等於 980px（行動版）：往下收起
            colorPicker.style.transform = 'translateY(100%)';
            setTimeout(() => {
                colorPicker.style.transform = 'translateY(0)';
            }, 600);
        } else {
            // 螢幕大於 980px（桌機版）：往右收起
            colorPicker.style.transform = 'translateX(100%)';
            setTimeout(() => {
                colorPicker.style.transform = 'translateX(0)';
            }, 600);
        }
        

        // 等待淡出動畫結束後更新影片並播放
        setTimeout(() => {
            backgroundVideo.src = selectedVideoUrl;

            // 確保影片已加載完成後再淡入
            backgroundVideo.addEventListener('loadeddata', () => {
                backgroundVideo.classList.remove('hidden');
                backgroundVideo.play();
            }, { once: true });
        }, 300); // 與 CSS 過渡時間一致
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
