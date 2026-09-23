// ============================================================
// Vista — Part 3: loading, empty, error states + polish
// ============================================================

// --- Element references ---
const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const results = document.getElementById('results');
const resultCount = document.getElementById('result-count');
const emptyState = document.getElementById('empty-state');
const emptyTitle = document.getElementById('empty-state__title');
const emptyHint = document.getElementById('empty-state__hint');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-state__message');
const errorRetry = document.getElementById('error-retry');
const loadingBar = document.getElementById('loading-bar');
const tabs = document.querySelectorAll('.tab');

// --- Theme toggle ---
const themeToggle = document.getElementById('theme-toggle');
const root = document.documentElement;

themeToggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    themeToggle.textContent = next === 'dark' ? 'Light' : 'Dark';
});

// --- Layout picker ---
const LAYOUT_KEY = 'vista-layout';
const layoutButtons = document.querySelectorAll('.layout-toggle__btn');

function applyLayout(mode) {
    results.setAttribute('data-layout', mode);
    layoutButtons.forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.layout === mode);
    });
}

const savedLayout = localStorage.getItem(LAYOUT_KEY) || 'fixed';
applyLayout(savedLayout);

layoutButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.layout;
        applyLayout(mode);
        localStorage.setItem(LAYOUT_KEY, mode);
    });
});

// --- Category tabs ---
tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');

        const category = tab.dataset.category;
        if (category && category !== 'all') {
            input.value = category;
            runSearch(category);
        }
    });
});

// --- State management ---
function setLoading(isLoading) {
    if (loadingBar) loadingBar.classList.toggle('is-active', isLoading);
}

function showEmptyState() {
    if (emptyState) emptyState.hidden = false;
    if (errorState) errorState.hidden = true;
}

function hideEmptyState() {
    if (emptyState) emptyState.hidden = true;
}

function showError(message) {
    if (errorMessage) errorMessage.textContent = message;
    if (errorState) errorState.hidden = false;
    if (emptyState) emptyState.hidden = true;
}

function hideError() {
    if (errorState) errorState.hidden = true;
}

// --- Retry handler ---
let lastQuery = '';
if (errorRetry) {
    errorRetry.addEventListener('click', () => {
        if (lastQuery) {
            input.value = lastQuery;
            runSearch(lastQuery);
        }
    });
}

// --- Form submit ---
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    runSearch(query);
});

// --- Main search function ---
async function runSearch(query) {
    lastQuery = query;

    setLoading(true);
    hideError();
    hideEmptyState();
    results.innerHTML = '';
    resultCount.textContent = `Searching "${query}"…`;

    const url =
        'https://commons.wikimedia.org/w/api.php?' +
        'action=query' +
        '&format=json' +
        '&origin=*' +
        '&generator=search' +
        '&gsrsearch=' + encodeURIComponent(query) +
        '&gsrnamespace=6' +
        '&gsrlimit=24' +
        '&prop=imageinfo' +
        '&iiprop=url|size|extmetadata' +
        '&iiurlwidth=400';

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const pages = data?.query?.pages ? Object.values(data.query.pages) : [];

        const items = pages
            .map((page) => {
                const info = page.imageinfo?.[0];
                if (!info || !info.thumburl) return null;
                const meta = info.extmetadata || {};
                const artistRaw = meta.Artist?.value || '';
                const artist = artistRaw.replace(/<[^>]*>/g, '').trim();
                return {
                    title: cleanTitle(page.title),
                    url: info.url,
                    thumb: info.thumburl,
                    width: info.width,
                    height: info.height,
                    artist: artist || 'Unknown',
                };
            })
            .filter(Boolean);

        if (items.length === 0) {
            setLoading(false);
            resultCount.textContent = `0 results`;
            emptyTitle.textContent = `No results for "${query}"`;
            emptyHint.textContent = 'Try another search or pick a category.';
            showEmptyState();
            return;
        }

        renderResults(items, query);
        setLoading(false);
    } catch (err) {
        console.error('Search failed:', err);
        setLoading(false);
        results.innerHTML = '';
        resultCount.textContent = `Search failed`;
        showError('Something went wrong. Please try again.');
    }
}

// --- Render ---
function renderResults(items, query) {
    results.innerHTML = '';
    hideError();
    hideEmptyState();

    resultCount.textContent = `Showing ${items.length} result${items.length === 1 ? '' : 's'} for "${query}"`;

    const fragment = document.createDocumentFragment();

    items.forEach((item, index) => {
        const card = document.createElement('a');
        card.className = 'card';
        card.href = item.url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.style.animationDelay = `${Math.min(index * 25, 400)}ms`;

        const img = document.createElement('img');
        img.src = item.thumb;
        img.alt = item.title;
        img.loading = 'lazy';

        const meta = document.createElement('div');
        meta.className = 'card__meta';

        const title = document.createElement('div');
        title.className = 'card__title';
        title.textContent = item.title;

        const author = document.createElement('div');
        author.className = 'card__author';
        author.textContent = `${item.artist} · ${item.width}×${item.height}`;

        meta.appendChild(title);
        meta.appendChild(author);
        card.appendChild(img);
        card.appendChild(meta);
        fragment.appendChild(card);
    });

    results.appendChild(fragment);
}

// --- Utility ---
function cleanTitle(raw) {
    return raw
        .replace(/^File:/, '')
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/_/g, ' ')
        .slice(0, 80);
}