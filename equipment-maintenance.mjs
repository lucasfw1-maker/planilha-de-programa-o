import {checkBranch,plateValue,equipmentState,cbCode,capacityValue} from './equipment.mjs';
import {query,one,run,transaction} from './storage.mjs';
import {slotWindow,overlaps} from './maintenance.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export const maintenanceAccess=u=>['manutencao','gerente','programador'].includes(u.role);
const sideAccess=(u,side)=>side==='maintenance'?maintenanceAccess(u):side==='logistics'&&['controlador','gerente','programador'].includes(u.role);
const text=(value,label,max=1000)=>{if(typeof value!=='string'||!value.trim()||value.length>max)fail('Informe '+label+' (até '+max+' caracteres).');return value.trim();};
function day(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)fail('Data inválida.');return value;}
function period(b){for(const key of ['starts_at','ends_at']){if(typeof b[key]!=='string'||!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(b[key]))fail('Informe início e fim com data e horário.');day(b[key].slice(0,10));}if(b.ends_at<=b.starts_at)fail('O fim da manutenção deve ser posterior ao início.');return {starts_at:b.starts_at,ends_at:b.ends_at,reason:text(b.reason,'o serviço/motivo da manutenção')};}
const select="SELECT j.*,progress.started_date,progress.notes progress_notes,x.completed_date,x.performed_by,x.notes execution_notes,x.created_at completed_at,technician.name completed_by_name,p.name pump_name,c.code cb_code,u.name proposed_by_name,m.name maintenance_name,l.name logistics_name FROM maintenance_jobs j LEFT JOIN pumps p ON p.id=j.pump_id LEFT JOIN maintenance_cbs c ON c.id=j.cb_id JOIN users u ON u.id=j.proposed_by LEFT JOIN users m ON m.id=j.maintenance_approved_by LEFT JOIN users l ON l.id=j.logistics_approved_by LEFT JOIN maintenance_progress progress ON progress.job_id=j.id LEFT JOIN maintenance_completions x ON x.job_id=j.id LEFT JOIN users technician ON technician.id=x.actor_id";
function nextDay(value){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
async function legacyPeriods(from,to,all=false,branch=''){
 const rows=await query("SELECT m.*,p.name equipment_code,p.plate equipment_plate,p.branch,u.name proposed_by_name FROM maintenance_periods m JOIN pumps p ON p.id=m.pump_id LEFT JOIN users u ON u.id=m.created_by WHERE m.starts_at<? AND m.ends_at>? AND (?=1 OR m.cancelled_at IS NULL) AND (?='' OR p.branch=?) AND NOT EXISTS(SELECT 1 FROM maintenance_jobs j WHERE j.period_id=m.id)",nextDay(to)+'T00:00',from+'T00:00',all?1:0,branch,branch);
 return rows.map(r=>({...r,id:'legacy-'+r.id,equipment_type:'bomba',pump_name:r.equipment_code,status:r.cancelled_at?'cancelado':'confirmado',maintenance_name:'Registro anterior',logistics_name:'Não registrada no cadastro anterior'}));
}
export async function maintenanceCalendar(from,to){day(from);day(to);if(from>to||Date.parse(to)-Date.parse(from)>366*86400000)fail('Consulte até 367 dias.');const jobs=await query("SELECT j.id,j.equipment_type,j.pump_id,j.cb_id,j.starts_at,j.ends_at,j.reason,j.branch,j.equipment_plate,done.created_at completed_at,done.completed_date,p.name pump_name,c.code cb_code FROM maintenance_jobs j LEFT JOIN maintenance_completions done ON done.job_id=j.id LEFT JOIN pumps p ON p.id=j.pump_id LEFT JOIN maintenance_cbs c ON c.id=j.cb_id WHERE j.status='confirmado' AND j.starts_at<? AND j.ends_at>? ORDER BY j.starts_at,j.id",nextDay(to)+'T00:00',from+'T00:00');return [...jobs,...await legacyPeriods(from,to)].sort((a,b)=>a.starts_at.localeCompare(b.starts_at));}

async function event(u,job,action,side,note){const stamp=new Date().toISOString();await run('INSERT INTO maintenance_job_events(job_id,actor_id,action,side,starts_at,ends_at,reason,note,revision,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',job.id,u.id,action,side,job.starts_at,job.ends_at,job.reason,note,job.revision,stamp);await run('INSERT INTO audit(user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',u.id,action,'manutencao_equipamento',job.id,JSON.stringify({side,revision:job.revision,starts_at:job.starts_at,ends_at:job.ends_at,reason:job.reason,note}));}
async function withConflicts(jobs){
 const pumps=jobs.filter(j=>j.equipment_type==='bomba'&&j.status!=='cancelado');if(!pumps.length)return jobs.map(j=>({...j,conflicts:[]}));
 const dates=pumps.flatMap(j=>[j.starts_at.slice(0,10),j.ends_at.slice(0,10)]).sort();const works=await query("SELECT id,customer,work,date,start,duration,pump_id FROM appointments WHERE status<>'cancelado' AND date BETWEEN ? AND ?",dates[0],dates.at(-1));
 return jobs.map(j=>({...j,conflicts:j.equipment_type==='bomba'&&j.status!=='cancelado'?works.filter(a=>a.pump_id===j.pump_id&&overlaps(slotWindow(a.date,a.start,a.duration),{start:j.starts_at,end:j.ends_at})):[]}));
}
async function get(id){const job=await one(select+' WHERE j.id=?',id);if(!job)fail('Proposta não encontrada.',404);const previous=!job.completed_at?await one("SELECT before_json FROM maintenance_execution_history WHERE job_id=? AND action='reabrir conclusão' ORDER BY id DESC LIMIT 1",id):null;return {...(await withConflicts([job]))[0],services:await query('SELECT service,quantity,unit FROM maintenance_services WHERE job_id=? ORDER BY id',id),...(previous?{last_completion:JSON.parse(previous.before_json)}:{})};}

async function confirm(job,u){
 if(!job.maintenance_approved_by||!job.logistics_approved_by)return;
 if(job.maintenance_approved_by===job.logistics_approved_by)fail('Manutenção e logística precisam de aprovações de pessoas diferentes.',409);
 if(job.change_of){
  const original=await get(job.change_of);if(original.completed_at)fail('A manutenção já foi realizada e seu registro deve ser preservado.',409);if(original.status!=='confirmado')fail('A manutenção original já foi alterada ou cancelada. Revise o pedido.',409);
  const note=job.change_action==='cancel'?'Cancelamento aceito pelas duas partes.':'Substituída pela programação #'+job.id+' aceita pelas duas partes.';
  await run("UPDATE maintenance_jobs SET status='cancelado',revision=revision+1,updated_at=? WHERE id=?",new Date().toISOString(),original.id);
  if(original.period_id)await run('UPDATE maintenance_periods SET cancelled_by=?,cancelled_at=?,cancel_reason=? WHERE id=?',u.id,new Date().toISOString(),note,original.period_id);
  original.revision++;await event(u,original,'alteração aprovada','both',note);
  if(job.change_action==='cancel'){await run("UPDATE maintenance_jobs SET status='cancelado',updated_at=? WHERE id=?",new Date().toISOString(),job.id);job.status='cancelado';await event(u,job,'aprovar cancelamento','both',note);return;}
 }
 const conflict=await one("SELECT id FROM maintenance_jobs WHERE id<>? AND status='confirmado' AND equipment_type=? AND COALESCE(pump_id,cb_id)=? AND starts_at<? AND ends_at>?",job.id,job.equipment_type,job.pump_id||job.cb_id,job.ends_at,job.starts_at);if(conflict)fail('Este equipamento já tem manutenção confirmada neste intervalo.',409);
 const equipment=await one(job.equipment_type==='bomba'?'SELECT active FROM pumps WHERE id=?':'SELECT active FROM maintenance_cbs WHERE id=?',job.pump_id||job.cb_id);if(!equipment?.active)fail('O equipamento está inativo. Ative-o antes da confirmação.',409);
 let periodId=null;
 if(job.equipment_type==='bomba'){
  if(await one('SELECT id FROM maintenance_periods WHERE pump_id=? AND cancelled_at IS NULL AND starts_at<? AND ends_at>?',job.pump_id,job.ends_at,job.starts_at))fail('A bomba já tem manutenção neste intervalo.',409);
  const works=await query("SELECT id,customer,date,start,duration FROM appointments WHERE pump_id=? AND status<>'cancelado' AND date BETWEEN ? AND ?",job.pump_id,job.starts_at.slice(0,10),job.ends_at.slice(0,10));
  job.conflicts=works.filter(a=>overlaps(slotWindow(a.date,a.start,a.duration),{start:job.starts_at,end:job.ends_at}));
  periodId=Number((await run('INSERT INTO maintenance_periods(pump_id,starts_at,ends_at,reason,created_by) VALUES(?,?,?,?,?)',job.pump_id,job.starts_at,job.ends_at,job.reason,u.id)).lastInsertRowid);
 }
 await run("UPDATE maintenance_jobs SET status='confirmado',period_id=? WHERE id=?",periodId,job.id);job.status='confirmado';await event(u,job,'confirmar programação','both','Manutenção e logística aceitaram a mesma revisão.'+(job.conflicts?.length?' Aviso: '+job.conflicts.length+' obra(s) já agendada(s) no período. IDs: '+job.conflicts.map(a=>a.id).join(', ')+'. A logística deve ajustar os atendimentos.':''));
}
export async function equipmentMaintenanceApi({path,method,url,u,body}){
 const prefix='/api/equipment-maintenance',route=path.slice(prefix.length);
 if(route==='/calendar'&&method==='GET')return maintenanceCalendar(url.searchParams.get('from'),url.searchParams.get('to'));
 if(!['manutencao','gerente','programador','controlador'].includes(u.role))fail('Sem permissão.',403);
 if(route==='/conflicts'&&method==='GET'){const pumpId=Number(url.searchParams.get('pump_id'));if(!Number.isInteger(pumpId)||pumpId<1)fail('Selecione uma bomba.');const data=period({starts_at:url.searchParams.get('starts_at'),ends_at:url.searchParams.get('ends_at'),reason:'Consulta'});return (await withConflicts([{...data,equipment_type:'bomba',pump_id:pumpId,status:'negociando'}]))[0].conflicts;}
 if(route==='/equipment'&&method==='GET')return {pumps:await query('SELECT * FROM pumps ORDER BY name'),cbs:await query('SELECT * FROM maintenance_cbs ORDER BY code')};
 if(route==='/equipment'&&method==='POST'){
  if(!maintenanceAccess(u))fail('Somente a manutenção ou gestão pode cadastrar equipamentos.',403);const b=await body(),code=cbCode(b.code),capacity=capacityValue(b.capacity_m3);
  return transaction(async()=>{if(plateValue(b.plate)&&await one('SELECT id FROM maintenance_cbs WHERE plate=?',plateValue(b.plate)))fail('Essa placa já está cadastrada em outro CB.',409);if(await one('SELECT id FROM maintenance_cbs WHERE code=?',code))fail('Este CB já está cadastrado.',409);const id=Number((await run('INSERT INTO maintenance_cbs(code,capacity_m3,plate,branch,created_by) VALUES(?,?,?,?,?)',code,capacity,plateValue(b.plate),checkBranch(b.branch||'pacaembu'),u.id)).lastInsertRowid);await run("INSERT OR IGNORE INTO settings(key,value) VALUES('fleet_registry_since',?)",new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));await run('INSERT INTO cb_fleet_history(cb_id,effective_date,active,branch) VALUES(?,?,1,?)',id,new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),b.branch||'pacaembu');await run('INSERT INTO audit(user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',u.id,'cadastrar equipamento','cb',id,JSON.stringify({code,capacity_m3:capacity,plate:plateValue(b.plate),branch:b.branch||'pacaembu'}));return {id};});
 }
 const equipmentMatch=route.match(/^\/equipment\/(\d+)$/);if(equipmentMatch&&method==='PATCH')return equipmentState(u,'cb',Number(equipmentMatch[1]),await body());
 if(route==='/report'&&method==='GET'){
  if(!maintenanceAccess(u))fail('Sem permissão.',403);
  const all=url.searchParams.get('all')==='1',from=all?'1900-01-01':day(url.searchParams.get('from')),to=all?'9998-12-31':day(url.searchParams.get('to'));if(from>to)fail('Confira o período.');const branch=checkBranch(url.searchParams.get('branch')||'',true);
  const jobs=await query(select+" WHERE (?=1 OR (j.starts_at<? AND j.ends_at>?)) AND (?='' OR j.branch=?) ORDER BY j.starts_at",all?1:0,nextDay(to)+'T00:00',from+'T00:00',branch,branch);
  const services=await query("SELECT s.* FROM maintenance_services s JOIN maintenance_jobs j ON j.id=s.job_id WHERE (?=1 OR (j.starts_at<? AND j.ends_at>?)) AND (?='' OR j.branch=?) ORDER BY s.id",all?1:0,nextDay(to)+'T00:00',from+'T00:00',branch,branch);
  return {from,to,all,jobs:[...jobs.map(j=>({...j,services:services.filter(s=>s.job_id===j.id)})),...await legacyPeriods(from,to,true,branch)].sort((a,b)=>a.starts_at.localeCompare(b.starts_at))};
 }
 const startMatch=route.match(/^\/requests\/(\d+)\/start$/);
 if(startMatch&&method==='POST'){
  if(!maintenanceAccess(u))fail('Somente a manutenção ou gestão pode registrar a execução.',403);
  const b=await body();return transaction(async()=>{
   const job=await get(Number(startMatch[1]));if(job.status!=='confirmado'||job.completed_at||job.started_date)fail('A manutenção precisa estar confirmada e ainda não iniciada.',409);
   if(Number(b.expected_revision)!==job.revision)fail('A manutenção mudou. Abra novamente.',409);
   if(await one("SELECT id FROM maintenance_jobs WHERE change_of=? AND status='negociando'",job.id))fail('Resolva o pedido de alteração pendente antes de iniciar.',409);
   const date=day(b.started_date),today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(date>today||date<job.starts_at.slice(0,10))fail('A data de início deve estar entre o início programado e hoje.');
   const notes=typeof b.notes==='string'?b.notes.trim():'';if(notes.length>2000)fail('Use até 2000 caracteres nas observações.');const stamp=new Date().toISOString();
   await run('INSERT INTO maintenance_progress(job_id,started_date,notes,actor_id,created_at) VALUES(?,?,?,?,?)',job.id,date,notes,u.id,stamp);await run('UPDATE maintenance_jobs SET revision=revision+1,updated_at=? WHERE id=?',stamp,job.id);job.revision++;
   await event(u,job,'iniciar execução','maintenance',notes);return get(job.id);
  });
 }
 const reopenMatch=route.match(/^\/requests\/(\d+)\/reopen$/);
 if(reopenMatch&&method==='POST'){
  if(!maintenanceAccess(u))fail('Somente a manutenção ou gestão pode reabrir a conclusão.',403);
  const b=await body();return transaction(async()=>{
   const job=await get(Number(reopenMatch[1]));if(!job.completed_at||job.status!=='confirmado')fail('Não há conclusão para reabrir neste registro.',409);if(Number(b.expected_revision)!==job.revision)fail('Este registro mudou. Abra novamente.',409);
   const note=text(b.note,'o motivo da reabertura',2000),stamp=new Date().toISOString();
   await run('INSERT INTO maintenance_execution_history(job_id,actor_id,action,before_json,after_json,created_at) VALUES(?,?,?,?,?,?)',job.id,u.id,'reabrir conclusão',JSON.stringify(job),JSON.stringify({note}),stamp);
   await run('DELETE FROM maintenance_services WHERE job_id=?',job.id);await run('DELETE FROM maintenance_completions WHERE job_id=?',job.id);await run('UPDATE maintenance_jobs SET revision=revision+1,updated_at=? WHERE id=?',stamp,job.id);job.revision++;
   await event(u,job,'reabrir conclusão','maintenance',note);return get(job.id);
  });
 }
 const completeMatch=route.match(/^\/requests\/(\d+)\/complete$/);
 if(completeMatch&&['POST','PATCH'].includes(method)){
  const editing=method==='PATCH';
  if(!maintenanceAccess(u))fail('Somente a manutenção ou gestão pode registrar a execução.',403);
  const b=await body();return transaction(async()=>{
   const job=await get(Number(completeMatch[1]));if(job.status!=='confirmado'||(editing?!job.completed_at:!!job.completed_at)||job.change_action==='cancel')fail(editing?'Esta manutenção não tem uma conclusão para editar.':'Só é possível concluir uma manutenção confirmada e ainda não realizada.',409);
   if(Number(b.expected_revision)!==job.revision)fail('A manutenção mudou. Abra novamente antes de concluir.',409);
   if(await one("SELECT id FROM maintenance_jobs WHERE change_of=? AND status='negociando'",job.id))fail('Resolva o pedido de alteração pendente antes de registrar a execução.',409);
   const date=day(b.completed_date),today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(date>today||date<(job.started_date||job.starts_at.slice(0,10)))fail('A data de execução deve estar entre o início programado e hoje.');
   if(!Array.isArray(b.services)||!b.services.length||b.services.length>50)fail('Informe de 1 a 50 serviços realizados.');
   const performedBy=text(b.performed_by,'quem realizou o serviço ou a empresa responsável',200);
   const services=b.services.map(s=>{const quantity=typeof s.quantity==='number'?s.quantity:typeof s.quantity==='string'&&s.quantity.trim()?Number(s.quantity.replace(',','.')):NaN;if(!Number.isFinite(quantity)||quantity<=0||quantity>100000000)fail('Informe uma quantidade válida e maior que zero para cada serviço.');return {service:text(s.service,'o nome do serviço',200),quantity,unit:text(s.unit,'a unidade do serviço',30)};});
   const notes=typeof b.notes==='string'?b.notes.trim():'';if(notes.length>2000)fail('Use até 2000 caracteres nas observações.');const stamp=new Date().toISOString();
   if(editing){await run('INSERT INTO maintenance_execution_history(job_id,actor_id,action,before_json,after_json,created_at) VALUES(?,?,?,?,?,?)',job.id,u.id,'editar conclusão',JSON.stringify(job),JSON.stringify({completed_date:date,performed_by:performedBy,services,notes}),stamp);await run('DELETE FROM maintenance_services WHERE job_id=?',job.id);await run('UPDATE maintenance_completions SET completed_date=?,performed_by=?,notes=?,actor_id=?,created_at=? WHERE job_id=?',date,performedBy,notes,u.id,stamp,job.id);}else await run('INSERT INTO maintenance_completions(job_id,completed_date,performed_by,notes,actor_id,created_at) VALUES(?,?,?,?,?,?)',job.id,date,performedBy,notes,u.id,stamp);
   for(const s of services)await run('INSERT INTO maintenance_services(job_id,service,quantity,unit) VALUES(?,?,?,?)',job.id,s.service,s.quantity,s.unit);
   await run('UPDATE maintenance_jobs SET revision=revision+1,updated_at=? WHERE id=?',stamp,job.id);job.revision++;
   await event(u,job,editing?'editar conclusão':'registrar execução','maintenance',JSON.stringify({completed_date:date,performed_by:performedBy,services,notes}));return get(job.id);
  });
 }

 if(route==='/requests'&&method==='GET')return withConflicts(await query(select+' ORDER BY CASE j.status WHEN \'negociando\' THEN 0 WHEN \'confirmado\' THEN 1 ELSE 2 END,j.starts_at,j.id'));
 if(route==='/requests'&&method==='POST'){
  if(!maintenanceAccess(u))fail('Somente a manutenção ou gestão pode sugerir uma manutenção.',403);const b=await body(),data=period(b),kind=b.equipment_type,pump=kind==='bomba'?Number(b.pump_id):null,cb=kind==='cb'?Number(b.cb_id):null;
  if(!['bomba','cb'].includes(kind)||!Number.isInteger(pump||cb)||(pump||cb)<1||!await one(kind==='bomba'?'SELECT id FROM pumps WHERE id=?':'SELECT id FROM maintenance_cbs WHERE id=?',pump||cb))fail('Selecione um equipamento cadastrado.');
  const equipment=await one(kind==='bomba'?'SELECT * FROM pumps WHERE id=?':'SELECT *,code name FROM maintenance_cbs WHERE id=?',pump||cb);if(!equipment.active)fail('O equipamento está inativo. Ative-o na Gerência antes de propor manutenção.');
  return transaction(async()=>{const stamp=new Date().toISOString(),id=Number((await run("INSERT INTO maintenance_jobs(equipment_type,pump_id,cb_id,starts_at,ends_at,reason,maintenance_approved_by,proposed_by,proposed_side,equipment_code,equipment_plate,branch,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'maintenance',?,?,?,?,?)",kind,pump,cb,data.starts_at,data.ends_at,data.reason,u.id,u.id,equipment.name,equipment.plate,equipment.branch,stamp,stamp)).lastInsertRowid);const job=await get(id);await event(u,job,'sugerir manutenção','maintenance',typeof b.note==='string'?b.note.slice(0,2000):'');return job;});
 }
 const changeMatch=route.match(/^\/requests\/(\d+)\/change$/);
 if(changeMatch&&method==='POST'){
  const b=await body(),side=b.side||(u.role==='manutencao'?'maintenance':'logistics');if(!sideAccess(u,side))fail('Sem permissão para solicitar esta alteração.',403);
  return transaction(async()=>{
   const original=await get(Number(changeMatch[1]));if(original.completed_at)fail('Uma manutenção realizada não pode ser remarcada ou cancelada.',409);if(original.status!=='confirmado'||Number(b.expected_revision)!==original.revision)fail('A programação mudou. Abra novamente antes de solicitar.',409);
   if(await one("SELECT id FROM maintenance_jobs WHERE change_of=? AND status='negociando'",original.id))fail('Já existe um pedido em negociação para esta manutenção.',409);
   if(!['cancel','reschedule'].includes(b.action))fail('Escolha cancelamento ou troca de data.');
   const note=text(b.note,'o motivo da solicitação',2000),data=b.action==='cancel'?original:period({...b,reason:original.reason});
   if(b.action==='reschedule'&&data.starts_at===original.starts_at&&data.ends_at===original.ends_at)fail('Escolha um novo período.');
   const stamp=new Date().toISOString(),id=Number((await run("INSERT INTO maintenance_jobs(change_of,change_action,equipment_type,pump_id,cb_id,starts_at,ends_at,reason,maintenance_approved_by,logistics_approved_by,proposed_by,proposed_side,equipment_code,equipment_plate,branch,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",original.id,b.action,original.equipment_type,original.pump_id,original.cb_id,data.starts_at,data.ends_at,original.reason,side==='maintenance'?u.id:null,side==='logistics'?u.id:null,u.id,side,original.equipment_code,original.equipment_plate,original.branch,stamp,stamp)).lastInsertRowid);
   const job=await get(id);await event(u,job,b.action==='cancel'?'solicitar cancelamento':'solicitar troca de data',side,note);await event(u,original,'solicitação de alteração',side,'Pedido #'+id+': '+note);return job;
  });
 }
 const match=route.match(/^\/requests\/(\d+)(?:\/(accept|negotiate|cancel))?$/);if(!match)fail('Recurso não encontrado.',404);const id=Number(match[1]),action=match[2];
 if(method==='GET'&&!action){const job=await get(id);return {...job,events:await query('SELECT e.*,u.name actor_name FROM maintenance_job_events e JOIN users u ON u.id=e.actor_id WHERE job_id=? ORDER BY e.id',id)};}
 if(method!=='POST'||!action)fail('Operação inválida.',405);
 const b=await body(),side=b.side;if(!sideAccess(u,side))fail('Você não pode representar esse lado da negociação.',403);
 return transaction(async()=>{
  const job=await get(id);if(b.expected_revision===undefined||Number(b.expected_revision)!==job.revision)fail('Esta proposta mudou. Abra novamente antes de responder.',409);if(job.status==='cancelado')fail('Proposta já cancelada.',409);
  if(action==='cancel'){
   if(job.completed_at)fail('A manutenção já foi realizada e seu registro deve ser preservado.',409);
   if(job.status==='confirmado'&&!['gerente','programador'].includes(u.role))fail('Somente Gerente ou Programador pode cancelar uma programação confirmada.',403);
   const note=text(b.note,'o motivo do cancelamento',2000);await run("UPDATE maintenance_jobs SET status='cancelado',revision=revision+1,updated_at=? WHERE id=?",new Date().toISOString(),id);if(job.period_id)await run('UPDATE maintenance_periods SET cancelled_by=?,cancelled_at=?,cancel_reason=? WHERE id=?',u.id,new Date().toISOString(),note,job.period_id);job.revision++;await event(u,job,'cancelar manutenção',side,note);return get(id);
  }
  if(job.status!=='negociando')fail('A programação já está confirmada. Para outra data, crie uma nova proposta.',409);
  if(action==='negotiate'){
   if(job.change_action==='cancel')fail('Para sugerir outra data, recuse o cancelamento e abra um pedido de troca de data.');
   const data=period(b),note=text(b.note,'a observação da negociação',2000);if(data.starts_at===job.starts_at&&data.ends_at===job.ends_at&&data.reason===job.reason)fail('Altere o período ou o serviço para negociar outra proposta.');
   Object.assign(job,data,{revision:job.revision+1,maintenance_approved_by:side==='maintenance'?u.id:null,logistics_approved_by:side==='logistics'?u.id:null});
   await run('UPDATE maintenance_jobs SET starts_at=?,ends_at=?,reason=?,revision=?,maintenance_approved_by=?,logistics_approved_by=?,proposed_side=?,updated_at=? WHERE id=?',job.starts_at,job.ends_at,job.reason,job.revision,job.maintenance_approved_by,job.logistics_approved_by,side,new Date().toISOString(),id);await event(u,job,'negociar outra data',side,note);return get(id);
  }
  const own=side==='maintenance'?'maintenance_approved_by':'logistics_approved_by',other=side==='maintenance'?'logistics_approved_by':'maintenance_approved_by';if(job[own])fail('Este lado já aceitou esta revisão.',409);if(job[other]===u.id)fail('A outra parte precisa ser representada por outra pessoa.',409);job[own]=u.id;
  await run('UPDATE maintenance_jobs SET '+own+'=?,updated_at=? WHERE id=?',u.id,new Date().toISOString(),id);await event(u,job,'aceitar proposta',side,typeof b.note==='string'?b.note.slice(0,2000):'');await confirm(job,u);return get(id);
 });
}
