(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const N = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const PN = v => {
    if (typeof v === 'number') return v;
    let s = String(v || '').replace(/R\$/gi, '').replace(/\s/g, '');
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    return Number(s.replace(/[^0-9.-]/g, '')) || 0;
  };
  const M = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const NUM = v => (Number(v) || 0).toLocaleString('pt-BR');
  const P = v => `${(Number(v) || 0).toFixed(1).replace('.', ',')}%`;
  const ESC = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const META = () => { try { return JSON.parse(localStorage.getItem('garimpeiro-ai-meta') || '{}'); } catch { return {}; } };

  function brand() {
    document.title = 'Garimpeiro da Shopee';
    const h = document.querySelector('.brand h1'); if (h) h.textContent = 'Garimpeiro da Shopee';
    const p = document.querySelector('.brand p'); if (p) p.textContent = 'Fornecedor × Shopee';
    const m = document.querySelector('.brand-mark'); if (m) m.textContent = 'G';
    const hero = document.querySelector('.hero p');
    if (hero) hero.textContent = 'Importe uma planilha do fornecedor e uma da Shopee. Para atualizar um produto, abra a busca na Shopee, tire um print e cole com Ctrl+V ou envie a imagem para a IA analisar preços, kits e vendas.';
  }

  function css() {
    if ($('garimpeiroAddonCss')) return;
    const s = document.createElement('style');
    s.id = 'garimpeiroAddonCss';
    s.textContent = `
      .ai-camera{padding:0;font-size:16px}
      .ai-badge{color:#d9c6ff!important;border:1px solid #8f6cff66!important;background:#8f6cff18!important;font-weight:700!important}
      tr.ai-analyzed-row td:first-child{box-shadow:inset 3px 0 0 #8f6cff}
      .gm-modal{position:fixed;inset:0;z-index:120;background:#000d;display:grid;place-items:center;padding:18px;overflow:auto}
      .gm-card{width:min(980px,100%);max-height:92vh;overflow:auto;background:#111;border:1px solid #333;border-radius:16px;padding:18px;box-shadow:0 28px 90px #000}
      .gm-head{display:flex;justify-content:space-between;gap:12px}.gm-head h3{margin:0}.gm-head p{margin:5px 0;color:#99958c;font-size:12px}
      .gm-x{width:34px;height:34px;border-radius:9px;border:1px solid #333;background:#181818;color:#fff;cursor:pointer}
      .gm-grid{display:grid;grid-template-columns:250px 1fr;gap:12px;margin:14px 0}
      .gm-up{min-height:180px;border:1px dashed #7759c9;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;padding:14px;text-align:center;background:#8f6cff08}
      .gm-up:hover,.gm-up.paste-ready{border-color:#a98bff;background:#8f6cff12}.gm-up b{margin-top:6px}.gm-up small,.gm-help{color:#99958c;font-size:12px}
      .gm-paste{margin-top:9px;padding:6px 9px;border-radius:8px;background:#1c1730;color:#d9c6ff;font-size:11px;font-weight:700}
      .gm-preview{min-height:180px;border:1px solid #293847;border-radius:12px;display:grid;place-items:center;overflow:hidden;background:#090909}
      .gm-preview img{max-width:100%;max-height:390px;display:block}
      .gm-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.gm-actions.bottom{margin-top:14px;justify-content:flex-end}
      .gm-result{margin-top:14px;border:1px solid #5d498d;border-radius:11px;padding:14px;background:#8f6cff0b}
      .gm-result h4{margin:14px 0 8px}.gm-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}
      .gm-stat{padding:9px;border:1px solid #2a2a2a;border-radius:9px;background:#0b0b0b}.gm-stat small{color:#99958c;display:block}.gm-stat b{display:block;margin-top:3px}
      .gm-warn{color:#e5c46a;font-size:12px}.gm-table-wrap{overflow:auto;border:1px solid #292929;border-radius:10px;margin-top:7px}.gm-table{width:100%;border-collapse:collapse;font-size:12px}.gm-table th,.gm-table td{padding:8px 9px;border-bottom:1px solid #242424;text-align:left;vertical-align:top}.gm-table th{color:#aaa;background:#0b0b0b}.gm-table tr:last-child td{border-bottom:0}.gm-table td strong{white-space:nowrap}
      .gm-applied{margin-top:12px;padding:10px;border:1px solid #315b45;border-radius:9px;background:#0c1b12;color:#b8efca;font-size:12px}
      .gm-hidden{display:none!important}
      @media(max-width:700px){.gm-grid{grid-template-columns:1fr}.gm-stats{grid-template-columns:1fr 1fr}.gm-card{padding:13px}}
    `;
    document.head.appendChild(s);
  }

  function readSession() { try { return JSON.parse(localStorage.getItem('radar-session') || 'null'); } catch { return null; } }
  function writeSession(v) { localStorage.setItem('radar-session', JSON.stringify(v)); }

  function injectKey() {
    const modal = $('settingsModal');
    if (!modal || $('geminiKeyAddon')) return;
    const grid = modal.querySelector('.form-grid');
    if (!grid) return;
    const l = document.createElement('label');
    l.className = 'field'; l.style.gridColumn = '1/-1';
    l.innerHTML = '<span>Chave Gemini para analisar prints</span><input id="geminiKeyAddon" type="password" autocomplete="off" placeholder="GEMINI_API_KEY"><small class="gm-help">Se a Vercel já tiver GEMINI_API_KEY configurada, deixe vazio.</small>';
    grid.appendChild(l);
    $('geminiKeyAddon').value = localStorage.getItem('garimpeiro-gemini-key') || '';
    $('saveSettings')?.addEventListener('click', () => {
      const v = $('geminiKeyAddon')?.value.trim() || '';
      v ? localStorage.setItem('garimpeiro-gemini-key', v) : localStorage.removeItem('garimpeiro-gemini-key');
    });
  }

  function decorate() {
    const body = $('resultsBody'); if (!body) return;
    const meta = META();
    body.querySelectorAll('tr').forEach(tr => {
      const name = tr.querySelector('.product-name')?.textContent.trim(); if (!name) return;
      const key = N(name), info = meta[key];
      const links = tr.querySelector('.link-row');
      if (links && !links.querySelector('.ai-camera')) {
        const b = document.createElement('button');
        b.className = 'icon-link ai-camera'; b.type = 'button'; b.title = 'Colar ou enviar print da busca na Shopee'; b.textContent = '📸';
        b.onclick = () => openShot(name);
        links.appendChild(b);
      }
      if (info) {
        tr.classList.add('ai-analyzed-row');
        if (!tr.querySelector('.ai-badge')) {
          const tags = tr.querySelector('.product-sub');
          if (tags) {
            const s = document.createElement('span'); s.className = 'tag ai-badge';
            s.textContent = `✨ IA analisado${info.confidence ? ` ${Math.round(info.confidence)}%` : ''}`;
            tags.appendChild(s);
          }
        }
      }
    });
  }

  function findResult(name) {
    const saved = readSession();
    const r = (saved?.results || []).find(x => N(x.product?.name) === N(name));
    return { saved, r };
  }

  function compress(file) {
    return new Promise((ok, no) => {
      if (!file) return no(new Error('Selecione ou cole um print.'));
      if (file.size > 12 * 1024 * 1024) return no(new Error('Use uma imagem de até 12 MB.'));
      const fr = new FileReader();
      fr.onerror = () => no(new Error('Não consegui ler a imagem.'));
      fr.onload = () => {
        const im = new Image();
        im.onerror = () => no(new Error('Imagem inválida.'));
        im.onload = () => {
          const sc = Math.min(1, 1800 / im.width), c = document.createElement('canvas');
          c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          const preview = c.toDataURL('image/jpeg', .86);
          ok({ preview, data: preview.split(',')[1], mimeType: 'image/jpeg' });
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function aiMarket(a) {
    const units = (a.unit_ads || []).filter(x => PN(x.price) > 0).map(x => ({ name: x.title || '', price: PN(x.price), sold: PN(x.sold), rating: PN(x.rating) }));
    const kits = (a.kit_ads || []).filter(x => PN(x.price) > 0).map(x => ({ name: x.title || '', price: PN(x.price), sold: PN(x.sold), rating: PN(x.rating), qty: PN(x.quantity), unitPrice: PN(x.unit_price) }));
    let base = units;
    if (!base.length) base = kits.filter(x => x.unitPrice > 0).map(x => ({ ...x, price: x.unitPrice }));
    if (!base.length) throw new Error('A IA não encontrou anúncios comparáveis com preço legível.');
    const s = [...base].sort((x, y) => x.price - y.price), ps = s.map(x => x.price), min = s[0], max = s[s.length - 1];
    const mean = ps.reduce((x, y) => x + y, 0) / ps.length;
    const median = ps.length % 2 ? ps[(ps.length - 1) / 2] : (ps[ps.length / 2 - 1] + ps[ps.length / 2]) / 2;
    return { min: min.price, max: max.price, mean, median, minSold: min.sold || 0, maxSold: max.sold || 0, totalSold: base.reduce((z, x) => z + (x.sold || 0), 0), unitCount: units.length, kitCount: kits.length, baseCount: base.length, minAd: min, maxAd: max, kits, units, all: [...units, ...kits], source: 'ai-screenshot' };
  }

  function calc(cost, sale) {
    let cfg = {}; try { cfg = JSON.parse(localStorage.getItem('radar-cfg') || '{}'); } catch {}
    const feePct = PN(cfg.feePct ?? 20), feeFixed = PN(cfg.feeFixed ?? 4), packCost = PN(cfg.packCost ?? 0), otherCost = PN(cfg.otherCost ?? 0);
    const fee = sale * feePct / 100 + feeFixed + packCost + otherCost;
    const profit = sale - cost - fee;
    return { profit, margin: sale ? profit / sale * 100 : 0 };
  }

  function profitHtml(label, x) {
    return `<div class="profit-row"><span>${label}</span><strong class="${x.profit >= 0 ? 'profit-positive' : 'profit-negative'}">${M(x.profit)} · ${P(x.margin)}</strong></div>`;
  }

  function updateRow(name, r, market, confidence) {
    const row = [...document.querySelectorAll('#resultsBody tr')].find(tr => N(tr.querySelector('.product-name')?.textContent) === N(name));
    if (!row) return;
    const cells = row.querySelectorAll('td');
    if (cells[2]) cells[2].innerHTML = `<div class="price-stack"><div class="price-row"><span>Mín.</span><strong>${M(market.min)}</strong></div><div class="price-row"><span>Médio</span><strong>${M(market.mean)}</strong></div><div class="price-row"><span>Máx.</span><strong>${M(market.max)}</strong></div></div>`;
    if (cells[3]) cells[3].innerHTML = `<strong>${NUM(market.totalSold)}</strong><small style="display:block;color:var(--muted)">mín: ${NUM(market.minSold)} · máx: ${NUM(market.maxSold)}</small>`;
    if (cells[4]) {
      const mn = calc(r.product.cost, market.min), md = calc(r.product.cost, market.mean), mx = calc(r.product.cost, market.max);
      cells[4].innerHTML = `<div class="profit-stack">${profitHtml('Mín.', mn)}${profitHtml('Médio', md)}${profitHtml('Máx.', mx)}</div>`;
    }
    const tags = row.querySelector('.product-sub');
    if (tags) {
      const countTag = [...tags.querySelectorAll('.tag')].find(t => /unid\.|kits/i.test(t.textContent));
      if (countTag) countTag.textContent = `${market.unitCount} unid. / ${market.kitCount} kits`;
    }
    row.classList.add('ai-analyzed-row');
    let badge = row.querySelector('.ai-badge');
    if (!badge && tags) { badge = document.createElement('span'); badge.className = 'tag ai-badge'; tags.appendChild(badge); }
    if (badge) badge.textContent = `✨ IA analisado${confidence ? ` ${Math.round(confidence)}%` : ''}`;
  }

  function updateAverageMetric(saved) {
    const metric = $('mProfit'); if (!metric || !saved?.results?.length) return;
    const avg = saved.results.reduce((sum, x) => sum + calc(x.product.cost, x.market.mean).profit, 0) / saved.results.length;
    metric.textContent = M(avg);
  }

  function adRows(items, isKit = false) {
    if (!items.length) return '<p class="gm-help">Nenhum anúncio deste tipo foi considerado.</p>';
    return `<div class="gm-table-wrap"><table class="gm-table"><thead><tr><th>Anúncio</th><th>Preço</th>${isKit ? '<th>Qtd.</th><th>Por unidade</th>' : ''}<th>Vendidos</th><th>Aval.</th></tr></thead><tbody>${items.map(x => `<tr><td>${ESC(x.name)}</td><td><strong>${M(x.price)}</strong></td>${isKit ? `<td>${NUM(x.qty || 0)}</td><td>${x.unitPrice ? M(x.unitPrice) : '—'}</td>` : ''}<td>${NUM(x.sold || 0)}</td><td>${x.rating ? Number(x.rating).toFixed(1) : '—'}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function openShot(name) {
    const { saved, r } = findResult(name);
    if (!r) return alert('Não consegui localizar este produto nos resultados atuais. Atualize a página e tente novamente.');
    const old = $('gmModal'); if (old) old.remove();
    const d = document.createElement('div'); d.id = 'gmModal'; d.className = 'gm-modal';
    d.innerHTML = `<section class="gm-card">
      <div class="gm-head"><div><h3>📸 Analisar print — ${ESC(r.product.name)}</h3><p>Custo: ${M(r.product.cost)} · cole o print com Ctrl+V ou selecione a imagem.</p></div><button class="gm-x" title="Fechar">✕</button></div>
      <div class="gm-actions"><a class="btn btn-ghost" href="https://shopee.com.br/search?keyword=${encodeURIComponent(r.query || r.product.name)}" target="_blank">🛍️ Abrir pesquisa na Shopee</a></div>
      <div class="gm-grid">
        <label class="gm-up" id="gmDrop"><input id="gmFile" type="file" accept="image/png,image/jpeg,image/webp" hidden><span style="font-size:30px">📷</span><b>Selecionar print</b><small>PNG, JPG ou WEBP</small><span class="gm-paste">ou pressione Ctrl+V com o print copiado</span></label>
        <div id="gmPrev" class="gm-preview"><span class="gm-help">A prévia aparecerá aqui. Você pode usar o Print Screen e voltar direto para esta janela.</span></div>
      </div>
      <div class="gm-actions"><button id="gmRun" class="btn btn-primary" disabled>✨ Analisar com IA</button><span id="gmStatus" class="gm-help">A IA usa somente o que estiver visível no print.</span></div>
      <div id="gmResult"></div>
      <div class="gm-actions bottom"><button id="gmCloseAfter" class="btn btn-ghost gm-hidden">Fechar e atualizar tabela</button></div>
    </section>`;
    document.body.appendChild(d);

    let shot = null, dirty = false;
    const close = () => {
      window.removeEventListener('paste', pasteHandler);
      d.remove();
      if (dirty) location.reload();
    };
    d.querySelector('.gm-x').onclick = close;
    $('gmCloseAfter').onclick = close;
    d.onclick = e => { if (e.target === d) close(); };

    async function setShot(file, source) {
      try {
        $('gmStatus').textContent = source === 'paste' ? 'Recebi o print da área de transferência...' : 'Carregando o print...';
        shot = await compress(file);
        $('gmPrev').innerHTML = `<img src="${shot.preview}" alt="Prévia do print">`;
        $('gmRun').disabled = false;
        $('gmStatus').textContent = source === 'paste' ? 'Print colado com Ctrl+V. Pronto para análise.' : 'Print carregado. Pronto para análise.';
        $('gmDrop').classList.add('paste-ready');
      } catch (err) { $('gmStatus').textContent = err.message; }
    }

    function pasteHandler(e) {
      const items = [...(e.clipboardData?.items || [])];
      const imageItem = items.find(item => item.type?.startsWith('image/'));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      e.preventDefault();
      setShot(file, 'paste');
    }
    window.addEventListener('paste', pasteHandler);
    $('gmFile').onchange = e => setShot(e.target.files[0], 'upload');

    $('gmRun').onclick = async () => {
      if (!shot) return;
      const b = $('gmRun'); b.disabled = true; b.textContent = 'Analisando...';
      $('gmStatus').textContent = 'Lendo preços, kits e vendas visíveis...';
      try {
        const h = { 'Content-Type': 'application/json' }, k = localStorage.getItem('garimpeiro-gemini-key') || '';
        if (k) h['x-gemini-key'] = k;
        const resp = await fetch('/api/analyze-screenshot', { method: 'POST', headers: h, body: JSON.stringify({ image: shot.data, mimeType: shot.mimeType, product: r.product, searchQuery: r.query }) });
        const j = await resp.json();
        if (!resp.ok || j.error) throw new Error(j.error || 'Falha na análise.');
        const market = aiMarket(j.analysis);
        r.market = market;
        r.aiScreenshot = { ...j.analysis, at: Date.now() };
        writeSession(saved);
        const meta = META();
        meta[N(r.product.name)] = { at: Date.now(), confidence: j.analysis.confidence || 0, min: market.min, mean: market.mean, max: market.max };
        localStorage.setItem('garimpeiro-ai-meta', JSON.stringify(meta));

        updateRow(name, r, market, j.analysis.confidence || 0);
        updateAverageMetric(saved);
        decorate();
        dirty = true;

        $('gmResult').innerHTML = `<div class="gm-result">
          <strong>✨ Análise concluída — dados aplicados ao produto</strong>
          <div class="gm-stats">
            <div class="gm-stat"><small>Confiança</small><b>${Math.round(j.analysis.confidence || 0)}%</b></div>
            <div class="gm-stat"><small>Mín. / médio / máx.</small><b>${M(market.min)} · ${M(market.mean)} · ${M(market.max)}</b></div>
            <div class="gm-stat"><small>Unidades / kits</small><b>${market.unitCount} / ${market.kitCount}</b></div>
            <div class="gm-stat"><small>Vendas visíveis</small><b>${NUM(market.totalSold)}</b></div>
          </div>
          <p class="gm-help">${ESC(j.analysis.summary || '')}</p>
          ${(j.analysis.warnings || []).length ? `<ul class="gm-warn">${j.analysis.warnings.map(w => `<li>${ESC(w)}</li>`).join('')}</ul>` : ''}
          <h4>Unidades consideradas no cálculo</h4>${adRows(market.units, false)}
          <h4>Kits identificados no print</h4>${adRows(market.kits, true)}
          <div class="gm-applied"><b>✓ Preços atualizados:</b> mínimo ${M(market.min)}, médio ${M(market.mean)} e máximo ${M(market.max)}. O lucro e a margem também foram recalculados usando o custo do fornecedor e suas taxas configuradas.</div>
        </div>`;
        $('gmStatus').textContent = 'Análise salva. Revise os resultados abaixo; esta janela só fecha quando você quiser.';
        $('gmCloseAfter').classList.remove('gm-hidden');
      } catch (err) {
        $('gmStatus').textContent = err.message;
        alert(err.message);
      } finally {
        b.disabled = false; b.textContent = '✨ Analisar novamente';
      }
    };
  }

  brand(); css(); injectKey();
  const obs = new MutationObserver(decorate), rb = $('resultsBody');
  if (rb) obs.observe(rb, { childList: true, subtree: true });
  decorate();
  setTimeout(() => { brand(); injectKey(); decorate(); }, 500);
})();
