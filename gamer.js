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
        desc: '刻晴main'
    },
    'star_rail': {
        title: '崩壞：星穹鐵道',
        subtitle: 'UID：802859889',
        desc: '雀門'
    },
    'lol': {
        title: '英雄聯盟',
        subtitle: 'ID：夥伴 Partnero#0487',
        desc: '李星OTP'
    },
    'ow': {
        title: '鬥陣特攻',
        subtitle: 'ID：PARTNER#4280',
        desc: '白金輔助'
    },
    'elden_ring': {
        title: '艾爾登法環',
        subtitle: 'steam：1192053283',
        desc: '新手法師'
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

        function getBase64Video(url, callback) {
            const xhr = new XMLHttpRequest();
            xhr.onload = function () {
                const reader = new FileReader();
                reader.onloadend = function () {
                    callback(reader.result); // Base64 編碼的 Data URI
                };
                reader.readAsDataURL(xhr.response);
            };
            xhr.open('GET', url);
            xhr.responseType = 'blob';
            xhr.send();
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
        contentWrapper.style.transform = 'translateY(-100%)';
        setTimeout(() => {
            contentWrapper.style.transform = 'translateY(0)'; // 更新內容 

            productTitle.textContent = contentData[selectedFileName].title;
            productSubtitle.textContent = contentData[selectedFileName].subtitle;
            productDesc.textContent = contentData[selectedFileName].desc;
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
        colorPicker.style.transform = 'translateX(100%)';
        setTimeout(() => {
            colorPicker.style.transform = 'translateX(0)';
        }, 600);

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