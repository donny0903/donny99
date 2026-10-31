// 언어: /en/ 아래 페이지는 영어판, 나머지는 한국어판. 공용 파일(components, img)은 사이트 루트에 있다
const IS_EN = /^\/en(\/|$)/.test(window.location.pathname);
const LANG_ROOT = IS_EN ? '/en/' : '/';

// 로컬 라이브 리로드 시 스크롤 위치 유지 (프로덕션·배포 호스트에서는 비활성)
function isLocalDevHost() {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

function devScrollStorageKey() {
    return 'devScrollY:' + window.location.pathname + window.location.search;
}

function saveDevScrollPosition() {
    if (!isLocalDevHost()) return;
    try {
        sessionStorage.setItem(devScrollStorageKey(), String(Math.round(window.scrollY)));
    } catch (e) {}
}

// 새로고침(라이브 리로드)일 때만 되살린다. 링크로 들어온 페이지는 맨 위에서 시작
function isReloadNavigation() {
    const nav = performance.getEntriesByType('navigation')[0];
    return nav ? nav.type === 'reload' : false;
}

function restoreDevScrollPosition() {
    if (!isLocalDevHost() || !isReloadNavigation()) return;
    let y;
    try {
        const raw = sessionStorage.getItem(devScrollStorageKey());
        if (raw === null) return;
        y = parseInt(raw, 10);
        if (Number.isNaN(y)) return;
    } catch (e) {
        return;
    }
    window.scrollTo(0, y);
}

// 공통 레이아웃 로더
async function loadPartial(selector, url) {
    const container = document.querySelector(selector);
    if (!container) return;

    try {
        const response = await fetch(url);
        if (!response.ok) return;
        const html = await response.text();
        container.innerHTML = html;

        // 조각 안의 페이지 링크(work.html 등)는 현재 언어판 기준, 이미지는 조각 파일 기준으로 맞춘다.
        // blog/ 처럼 한 단계 깊은 페이지에서도 같은 조각을 쓰기 위해서다
        container.querySelectorAll('a[href]').forEach((a) => {
            const href = a.getAttribute('href');
            if (!/^([a-z]+:|\/|#)/i.test(href)) a.setAttribute('href', LANG_ROOT + href);
        });
        container.querySelectorAll('img[src]').forEach((img) => {
            img.setAttribute('src', new URL(img.getAttribute('src'), new URL(url, window.location.origin)).pathname);
        });
    } catch (e) {
        // 네트워크 오류 등은 조용히 무시
    }
}

// 모바일 메뉴 토글 및 자동 닫힘 기능
function initMobileMenu() {
    const mobileMenuButton = document.querySelector('.mobile-menu-button');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuButton && navLinks) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenuButton.classList.toggle('active');
            navLinks.classList.toggle('active');
            document.body.classList.toggle('menu-open');
        });

        // 메뉴 아이템 클릭시 메뉴 닫기
        document.querySelectorAll('.nav-item').forEach((item) => {
            item.addEventListener('click', () => {
                mobileMenuButton.classList.remove('active');
                navLinks.classList.remove('active');
                document.body.classList.remove('menu-open');
            });
        });
    }
}

// work 아코디언 토글
// 기본은 모두 접힘. 펼친 카드는 sessionStorage 에 기억해 새로고침해도 유지한다(새 방문이면 다시 접힘).
const WORK_OPEN_KEY = 'work-open-items';

function readOpenWorkItems() {
    try {
        return new Set(JSON.parse(sessionStorage.getItem(WORK_OPEN_KEY) || '[]'));
    } catch (e) {
        return new Set();
    }
}

function writeOpenWorkItems(openItems) {
    try {
        sessionStorage.setItem(WORK_OPEN_KEY, JSON.stringify([...openItems]));
    } catch (e) {
        // storage 를 못 쓰면 기억하지 않을 뿐, 토글은 그대로 동작한다
    }
}

function workItemKey(workItem) {
    const title = workItem.querySelector('.work-header h2');
    return title ? title.textContent.replace(/\s+/g, ' ').trim() : '';
}

