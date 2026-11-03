import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {parse,locateScreen}=createRequire(import.meta.url)('../public/commercial-image.js');
const word=(text,x,y,width=25,confidence=95)=>({text,confidence,bbox:{x0:x,y0:y,x1:x+width,y1:y+20}});
const head=[word('Pedido:',20,20,65),word('10.936',115,20,65),word('Cliente:',300,20,65),word('00519',415,20,65),word('Seq.',50,200,45),word('Transação',110,200,100)];
const row=(n,y)=>[word(String(n),80,y,12),word('90106',115,y,65),word('2',290,y,12),word('01020E25180.0',370,y,150)];
function pixels(rows,rectangle=false){const width=500,height=420,data=new Uint8ClampedArray(width*height*4).fill(255);for(const y of rows)for(let dy=-12;dy<=12;dy++)for(let dx=0;dx<(rectangle?16:15-Math.abs(dy));dx++){const p=((y+10+dy)*width+25+dx)*4;data[p]=data[p+1]=data[p+2]=0;}return {data,width,height};}
test('reads labelled customer/order, strips thousands separators and keeps leading zeroes',()=>{const r=parse({words:[...head,...row(1,250)]});assert.equal(r.order_code,'10936');assert.equal(r.customer_code,'00519');assert.equal(r.order_item,'1');});
test('selects Seq row with triangle, never transaction/status/service codes',()=>{const r=parse({words:[...head,...row(1,250),...row(2,300),...row(3,350)]},pixels([350]));assert.equal(r.order_item,'3');assert.equal(r.needsChoice,false);});
test('multiple rows without a unique triangle require an explicit choice',()=>{for(const image of [undefined,pixels([250,300]),pixels([300],true)]){const r=parse({words:[...head,...row(1,250),...row(2,300)]},image);assert.equal(r.order_item,'');assert.equal(r.needsChoice,true);}});
test('poor OCR of adjacent column header cannot turn status into an item',()=>{const words=[...head.map(w=>w.text==='Transação'?{...w,confidence:20}:w),...row(1,250)];assert.equal(parse({words}).order_item,'1');});
test('does not assume one item if another row was not recognized reliably',()=>{const words=[...head,...row(1,250),...row(2,300).map((w,i)=>i===0?{...w,confidence:20}:w)];assert.equal(parse({words}).order_item,'');});
test('does not invent missing headers or low-confidence customer codes',()=>{assert.equal(parse({words:[...row(1,250)]}).order_item,'');assert.equal(parse({words:head.map(w=>w.text==='00519'?{...w,confidence:20}:w)}).customer_code,'');});

function gridImage(){const width=500,height=400,data=new Uint8ClampedArray(width*height*4).fill(255);const dot=(x,y)=>{const p=(y*width+x)*4;data[p]=data[p+1]=data[p+2]=180;};const box=(x,y,w,h)=>{for(let a=x;a<x+w;a++){dot(a,y);dot(a,y+h-1);}for(let b=y;b<y+h;b++){dot(x,b);dot(x+w-1,b);}};box(40,10,90,20);box(220,10,90,20);for(const x of [5,18,54,110,160])for(let y=220;y<395;y++)dot(x,y);for(const y of [220,245,275,305,335,365,394])for(let x=5;x<480;x++)dot(x,y);return {width,height,data};}
test('locates the two commercial fields and isolates Seq. from transaction/service columns',()=>{const layout=locateScreen(gridImage());assert.deepEqual(layout.order,{x0:40,y0:10,x1:129,y1:29});assert.deepEqual(layout.customer,{x0:220,y0:10,x1:309,y1:29});assert.equal(layout.seq.x0,20);assert.equal(layout.seq.x1,52);assert.equal(layout.seq.y0,247);});
test('does not invent a legacy layout for an empty screenshot',()=>{const p=gridImage();p.data.fill(255);assert.equal(locateScreen(p),null);});
