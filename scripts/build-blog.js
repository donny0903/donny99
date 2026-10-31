// 블로그 글을 정적 HTML 로 만든다: blog/<slug>.html (한국어), en/blog/<slug>.html (영어)
// 본문이 HTML 에 미리 들어 있어서 JavaScript 를 실행하지 않는 검색 엔진 · AI 크롤러도 글을 읽는다.
// sitemap.xml 과 llms.txt 도 글 목록에 맞춰 함께 만든다.
//
// 글을 추가하거나 고친 뒤 레포 루트에서 실행: node scripts/build-blog.js
// 원본은 blog_article/*.md, en/blog_article/*.md 와 각 폴더의 index.json 이다.

const fs = require('fs');
const path = require('path');
const { marked } = require('../js/vendor/marked-15.0.12.min.js');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://aboutdonny.com';
const TODAY = new Date().toISOString().slice(0, 10);

const LANGS = {
    ko: {
        dir: 'blog_article',
        out: 'blog',
        prefix: '',
        locale: 'ko_KR',
        author: '김동환 (Donny)',
        blogDesc: '프로덕트 디자이너이자 Builder 김동환(Donny)의 블로그 글.',
    },
    en: {
        dir: 'en/blog_article',
        out: 'en/blog',
        prefix: 'en/',
        locale: 'en_US',
        author: 'Donghwan (Donny) Kim',
        blogDesc: 'A blog post by product designer and builder Donghwan (Donny) Kim.',
    },
};

const PERSON = {
    '@type': 'Person',
    '@id': `${BASE}/#person`,
    name: 'Donghwan Kim',
    alternateName: ['Donny Kim', 'Donny', '김동환'],
    jobTitle: ['Product Designer', 'Builder'],
    url: `${BASE}/`,
};

const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const postUrl = (lang, slug) => `${BASE}/${LANGS[lang].prefix}blog/${slug}.html`;
const isoDate = (slug) => slug.replace(/_/g, '-');
const dotDate = (slug) => slug.replace(/_/g, '.');
const hasHangul = (s) => /[ㄱ-ㆎ가-힣]/.test(s);

// 루트 기준 상대 경로(img/...)를 사이트 절대 경로(/img/...)로
const absPath = (p) => (/^(\/|[a-z]+:|#)/i.test(p) ? p : '/' + p.replace(/^(\.\.\/)+/, ''));

// main.js 가 브라우저에서 하던 본문 후처리를 빌드 때 한다
function renderBody(md) {
    let html = marked.parse(md);
    html = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>\s*/, ''); // 제목은 헤더에 따로 있다
    html = html.replace(/<a href="/g, '<a target="_blank" rel="noopener noreferrer" href="');
    html = html.replace(/<blockquote>[\s\S]*?<\/blockquote>/g,
        (bq) => bq.replace(/<br\s*\/?>/g, '<span class="br-spacer"></span>'));
    html = html.replace(/<hr\s*\/?>/g,
        '<div class="work-divider"><img src="/img/icon/divider.png" alt="" width="108" height="12"></div>');
    html = html.replace(/<img ([^>]*?)src="([^"]+)"/g,
        (m, before, src) => `<img ${before}src="${absPath(src)}" loading="lazy" decoding="async"`);
    return html;
}

function pageHtml(lang, post, bodyHtml, hasOther) {
    const L = LANGS[lang];
    const title = post.title;
    const desc = post.subtitle || title;
    const url = postUrl(lang, post.slug);
    const image = post.thumbnail ? `${BASE}/${post.thumbnail}` : `${BASE}/img/profile.jpg`;
    const fullTitle = `${title} | ${L.author}`;
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: title,
        description: desc,
        image,
        datePublished: isoDate(post.slug),
        inLanguage: lang,
        url,
        mainEntityOfPage: url,
        keywords: post.tags || [],
        author: PERSON,
        publisher: PERSON,
    };
    const alternates = hasOther
        ? [
            `        <link rel="alternate" hreflang="ko" href="${postUrl('ko', post.slug)}">`,
            `        <link rel="alternate" hreflang="en" href="${postUrl('en', post.slug)}">`,
            `        <link rel="alternate" hreflang="x-default" href="${postUrl('en', post.slug)}">`,
        ].join('\n')
        : '';
    const hero = post.thumbnail
        ? `                    <div class="blog-post-hero">
                        <img src="/${post.thumbnail}" alt="${escapeHtml(post.thumbnail_alt || title)}" fetchpriority="high">
                    </div>\n`
        : '';
    return `<!DOCTYPE html>
<html lang="${lang}">
    <head>
        <!-- scripts/build-blog.js 가 만든 파일. 직접 고치지 말고 md 를 고친 뒤 다시 빌드한다 -->
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
        <title>${escapeHtml(fullTitle)}</title>
        <meta name="description" content="${escapeHtml(desc)}">
        <meta name="author" content="Donghwan Kim (김동환)">
        <meta name="robots" content="index, follow, max-image-preview:large">
        <link rel="canonical" href="${url}">
${alternates}
        <!-- Favicon -->
        <link rel="icon" type="image/x-icon" href="/img/favicon_package/favicon.ico">
        <link rel="icon" type="image/svg+xml" href="/img/favicon_package/favicon.svg">
        <link rel="apple-touch-icon" sizes="180x180" href="/img/favicon_package/favicon-180.png">
        <link rel="icon" type="image/png" sizes="32x32" href="/img/favicon_package/favicon-32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="/img/favicon_package/favicon-16.png">
        <!-- Open Graph / X -->
        <meta property="og:type" content="article">
        <meta property="og:site_name" content="About Donny">
        <meta property="og:locale" content="${L.locale}">
        <meta property="og:title" content="${escapeHtml(title)}">
        <meta property="og:description" content="${escapeHtml(desc)}">
        <meta property="og:image" content="${image}">
        <meta property="og:url" content="${url}">
        <meta property="article:published_time" content="${isoDate(post.slug)}">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:site" content="@okid2318">
        <meta name="twitter:creator" content="@okid2318">
        <!-- 보안 -->
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'">
        <!-- link section -->
        <link rel="stylesheet" href="/css/pretendard.css">
        <link rel="stylesheet" href="/css/font.css">
        <link rel="stylesheet" href="/css/main.css">
        <script src="/js/lang.js"></script>
        <script src="/js/main.js" defer></script>
        <!-- 구조화 데이터 (검색 · AI 답변 엔진용) -->
        <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2).replace(/^/gm, '            ')}
        </script>
    </head>
    <body>
        <!-- navbar section -->
        <div id="topNavigation"></div>

        <main class="blog-page">
            <article class="blog-post">
                <div class="blog-post-container">
${hero}                    <div class="blog-post-header">
                        <h1 class="blog-post-title${hasHangul(title) ? '' : ' is-serif'}">${escapeHtml(title)}</h1>
                        <p class="blog-post-subtitle">${escapeHtml(post.subtitle || '')}</p>
                        <p class="blog-post-date"><time datetime="${isoDate(post.slug)}">${dotDate(post.slug)}</time></p>
                    </div>
                    <div class="work-divider">
                        <img src="/img/icon/divider.png" alt="" width="108" height="12">
                    </div>
                    <div class="blog-post-content">
${bodyHtml.trim().replace(/^/gm, '                        ')}
                    </div>
                </div>
            </article>
        </main>

        <!-- footer section -->
        <div id="footer"></div>
    </body>
</html>
`;
}