function initWorkAccordion() {
    const openItems = readOpenWorkItems();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    document.querySelectorAll('button.chevron-button').forEach((button) => {
        const workItem = button.closest('.work-item');
        if (!workItem) return;

        const content = workItem.querySelector('.collapsible-content');
        if (!content) return;

        const key = workItemKey(workItem);

        if (openItems.has(key)) {
            button.classList.add('no-anim', 'open');
            content.classList.add('no-anim', 'open');
            requestAnimationFrame(() => requestAnimationFrame(() => {
                button.classList.remove('no-anim');
                content.classList.remove('no-anim');
            }));
        }

        // 애니메이션이 끝나면 인라인 높이를 지워 CSS 값(펼침 none, 접힘 0)으로 돌려 둔다
        content.addEventListener('transitionend', (e) => {
            if (e.target === content && e.propertyName === 'max-height') {
                content.style.maxHeight = '';
            }
        });

        button.addEventListener('click', () => {
            const isOpen = !content.classList.contains('open');

            if (reduceMotion.matches) {
                content.classList.toggle('open', isOpen);
            } else {
                // 지금 보이는 높이에서 출발해 목표 높이(펼침: 내용 높이, 접힘: 0)로 간다.
                // 애니메이션 도중에 다시 눌러도 튀지 않는다
                content.style.maxHeight = content.getBoundingClientRect().height + 'px';
                content.offsetHeight; // 시작 높이를 확정
                content.classList.toggle('open', isOpen);
                content.style.maxHeight = isOpen ? content.scrollHeight + 'px' : '0px';
            }
            button.classList.toggle('open', isOpen);

            const current = readOpenWorkItems();
            if (isOpen) current.add(key);
            else current.delete(key);
            writeOpenWorkItems(current);
        });
    });
}

// 프로젝트 이미지 프리뷰 기능
function initProjectPreview() {
    if (window.innerWidth < 800) return;  // 데스크톱에서만 실행

    const preview = document.createElement('div');
    preview.className = 'project-image-preview';
    document.body.appendChild(preview);

    // 프로젝트 프리뷰 대상: 상세 리스트(h3) + 헤더 타이틀(h1)
    document.querySelectorAll('.work-body-item h3, .work-header h2[data-image-name]').forEach((title) => {
        const imageName = title.getAttribute('data-image-name');

        if (imageName) {
            title.classList.add('has-preview');

            title.addEventListener('mouseenter', () => {
                preview.innerHTML = `<img src="../img/projects/${imageName}.jpg" alt="${title.textContent.trim()}">`;
                preview.style.opacity = '1';
                preview.style.left = '50%';
                preview.style.top = '50%';
                preview.style.transform = 'translate(-50%, -50%)';
            });

            title.addEventListener('mouseleave', () => {
                preview.style.opacity = '0';
            });
        }
    });
}

// 현재 페이지 메뉴 하이라이트 기능
function initNavHighlight() {
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item');

    let activeKey = null;
    if (currentPath.includes('work.html')) {
        activeKey = 'work';
    } else if (currentPath.includes('blog_article') || currentPath.includes('/blog/')) {
        activeKey = 'blog';
    } else if (currentPath.includes('about.html')) {
        activeKey = 'about';
    }

    if (!activeKey) return;

    navItems.forEach((item) => {
        const label = item.textContent.trim().toLowerCase();
        if (label === activeKey) {
            item.classList.add('active');
        }
    });
}

// 언어 전환 링크: 한국어판에서는 en, 영어판에서는 kr 로 같은 페이지의 다른 언어판을 가리킨다
function initLangSwitch() {
    const link = document.querySelector('.lang-switch');
    if (!link) return;

    const path = window.location.pathname;
    link.textContent = IS_EN ? 'kr' : 'en';
    link.href = (IS_EN ? path.replace(/^\/en(\/|$)/, '/') : '/en' + path) + window.location.search;
    link.hreflang = IS_EN ? 'ko' : 'en';

    // 직접 고른 언어를 기억해 두면 lang.js 가 브라우저 언어보다 이걸 따른다
    link.addEventListener('click', () => {
        try {
            localStorage.setItem('lang', link.hreflang);
        } catch (e) {}
    });
}

// href="#"인 링크 클릭 시 경고 모달 표시 (임시 링크 막기 용도)
function initHashLinks() {
    const hashLinks = document.querySelectorAll('a[href="#_work"]');

    hashLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // 기본 동작 방지
            alert(IS_EN
                ? 'Want the details? Reach out on LinkedIn or by email 😄'
                : '자세한 내용이 궁금하시다면 링크드인 또는 메일로 연락주세요 😄');
        });
    });
}

