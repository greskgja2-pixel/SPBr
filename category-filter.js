(()=>{
  'use strict';

  const SESSION_KEY='radar-session';
  const MASTER_KEY='garimpeiro-master-results';
  const CATEGORY_KEY='garimpeiro-category-filter';
  const $=id=>document.getElementById(id);
  const N=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  let busy=false;

  function read(key,fallback=null){
    try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}
  }
  function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
  function resultKey(r){return `${r?.product?.id||''}::${N(r?.product?.name||'')}`}
  function session(){return read(SESSION_KEY,null)}
  function master(){return read(MASTER_KEY,[])||[]}

  function mergeIntoMaster(results){
    if(!Array.isArray(results)||!results.length)return;
    const current=master();
    if(!current.length){write(MASTER_KEY,results);return}
    const map=new Map(current.map(r=>[resultKey(r),r]));
    results.forEach(r=>map.set(resultKey(r),r));
    write(MASTER_KEY,[...map.values()]);
  }

  function captureFullIfNeeded(){
    const s=session();
    if(!s||!Array.isArray(s.results)||!s.results.length)return;
    const selected=$('categoryFilter')?.value||localStorage.getItem(CATEGORY_KEY)||'all';
    const hasOther=selected==='all'||s.results.some(r=>N(r?.product?.category)!==N(selected));
    if(hasOther)write(MASTER_KEY,s.results);
    else mergeIntoMaster(s.results);
  }

  function categories(){
    const src=master().length?master():(session()?.results||[]);
    return [...new Set(src.map(r=>String(r?.product?.category||'').trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));
  }

  function populate(){
    const sel=$('categoryFilter');
    if(!sel)return;
    const wanted=sel.value||localStorage.getItem(CATEGORY_KEY)||'all';
    const cats=categories();
    const signature=cats.join('|');
    if(sel.dataset.signature===signature)return;
    sel.dataset.signature=signature;
    sel.innerHTML='<option value="all">Todas as categorias</option>'+cats.map(c=>`<option value="${c.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}">${c.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`).join('');
    sel.value=cats.includes(wanted)?wanted:'all';
  }

  function restoreApp(){
    const b=$('btnRestore');
    if(b)b.click();
  }

  function applyCategory(value,{remember=true}={}){
    if(busy)return;
    busy=true;
    try{
      const s=session();
      if(!s||!Array.isArray(s.results)){return}
      let full=master();
      if(!full.length){
        full=s.results;
        write(MASTER_KEY,full);
      }
      if(remember){
        if(value&&value!=='all')localStorage.setItem(CATEGORY_KEY,value);
        else localStorage.removeItem(CATEGORY_KEY);
      }
      s.results=(value&&value!=='all')?full.filter(r=>N(r?.product?.category)===N(value)):full;
      write(SESSION_KEY,s);
      restoreApp();
      setTimeout(()=>{
        const cap=$('resultsCaption');
        if(cap&&value&&value!=='all')cap.textContent+=` · Categoria: ${value}`;
      },30);
    }finally{
      setTimeout(()=>{busy=false},60);
    }
  }

  function init(){
    const sel=$('categoryFilter');
    const body=$('resultsBody');
    if(!sel||!body)return;

    captureFullIfNeeded();
    populate();
    const saved=localStorage.getItem(CATEGORY_KEY)||'all';
    if(saved!=='all'){
      sel.value=[...sel.options].some(o=>o.value===saved)?saved:'all';
      if(sel.value!=='all')applyCategory(sel.value,{remember:false});
    }

    sel.addEventListener('change',()=>applyCategory(sel.value));

    const observer=new MutationObserver(()=>{
      if(busy)return;
      const s=session();
      if(s?.results?.length){
        const selected=sel.value||'all';
        const containsOther=selected==='all'||s.results.some(r=>N(r?.product?.category)!==N(selected));
        if(containsOther){
          write(MASTER_KEY,s.results);
          populate();
          if(selected!=='all')setTimeout(()=>applyCategory(selected,{remember:false}),0);
        }else{
          mergeIntoMaster(s.results);
          populate();
        }
      }
    });
    observer.observe(body,{childList:true,subtree:false});

    $('btnClear')?.addEventListener('click',()=>setTimeout(()=>{
      if(!localStorage.getItem(SESSION_KEY)){
        localStorage.removeItem(MASTER_KEY);
        localStorage.removeItem(CATEGORY_KEY);
        sel.dataset.signature='';
        populate();
        sel.value='all';
      }
    },100));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