// 글 생성
const posts = {};
for (const lang of Object.keys(LANGS)) {
    posts[lang] = readJson(`${LANGS[lang].dir}/index.json`);
}
const slugsIn = (lang) => new Set(posts[lang].map((p) => p.slug));

for (const lang of Object.keys(LANGS)) {
    const L = LANGS[lang];
    const other = lang === 'ko' ? 'en' : 'ko';
    const outDir = path.join(ROOT, L.out);
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    for (const post of posts[lang]) {
        const md = fs.readFileSync(path.join(ROOT, L.dir, `${post.slug}.md`), 'utf8');
        const html = pageHtml(lang, post, renderBody(md), slugsIn(other).has(post.slug));
        fs.writeFileSync(path.join(outDir, `${post.slug}.html`), html);
        console.log('wrote', `${L.out}/${post.slug}.html`);
    }
}

// sitemap.xml: 페이지와 글을 언어판 짝(hreflang)과 함께
const PAGES = ['', 'work.html', 'about.html', 'blog_article.html'];
const entry = (ko, en, lastmod) => ['ko', 'en'].map((lang) => [
    '  <url>',
    `    <loc>${lang === 'ko' ? ko : en}</loc>`,
    `    <xhtml:link rel="alternate" hreflang="ko" href="${ko}"/>`,
    `    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>`,
    `    <lastmod>${lastmod}</lastmod>`,
    '  </url>',
].join('\n')).join('\n');
const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...PAGES.map((p) => entry(`${BASE}/${p}`, `${BASE}/en/${p}`, TODAY)),
    ...posts.ko.filter((p) => slugsIn('en').has(p.slug))
        .map((p) => entry(postUrl('ko', p.slug), postUrl('en', p.slug), isoDate(p.slug))),
    '</urlset>',
    '',
].join('\n');
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
console.log('wrote sitemap.xml');

// llms.txt: AI 가 읽기 좋은 사이트 요약 (https://llmstxt.org)
const enBySlug = Object.fromEntries(posts.en.map((p) => [p.slug, p]));
const byDateDesc = [...posts.ko].sort((a, b) => b.slug.localeCompare(a.slug));
const llms = [
    '# About Donny: Donghwan (Donny) Kim',
    '',
    '> Donghwan (Donny) Kim (김동환) is a product designer and builder who designed B2B SaaS, local services marketplace, and e-commerce products at Match Group (Azar), Spoqa, Soomgo, and Oflower, and now builds products end to end with AI tools. The site is available in Korean and English.',
    '',
    '## Pages',
    '',
    `- [Work (English)](${BASE}/en/work.html): career history and projects`,
    `- [Work (Korean)](${BASE}/work.html): 경력과 프로젝트`,
    `- [About (English)](${BASE}/en/about.html)`,
    `- [About (Korean)](${BASE}/about.html)`,
    `- [Blog (English)](${BASE}/en/blog_article.html)`,
    `- [Blog (Korean)](${BASE}/blog_article.html)`,
    '',
    '## Blog posts',
    '',
    ...byDateDesc.flatMap((p) => {
        const e = enBySlug[p.slug];
        const lines = [];
        if (e) lines.push(`- [${e.title}](${postUrl('en', p.slug)}) (${isoDate(p.slug)}, English): ${e.subtitle || ''}`);
        lines.push(`- [${p.title}](${postUrl('ko', p.slug)}) (${isoDate(p.slug)}, Korean): ${p.subtitle || ''}`);
        return lines;
    }),
    '',
    '## Elsewhere',
    '',
    '- [LinkedIn](https://www.linkedin.com/in/donghwan-kim-52b7371a9/)',
    '- [X (@okid2318)](https://x.com/okid2318)',
    '- [Medium](https://medium.com/@okid2318)',
    '- [Brunch](https://brunch.co.kr/@okid2318)',
    '',
].join('\n');
fs.writeFileSync(path.join(ROOT, 'llms.txt'), llms);
console.log('wrote llms.txt');
