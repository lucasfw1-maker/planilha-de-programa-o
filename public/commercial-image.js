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
// Locate the legacy order screen's bordered inputs and Seq. column before OCR.
// Coordinates come from its grid; order/customer values are never inferred from other text.
function locateScreen(image){
 const {width:w,height:h,data}=image,ink=(x,y)=>{const i=(y*w+x)*4;return data[i]<215&&data[i+1]<215&&data[i+2]<215;};
 const boxes=[];
 for(let y=0;y<Math.min(h*.4,180);y++)for(let x=0;x<w*.6;x++){
  if(!ink(x,y))continue;const left=x;while(x<w&&ink(x,y))x++;const right=x-1,ww=right-left+1;
  if(ww<w*.035||ww>w*.33)continue;
  for(let bottom=y+10;bottom<Math.min(h,y+55);bottom++){
   let edge=0;for(let xx=left;xx<=right;xx++)if(ink(xx,bottom))edge++;
   if(edge/ww<.86)continue;
   let sides=0;for(let yy=y;yy<=bottom;yy++)if(ink(left,yy)&&ink(right,yy))sides++;
   if(sides/(bottom-y+1)>.82&&ww>(bottom-y)*1.5){boxes.push({x0:left,y0:y,x1:right,y1:bottom});break;}
  }
 }
 const unique=boxes.filter((b,i)=>!boxes.slice(0,i).some(a=>Math.abs(a.x0-b.x0)<3&&Math.abs(a.y0-b.y0)<3));
 const pairs=[];for(const a of unique)for(const b of unique)if(a.x0<w*.23&&b.x0>a.x1+5&&b.x0<w*.5&&Math.abs(a.y0-b.y0)<4&&Math.abs(a.y1-b.y1)<5)pairs.push([a,b]);
 pairs.sort((a,b)=>a[0].y0-b[0].y0||a[0].x0-b[0].x0||a[1].x0-b[1].x0);
 if(!pairs.length)return null;
 const [order,customer]=pairs[0];
 const lines=[];
 for(let x=0;x<w*.22;x++){
  let start=-1;
  for(let y=Math.floor(h*.25);y<=h;y++){
   if(y<h&&ink(x,y)){if(start<0)start=y;}else if(start>=0){if(y-start>h*.18&&start>h*.25&&y>h*.8)lines.push({x,y0:start,y1:y});start=-1;}
  }
 }
 const columns=lines.filter((a,i)=>!lines.slice(0,i).some(b=>Math.abs(a.x-b.x)<3&&Math.abs(a.y0-b.y0)<4));
 const groups=columns.map(a=>columns.filter(b=>Math.abs(a.y0-b.y0)<4));groups.sort((a,b)=>b.length-a.length);
 const grid=groups[0]?.sort((a,b)=>a.x-b.x);
 if(!grid||grid.length<3)return null;
 const [marker,left,right]=grid;const top=Math.max(left.y0,right.y0);let headerBottom=0;
 for(let y=top+8;y<Math.min(h,top+55);y++){let count=0;for(let x=left.x+1;x<right.x;x++)if(ink(x,y))count++;if(count/(right.x-left.x-1)>.86){headerBottom=y;break;}}
 if(!headerBottom)return null;
 return {order,customer,header:{x0:0,y0:Math.max(0,order.y0-2),x1:customer.x1,y1:order.y1+2},seq:{x0:left.x+2,y0:headerBottom+2,x1:right.x-2,y1:Math.min(left.y1,right.y1)-1},marker:marker.x};
}
function crop(source,box,mode='plain',scale=4){
 const c=document.createElement('canvas');c.width=Math.max(1,Math.round((box.x1-box.x0)*scale));c.height=Math.max(1,Math.round((box.y1-box.y0)*scale));const ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=mode!=='pixel';ctx.drawImage(source,box.x0,box.y0,box.x1-box.x0,box.y1-box.y0,0,0,c.width,c.height);
 if(mode==='contrast'){const p=ctx.getImageData(0,0,c.width,c.height);for(let i=0;i<p.data.length;i+=4){const v=(p.data[i]+p.data[i+1]+p.data[i+2])/3<155?0:255;p.data[i]=p.data[i+1]=p.data[i+2]=v;}ctx.putImageData(p,0,0);}return c;
}
let digitTemplates;
function inkBounds(image){const {width,height,data}=image;let x0=width,y0=height,x1=0,y1=0;for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=(y*width+x)*4;if((data[p]+data[p+1]+data[p+2])/3<185){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}}return x1>x0?{x0,y0,x1,y1}:null;}
function glyphShape(source,box){
 const out=document.createElement('canvas');out.width=24;out.height=32;const c=out.getContext('2d',{willReadFrequently:true});c.fillStyle='white';c.fillRect(0,0,24,32);const scale=Math.min(20/(box.x1-box.x0),28/(box.y1-box.y0)),w=(box.x1-box.x0)*scale,h=(box.y1-box.y0)*scale;c.drawImage(source,box.x0,box.y0,box.x1-box.x0,box.y1-box.y0,(24-w)/2,(32-h)/2,w,h);const p=c.getImageData(0,0,24,32).data;return Float32Array.from({length:24*32},(_,i)=>(765-p[i*4]-p[i*4+1]-p[i*4+2])/765);
}
function templates(){
 if(digitTemplates)return digitTemplates;
 digitTemplates=[];for(const font of ['Arial','Tahoma','Verdana','"Courier New"','Consolas','monospace'])for(let size=9;size<=16;size++)for(let digit=0;digit<10;digit++){
  const canvas=document.createElement('canvas');canvas.width=40;canvas.height=40;const c=canvas.getContext('2d',{willReadFrequently:true});c.fillStyle='white';c.fillRect(0,0,40,40);c.font=size+'px '+font;c.fillStyle='black';c.fillText(String(digit),8,28);const bounds=inkBounds(c.getImageData(0,0,40,40));if(bounds)digitTemplates.push({digit:String(digit),shape:glyphShape(canvas,bounds)});
 }return digitTemplates;
}
// Very small legacy bitmap fonts can confuse even a high-confidence OCR result
// (notably 8/9 and 0/6). Cross-check OCR against the digit shapes before filling codes.
function readNumericGlyphs(source,box){
 const raw=crop(source,box,'plain',1),c=raw.getContext('2d',{willReadFrequently:true}),pixels=c.getImageData(0,0,raw.width,raw.height),runs=[];
 const inkColumn=x=>{for(let y=0;y<raw.height;y++){const p=(y*raw.width+x)*4;if((pixels.data[p]+pixels.data[p+1]+pixels.data[p+2])/3<185)return true;}return false;};
 for(let x=0;x<raw.width;x++){if(!inkColumn(x))continue;const first=x;while(x<raw.width&&inkColumn(x))x++;const part=c.getImageData(first,0,x-first,raw.height),b=inkBounds(part);if(b)runs.push({x0:b.x0+first,y0:b.y0,x1:b.x1+first,y1:b.y1});}
 if(!runs.length)return '';
 const height=Math.max(...runs.map(b=>b.y1-b.y0));let value='';const margins=[],errors=[];
 for(const b of runs){if(b.y1-b.y0<height*.5)continue;const shape=glyphShape(raw,b),scores=new Map();for(const t of templates()){let error=0;for(let j=0;j<shape.length;j++)error+=Math.abs(shape[j]-t.shape[j]);error/=shape.length;scores.set(t.digit,Math.min(scores.get(t.digit)??Infinity,error));}const rank=[...scores].sort((a,b)=>a[1]-b[1]);if(rank[0][1]>.075||rank[1][1]-rank[0][1]<.005)return null;value+=rank[0][0];margins.push(rank[1][1]-rank[0][1]);errors.push(rank[0][1]);}
 return {value,margins,errors};
}
async function targetedRead(worker,canvas,pixels,layout){
 await worker.setParameters({tessedit_pageseg_mode:'11',tessedit_char_whitelist:''});
 const header=await worker.recognize(crop(canvas,layout.header),{}, {text:true});
 const labels=normalized(header.data.text);if(!labels.includes('pedido')||!labels.includes('cliente'))return null;
 await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'0123456789.,'});
 async function number(box){
  const height=box.y1-box.y0,inside={x0:box.x0+2,y0:box.y0+2,x1:box.x1-Math.round(height*.8),y1:box.y1-2};
  const values=[];
  for(const mode of ['plain','contrast']){const {data}=await worker.recognize(crop(canvas,inside,mode),{}, {text:true,blocks:true});const value=digits(data.text.trim());values.push(value&&data.confidence>=65?value:'');}
  const glyphs=readNumericGlyphs(canvas,inside),agreed=values[0]&&values[0]===values[1]?values[0]:'';
  if(!glyphs?.value)return '';
  if(agreed&&agreed.length===glyphs.value.length){for(let i=0;i<agreed.length;i++)if(agreed[i]!==glyphs.value[i]&&(glyphs.margins[i]<.018||glyphs.errors[i]>.06))return '';return glyphs.value;}
  return values.includes(glyphs.value)&&glyphs.margins.every(m=>m>.008)?glyphs.value:'';
 }
 const order_code=await number(layout.order),customer_code=await number(layout.customer);
 await worker.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:'0123456789'});
 const {data}=await worker.recognize(crop(canvas,layout.seq,'pixel'),{}, {text:true,blocks:true});
 const items=wordsOf(data).filter(w=>/^\d{1,4}$/.test(w.text)&&w.confidence>=60).map(w=>{const bbox={x0:w.bbox.x0/4+layout.seq.x0,y0:w.bbox.y0/4+layout.seq.y0,x1:w.bbox.x1/4+layout.seq.x0,y1:w.bbox.y1/4+layout.seq.y0};const seq={bbox:{x0:layout.seq.x0+2}};return {code:w.text,bbox,selected:hasArrow(pixels,{bbox},seq)};});
 const selected=items.filter(i=>i.selected),allLines=(data.text||'').trim().split(/\n/).filter(Boolean);
 const order_item=selected.length===1?selected[0].code:items.length===1&&allLines.length===1?items[0].code:'';
 return {order_code,customer_code,order_item,items,needsChoice:items.length>0&&!order_item};
}
let readerPromise,readerQueue=Promise.resolve(),readerTimer,readerActive=false,progressListener=()=>{};
function prepareReader(){
 clearTimeout(readerTimer);
 if(!readerPromise)readerPromise=loadLibrary().then(()=>root.Tesseract.createWorker('eng',1,{workerPath:location.origin+'/vendor/ocr/worker.min.js',workerBlobURL:false,corePath:location.origin+'/vendor/ocr',langPath:location.origin+'/vendor/ocr',logger:m=>progressListener(m)})).catch(e=>{readerPromise=null;throw e;});
 return readerPromise;
}
function releaseReader(){if(readerActive)return;clearTimeout(readerTimer);readerTimer=setTimeout(()=>{const p=readerPromise;readerPromise=null;p?.then(w=>w.terminate()).catch(()=>{});},60000);}
async function withReader(task,progress){
 const previous=readerQueue;let done;readerQueue=new Promise(r=>done=r);await previous;
 try{readerActive=true;progressListener=progress;const worker=await prepareReader();return await task(worker);}catch(error){const failed=readerPromise;readerPromise=null;failed?.then(w=>w.terminate()).catch(()=>{});throw error;}finally{readerActive=false;progressListener=()=>{};releaseReader();done();}
}

