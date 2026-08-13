(()=>{
'use strict';
const $=id=>document.getElementById(id);
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const money=n=>(Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pct=n=>`${(Number(n)||0).toFixed(1).replace('.',',')}%`;
const num=v=>Number(String(v??0).replace(/R\$/gi,'').replace(/\s/g,'').replace(',','.').replace(/[^0-9.-]/g,''))||0;
const dkey=p=>`${p?.id||''}::${norm(p?.name).slice(0,120)}`;
function calc(cost,sale){const c=read('radar-cfg',{}),fee=sale*num(c.feePct??20)/100+num(c.feeFixed??4)+num(c.packCost??0)+num(c.otherCost??0),profit=sale-cost-fee;return{profit,margin:sale?profit/sale*100:0}}
function generate(){
 const master=read('garimpeiro-master-results',[]),session=read('radar-session',{results:[]}),src=master.length?master:(session.results||[]),dec=read('radar-dec',{}),notes=read('radar-notes',{}),rows=src.filter(r=>dec[dkey(r.product)]==='yes'&&r.market);
 if(!rows.length)return alert('Marque pelo menos um produto como “Vale a pena”.');
 if(!window.jspdf?.jsPDF)return alert('Gerador de PDF ainda não carregou.');
 const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape'}),date=new Date().toLocaleString('pt-BR');
 doc.setFontSize(16);doc.text('Lista de Compra - Garimpeiro da Shopee',12,12);doc.setFontSize(9);doc.text(`Data da exportacao: ${date}`,12,18);
 doc.autoTable({startY:23,head:[['Produto','Fornecedor','Custo','Venda min/media/max','Margem min/media/max','Lucro medio','Vendas','Observacao']],body:rows.map(r=>{const a=calc(r.product.cost,r.market.min),b=calc(r.product.cost,r.market.mean),c=calc(r.product.cost,r.market.max);return[r.product.name,r.product.supplier||'-',money(r.product.cost),`${money(r.market.min)} / ${money(r.market.mean)} / ${money(r.market.max)}`,`${pct(a.margin)} / ${pct(b.margin)} / ${pct(c.margin)}`,money(b.profit),(r.market.totalSold||0).toLocaleString('pt-BR'),notes[dkey(r.product)]||'']}),styles:{fontSize:7,cellPadding:2},columnStyles:{0:{cellWidth:50},1:{cellWidth:28},2:{cellWidth:18},3:{cellWidth:44},4:{cellWidth:42},5:{cellWidth:22},6:{cellWidth:18},7:{cellWidth:50}},margin:{left:8,right:8}});
 doc.save(`garimpeiro-lista-compra-${new Date().toISOString().slice(0,10)}.pdf`);
}
function init(){const b=$('btnGeneratePdf');if(b)b.onclick=generate}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();