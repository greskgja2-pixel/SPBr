(() => {
  'use strict';

  const PLACEHOLDER = '📦';
  const CACHE_KEY = 'garimpeiro-supplier-image-cache-v2';
  const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
  const MAX_CACHE = 600;
  const seen = new WeakSet();
  const pending = new Map();

  const style = document.createElement('style');
  style.textContent = `.supplier-product-layout{display:flex;align-items:flex-start;gap:12px;min-width:330px}.supplier-product-text{min-width:0;flex:1}.supplier-thumb{width:72px;height:72px;flex:0 0 72px;border:1px solid #303030;border-radius:12px;background:#0b0b0b;display:grid;place-items:center;overflow:hidden;text-decoration:none;position:relative}.supplier-thumb:hover{border-color:#6f5e24}.supplier-thumb img{width:100%;height:100%;object-fit:contain;background:#fff;opacity:0;transition:opacity .18s}.supplier-thumb.loaded img{opacity:1}.supplier-thumb-placeholder{font-size:25px;filter:grayscale(.2);opacity:.75}.supplier-thumb.loading .supplier-thumb-placeholder{animation:supplierPulse 1s ease-in-out infinite}.supplier-thumb.failed .supplier-thumb-placeholder{opacity:.42}.supplier-thumb::after{content:'Fornecedor';position:absolute;left:4px;right:4px;bottom:4px;padding:2px 3px;border-radius:5px;background:rgba(0,0,0,.72);color:#ddd;font-size:8px;text-align:center;opacity:0;transition:.15s}.supplier-thumb:hover::after{opacity:1}@keyframes supplierPulse{50%{opacity:.28;transform:scale(.92)}}@media(max-width:680px){.supplier-product-layout{min-width:290px}.supplier-thumb{width:58px;height:58px;flex-basis:58px}}`;
  document.head.appendChild(style);

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; }
    catch { return {}; }
  }

  function getCached(url) {
    const cache = readCache();
    const item = cache[url];
    if (!item || !item.imageUrl || Date.now() - Number(item.at || 0) > CACHE_TTL) return '';
    return item.imageUrl;
  }

  function setCached(url, imageUrl) {
    if (!imageUrl) return;
    const cache = readCache();
    cache[url] = { imageUrl, at: Date.now() };
    const entries = Object.entries(cache).sort((a, b) => Number(b[1]?.at || 0) - Number(a[1]?.at || 0));
    const trimmed = Object.fromEntries(entries.slice(0, MAX_CACHE));
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed)); } catch {}
  }

  function supplierLinkForRow(row) {
    return [...row.querySelectorAll('a[href]')].find(a => {
      try {
        const u = new URL(a.href, location.href);
        return /^https?:$/.test(u.protocol) && !/(^|\.)shopee\.com\.br$/i.test(u.hostname);
      } catch { return false; }
    });
  }

  async function supplierImage(pageUrl) {
    const cached = getCached(pageUrl);
    if (cached) return cached;
    if (pending.has(pageUrl)) return pending.get(pageUrl);
    const task = fetch(`/api/supplier-meta?url=${encodeURIComponent(pageUrl)}`)
      .then(async r => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.imageUrl) throw new Error(j?.error || 'Imagem não encontrada.');
        const imageUrl = String(j.imageUrl || '').trim();
        if (!/^https?:\/\//i.test(imageUrl)) throw new Error('Imagem inválida.');
        setCached(pageUrl, imageUrl);
        return imageUrl;
      })
      .finally(() => pending.delete(pageUrl));
    pending.set(pageUrl, task);
    return task;
  }

  function loadImage(thumbLink, placeholder, pageUrl) {
    thumbLink.classList.add('loading');
    supplierImage(pageUrl).then(imageUrl => {
      const img = document.createElement('img');
      img.alt = 'Imagem do produto do fornecedor';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('load', () => {
        thumbLink.classList.remove('loading');
        thumbLink.classList.add('loaded');
        placeholder.remove();
      }, { once: true });
      img.addEventListener('error', () => {
        img.remove();
        thumbLink.classList.remove('loading');
        thumbLink.classList.add('failed');
        placeholder.title = 'Não foi possível carregar a imagem deste fornecedor';
      }, { once: true });
      img.src = imageUrl;
      thumbLink.appendChild(img);
    }).catch(() => {
      thumbLink.classList.remove('loading');
      thumbLink.classList.add('failed');
      placeholder.title = 'Não foi possível obter a imagem deste fornecedor';
    });
  }

  function decorateRow(row) {
    if (!row || seen.has(row)) return;
    const supplierLink = supplierLinkForRow(row);
    const cell = row.querySelector('td:first-child');
    if (!supplierLink || !cell) return;
    seen.add(row);

    const wrap = document.createElement('div');
    wrap.className = 'supplier-product-layout';

    const thumbLink = document.createElement('a');
    thumbLink.className = 'supplier-thumb';
    thumbLink.href = supplierLink.href;
    thumbLink.target = '_blank';
    thumbLink.rel = 'noopener noreferrer';
    thumbLink.title = 'Abrir produto no fornecedor';

    const placeholder = document.createElement('span');
    placeholder.className = 'supplier-thumb-placeholder';
    placeholder.textContent = PLACEHOLDER;
    thumbLink.appendChild(placeholder);
    loadImage(thumbLink, placeholder, supplierLink.href);

    const text = document.createElement('div');
    text.className = 'supplier-product-text';
    while (cell.firstChild) text.appendChild(cell.firstChild);
    wrap.append(thumbLink, text);
    cell.appendChild(wrap);
  }

  function decorateRows() {
    document.querySelectorAll('#resultsBody tr').forEach(decorateRow);
  }

  function start() {
    const body = document.getElementById('resultsBody');
    if (!body) return;
    decorateRows();
    new MutationObserver(decorateRows).observe(body, { childList: true, subtree: false });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
