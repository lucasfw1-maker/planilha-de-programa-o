import {createHash} from 'node:crypto';
import {one,query,run,transaction} from './storage.mjs';
import {customerKey,customerName} from './customers.mjs';
import {searchName} from './changes.mjs';

const reject=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const chunks=function*(items){for(let offset=0;offset<items.length;offset+=250)yield items.slice(offset,offset+250);};

async function readEdit(id,input={}){
 const customer=await one('SELECT c.*,u.name seller_name FROM customers c JOIN users u ON u.id=c.seller_id WHERE c.id=?',id);
 if(!customer)reject('Cliente não encontrado. Atualize a lista.',404);
 const raw=input.name===undefined?customer.name:input.name;
 if(typeof raw!=='string'||!raw.trim()||raw.length>200)reject('Informe o nome do cliente com até 200 caracteres.');
 const name=customerName(raw),nameKey=customerKey(name),sellerId=Number(input.seller_id??customer.seller_id);
 if(!Number.isInteger(sellerId)||sellerId<1)reject('Selecione um vendedor válido.');
 if(sellerId!==customer.seller_id&&!await one("SELECT id FROM users WHERE id=? AND role='vendedor' AND active=1 AND status='aprovado'",sellerId))reject('Selecione um vendedor ativo e aprovado.');
 const destination=await one('SELECT c.*,u.name seller_name FROM customers c JOIN users u ON u.id=c.seller_id WHERE c.seller_id=? AND c.name_key=? AND c.id<>?',sellerId,nameKey,id);
 const owners=[...new Set(destination?[customer.seller_id,sellerId]:[customer.seller_id])],marks=owners.map(()=>'?').join(',');
 const matches=row=>(row.seller_id===customer.seller_id&&customerKey(row.customer)===customer.name_key)||(destination&&row.seller_id===sellerId&&customerKey(row.customer)===destination.name_key);
 const appointments=(await query(`SELECT id,customer,seller_id,date,status,information_version,customer_code FROM appointments WHERE seller_id IN (${marks}) ORDER BY id`,...owners)).filter(matches);
 const requests=(await query(`SELECT id,customer,seller_id,status FROM requests WHERE seller_id IN (${marks}) ORDER BY id`,...owners)).filter(matches);
 const events=[];
 for(const batch of chunks(appointments.map(a=>a.id)))events.push(...await query(`SELECT id,appointment_id FROM appointment_events WHERE appointment_id IN (${batch.map(()=>'?').join(',')}) ORDER BY id`,...batch));
 const proposed={name,name_key:nameKey,seller_id:sellerId};
 const token=createHash('sha256').update(JSON.stringify({customer,destination:destination||null,proposed,appointments,requests,events})).digest('hex');
 return {customer,destination:destination||null,proposed,appointments,requests,events,token};
}
function publicPreview(edit){return {customer:edit.customer,destination:edit.destination,proposed:edit.proposed,preview_token:edit.token,counts:{appointments:edit.appointments.length,requests:edit.requests.length,events:edit.events.length},changed:edit.proposed.name!==edit.customer.name||edit.proposed.seller_id!==edit.customer.seller_id};}
export async function customerEditPreview(id,input,actor){
 if(actor.role!=='programador')reject('Somente o Programador pode editar nome e vendedor do cliente.',403);
 return publicPreview(await readEdit(id,input));
}
export async function editCustomer(id,input,actor){
 if(actor.role!=='programador')reject('Somente o Programador pode editar nome e vendedor do cliente.',403);
 return transaction(async()=>{
  const edit=await readEdit(id,input),preview=publicPreview(edit);
  if(typeof input.preview_token!=='string'||input.preview_token!==edit.token)reject('O cadastro ou suas obras foram atualizados. Confira a prévia novamente antes de salvar.',409);
  if(!preview.changed)reject('Altere o nome do cliente ou o vendedor responsável.');
  if(edit.destination&&input.merge_existing!==true)reject('Já existe um cadastro no destino. Confira a prévia para unificar os clientes.',409);
  const {customer,destination,proposed}=edit,stamp=new Date().toISOString();
  const sourceWorks=edit.appointments.filter(a=>a.seller_id===customer.seller_id&&customerKey(a.customer)===customer.name_key),sourceIds=new Set(sourceWorks.map(a=>a.id));
  const groups=[{rows:sourceWorks,code:customer.customer_code},{rows:edit.appointments.filter(a=>!sourceIds.has(a.id)),code:destination?.customer_code}];
  // Preserve codes previously inherited from each customer before merging their default data.
  for(const group of groups)for(const batch of chunks(group.rows.map(a=>a.id)))await run(`UPDATE appointments SET customer=?,seller_id=?,customer_code=CASE WHEN customer_code='' THEN ? ELSE customer_code END,information_version=information_version+1 WHERE id IN (${batch.map(()=>'?').join(',')})`,proposed.name,proposed.seller_id,group.code||'',...batch);
  for(const batch of chunks(edit.requests.map(r=>r.id)))await run(`UPDATE requests SET customer=?,seller_id=? WHERE id IN (${batch.map(()=>'?').join(',')})`,proposed.name,proposed.seller_id,...batch);
  // Current report attribution follows the client; original event snapshots and actors remain intact.
  for(const batch of chunks(edit.events.map(e=>e.id)))await run(`UPDATE appointment_events SET customer=?,customer_search=?,seller_id=? WHERE id IN (${batch.map(()=>'?').join(',')})`,proposed.name,searchName(proposed.name),proposed.seller_id,...batch);
  let resultId=customer.id;
  if(destination){
   const latest=(Date.parse(customer.updated_at)||0)>(Date.parse(destination.updated_at)||0)?customer:destination;
   const defaults=['work','gravel','resistance','slump','piece','notes','planned_volume','trips','duration','type','load_capacity','customer_code','contact_name','contact_phone'];
   await run('DELETE FROM customers WHERE id=?',customer.id);
   await run(`UPDATE customers SET name=?,name_key=?,${defaults.map(field=>field+'=?').join(',')},updated_at=? WHERE id=?`,proposed.name,proposed.name_key,...defaults.map(field=>latest[field]),stamp,destination.id);
   resultId=destination.id;
  }else await run('UPDATE customers SET name=?,name_key=?,seller_id=?,updated_at=? WHERE id=?',proposed.name,proposed.name_key,proposed.seller_id,stamp,customer.id);
  await run('INSERT INTO audit(user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',actor.id,'editar cliente','cliente',resultId,JSON.stringify({before:customer,destination_before:destination,after:await one('SELECT * FROM customers WHERE id=?',resultId),counts:preview.counts,appointment_ids:edit.appointments.map(a=>a.id),request_ids:edit.requests.map(r=>r.id)}));
  return {ok:true,customer_id:resultId,counts:preview.counts,merged:Boolean(destination)};
 });
}
