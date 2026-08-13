module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const image = String(body.image || '').trim();
    const mimeType = String(body.mimeType || 'image/jpeg');
    const product = body.product || {};
    const searchQuery = String(body.searchQuery || product.name || '').trim();
    const apiKey = process.env.GEMINI_API_KEY || String(req.headers['x-gemini-key'] || '').trim();

    if (!apiKey) return res.status(503).json({ error: 'A análise por IA ainda não está configurada. Abra Configurações e informe uma chave Gemini, ou configure GEMINI_API_KEY na Vercel.' });
    if (!image) return res.status(400).json({ error: 'Envie um print da busca da Shopee.' });
    if (image.length > 8_000_000) return res.status(413).json({ error: 'A imagem ficou grande demais para análise. Envie um print menor.' });
    if (!/^image\/(jpeg|png|webp)$/i.test(mimeType)) return res.status(400).json({ error: 'Formato de imagem não suportado.' });

    const prompt = `Você é um analista de oportunidades de revenda no marketplace Shopee Brasil.

PRODUTO DO FORNECEDOR:
- Nome: ${String(product.name || '')}
- Categoria: ${String(product.category || '')}
- SKU/modelo: ${String(product.sku || '')}
- Custo unitário: R$ ${Number(product.cost || 0).toFixed(2)}
- Termo pesquisado na Shopee: ${searchQuery}

TAREFA:
Analise SOMENTE o print enviado, que representa a primeira página/parte visível de uma busca da Shopee.
1. Identifique quais cards/anúncios visíveis realmente parecem ser o mesmo produto ou uma variação comercialmente comparável ao produto do fornecedor.
2. Ignore anúncios claramente diferentes, acessórios incompatíveis, outro modelo, outra capacidade, outra voltagem, refil, peça avulsa ou produto que só compartilha palavras genéricas.
3. Separe vendas de UMA UNIDADE e KITS. Não misture preço de kit com preço unitário.
4. Para kit, informe a quantidade de unidades quando estiver visível/inferível com alta segurança e calcule o preço por unidade somente quando a quantidade estiver clara.
5. Use o PREÇO ATUAL exibido no anúncio. Não use preço antigo riscado.
6. Extraia o volume de vendidos somente quando estiver visível. Converta "1,2 mil" para aproximadamente 1200. Se não estiver visível, use 0.
7. Se o print tiver cupons, parcelas ou frete, não trate esses valores como preço do produto.
8. Não invente dados que não aparecem na imagem. Em caso de dúvida, registre um aviso.

Retorne todos os anúncios relevantes que conseguir ler no print. O sistema calculará mínimo, média e máximo depois.`;

    const schema = {
      type: 'object',
      properties: {
        relevant: { type: 'boolean', description: 'Se o print contém resultados úteis e comparáveis ao produto do fornecedor.' },
        confidence: { type: 'number', minimum: 0, maximum: 100, description: 'Confiança geral da análise e correspondência visual.' },
        summary: { type: 'string', description: 'Resumo curto em português do que foi encontrado.' },
        unit_ads: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              price: { type: 'number' },
              sold: { type: 'integer' },
              rating: { type: 'number' }
            },
            required: ['title','price','sold','rating']
          }
        },
        kit_ads: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              price: { type: 'number' },
              quantity: { type: 'integer' },
              unit_price: { type: 'number' },
              sold: { type: 'integer' },
              rating: { type: 'number' }
            },
            required: ['title','price','quantity','unit_price','sold','rating']
          }
        },
        ignored_count: { type: 'integer' },
        warnings: { type: 'array', items: { type: 'string' } }
      },
      required: ['relevant','confidence','summary','unit_ads','kit_ads','ignored_count','warnings']
    };

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        model: 'gemini-3.6-flash',
        input: [
          { type: 'text', text: prompt },
          { type: 'image', data: image, mime_type: mimeType }
        ],
        response_format: { type: 'text', mime_type: 'application/json', schema }
      })
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = json?.error?.message || json?.message || `Gemini respondeu HTTP ${response.status}.`;
      return res.status(502).json({ error: `Falha na análise do Gemini: ${detail}` });
    }

    let text = json.output_text || '';
    if (!text && Array.isArray(json.steps)) {
      for (const step of json.steps) {
        if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue;
        for (const part of step.content) if (part?.type === 'text' && part.text) text += part.text;
      }
    }
    if (!text && Array.isArray(json.outputs)) {
      for (const out of json.outputs) if (out?.text) text += out.text;
    }
    if (!text) return res.status(502).json({ error: 'O Gemini respondeu, mas não retornou dados estruturados.' });

    let analysis;
    try { analysis = JSON.parse(text); }
    catch { return res.status(502).json({ error: 'A resposta da IA não veio em JSON válido.' }); }

    analysis.unit_ads = Array.isArray(analysis.unit_ads) ? analysis.unit_ads : [];
    analysis.kit_ads = Array.isArray(analysis.kit_ads) ? analysis.kit_ads : [];
    analysis.warnings = Array.isArray(analysis.warnings) ? analysis.warnings : [];
    return res.status(200).json({ analysis, model: 'gemini-3.6-flash' });
  } catch (error) {
    return res.status(500).json({ error: `Erro ao analisar o print: ${error.message}` });
  }
};