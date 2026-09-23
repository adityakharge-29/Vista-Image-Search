// ============================================================
// Vista — Part 2: search, fetch, render
// ============================================================

// --- Element references ---
const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const results = document.getElementById('results');
const resultCount = document.getElementById('result-count');
const emptyState = document.getElementById('empty-state');
const tabs = document.querySelectorAll('.tab');

// --- Theme toggle (from Part 1) ---
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

// Restore saved preference on load (default: fixed)
const savedLayout = localStorage.getItem(LAYOUT_KEY) || 'fixed';
applyLayout(savedLayout);

layoutButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.layout;
        applyLayout(mode);
        localStorage.setItem(LAYOUT_KEY, mode);
    });
});

// --- Category tab active state (from Part 1) + wire chips to search ---
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

// // --- Dev layout toggle (temporary — remove before commit) ---
// // Cycles #results through: masonry → fixed → square
// const layoutOrder = ['masonry', 'fixed', 'square'];
// let layoutIndex = 0;
// const layoutBtn = document.getElementById('layout-toggle');

// if (layoutBtn) {
//     layoutBtn.textContent = `Layout: ${layoutOrder[0]}`;
//     layoutBtn.addEventListener('click', () => {
//         layoutIndex = (layoutIndex + 1) % layoutOrder.length;
//         const mode = layoutOrder[layoutIndex];
//         results.setAttribute('data-layout', mode);
//         layoutBtn.textContent = `Layout: ${mode}`;
//     });
// }

// --- Main search handler ---
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    runSearch(query);
});

// --- Fetch + render ---
async function runSearch(query) {
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

        // Filter out entries without a usable thumbnail
        const items = pages
            .map((page) => {
                const info = page.imageinfo?.[0];
                if (!info || !info.thumburl) return null;
                const meta = info.extmetadata || {};
                const artistRaw = meta.Artist?.value || '';
                // Strip HTML tags from the artist field (Wikimedia returns HTML)
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

        renderResults(items, query);
    } catch (err) {
        console.error('Search failed:', err);
        results.innerHTML = '';
        if (emptyState) emptyState.style.display = '';
        resultCount.textContent = `Search failed — ${err.message}`;
    }
}

// --- Render ---
function renderResults(items, query) {
    results.innerHTML = '';

    if (items.length === 0) {
        if (emptyState) emptyState.style.display = '';
        resultCount.textContent = `No results for "${query}"`;
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    resultCount.textContent = `Showing ${items.length} results for "${query}"`;

    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
        const card = document.createElement('a');
        card.className = 'card';
        card.href = item.url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';

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

// --- Utility: tidy a Wikimedia title ---
function cleanTitle(raw) {
    return raw
        .replace(/^File:/, '')
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/_/g, ' ')
        .slice(0, 80);
}