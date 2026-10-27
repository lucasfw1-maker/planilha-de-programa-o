import {checkBranch,plateValue,equipmentState} from './equipment.mjs';
import {query,one,run,transaction} from './storage.mjs';
import {slotWindow,overlaps} from './maintenance.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export const maintenanceAccess=u=>['manutencao','gerente','programador'].includes(u.role);
const sideAccess=(u,side)=>side==='maintenance'?maintenanceAccess(u):side==='logistics'&&['controlador','gerente','programador'].includes(u.role);
const text=(value,label,max=1000)=>{if(typeof value!=='string'||!value.trim()||value.length>max)fail('Informe '+label+' (até '+max+' caracteres).');return value.trim();};
function day(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)fail('Data inválida.');return value;}
function period(b){for(const key of ['starts_at','ends_at']){if(typeof b[key]!=='string'||!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(b[key]))fail('Informe início e fim com data e horário.');day(b[key].slice(0,10));}if(b.ends_at<=b.starts_at)fail('O fim da manutenção deve ser posterior ao início.');return {starts_at:b.starts_at,ends_at:b.ends_at,reason:text(b.reason,'o serviço/motivo da manutenção')};}
const select="SELECT j.*,p.name pump_name,c.code cb_code,u.name proposed_by_name,m.name maintenance_name,l.name logistics_name FROM maintenance_jobs j LEFT JOIN pumps p ON p.id=j.pump_id LEFT JOIN maintenance_cbs c ON c.id=j.cb_id JOIN users u ON u.id=j.proposed_by LEFT JOIN users m ON m.id=j.maintenance_approved_by LEFT JOIN users l ON l.id=j.logistics_approved_by";
function nextDay(value){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
async function legacyPeriods(from,to,all=false,branch=''){
 const rows=await query("SELECT m.*,p.name equipment_code,p.plate equipment_plate,p.branch,u.name proposed_by_name FROM maintenance_periods m JOIN pumps p ON p.id=m.pump_id LEFT JOIN users u ON u.id=m.created_by WHERE m.starts_at<? AND m.ends_at>? AND (?=1 OR m.cancelled_at IS NULL) AND (?='' OR p.branch=?) AND NOT EXISTS(SELECT 1 FROM maintenance_jobs j WHERE j.period_id=m.id)",nextDay(to)+'T00:00',from+'T00:00',all?1:0,branch,branch);
 return rows.map(r=>({...r,id:'legacy-'+r.id,equipment_type:'bomba',pump_name:r.equipment_code,status:r.cancelled_at?'cancelado':'confirmado',maintenance_name:'Registro anterior',logistics_name:'Não registrada no cadastro anterior'}));
}
export async function maintenanceCalendar(from,to){day(from);day(to);if(from>to||Date.parse(to)-Date.parse(from)>366*86400000)fail('Consulte até 367 dias.');const jobs=await query("SELECT j.id,j.equipment_type,j.pump_id,j.cb_id,j.starts_at,j.ends_at,j.reason,j.branch,j.equipment_plate,p.name pump_name,c.code cb_code FROM maintenance_jobs j LEFT JOIN pumps p ON p.id=j.pump_id LEFT JOIN maintenance_cbs c ON c.id=j.cb_id WHERE j.status='confirmado' AND j.starts_at<? AND j.ends_at>? ORDER BY j.starts_at,j.id",nextDay(to)+'T00:00',from+'T00:00');return [...jobs,...await legacyPeriods(from,to)].sort((a,b)=>a.starts_at.localeCompare(b.starts_at));}

async function event(u,job,action,side,note){const stamp=new Date().toISOString();await run('INSERT INTO maintenance_job_events(job_id,actor_id,action,side,starts_at,ends_at,reason,note,revision,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',job.id,u.id,action,side,job.starts_at,job.ends_at,job.reason,note,job.revision,stamp);await run('INSERT INTO audit(user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',u.id,action,'manutencao_equipamento',job.id,JSON.stringify({side,revision:job.revision,starts_at:job.starts_at,ends_at:job.ends_at,reason:job.reason,note}));}
async function withConflicts(jobs){
 const pumps=jobs.filter(j=>j.equipment_type==='bomba'&&j.status!=='cancelado');if(!pumps.length)return jobs.map(j=>({...j,conflicts:[]}));
 const dates=pumps.flatMap(j=>[j.starts_at.slice(0,10),j.ends_at.slice(0,10)]).sort();const works=await query("SELECT id,customer,work,date,start,duration,pump_id FROM appointments WHERE status<>'cancelado' AND date BETWEEN ? AND ?",dates[0],dates.at(-1));
 return jobs.map(j=>({...j,conflicts:j.equipment_type==='bomba'&&j.status!=='cancelado'?works.filter(a=>a.pump_id===j.pump_id&&overlaps(slotWindow(a.date,a.start,a.duration),{start:j.starts_at,end:j.ends_at})):[]}));
}
async function get(id){const job=await one(select+' WHERE j.id=?',id);if(!job)fail('Proposta não encontrada.',404);return (await withConflicts([job]))[0];}

async function confirm(job,u){
 if(!job.maintenance_approved_by||!job.logistics_approved_by)return;
 if(job.maintenance_approved_by===job.logistics_approved_by)fail('Manutenção e logística precisam de aprovações de pessoas diferentes.',409);
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
  if(!maintenanceAccess(u))fail('Somente a manutenção ou gestão pode cadastrar equipamentos.',403);const b=await body(),code=text(b.code,'o código do CB',40).toLocaleUpperCase('pt-BR'),description=typeof b.description==='string'?b.description.trim().slice(0,200):'';
  return transaction(async()=>{if(plateValue(b.plate)&&await one('SELECT id FROM maintenance_cbs WHERE plate=?',plateValue(b.plate)))fail('Essa placa já está cadastrada em outro CB.',409);if(await one('SELECT id FROM maintenance_cbs WHERE code=?',code))fail('Este CB já está cadastrado.',409);const id=Number((await run('INSERT INTO maintenance_cbs(code,description,plate,branch,created_by) VALUES(?,?,?,?,?)',code,description,plateValue(b.plate),checkBranch(b.branch||'pacaembu'),u.id)).lastInsertRowid);await run("INSERT OR IGNORE INTO settings(key,value) VALUES('fleet_registry_since',?)",new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));await run('INSERT INTO cb_fleet_history(cb_id,effective_date,active,branch) VALUES(?,?,1,?)',id,new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),b.branch||'pacaembu');await run('INSERT INTO audit(user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',u.id,'cadastrar equipamento','cb',id,JSON.stringify({code,plate:plateValue(b.plate),branch:b.branch||'pacaembu'}));return {id};});
 }
 const equipmentMatch=route.match(/^\/equipment\/(\d+)$/);if(equipmentMatch&&method==='PATCH')return equipmentState(u,'cb',Number(equipmentMatch[1]),await body());
 if(route==='/report'&&method==='GET'){if(!maintenanceAccess(u))fail('Sem permissão.',403);const from=day(url.searchParams.get('from')),to=day(url.searchParams.get('to'));if(from>to)fail('Confira o período.');const branch=checkBranch(url.searchParams.get('branch')||'',true);const jobs=await query(select+" WHERE j.starts_at<? AND j.ends_at>? AND (?='' OR j.branch=?) ORDER BY j.starts_at",nextDay(to)+'T00:00',from+'T00:00',branch,branch);const events=await query("SELECT e.*,u.name actor_name FROM maintenance_job_events e JOIN maintenance_jobs j ON j.id=e.job_id JOIN users u ON u.id=e.actor_id WHERE j.starts_at<? AND j.ends_at>? AND (?='' OR j.branch=?) ORDER BY e.created_at,e.id",nextDay(to)+'T00:00',from+'T00:00',branch,branch);return {from,to,jobs:[...jobs,...await legacyPeriods(from,to,true,branch)].sort((a,b)=>a.starts_at.localeCompare(b.starts_at)),events};}
 if(route==='/requests'&&method==='GET')return withConflicts(await query(select+' ORDER BY CASE j.status WHEN \'negociando\' THEN 0 WHEN \'confirmado\' THEN 1 ELSE 2 END,j.starts_at,j.id'));
 if(route==='/requests'&&method==='POST'){
  if(!maintenanceAccess(u))fail('Somente a manutenção ou gestão pode sugerir uma manutenção.',403);const b=await body(),data=period(b),kind=b.equipment_type,pump=kind==='bomba'?Number(b.pump_id):null,cb=kind==='cb'?Number(b.cb_id):null;
  if(!['bomba','cb'].includes(kind)||!Number.isInteger(pump||cb)||(pump||cb)<1||!await one(kind==='bomba'?'SELECT id FROM pumps WHERE id=?':'SELECT id FROM maintenance_cbs WHERE id=?',pump||cb))fail('Selecione um equipamento cadastrado.');
  const equipment=await one(kind==='bomba'?'SELECT * FROM pumps WHERE id=?':'SELECT *,code name FROM maintenance_cbs WHERE id=?',pump||cb);if(!equipment.active)fail('O equipamento está inativo. Ative-o na Gerência antes de propor manutenção.');
  return transaction(async()=>{const stamp=new Date().toISOString(),id=Number((await run("INSERT INTO maintenance_jobs(equipment_type,pump_id,cb_id,starts_at,ends_at,reason,maintenance_approved_by,proposed_by,proposed_side,equipment_code,equipment_plate,branch,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'maintenance',?,?,?,?,?)",kind,pump,cb,data.starts_at,data.ends_at,data.reason,u.id,u.id,equipment.name,equipment.plate,equipment.branch,stamp,stamp)).lastInsertRowid);const job=await get(id);await event(u,job,'sugerir manutenção','maintenance',typeof b.note==='string'?b.note.slice(0,2000):'');return job;});
 }
 const match=route.match(/^\/requests\/(\d+)(?:\/(accept|negotiate|cancel))?$/);if(!match)fail('Recurso não encontrado.',404);const id=Number(match[1]),action=match[2];
 if(method==='GET'&&!action){const job=await get(id);return {...job,events:await query('SELECT e.*,u.name actor_name FROM maintenance_job_events e JOIN users u ON u.id=e.actor_id WHERE job_id=? ORDER BY e.id',id)};}
 if(method!=='POST'||!action)fail('Operação inválida.',405);
 const b=await body(),side=b.side;if(!sideAccess(u,side))fail('Você não pode representar esse lado da negociação.',403);
 return transaction(async()=>{
  const job=await get(id);if(b.expected_revision===undefined||Number(b.expected_revision)!==job.revision)fail('Esta proposta mudou. Abra novamente antes de responder.',409);if(job.status==='cancelado')fail('Proposta já cancelada.',409);
  if(action==='cancel'){
   if(job.status==='confirmado'&&!['gerente','programador'].includes(u.role))fail('Somente Gerente ou Programador pode cancelar uma programação confirmada.',403);
   const note=text(b.note,'o motivo do cancelamento',2000);await run("UPDATE maintenance_jobs SET status='cancelado',revision=revision+1,updated_at=? WHERE id=?",new Date().toISOString(),id);if(job.period_id)await run('UPDATE maintenance_periods SET cancelled_by=?,cancelled_at=?,cancel_reason=? WHERE id=?',u.id,new Date().toISOString(),note,job.period_id);job.revision++;await event(u,job,'cancelar manutenção',side,note);return get(id);
  }
  if(job.status!=='negociando')fail('A programação já está confirmada. Para outra data, crie uma nova proposta.',409);
  if(action==='negotiate'){
   const data=period(b),note=text(b.note,'a observação da negociação',2000);if(data.starts_at===job.starts_at&&data.ends_at===job.ends_at&&data.reason===job.reason)fail('Altere o período ou o serviço para negociar outra proposta.');
   Object.assign(job,data,{revision:job.revision+1,maintenance_approved_by:side==='maintenance'?u.id:null,logistics_approved_by:side==='logistics'?u.id:null});
   await run('UPDATE maintenance_jobs SET starts_at=?,ends_at=?,reason=?,revision=?,maintenance_approved_by=?,logistics_approved_by=?,proposed_side=?,updated_at=? WHERE id=?',job.starts_at,job.ends_at,job.reason,job.revision,job.maintenance_approved_by,job.logistics_approved_by,side,new Date().toISOString(),id);await event(u,job,'negociar outra data',side,note);return get(id);
  }
  const own=side==='maintenance'?'maintenance_approved_by':'logistics_approved_by',other=side==='maintenance'?'logistics_approved_by':'maintenance_approved_by';if(job[own])fail('Este lado já aceitou esta revisão.',409);if(job[other]===u.id)fail('A outra parte precisa ser representada por outra pessoa.',409);job[own]=u.id;
  await run('UPDATE maintenance_jobs SET '+own+'=?,updated_at=? WHERE id=?',u.id,new Date().toISOString(),id);await event(u,job,'aceitar proposta',side,typeof b.note==='string'?b.note.slice(0,2000):'');await confirm(job,u);return get(id);
 });
}
