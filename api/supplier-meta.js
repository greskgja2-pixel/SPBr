module.exports=async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Use GET.'});
  const raw=String(req.query?.url||'').trim();
  let pageUrl;
  try{pageUrl=new URL(raw);if(!['http:','https:'].includes(pageUrl.protocol))throw new Error()}catch{return res.status(400).json({error:'Link do fornecedor inválido.'})}
  const key=process.env.GEMINI_API_KEY;
  if(!key)return res.status(503).json({error:'A leitura do fornecedor por IA ainda não está configurada.'});
  try{
    const prompt=`Acesse SOMENTE esta página pública de produto do fornecedor usando contexto de URL:\n${pageUrl.toString()}\n\nExtraia apenas dados do produto principal desta página. Retorne JSON válido exatamente neste formato:\n{"price":12.34,"image_url":"https://...","evidence":"resumo curto"}\n\nRegras:\n- price deve ser o preço atual de compra/custo de UMA unidade em BRL; se não houver preço confiável, use null.\n- Não use frete, parcela, pedido mínimo, preço riscado ou preço de outro produto.\n- image_url deve ser a URL pública da imagem principal do produto; se não houver uma imagem confiável, use null.\n- Não invente valores.\n- Não navegue para outro produto ou domínio para preencher lacunas.`;
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({model:'gemini-3.6-flash',input:prompt,tools:[{type:'url_context'}]})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return res.status(502).json({error:j?.error?.message||`Gemini respondeu HTTP ${r.status}.`});
    let text='',cited=false;
    for(const step of j?.steps||[]){if(step?.type!=='model_output')continue;for(const part of step.content||[]){if(part?.type==='text'&&part.text)text+=part.text;for(const a of part?.annotations||[])if(a?.type==='url_citation')cited=true}}
    if(!text&&j.output_text)text=j.output_text;
    if(!text)return res.status(404).json({error:'Não foi possível ler os dados deste produto.'});
    const clean=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    let data;try{data=JSON.parse(clean)}catch{return res.status(502).json({error:'A leitura do fornecedor não retornou dados válidos.'})}
    const price=Number(data?.price);let imageUrl='';
    if(data?.image_url){try{const u=new URL(String(data.image_url));if(['http:','https:'].includes(u.protocol))imageUrl=u.toString()}catch{}}
    if(!(price>0)&&!imageUrl)return res.status(404).json({error:'Preço e imagem principal não foram encontrados com confiança.'});
    res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=21600');
    return res.status(200).json({price:price>0?price:null,imageUrl:imageUrl||null,evidence:String(data?.evidence||'').slice(0,260),source:cited?'Gemini · contexto da URL':'Gemini · leitura da URL',url:pageUrl.toString()});
  }catch(e){return res.status(502).json({error:e?.message||'Falha ao consultar o fornecedor.'})}
};
