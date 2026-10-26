import {query, one, run} from './storage.mjs';

export const localDay = value => new Intl.DateTimeFormat('en-CA', {
  timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'
}).format(value);
export const searchName = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
export function changeKind(before, after) {
  if(before.status!=='cancelado' && after.status==='cancelado')return 'cancelado';
  if(after.status!=='cancelado' && (before.status==='cancelado' || ['date','start','duration','type','pump_id'].some(key=>before[key]!==after[key])))return 'remarcado';
  return null;
}
export async function recordChange(user, before, after, reason) {
  const kind=changeKind(before,after);
  if(!kind)return;
  const names=await query('SELECT id,name FROM pumps WHERE id=? OR id=?',before.pump_id,after.pump_id);
  const seller=await one('SELECT name FROM users WHERE id=?',before.seller_id);
  const snapshot=a=>({...a,pump_name:names.find(p=>p.id===a.pump_id)?.name||null,seller_name:seller?.name||''});
  const now=new Date();
  await run(`INSERT INTO appointment_events(appointment_id,kind,reason,actor_id,customer,customer_search,work,seller_id,planned_volume,before_json,after_json,event_date,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    before.id,kind,reason,user.id,before.customer,searchName(before.customer),before.work,before.seller_id,before.planned_volume,
    JSON.stringify(snapshot(before)),JSON.stringify(snapshot(after)),localDay(now),now.toISOString());
}