function mount(form){
 const picker=form.querySelector('[data-commercial-image-file]'),button=form.querySelector('[data-commercial-image]'),status=form.querySelector('[data-commercial-image-status]'),choices=form.querySelector('[data-commercial-image-choices]');
 if(!picker||!button)return;
 let busy=false,closed=false,pasteDialog=null;const dialog=form.closest('dialog');
 const cleanup=()=>{if(dialog.open&&form.isConnected)return;closed=true;dialog.removeEventListener('close',cleanup);if(pasteDialog){pasteDialog.close();pasteDialog.remove();pasteDialog=null;}};dialog?.addEventListener('close',cleanup);
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
   const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0);
   let pixels=ctx.getImageData(0,0,canvas.width,canvas.height),layout=locateScreen(pixels);

   const result=await withReader(async worker=>{
    if(closed)return null;
    if(layout){const targeted=await targetedRead(worker,canvas,pixels,layout);if(targeted)return targeted;}
    // Other layouts still use labels and geometry, never unlabelled numbers.
    await worker.setParameters({tessedit_pageseg_mode:'11',tessedit_char_whitelist:''});
    const resized=crop(canvas,{x0:0,y0:0,x1:canvas.width,y1:canvas.height},'plain',Math.min(3,2000/canvas.width));
    const {data}=await worker.recognize(resized,{}, {blocks:true,text:true});
    return parse(data,resized.getContext('2d').getImageData(0,0,resized.width,resized.height));
   },m=>{if(!closed)status.textContent=m.status==='recognizing text'?'Lendo os códigos do print…':'Preparando o leitor de imagens…';});
   if(!result||closed||!form.isConnected)return;
   // An unread code must not silently retain a value from another print.
   for(const name of ['customer_code','order_code','order_item']){const input=form.elements.namedItem(name);input.value=result[name]||'';input.required=true;input.dispatchEvent(new Event('input',{bubbles:true}));}
   if(result.needsChoice){
    const label=document.createElement('label');label.textContent='Não identifiquei a seleção com segurança. Qual item deseja usar?';const select=document.createElement('select');select.setAttribute('aria-label','Escolher item do print');const first=new Option('Selecione o item','');select.add(first);for(const code of new Set(result.items.map(i=>i.code)))select.add(new Option('Item '+code,code));select.onchange=()=>{const input=form.elements.namedItem('order_item');input.value=select.value;input.dispatchEvent(new Event('input',{bubbles:true}));status.textContent=select.value?'Item '+select.value+' selecionado. Confira os dados antes de salvar.':'Escolha o item do print ou preencha o campo manualmente.';};label.append(select);choices.append(label);
   }
   form.elements.namedItem('order_item').dispatchEvent(new Event('input',{bubbles:true}));
   const missing=[!result.customer_code&&'cliente',!result.order_code&&'pedido',!result.order_item&&'item'].filter(Boolean);
   status.textContent=missing.length?'Leitura concluída. Confira os campos e informe '+missing.join(', ')+'.':'Cliente, pedido e item preenchidos. Confira antes de salvar.';
  }catch(error){if(!closed)status.textContent=error.message?.startsWith('O print')?error.message:'Não consegui ler este print. Tente uma imagem mais nítida ou preencha os campos manualmente.';}
  finally{bitmap?.close();busy=false;if(!closed){button.disabled=false;picker.value='';submitButtons.forEach(b=>b.button.disabled=b.disabled);}}
 }
 function openPasteDialog(file){
  if(closed||busy)return;
  if(pasteDialog?.open){if(file)pasteDialog.stageImage(file);return;}
  const popup=document.createElement('dialog');pasteDialog=popup;popup.className='commercial-paste-dialog';popup.setAttribute('aria-labelledby','commercial-paste-title');
  popup.innerHTML='<div class="modal-header"><h2 id="commercial-paste-title">Colar print</h2><button type="button" data-paste-close aria-label="Fechar prévia do print">×</button></div><div class="modal-body"><div class="commercial-paste-zone" tabindex="0" role="region" aria-label="Área para colar imagem"><p data-paste-instruction>Pressione Ctrl+V para colar a imagem aqui.</p><img data-paste-preview alt="Prévia do print colado" hidden></div><p data-paste-status role="status" aria-live="polite"></p><div class="commercial-paste-actions"><button type="button" data-paste-file>Escolher arquivo</button><button type="button" data-paste-use class="primary" disabled>Usar imagem</button></div></div>';
  document.body.append(popup);
  let pending=null,generation=0;
  const zone=popup.querySelector('.commercial-paste-zone'),preview=popup.querySelector('[data-paste-preview]'),hint=popup.querySelector('[data-paste-instruction]'),message=popup.querySelector('[data-paste-status]'),use=popup.querySelector('[data-paste-use]');
  popup.stageImage=async image=>{
   const current=++generation;pending=null;use.disabled=true;
   if(!['image/png','image/jpeg','image/webp'].includes(image.type)){message.textContent='Use uma imagem em PNG, JPG ou WebP.';return;}
   if(image.size>12*1024*1024){message.textContent='A imagem deve ter até 12 MB.';return;}
   message.textContent='Carregando a prévia…';
   try{
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Falha ao abrir imagem'));reader.readAsDataURL(image);});
    if(!popup.open||current!==generation)return;
    preview.src=data;await preview.decode();if(!popup.open||current!==generation)return;
    preview.hidden=false;hint.hidden=true;pending=image;use.disabled=false;message.textContent='Confira o print. Para trocar, cole outra imagem.';prepareReader().then(releaseReader).catch(()=>{});
   }catch{if(popup.open&&current===generation)message.textContent='Não consegui abrir a imagem. Cole outro print ou escolha um arquivo.';}
  };
  popup.querySelector('[data-paste-close]').onclick=()=>popup.close();
  popup.querySelector('[data-paste-file]').onclick=()=>picker.click();
  use.onclick=()=>{if(!pending)return;const image=pending;popup.close();read(image);};
  popup.addEventListener('paste',event=>{const image=[...(event.clipboardData?.items||[])].find(i=>i.kind==='file'&&i.type.startsWith('image/'))?.getAsFile();if(image){event.preventDefault();event.stopPropagation();popup.stageImage(image);}else message.textContent='Copie um print e pressione Ctrl+V, ou escolha um arquivo.';});
  popup.addEventListener('close',()=>{++generation;pending=null;popup.remove();if(pasteDialog===popup)pasteDialog=null;picker.value='';if(form.isConnected&&dialog.open)button.focus();},{once:true});
  popup.showModal();zone.focus();if(file)popup.stageImage(file);
 }
 button.onclick=()=>openPasteDialog();picker.onchange=()=>{if(picker.files[0])openPasteDialog(picker.files[0]);};
 form.addEventListener('paste',event=>{const file=[...(event.clipboardData?.items||[])].find(i=>i.kind==='file'&&i.type.startsWith('image/'))?.getAsFile();if(file){event.preventDefault();openPasteDialog(file);}});
}
const api={parse,hasArrow,locateScreen,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.CommercialImage=api;
})(typeof globalThis==='object'?globalThis:this);