// work 탭 전환 기능 (슬라이드 애니메이션)
function initWorkTabs() {
    const tabs = document.querySelectorAll('.work-tab');
    const personalSection = document.querySelector('.work-section-personal');
    const fieldSection = document.querySelector('.work-section-field');

    if (!tabs.length || !personalSection || !fieldSection) return;

    let currentMode = 'field';

    const activateTab = (mode) => {
        if (mode === currentMode) return;

        const toPersonal = mode === 'personal';
        const incoming = toPersonal ? personalSection : fieldSection;
        const outgoing = toPersonal ? fieldSection : personalSection;

        tabs.forEach((tab) => {
            const isActive = tab.dataset.tab === mode;
            tab.classList.toggle('active', isActive);
        });

        // 리셋
        incoming.classList.remove('slide-in-from-left', 'slide-in-from-right');

        // 방향에 따라 애니메이션 클래스 부여
        incoming.classList.add(toPersonal ? 'slide-in-from-right' : 'slide-in-from-left');

        // 실제 활성 상태 전환
        incoming.classList.add('is-active');
        outgoing.classList.remove('is-active', 'slide-in-from-left', 'slide-in-from-right');

        currentMode = mode;
    };

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.tab;
            activateTab(mode);
        });
    });

    // 기본값: field (Work Experience)
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === 'field'));
    personalSection.classList.remove('is-active', 'slide-in-from-left', 'slide-in-from-right');
    fieldSection.classList.add('is-active');
    fieldSection.classList.remove('slide-in-from-left', 'slide-in-from-right');
}

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
        loadPartial('#topNavigation', '/components/topNavigation.html'),
        loadPartial('#footer', '/components/footer.html'),
        loadPartial('#workTabs', '/components/workTabs.html'),
    ]);

    initMobileMenu();
    initWorkAccordion();
    initProjectPreview();
    initNavHighlight();
    initLangSwitch();
    initHashLinks();
    initWorkTabs();
    await Promise.all([
        initBlogArticleGrid('blogGrid'),
        initBlogArticleGrid('indexBlogGrid', 5),
        // initBlogSpaceGrid('spaceGrid'),
        // initBlogSpaceGrid('indexSpaceGrid'),
    ]);
    restoreDevScrollPosition();
});

if (isLocalDevHost()) {
    window.addEventListener('pagehide', saveDevScrollPosition);
    window.addEventListener('load', () => {
        restoreDevScrollPosition();
    });
}

function formatDateFromSlug(slug) {
    const parts = slug.split('_');
    return parts.length === 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : slug;
}

function getSlugTimestamp(slug) {
    const parts = slug.split('_');
    if (parts.length !== 3) return 0;

    const [year, month, day] = parts.map(Number);
    if (!year || !month || !day) return 0;

    return new Date(year, month - 1, day).getTime();
}

function sortPostsByDateDesc(posts) {
    return [...posts].sort((a, b) => getSlugTimestamp(b.slug) - getSlugTimestamp(a.slug));
}

async function getPostTitle(post, sourceDir) {
    if (post.title) return post.title;

    try {
        const mdRes = await fetch(`${sourceDir}/${post.slug}.md`);
        if (!mdRes.ok) return post.slug;
        const md = await mdRes.text();
        const titleMatch = md.match(/^#\s+(.+)$/m);
        return titleMatch ? titleMatch[1] : post.slug;
    } catch (e) {
        return post.slug;
    }
}

// blog_article 목록 (텍스트 리스트)
async function initBlogArticleGrid(gridId, limit) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    try {
        const res = await fetch(`${LANG_ROOT}blog_article/index.json`);
        if (!res.ok) return;
        const posts = sortPostsByDateDesc(await res.json());

        const visiblePosts = Number.isInteger(limit) ? posts.slice(0, limit) : posts;

        for (const post of visiblePosts) {
            const title = await getPostTitle(post, `${LANG_ROOT}blog_article`);
            const date = formatDateFromSlug(post.slug);
            const subtitle = post.subtitle || '';

            const item = document.createElement('a');
            item.className = 'blog-list-item';
            item.href = `${LANG_ROOT}blog/${post.slug}.html`; // scripts/build-blog.js 가 만든 정적 글
            item.innerHTML = `
                <span class="blog-list-date">${date}</span>
                <span class="blog-list-title">${title}</span>
                <span class="blog-list-subtitle">${subtitle}</span>
            `;
            grid.appendChild(item);
        }
    } catch (e) {
        // 로드 실패 시 조용히 무시
    }
}

// blog_space 목록 (썸네일 카드)
// async function initBlogSpaceGrid(gridId) {
//     const grid = document.getElementById(gridId);
//     if (!grid) return;
//
//     try {
//         const res = await fetch('blog_space/index.json');
//         if (!res.ok) return;
//         const posts = sortPostsByDateDesc(await res.json());
//
//         for (const post of posts) {
//             const title = await getPostTitle(post, 'blog_space');
//             const subtitle = post.subtitle || '';
//
//             const article = document.createElement('article');
//             article.className = 'project-card';
//             article.innerHTML = `
//                 <a href="blog_space_post.html?slug=${post.slug}" class="project-card" rel="noopener noreferrer">
//                     <div class="card-image">
//                         <img src="${post.thumbnail}" alt="${title}">
//                     </div>
//                     <h2 class="card-title">${title}</h2>
//                 </a>
//                 <p class="card-subtitle">${subtitle}</p>
//             `;
//             grid.appendChild(article);
//         }
//     } catch (e) {
//         // 로드 실패 시 조용히 무시
//     }
// }
