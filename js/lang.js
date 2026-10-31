// 브라우저 언어에 맞는 언어판으로 보낸다: 한국어면 한국어판, 그 외에는 /en/ 영어판.
// 사용자가 상단 kr / en 링크로 직접 고른 언어가 있으면 그걸 따른다 (main.js initLangSwitch 가 저장).
// 화면이 그려지기 전에 이동하도록 <head> 에서 defer 없이 불러온다.
(function () {
    var path = window.location.pathname;
    var isEn = /^\/en(\/|$)/.test(path);

    // 예전 글 주소(blog_article_post.html?slug=…)는 정적 글 페이지(blog/<slug>.html)로 옮겼다
    var oldPost = /blog_article_post\.html$/.test(path) && /[?&]slug=([\w-]+)/.exec(window.location.search);
    if (oldPost) {
        window.location.replace((isEn ? '/en' : '') + '/blog/' + oldPost[1] + '.html');
        return;
    }

    // 검색 엔진 · AI 크롤러 · 미리보기 봇은 보낸 주소 그대로 읽게 둔다 (언어판은 hreflang 으로 알린다)
    if (/bot|crawl|spider|slurp|lighthouse|headless|preview|facebookexternalhit|embedly|whatsapp|telegram/i.test(navigator.userAgent)) return;

    var saved = null;
    try {
        saved = localStorage.getItem('lang');
    } catch (e) {}

    var browserLang = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    var want = saved === 'ko' || saved === 'en' ? saved : (/^ko\b/i.test(browserLang) ? 'ko' : 'en');
    if ((want === 'en') === isEn) return;

    var target = isEn ? path.replace(/^\/en(\/|$)/, '/') : '/en' + path;
    window.location.replace(target + window.location.search + window.location.hash);
})();
