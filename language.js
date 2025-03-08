// 引入 Google 翻譯 API
const script = document.createElement('script');
script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
document.head.appendChild(script);

// 初始化 Google 翻譯
function googleTranslateElementInit() {
    new google.translate.TranslateElement(
        {
            pageLanguage: 'zh-TW',
            includedLanguages: 'zh-TW,zh-CN,en,ja',
            gaTrack: true
        },
        'google_translate_element'
    );

    // 設置下拉選單的 title 屬性
    const translateSelect = document.querySelector('select.goog-te-combo');
    if (translateSelect) {
        translateSelect.setAttribute('title', 'translate');
    }
}