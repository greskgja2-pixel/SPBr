const dns = require('node:dns').promises;
const net = require('node:net');

const MAX_HTML_BYTES = 1_500_000;
const MAX_IMAGE_BYTES = 6_000_000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36';

function isPrivateIp(ip) {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      p[0] >= 224;
  }
  const s = ip.toLowerCase();
  return s === '::1' || s === '::' || s.startsWith('fc') || s.startsWith('fd') ||
    s.startsWith('fe8') || s.startsWith('fe9') || s.startsWith('fea') || s.startsWith('feb') ||
    s.startsWith('ff');
}

async function assertPublicUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('URL inválida.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Protocolo não permitido.');
  if (url.username || url.password) throw new Error('URL com credenciais não é permitida.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error('Host local não permitido.');
  const answers = await dns.lookup(host, { all: true, verbatim: true });
  if (!answers.length || answers.some(a => isPrivateIp(a.address))) throw new Error('Host privado não permitido.');
  return url;
}

async function safeFetch(rawUrl, options = {}, redirects = 0) {
  if (redirects > 4) throw new Error('Redirecionamentos demais.');
  const url = await assertPublicUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 9000);
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      redirect: 'manual',
      signal: controller.signal
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const loc = response.headers.get('location');
      if (!loc) throw new Error('Redirecionamento sem destino.');
      const next = new URL(loc, url).toString();
      return safeFetch(next, options, redirects + 1);
    }
    return { response, finalUrl: url.toString() };
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(value = '') {
  return String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x2F;/gi, '/');
}

function metaImage(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const preferred = ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src'];
  for (const key of preferred) {
    for (const tag of tags) {
      const prop = (tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i) || [])[1];
      if (!prop || prop.toLowerCase() !== key) continue;
      const content = (tag.match(/content\s*=\s*["']([^"']+)["']/i) || [])[1];
      if (content) return decodeEntities(content);
    }
  }
  return '';
}

function findProductImageInJson(value) {
  if (!value) return '';
  if (Array.isArray(value)) {
    for (const v of value) {
      const found = findProductImageInJson(v);
      if (found) return found;
    }
    return '';
  }
  if (typeof value !== 'object') return '';
  const type = value['@type'];
  const isProduct = (Array.isArray(type) ? type : [type]).some(t => String(t || '').toLowerCase() === 'product');
  if (isProduct && value.image) {
    const img = Array.isArray(value.image) ? value.image[0] : value.image;
    if (typeof img === 'string') return img;
    if (img && typeof img === 'object' && (img.url || img.contentUrl)) return img.url || img.contentUrl;
  }
  if (value['@graph']) {
    const found = findProductImageInJson(value['@graph']);
    if (found) return found;
  }
  for (const v of Object.values(value)) {
    const found = findProductImageInJson(v);
    if (found) return found;
  }
  return '';
}

function jsonLdImage(html) {
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const text = m[1].trim();
    if (!text) continue;
    try {
      const found = findProductImageInJson(JSON.parse(text));
      if (found) return decodeEntities(found);
    } catch {}
  }
  return '';
}

function fallbackImage(html) {
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const scored = imgs.map(tag => {
    const src = (tag.match(/(?:src|data-src|data-lazy-src)\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    const context = tag.toLowerCase();
    let score = 0;
    if (/product|produto|gallery|galeria|main|principal|zoom/.test(context)) score += 5;
    if (/logo|icon|sprite|avatar|banner/.test(context)) score -= 5;
    if (/width\s*=\s*["']?(?:[3-9]\d\d|\d{4,})/i.test(tag)) score += 1;
    return { src: decodeEntities(src), score };
  }).filter(x => x.src && !x.src.startsWith('data:'));
  scored.sort((a,b) => b.score - a.score);
  return scored[0]?.src || '';
}

function resolveImageUrl(html, pageUrl) {
  const raw = metaImage(html) || jsonLdImage(html) || fallbackImage(html);
  if (!raw) return '';
  try { return new URL(raw, pageUrl).toString(); } catch { return ''; }
}

async function readLimitedText(response, limit) {
  const buf = Buffer.from(await response.arrayBuffer());
  if (buf.length > limit) throw new Error('Página grande demais.');
  return buf.toString('utf8');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET.' });
  const pageUrl = String(req.query?.url || '').trim();
  if (!pageUrl) return res.status(400).json({ error: 'Link do fornecedor ausente.' });

  try {
    const { response: page, finalUrl } = await safeFetch(pageUrl, {
      headers: {
        'user-agent': UA,
        'accept': 'text/html,application/xhtml+xml',
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.7'
      },
      timeout: 9000
    });
    if (!page.ok) return res.status(404).json({ error: `Fornecedor respondeu HTTP ${page.status}.` });
    const type = (page.headers.get('content-type') || '').toLowerCase();
    if (!type.includes('text/html') && !type.includes('application/xhtml')) return res.status(415).json({ error: 'O link não retornou uma página HTML.' });

    const html = await readLimitedText(page, MAX_HTML_BYTES);
    const imageUrl = resolveImageUrl(html, finalUrl);
    if (!imageUrl) return res.status(404).json({ error: 'Imagem principal não encontrada.' });

    const { response: image } = await safeFetch(imageUrl, {
      headers: {
        'user-agent': UA,
        'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'referer': finalUrl
      },
      timeout: 9000
    });
    if (!image.ok) return res.status(404).json({ error: `Imagem respondeu HTTP ${image.status}.` });
    const imageType = (image.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!imageType.startsWith('image/')) return res.status(415).json({ error: 'O recurso encontrado não é uma imagem.' });

    const data = Buffer.from(await image.arrayBuffer());
    if (!data.length || data.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: 'Imagem vazia ou grande demais.' });

    res.setHeader('Content-Type', imageType);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('X-Image-Source', 'supplier-page');
    return res.status(200).send(data);
  } catch (error) {
    const msg = error?.name === 'AbortError' ? 'Tempo esgotado ao buscar imagem.' : error.message;
    return res.status(404).json({ error: msg || 'Não foi possível obter a imagem.' });
  }
};
