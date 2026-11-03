(function(root){
'use strict';
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
const digits=value=>/^\d[\d.,]*$/.test(String(value).trim())?String(value).replace(/[.,]/g,''):'';
const cy=w=>(w.bbox.y0+w.bbox.y1)/2;
function wordsOf(data){return data.words||data.blocks?.flatMap(b=>b.paragraphs.flatMap(p=>p.lines.flatMap(l=>l.words)))||[];}
function parse(data,pixels){
 const words=wordsOf(data).filter(w=>w.bbox&&Number(w.confidence)>=45);
 const label=name=>words.filter(w=>normalized(w.text)===name).sort((a,b)=>a.bbox.y0-b.bbox.y0)[0];
 const field=name=>{const l=label(name);if(!l)return '';const h=l.bbox.y1-l.bbox.y0;const candidates=words.filter(w=>w.bbox.x0>=l.bbox.x1-h*.25&&w.bbox.x0<l.bbox.x1+h*9&&Math.abs(cy(w)-cy(l))<h*.7&&digits(w.text));return candidates.sort((a,b)=>a.bbox.x0-b.bbox.x0)[0];};
 const order=field('pedido'),customer=field('cliente'),seq=label('seq');let items=[];
 if(seq){const h=seq.bbox.y1-seq.bbox.y0;const next=words.filter(w=>w.bbox.x0>seq.bbox.x1&&Math.abs(cy(w)-cy(seq))<h).sort((a,b)=>a.bbox.x0-b.bbox.x0)[0];const right=Math.min(seq.bbox.x1+h*1.8,next?next.bbox.x0-h*.15:Infinity);
  items=words.filter(w=>w.bbox.y0>seq.bbox.y1&&w.bbox.x0>=seq.bbox.x0-h*.3&&w.bbox.x1<right&&/^\d{1,4}$/.test(w.text)).map(w=>({code:w.text,bbox:w.bbox,selected:pixels?hasArrow(pixels,w,seq):false}));
 }
 const selected=items.filter(i=>i.selected),unique=new Set(items.map(i=>i.code));
 const onlyRow=items.length===1&&seq&&!wordsOf(data).some(w=>w.bbox&&w.bbox.x0>seq.bbox.x1&&w.bbox.y0>seq.bbox.y1&&Math.abs(cy(w)-cy(items[0]))>(seq.bbox.y1-seq.bbox.y0)*.95);
 const item=selected.length===1?selected[0].code:unique.size===1&&onlyRow?items[0].code:'';
 return {customer_code:customer?digits(customer.text):'',order_code:order?digits(order.text):'',order_item:item,items:items.map(i=>({code:i.code,selected:i.selected})),needsChoice:items.length>0&&!item};
}
// The row marker is a filled right-pointing triangle immediately before Seq.
// Text, grid lines and coloured highlights are not used to guess the item.
function hasArrow(image,word,seq){
 const h=word.bbox.y1-word.bbox.y0,{width,height,data}=image;
 const x0=Math.max(0,Math.floor(seq.bbox.x0-h*2)),x1=Math.min(width,Math.ceil(seq.bbox.x0-h*.12));
 const y0=Math.max(0,Math.floor(cy(word)-h*.85)),y1=Math.min(height,Math.ceil(cy(word)+h*.85));
 const seen=new Set(),dark=(x,y)=>{const p=(y*width+x)*4;return data[p]<85&&data[p+1]<85&&data[p+2]<85&&data[p+3]>100;};
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const key=y*width+x;if(seen.has(key)||!dark(x,y))continue;
  const todo=[[x,y]],points=[];seen.add(key);
  while(todo.length){const [a,b]=todo.pop();points.push([a,b]);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=a+dx,ny=b+dy,k=ny*width+nx;if(nx>=x0&&nx<x1&&ny>=y0&&ny<y1&&!seen.has(k)&&dark(nx,ny)){seen.add(k);todo.push([nx,ny]);}}}
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),w=right-left+1,hh=bottom-top+1,fill=points.length/(w*hh);
  if(w<h*.3||w>h*1.3||hh<h*.6||hh>h*1.65||fill<.32||fill>.8)continue;
  const rowWidth=row=>{const a=points.filter(p=>p[1]===row).map(p=>p[0]);return a.length?Math.max(...a)-Math.min(...a)+1:0;};
  const middle=rowWidth(Math.round((top+bottom)/2));
  if(middle>w*.75&&rowWidth(top+1)<middle*.75&&rowWidth(bottom-1)<middle*.75&&Math.abs((top+bottom)/2-cy(word))<h*.5)return true;
 }
 return false;
}
let libraryPromise;
function loadLibrary(){if(root.Tesseract)return Promise.resolve();if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/vendor/ocr/tesseract.min.js';s.onload=resolve;s.onerror=()=>{s.remove();libraryPromise=null;reject(Error('Não foi possível carregar a leitura de imagens. Tente novamente.'));};document.head.append(s);});return libraryPromise;}
function mount(form){
 const picker=form.querySelector('[data-commercial-image-file]'),button=form.querySelector('[data-commercial-image]'),status=form.querySelector('[data-commercial-image-status]'),choices=form.querySelector('[data-commercial-image-choices]');
 if(!picker||!button)return;
 let busy=false,worker=null,closed=false;const dialog=form.closest('dialog');
 const cleanup=()=>{if(dialog.open&&form.isConnected)return;closed=true;dialog.removeEventListener('close',cleanup);if(worker){worker.terminate();worker=null;}};dialog?.addEventListener('close',cleanup);
 const set=(name,value)=>{if(value){const input=form.elements.namedItem(name);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}};
 async function read(file){
  if(busy)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){status.textContent='Use um print em PNG, JPG ou WebP.';return;}
  if(file.size>12*1024*1024){status.textContent='A imagem deve ter até 12 MB.';return;}
  busy=true;button.disabled=true;const submitButtons=[...form.querySelectorAll('button[type=submit],button:not([type])')].map(b=>({button:b,disabled:b.disabled}));submitButtons.forEach(b=>b.button.disabled=true);choices.replaceChildren();status.textContent='Preparando a leitura do print…';
  let bitmap;
  try{
   bitmap=await createImageBitmap(file);if(closed)return;
   if(bitmap.width*bitmap.height>24000000)throw Error('O print é muito grande. Recorte a área do pedido e tente novamente.');
   const scale=Math.min(2,2400/bitmap.width,3000/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   await loadLibrary();if(closed)return;
   worker=await root.Tesseract.createWorker('eng',1,{workerPath:location.origin+'/vendor/ocr/worker.min.js',workerBlobURL:false,corePath:location.origin+'/vendor/ocr',langPath:location.origin+'/vendor/ocr',logger:m=>{if(!closed)status.textContent=m.status==='recognizing text'?'Lendo o print… '+Math.round(m.progress*100)+'%':'Carregando o leitor de imagens…';}});
   if(closed){await worker.terminate();worker=null;return;}
   await worker.setParameters({tessedit_pageseg_mode:'11'});
   const {data}=await worker.recognize(canvas,{}, {blocks:true,text:true});if(closed||!form.isConnected)return;
   const result=parse(data,ctx.getImageData(0,0,canvas.width,canvas.height));
   set('customer_code',result.customer_code);set('order_code',result.order_code);
   // Never keep a stale item when a new print has ambiguous or unreadable rows.
   form.elements.namedItem('order_item').value='';
   if(result.order_item)set('order_item',result.order_item);
   if(result.needsChoice){
    const label=document.createElement('label');label.textContent='Não identifiquei a seleção com segurança. Qual item deseja usar?';const select=document.createElement('select');select.setAttribute('aria-label','Escolher item do print');const first=new Option('Selecione o item','');select.add(first);for(const code of new Set(result.items.map(i=>i.code)))select.add(new Option('Item '+code,code));select.onchange=()=>{const input=form.elements.namedItem('order_item');input.value=select.value;input.dispatchEvent(new Event('input',{bubbles:true}));status.textContent=select.value?'Item '+select.value+' selecionado. Confira os dados antes de salvar.':'Escolha o item do print ou preencha o campo manualmente.';};label.append(select);choices.append(label);
   }
   form.elements.namedItem('order_item').dispatchEvent(new Event('input',{bubbles:true}));
   const missing=[!result.customer_code&&'cliente',!result.order_code&&'pedido',!result.order_item&&'item'].filter(Boolean);
   status.textContent=missing.length?'Leitura concluída. Confira os campos e informe '+missing.join(', ')+'.':'Cliente, pedido e item preenchidos. Confira antes de salvar.';
  }catch(error){if(!closed)status.textContent=error.message?.startsWith('O print')?error.message:'Não consegui ler este print. Tente uma imagem mais nítida ou preencha os campos manualmente.';}
  finally{bitmap?.close();if(worker){await worker.terminate();worker=null;}busy=false;if(!closed){button.disabled=false;picker.value='';submitButtons.forEach(b=>b.button.disabled=b.disabled);}}
 }
 button.onclick=()=>picker.click();picker.onchange=()=>{if(picker.files[0])read(picker.files[0]);};
 form.addEventListener('paste',event=>{const file=[...(event.clipboardData?.items||[])].find(i=>i.kind==='file'&&i.type.startsWith('image/'))?.getAsFile();if(file){event.preventDefault();read(file);}});
}
const api={parse,hasArrow,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.CommercialImage=api;
})(typeof globalThis==='object'?globalThis:this);
