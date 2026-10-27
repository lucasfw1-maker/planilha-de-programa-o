import {one,query,run,transaction} from './storage.mjs';
import {customerName,customerKey,customerAddresses} from './customers.mjs';
import {contactFields} from './contacts.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export const contractToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function text(value,label,max=500,optional=false){if(typeof value!=='string'||value.length>max||(!optional&&!value.trim()))fail('Informe '+label+' (até '+max+' caracteres).');return value.trim();}
function day(value,optional=false){if(optional&&!value)return '';if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)fail('Informe uma data válida.');return value;}
async function log(actor,action,id,detail){await run('INSERT INTO audit(user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',actor.id,action,'contrato',id,JSON.stringify(detail));}
const contractSelect='SELECT k.*,c.name registered_name,c.seller_id registered_seller_id,u.name seller_name FROM active_contracts k LEFT JOIN customers c ON c.id=k.customer_id JOIN users u ON u.id=COALESCE(c.seller_id,k.seller_id)';
const contractView=row=>({...row,customer:row.registered_name||row.customer,seller_id:row.registered_seller_id||row.seller_id});
export async function readContract(id){
 const row=await one(contractSelect+' WHERE k.id=?',id);
 if(!row)fail('Contrato não encontrado.',404);return contractView(row);
}
async function editable(id,input){const row=await readContract(id);if(row.status!=='ativo')fail('Este contrato está encerrado.',409);if(Number(input.expected_version)!==row.version||input.expected_version===undefined)fail('O contrato foi atualizado. Abra novamente para conferir os dados.',409);return row;}
async function fields(b){
 let customerId=b.customer_id?Number(b.customer_id):null;if(customerId!==null&&(!Number.isInteger(customerId)||customerId<1))fail('Selecione um cliente válido.');
 let existing=customerId?await one('SELECT * FROM customers WHERE id=?',customerId):null;
 if(customerId&&!existing)fail('Cliente não encontrado.');
 const seller=Number(existing?.seller_id||b.seller_id);
 if(!await one("SELECT id FROM users WHERE id=? AND role='vendedor' AND active=1 AND status='aprovado'",seller))fail('Selecione um vendedor ativo.');
 if(!existing){existing=await one('SELECT * FROM customers WHERE seller_id=? AND name_key=?',seller,customerKey(b.customer));if(existing)customerId=existing.id;}
 const piece=text(b.last_piece||'','a última peça',200,true),lastDate=day(b.last_date,true),volume=b.last_volume===''||b.last_volume===undefined?null:Number(b.last_volume);
 if(volume!==null&&(!Number.isFinite(volume)||volume<0))fail('Volume inválido.');if(lastDate>contractToday())fail('A última concretagem não pode estar no futuro.');if(Boolean(piece)!==Boolean(lastDate))fail('Preencha a última peça e sua data juntas, ou deixe ambas vazias.');
 return {customer_id:customerId,customer:customerName(existing?.name||text(b.customer,'o nome do cliente',200)),seller_id:seller,work_name:text(b.work_name,'o nome da obra',200),address:text(b.address,'o endereço da obra'),...contactFields(b,existing||{}),next_contact:day(b.next_contact),last_piece:piece,last_date:lastDate,last_volume:volume};
}
async function contact(id,b,u){
 const notes=text(b.contact_notes,'a observação da conversa',2000),next=day(b.next_contact),today=contractToday();if(next<today)fail('Escolha hoje ou uma próxima data para o novo contato.');
 const result=await run('INSERT INTO contract_contacts(contract_id,actor_id,contact_date,notes,next_contact,created_at) VALUES(?,?,?,?,?,?)',id,u.id,today,notes,next,new Date().toISOString());
 await run('UPDATE active_contracts SET next_contact=?,version=version+1 WHERE id=?',next,id);await log(u,'registrar contato',id,{contact_id:Number(result.lastInsertRowid),notes,next_contact:next});return Number(result.lastInsertRowid);
}
async function customerReport(id){
 const contract=await readContract(id);
 const appointments=(await query('SELECT a.*,p.name pump_name FROM appointments a LEFT JOIN pumps p ON p.id=a.pump_id WHERE a.seller_id=? ORDER BY a.date,a.start,a.id',contract.seller_id)).filter(a=>customerKey(a.customer)===customerKey(contract.customer));
 const ids=new Set(appointments.map(a=>a.id)),events=(await query('SELECT e.*,u.name actor_name FROM appointment_events e LEFT JOIN users u ON u.id=e.actor_id WHERE e.seller_id=? ORDER BY e.created_at DESC,e.id DESC',contract.seller_id)).filter(e=>ids.has(e.appointment_id));
 return {customer:contract.customer,seller_id:contract.seller_id,seller_name:contract.seller_name,appointments,events,totals:{scheduled:appointments.length,rescheduled:events.filter(e=>e.kind==='remarcado').length,cancelled:events.filter(e=>e.kind==='cancelado').length,currently_cancelled:appointments.filter(a=>a.status==='cancelado').length,planned:appointments.reduce((n,a)=>n+a.planned_volume,0),active_planned:appointments.filter(a=>a.status!=='cancelado').reduce((n,a)=>n+a.planned_volume,0),delivered:appointments.reduce((n,a)=>n+(a.delivered_volume||0),0),missing:appointments.filter(a=>a.delivered_volume===null).length}};
}
export async function contractsApi({path,method,url,u,body,createAppointment}){
 if(!['programador','gerente','controlador'].includes(u.role))fail('Sem permissão para contratos ativos.',403);
 if(path==='/api/contracts/customer-info'&&method==='GET'){
  const customer=await one('SELECT * FROM customers WHERE id=?',Number(url.searchParams.get('id')));if(!customer)fail('Cliente não encontrado.',404);
  const works=(await query('SELECT * FROM appointments WHERE seller_id=? ORDER BY date DESC,start DESC,id DESC',customer.seller_id)).filter(a=>customerKey(a.customer)===customer.name_key);
  return {customer,addresses:await customerAddresses(customer.id,u),completed:works.filter(a=>a.status==='concluido'&&a.date<=contractToday()&&a.delivered_volume>0)};
 }
 if(path==='/api/contracts/report'&&method==='GET'){
  const date=day(url.searchParams.get('date'));
  const rows=await query(`SELECT b.*,a.date current_date,a.start current_start,a.status current_status,c.contact_date,c.notes contact_notes,u.name actor_name FROM contract_bookings b JOIN contract_contacts c ON c.id=b.contact_id JOIN appointments a ON a.id=b.appointment_id JOIN users u ON u.id=b.actor_id WHERE c.contact_date=? ORDER BY b.booked_at,b.id`,date);
  return {date,rows:rows.map(row=>({...JSON.parse(row.snapshot_json),...row,snapshot_json:undefined}))};
 }
 if(path==='/api/contracts'&&method==='GET'){
  const status=url.searchParams.get('status')||'ativo';if(!['ativo','encerrado'].includes(status))fail('Filtro inválido.');
  const rows=(await query(contractSelect+' WHERE k.status=? ORDER BY k.next_contact,k.id',status)).map(contractView);
  const delivered=await query("SELECT * FROM appointments WHERE status='concluido' AND date<=? AND delivered_volume>0 ORDER BY date DESC,start DESC,id DESC",contractToday());
  const linked=await query('SELECT contract_id,appointment_id FROM contract_bookings');
  for(const row of rows){const ids=new Set(linked.filter(b=>b.contract_id===row.id).map(b=>b.appointment_id));const last=delivered.find(a=>ids.has(a.id)||(a.seller_id===row.seller_id&&customerKey(a.customer)===customerKey(row.customer)&&customerKey(a.work)===customerKey(row.address)));if(last&&(!row.last_date||last.date>=row.last_date)){row.last_piece=last.piece;row.last_date=last.date;row.last_volume=last.delivered_volume;}row.due=row.next_contact<=contractToday()&&row.status==='ativo';}
  return rows;
 }
 if(path==='/api/contracts'&&method==='POST')return transaction(async()=>{
  const data=await fields(await body()),keys=Object.keys(data),result=await run(`INSERT INTO active_contracts(${keys.join(',')},created_by) VALUES(${keys.map(()=>'?').join(',')},?)`,...Object.values(data),u.id),id=Number(result.lastInsertRowid);await log(u,'criar contrato',id,data);return {id};
 });
 const match=path.match(/^\/api\/contracts\/(\d+)(?:\/(contacts|bookings|close|customer-report))?$/);if(!match)fail('Recurso não encontrado.',404);const id=Number(match[1]),action=match[2];
 if(method==='GET'&&action==='customer-report')return customerReport(id);
 if(method==='GET'&&!action){const row=await readContract(id);return {...row,contacts:await query('SELECT c.*,u.name actor_name FROM contract_contacts c JOIN users u ON u.id=c.actor_id WHERE contract_id=? ORDER BY c.id DESC',id),bookings:await query('SELECT a.*,b.booked_at,p.name pump_name FROM contract_bookings b JOIN appointments a ON a.id=b.appointment_id LEFT JOIN pumps p ON p.id=a.pump_id WHERE b.contract_id=? ORDER BY b.id DESC',id)};}
 if(method==='POST'||method==='PATCH')return transaction(async()=>{
  const b=await body(),old=await editable(id,b);
  if(action==='contacts'&&method==='POST')return {id:await contact(id,b,u)};
  if(action==='close'&&method==='POST'){const reason=text(b.reason,'o motivo de encerramento',1000);await run("UPDATE active_contracts SET status='encerrado',closed_at=?,closed_by=?,close_reason=?,version=version+1 WHERE id=?",new Date().toISOString(),u.id,reason,id);await log(u,'encerrar contrato',id,{reason});return {ok:true};}
  if(action==='bookings'&&method==='POST'){
   const contactId=await contact(id,b,u),appointmentId=await createAppointment({...b,customer:old.customer,work:old.address,seller_id:old.seller_id,contact_name:old.contact_name,contact_phone:old.contact_phone},u),appointment=await one('SELECT * FROM appointments WHERE id=?',appointmentId);
   const customer=await one('SELECT id FROM customers WHERE seller_id=? AND name_key=?',old.seller_id,customerKey(old.customer));if(customer)await run('UPDATE active_contracts SET customer_id=? WHERE id=?',customer.id,id);
   await run('INSERT INTO contract_bookings(contract_id,contact_id,appointment_id,actor_id,booked_at,snapshot_json) VALUES(?,?,?,?,?,?)',id,contactId,appointmentId,u.id,new Date().toISOString(),JSON.stringify({...appointment,work_name:old.work_name,seller_name:old.seller_name}));await log(u,'agendar contrato',id,{appointment_id:appointmentId,contact_id:contactId});return {id:appointmentId};
  }
  if(!action&&method==='PATCH'){const data=await fields(b);await run(`UPDATE active_contracts SET ${Object.keys(data).map(k=>k+'=?').join(',')},version=version+1 WHERE id=?`,...Object.values(data),id);await log(u,'editar contrato',id,{before:old,after:data});return {ok:true};}
  fail('Operação inválida.',405);
 });
 fail('Operação inválida.',405);
}
