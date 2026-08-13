(() => {
  'use strict';

  const PLACEHOLDER = '📦';
  const seen = new WeakSet();

  const style = document.createElement('style');
  style.textContent = `.supplier-product-layout{display:flex;align-items:flex-start;gap:12px;min-width:330px}.supplier-product-text{min-width:0;flex:1}.supplier-thumb{width:72px;height:72px;flex:0 0 72px;border:1px solid #303030;border-radius:12px;background:#0b0b0b;display:grid;place-items:center;overflow:hidden;text-decoration:none;position:relative}.supplier-thumb:hover{border-color:#6f5e24}.supplier-thumb img{width:100%;height:100%;object-fit:contain;background:#fff;opacity:0;transition:opacity .18s}.supplier-thumb.loaded img{opacity:1}.supplier-thumb-placeholder{font-size:25px;filter:grayscale(.2);opacity:.75}.supplier-thumb.failed .supplier-thumb-placeholder{opacity:.42}.supplier-thumb::after{content:'Fornecedor';position:absolute;left:4px;right:4px;bottom:4px;padding:2px 3px;border-radius:5px;background:rgba(0,0,0,.72);color:#ddd;font-size:8px;text-align:center;opacity:0;transition:.15s}.supplier-thumb:hover::after{opacity:1}@media(max-width:680px){.supplier-product-layout{min-width:290px}.supplier-thumb{width:58px;height:58px;flex-basis:58px}}`;
  document.head.appendChild(style);

  function supplierLinkForRow(row) {
    return [...row.querySelectorAll('a[href]')].find(a => {
      try {
        const u = new URL(a.href, location.href);
        return /^https?:$/.test(u.protocol) && !/(^|\.)shopee\.com\.br$/i.test(u.hostname);
      } catch { return false; }
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

    const img = document.createElement('img');
    img.alt = 'Imagem do produto do fornecedor';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.src = `/api/supplier-image?url=${encodeURIComponent(supplierLink.href)}`;
    img.addEventListener('load', () => {
      thumbLink.classList.add('loaded');
      placeholder.remove();
    }, { once: true });
    img.addEventListener('error', () => {
      img.remove();
      thumbLink.classList.add('failed');
      placeholder.title = 'Não foi possível obter a imagem deste fornecedor';
    }, { once: true });

    thumbLink.append(placeholder, img);

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
