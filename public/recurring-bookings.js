(function(root){
'use strict';
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
function dates(start,period,includeSaturday=false){
 if(typeof start!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(Date.parse(start+'T12:00:00Z'))||new Date(start+'T12:00:00Z').toISOString().slice(0,10)!==start)fail('Escolha uma data inicial válida.');
 if(!['week','month'].includes(period)||typeof includeSaturday!=='boolean')fail('Escolha semana ou mês para repetir.');
 const first=new Date(start+'T12:00:00Z'),last=new Date(first);if(period==='week')last.setUTCDate(last.getUTCDate()+6);else{last.setUTCMonth(last.getUTCMonth()+1,0);}
 const result=[];for(const d=new Date(first);d<=last;d.setUTCDate(d.getUTCDate()+1)){const day=d.getUTCDay();if(day!==0&&(day!==6||includeSaturday))result.push(d.toISOString().slice(0,10));}return result;
}
function open(a){
 const pumps=state.meta.pumps.filter(p=>p.active!==0&&!p.maintenance),template={customer:a.customer,work_name:a.work_name||a.customer,work:a.work,seller_id:a.seller_id,contact_name:a.contact_name||'',contact_phone:a.contact_phone||'',type:a.type,planned_volume:a.planned_volume,load_capacity:a.load_capacity||9,gravel:a.gravel,slump:a.slump||'',resistance:a.resistance,piece:a.piece,notes:a.notes||'',duration:a.duration,start:a.start};
 let rows=[],rotation=[String(a.pump_id||pumps[0]?.id||''),String(pumps.find(p=>p.id!==a.pump_id)?.id||'')],token=crypto.randomUUID(),revision=0;
 const options=id=>'<option value="">Selecione</option>'+pumps.map(p=>`<option value="${p.id}" ${String(p.id)===String(id)?'selected':''}>${esc(p.name)}</option>`).join('');
 const time=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`,minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
 dialog('Repetir agendamento',customerName(a.customer)+' · '+(a.work_name||a.work),`<form id="repeat-booking-form"><div class="repeat-summary"><strong>${esc(displayPiece(a.piece))} · ${num(a.planned_volume)} m³</strong><small>${esc(addressName(a.work))} · ${esc(a.seller_name||'')}</small></div><details class="repeat-config" open><summary>Período e alternância de bombas</summary><div class="repeat-settings"><label>A partir de<input type="date" data-repeat-start required value="${shift(a.date,1)<today()?today():shift(a.date,1)}"></label><label>Período<select data-repeat-period><option value="week">Uma semana (7 dias)</option><option value="month">Até o fim do mês</option></select></label><label class="repeat-check"><input type="checkbox" data-repeat-saturday> Incluir sábado (até 12h)</label></div>${a.type==='bomba'?`<div class="repeat-pump-settings"><label>Distribuição<select data-repeat-mode><option value="alternate">Alternar bombas</option><option value="fixed">Mesma bomba</option></select></label><div data-repeat-rotation></div><button type="button" class="repeat-add-pump" data-repeat-add>${icon('plus')} Adicionar bomba</button></div>`:''}</details><div class="repeat-preview-heading"><strong>Prévia dos agendamentos</strong><button type="button" data-repeat-check>Conferir disponibilidade</button></div><p class="repeat-explanation">Desmarque os dias que não deseja criar. Você pode ajustar a bomba e o horário de cada dia. O agendamento original será mantido.</p><div data-repeat-rows class="repeat-rows"></div><p data-repeat-result role="status" aria-live="polite"></p>${footer('Criar agendamentos')}</form>`,async()=>{
  const payload=collect(),controls=[...form.querySelectorAll('input,select,button')].map(el=>({el,disabled:el.disabled}));controls.forEach(({el})=>el.disabled=true);submit.textContent='Conferindo agendamentos…';
  try{
   const result=await api('/appointments/repeat/preview',{method:'POST',body:JSON.stringify(payload)});paintChecks(result);if(!result.valid)throw Error('Revise ou desmarque os dias com conflito antes de criar.');
   submit.textContent='Criando agendamentos…';
   let saved;try{saved=await api('/appointments/repeat',{method:'POST',body:JSON.stringify(payload)});}catch{saved=await api('/appointments/repeat',{method:'POST',body:JSON.stringify(payload)});}
   if(form.isConnected)modal.close();toast(saved.count+' agendamentos criados.');await refresh();
  }catch(error){if(form.isConnected)await check();throw error;}
  finally{if(form.isConnected){controls.forEach(({el,disabled})=>el.disabled=disabled);submit.textContent='Criar '+rows.filter(r=>r.selected).length+' agendamentos';}}

 });
 const form=$('#repeat-booking-form',modal),container=$('[data-repeat-rows]',form),submit=$('[type=submit]',form);
 function changed(){revision++;token=crypto.randomUUID();$('[data-repeat-result]',form).textContent='';for(const el of $$('[data-repeat-day-status]',form)){el.textContent='';el.className='';}}
 function renderRotation(){const holder=$('[data-repeat-rotation]',form);if(!holder)return;const fixed=$('[data-repeat-mode]',form).value==='fixed';holder.innerHTML=rotation.slice(0,fixed?1:rotation.length).map((id,i)=>`<div class="repeat-pump-slot"><label>Bomba ${i+1}<select data-repeat-pump-slot="${i}" required>${options(id)}</select></label>${i>1?`<button type="button" data-repeat-remove="${i}" aria-label="Remover bomba ${i+1}">${icon('close')}</button>`:''}</div>`).join('');$('[data-repeat-add]',form).hidden=fixed;$('[data-repeat-add]',form).disabled=rotation.length>=pumps.length;for(const select of $$('[data-repeat-pump-slot]',holder))select.onchange=()=>{rotation[Number(select.dataset.repeatPumpSlot)]=select.value;generate(true);};for(const b of $$('[data-repeat-remove]',holder))b.onclick=()=>{rotation.splice(Number(b.dataset.repeatRemove),1);renderRotation();generate(true);};}
 function generate(forcePumps=false){
  const before=new Map(rows.map(r=>[r.date,r])),dayList=dates($('[data-repeat-start]',form).value,$('[data-repeat-period]',form).value,$('[data-repeat-saturday]',form).checked),fixed=$('[data-repeat-mode]',form)?.value==='fixed',selected=(fixed?rotation.slice(0,1):rotation).filter(Boolean);
  rows=dayList.map((date,i)=>{const old=before.get(date),saturday=new Date(date+'T12:00:00Z').getUTCDay()===6;let start=old?.start||a.start;if(!old&&saturday&&minutes(start)+a.duration>720)start='07:00';return {date,selected:old?.selected??true,start,end:old?.end||time(minutes(start)+a.duration),pump_id:!forcePumps&&old?old.pump_id:(selected[i%selected.length]||'')};});
  renderRows();changed();
 }
 function renderRows(){
  const renderRow=(r,i)=>`<div class="repeat-day" data-repeat-row="${i}"><label class="repeat-day-label"><input type="checkbox" data-repeat-selected="${i}" ${r.selected?'checked':''}><span>${fmt(r.date,{weekday:'short'})}<small>${fmt(r.date,{day:'2-digit',month:'2-digit'})}</small></span></label>${a.type==='bomba'?`<label class="repeat-day-pump"><span class="sr-only">Bomba de ${fmt(r.date)}</span><select data-repeat-day-pump="${i}" ${r.selected?'required':'disabled'}>${options(r.pump_id)}</select></label>`:'<span class="repeat-conventional">Convencional</span>'}<div class="repeat-times"><input type="time" aria-label="Início de ${fmt(r.date)}" data-repeat-time="${i}" data-part="start" value="${r.start}" ${r.selected?'required':'disabled'}><span>às</span><input type="time" aria-label="Término de ${fmt(r.date)}" data-repeat-time="${i}" data-part="end" value="${r.end}" ${r.selected?'required':'disabled'} max="${new Date(r.date+'T12:00Z').getUTCDay()===6?'12:00':'23:59'}"></div><small data-repeat-day-status="${i}"></small></div>`;
  if($('[data-repeat-period]',form).value==='month'){const groups=new Map();rows.forEach((r,i)=>{const d=new Date(r.date+'T12:00Z'),key=shift(r.date,-((d.getUTCDay()+6)%7));if(!groups.has(key))groups.set(key,[]);groups.get(key).push([r,i]);});container.innerHTML=[...groups].map(([key,list],i)=>`<details class="repeat-week" ${i===0?'open':''}><summary>Semana de ${fmt(key,{day:'2-digit',month:'2-digit'})} · ${list.length} dias</summary>${list.map(([r,n])=>renderRow(r,n)).join('')}</details>`).join('');}else container.innerHTML=rows.map(renderRow).join('');
  for(const input of $$('[data-repeat-selected]',container))input.onchange=()=>{rows[Number(input.dataset.repeatSelected)].selected=input.checked;renderRows();changed();};
  for(const select of $$('[data-repeat-day-pump]',container))select.onchange=()=>{rows[Number(select.dataset.repeatDayPump)].pump_id=select.value;changed();};
  for(const input of $$('[data-repeat-time]',container))input.oninput=()=>{rows[Number(input.dataset.repeatTime)][input.dataset.part]=input.value;changed();};
  if(!rows.length)container.innerHTML='<div class="empty">Não há dias de atendimento neste período. Escolha outra data inicial.</div>';
  submit.textContent='Criar '+rows.filter(r=>r.selected).length+' agendamentos';submit.disabled=!rows.some(r=>r.selected);
 }
 function collect(){
  const selected=rows.filter(r=>r.selected);if(!selected.length)throw Error('Selecione ao menos um dia.');
  const chosen=$('[data-repeat-mode]',form)?.value==='fixed'?rotation.slice(0,1):rotation;if(a.type==='bomba'&&chosen.some(id=>!id))throw Error('Selecione as bombas da alternância ou remova o seletor vazio.');const usedRotation=chosen.filter(Boolean);if(a.type==='bomba'&&new Set(usedRotation).size!==usedRotation.length)throw Error('Escolha bombas diferentes na alternância.');
  const occurrences=selected.map(r=>{const duration=minutes(r.end)-minutes(r.start);if(!Number.isFinite(duration)||duration<15)throw Error('Confira o início e o término de '+fmt(r.date)+'.');return {date:r.date,start:r.start,duration,pump_id:r.pump_id};});
  return {token,period:$('[data-repeat-period]',form).value,includeSaturday:$('[data-repeat-saturday]',form).checked,common:{...template,date:$('[data-repeat-start]',form).value,pump_id:occurrences[0].pump_id},occurrences};
 }
 function paintChecks(result){$('.repeat-config',form).open=false;modal.scrollTop=0;for(const r of result.rows){const i=rows.findIndex(row=>row.date===r.date),el=$('[data-repeat-day-status="'+i+'"]',form);if(!el)continue;el.textContent=r.ok?(r.warnings?.join(' ')||'Disponível'):r.message;el.className=r.ok?'repeat-ok':'repeat-conflict';if(!r.ok)el.closest('details')?.setAttribute('open','');}$('[data-repeat-result]',form).textContent=result.valid?result.count+' dias conferidos. Pronto para criar.':'Existem dias que precisam de ajuste. Nenhum agendamento foi criado.';}
 async function check(){const v=revision;const button=$('[data-repeat-check]',form);button.disabled=true;try{const payload=collect(),result=await api('/appointments/repeat/preview',{method:'POST',body:JSON.stringify(payload)});if(v===revision&&form.isConnected)paintChecks(result);}catch(e){if(v===revision&&form.isConnected)$('[data-repeat-result]',form).textContent=e.message;}finally{button.disabled=false;}}
 for(const control of $$('[data-repeat-start],[data-repeat-period],[data-repeat-saturday]',form))control.onchange=()=>{try{generate();}catch(e){$('[data-repeat-result]',form).textContent=e.message;}};
 if($('[data-repeat-mode]',form))$('[data-repeat-mode]',form).onchange=()=>{renderRotation();generate(true);};
 if($('[data-repeat-add]',form))$('[data-repeat-add]',form).onclick=()=>{if(rotation.length>=pumps.length)return;rotation.push('');renderRotation();};
 $('[data-repeat-check]',form).onclick=check;
 renderRotation();generate(true);
}
const exported={dates,open};if(typeof module==='object'&&module.exports)module.exports=exported;else root.RecurringBookings=exported;
})(typeof globalThis==='object'?globalThis:this);
