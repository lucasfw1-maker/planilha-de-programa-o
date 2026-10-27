import {query,one} from './storage.mjs';
export function estimateTrips(volume,capacity=9){
  const value=Number(capacity);
  if(![8,9,10].includes(value))throw Object.assign(new Error('Escolha 8, 9 ou 10 m³ para estimar as viagens.'),{status:400});
  return {load_capacity:value,trips:Math.ceil(Number(volume)/value)};
}
export async function fleetRange(from,to,branch=''){
  const start=new Date(from+'T12:00:00Z'),end=new Date(to+'T12:00:00Z');
  if(end<start || (end-start)/86400000>365)throw Object.assign(new Error('Informe um período de até 366 dias, em ordem crescente.'),{status:400});
  const defaults=await query('SELECT effective_date,trucks FROM fleet_defaults WHERE effective_date<=? ORDER BY effective_date',to);
  const overrides=await query('SELECT date,trucks FROM fleet_days WHERE date BETWEEN ? AND ?',from,to);
  const registered=await one("SELECT value FROM settings WHERE key='fleet_registry_since'"),history=await query('SELECT * FROM cb_fleet_history WHERE effective_date<=? ORDER BY effective_date',to),jobs=await query("SELECT j.cb_id,j.starts_at,j.ends_at FROM maintenance_jobs j WHERE j.status='confirmado' AND j.equipment_type='cb' AND j.starts_at<? AND j.ends_at>?",new Date(Date.parse(to+'T00:00:00Z')+86400000).toISOString().slice(0,10)+'T00:00',from+'T00:00');
  const byDate=new Map(overrides.map(r=>[r.date,r.trucks])),days=[];
  for(const cursor=new Date(start);cursor<=end;cursor.setUTCDate(cursor.getUTCDate()+1)){
    const date=cursor.toISOString().slice(0,10);
    const base=defaults.filter(r=>r.effective_date<=date).at(-1)?.trucks??17;
    const roster=new Map();for(const event of history)if(event.effective_date<=date)roster.set(event.cb_id,event);const activeIds=new Set([...roster.values()].filter(cb=>cb.active&&(!branch||cb.branch===branch)).map(cb=>cb.cb_id));
    const registry=Boolean(branch||registered&&date>=registered.value),configured=registry?activeIds.size:(byDate.has(date)?byDate.get(date):base),next=new Date(cursor);next.setUTCDate(next.getUTCDate()+1);const out=new Set(jobs.filter(j=>activeIds.has(j.cb_id)&&j.starts_at<next.toISOString().slice(0,10)+'T00:00'&&j.ends_at>date+'T00:00').map(j=>j.cb_id)).size;
    days.push({date,trucks:Math.max(0,configured-out),configured_trucks:configured,maintenance_trucks:out,registry,default_trucks:registry?configured:base,override:!registry&&byDate.has(date)});
  }
  return {days,truck_days:days.reduce((sum,d)=>sum+d.trucks,0)};
}
