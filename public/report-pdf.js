'use strict';
const reportPdfLibraries=new Map();
let preparingReportPdf=false;
function reportLibrary(src){
 if(!reportPdfLibraries.has(src))reportPdfLibraries.set(src,new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>{reportPdfLibraries.delete(src);reject(Error('Não foi possível preparar o PDF. Tente novamente.'));};document.head.append(script);
 }));
 return reportPdfLibraries.get(src);
}
function reportFileName(page){
 if(page==='labMoldingSheet')return 'ficha-de-moldagem-A4.pdf';
 if(['labDocument','ticketLabDocument'].includes(page))return 'laudo-laboratorial-LAB-'+String(state.labDocument.id).padStart(6,'0')+'.pdf';
 if(page==='labReports')return 'laboratorio-'+(state.labReportFilters.month||state.labReportFilters.from)+'.pdf';
 if(page==='labMoisture')return 'umidade-areia-'+state.labMoistureFilters.from+'.pdf';
 if(page==='ticketView')return 'chamado-'+state.selectedTicketId+'.pdf';
 if(page==='ticketReport')return 'relatorio-chamados-'+state.ticketReportFilters.from+'.pdf';
 if(page==='maintenanceReport')return 'manutencoes-'+state.maintenanceReportFilters.from+'.pdf';
 if(page==='customerContractReport')return 'historico-cliente-'+state.selectedContractId+'.pdf';
 if(page==='contractReport')return 'contratos-ligacoes-'+state.contractReportDate+'.pdf';
 if(page==='next')return 'programacao-cascavel-'+loadingReportDate()+'.pdf';
 if(page==='production')return 'producao-e-metas-'+state.productionFilters.month+'.pdf';
 if(page==='changes')return 'cancelamentos-remarcacoes-'+state.changeFilters.from+'.pdf';
 return 'programacao-e-volumes-'+state.from+'.pdf';
}
async function reportAvatar(author){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
 ctx.beginPath();ctx.arc(64,64,63,0,Math.PI*2);ctx.clip();ctx.fillStyle='#087c2d';ctx.fillRect(0,0,128,128);
 if(author.version){
  try{
   const image=new Image();await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Foto indisponível')),7000);image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(Error('Foto indisponível'));};image.src='/api/profile-photo/'+author.id+'?v='+encodeURIComponent(author.version);});
   ctx.drawImage(image,0,0,128,128);return canvas.toDataURL('image/png');
  }catch{}
 }
 ctx.fillStyle='#fff';ctx.font='600 48px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(author.name.split(/\s+/).filter(Boolean).map(word=>word[0]).slice(0,2).join(''),64,66);
 return canvas.toDataURL('image/png');
}
function reportFooter(pdf,author,avatar,page,total,generatedAt){
 const width=pdf.internal.pageSize.getWidth(),height=pdf.internal.pageSize.getHeight();
 pdf.setDrawColor(210,222,216);pdf.setLineWidth(.25);pdf.line(14,height-23,width-14,height-23);
 pdf.addImage(avatar,'PNG',14,height-19,10,10,'report-author-avatar');
 pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.setTextColor(30,58,48);
 let name=author.name;while(name.length>2&&pdf.getTextWidth(name)>100)name=name.slice(0,-1);if(name!==author.name)name=name.slice(0,-3)+'...';
 pdf.text(name,27,height-15);pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(111,132,123);pdf.text(author.role,27,height-11);
 const stamp=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(generatedAt);
 pdf.setFontSize(7);pdf.text('Gerado em '+stamp,width-14,height-15,{align:'right'});pdf.text(page+' / '+total,width-14,height-11,{align:'right'});
}
function reportGeometry(content){
 const origin=content.getBoundingClientRect(),box=element=>{const r=element.getBoundingClientRect();return {top:r.top-origin.top,bottom:r.bottom-origin.top};},protectedBoxes=[];
 for(const element of content.querySelectorAll('tr,.report-document-header,.report-summary,.stat,.projection-card,.analytics-chart,.legend')){
  const bounds=box(element);if(bounds.bottom>bounds.top)protectedBoxes.push(bounds);
 }
 for(const header of content.querySelectorAll('.panel-header')){
  const next=header.nextElementSibling;protectedBoxes.push({top:box(header).top,bottom:box(next||header).bottom});
 }
 const tables=[...content.querySelectorAll('table')].filter(table=>table.tHead&&table.tBodies[0]?.rows.length).map(table=>{
  const head=table.tHead,first=table.tBodies[0].rows[0];protectedBoxes.push({top:box(head).top,bottom:box(first).bottom});
  return {table,top:box(first).top,bottom:box(table).bottom,left:table.getBoundingClientRect().left-origin.left,width:table.getBoundingClientRect().width,height:head.getBoundingClientRect().height,columns:[...head.rows[0].cells].map(cell=>cell.getBoundingClientRect().width)};
 });
 return {height:Math.ceil(origin.height),protectedBoxes,tables};
}
function reportPageEnd(start,limit,total,boxes){
 let end=Math.min(start+limit,total);
 if(end>=total)return total;
 for(let attempt=0;attempt<30;attempt++){
  const crossing=boxes.filter(box=>box.top>start+25&&box.top<end-.5&&box.bottom>end+.5&&box.bottom-box.top<=limit);
  if(!crossing.length)break;
  const next=Math.min(...crossing.map(box=>box.top));if(next>=end-.5)break;end=next;
 }
 return end>start+25?end:Math.min(start+limit,total);
}
function repeatedReportHeader(info){
 const wrapper=document.createElement('div');wrapper.className='pdf-repeat-heading';wrapper.style.left=info.left+'px';wrapper.style.width=info.width+'px';
 const table=document.createElement('table'),columns=document.createElement('colgroup');
 for(const width of info.columns){const column=document.createElement('col');column.style.width=width+'px';columns.append(column);}
 table.append(columns,info.table.tHead.cloneNode(true));wrapper.append(table);return wrapper;
}
async function printReport(){
 if(!state.user||!['reports','next','changes','production','contractReport','customerContractReport','maintenanceReport','ticketView','ticketReport','labDocument','ticketLabDocument','labReports','labMoisture','labMoldingSheet'].includes(state.page))return;
 const button=$('#print');if(!button||button.disabled||preparingReportPdf)return;
 const original=button.innerHTML,filename=reportFileName(state.page),generatedAt=new Date(),author={id:state.user.id,name:state.user.name,role:roleNames[state.user.role],version:state.meta.profiles?.find(profile=>profile.id===state.user.id)?.version};
 const content=$('#page-content').cloneNode(true);content.removeAttribute('id');content.className='pdf-export-content';
 content.querySelectorAll('.page-heading,.report-tabs,.filters,.no-print,button').forEach(element=>element.remove());
 const surface=document.createElement('div');surface.className='pdf-export-surface';surface.setAttribute('aria-hidden','true');surface.append(content);
 preparingReportPdf=true;button.disabled=true;button.textContent='Preparando PDF…';
 try{
  await Promise.all([reportLibrary('/vendor/html-to-image.js'),reportLibrary('/vendor/jspdf.umd.min.js')]);
  document.body.append(surface);await document.fonts.ready;
  await Promise.all([...content.querySelectorAll('img')].map(image=>image.decode().catch(()=>{})));
  const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:false});
  pdf.setProperties({title:content.querySelector('.report-document-title h2')?.textContent||'Relatório ConcretLog',author:author.name,subject:author.role+' · Concresuper Cascavel'});
  const geometry=reportGeometry(content),width=900,mmPerPixel=(pdf.internal.pageSize.getWidth()-28)/width,capacity=(pdf.internal.pageSize.getHeight()-40)/mmPerPixel,pages=[];
  for(let start=0;start<geometry.height;){
   const table=start>0?geometry.tables.find(table=>start>=table.top-.5&&start<table.bottom-.5):null,heading=table?.height||0,end=reportPageEnd(start,capacity-heading,geometry.height,geometry.protectedBoxes);
   pages.push({start,end,table,heading});start=end;
  }
  const avatar=await reportAvatar(author);
  for(let index=0;index<pages.length;index++){
   const page=pages[index];if(index)pdf.addPage();
   const height=Math.ceil(page.end-page.start+page.heading);surface.style.height=height+'px';content.style.transform='translateY('+(-page.start+page.heading)+'px)';
   const repeated=page.table?repeatedReportHeader(page.table):null;if(repeated)surface.append(repeated);
   const captureOptions={width,height,pixelRatio:1.75,backgroundColor:'#fff',skipFonts:true,cacheBust:false,style:{position:'relative',inset:'auto',insetInline:'auto',insetBlock:'auto',left:'0',top:'0',zIndex:'0'}};
   const canvas=await window.htmlToImage.toCanvas(surface,captureOptions);
   pdf.addImage(canvas.toDataURL('image/jpeg',.96),'JPEG',14,12,width*mmPerPixel,height*mmPerPixel,undefined,'FAST');
   repeated?.remove();reportFooter(pdf,author,avatar,index+1,pages.length,generatedAt);
  }
  const url=URL.createObjectURL(pdf.output('blob'));
  dialog('Relatório pronto para impressão','Gerado por '+author.name+' · '+author.role,`<iframe class="report-pdf-preview" id="report-pdf-frame" title="Prévia do relatório em PDF" src="${esc(url)}"></iframe><div class="modal-footer report-pdf-actions"><a href="${esc(url)}" download="${esc(filename)}">${icon('export')} Baixar PDF</a><button type="button" class="primary" id="print-ready-pdf">Imprimir</button></div>`);
  $('#print-ready-pdf').onclick=()=>{try{const frame=$('#report-pdf-frame');frame.contentWindow.focus();frame.contentWindow.print();}catch{window.open(url,'_blank','noopener');}};
  modal.addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});
 }catch(error){console.warn('Não foi possível gerar o relatório:',error);toast('Não foi possível gerar o PDF. Tente novamente.',true);}
 finally{surface.remove();button.innerHTML=original;button.disabled=false;preparingReportPdf=false;}
}
