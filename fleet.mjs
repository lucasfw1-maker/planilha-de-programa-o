import {query} from './storage.mjs';
export function estimateTrips(volume,capacity=9){
  const value=Number(capacity);
  if(![8,9,10].includes(value))throw Object.assign(new Error('Escolha 8, 9 ou 10 m³ para estimar as viagens.'),{status:400});
  return {load_capacity:value,trips:Math.ceil(Number(volume)/value)};
}
export async function fleetRange(from,to){
  const start=new Date(from+'T12:00:00Z'),end=new Date(to+'T12:00:00Z');
  if(end<start || (end-start)/86400000>365)throw Object.assign(new Error('Informe um período de até 366 dias, em ordem crescente.'),{status:400});
  const defaults=await query('SELECT effective_date,trucks FROM fleet_defaults WHERE effective_date<=? ORDER BY effective_date',to);
  const overrides=await query('SELECT date,trucks FROM fleet_days WHERE date BETWEEN ? AND ?',from,to);
  const byDate=new Map(overrides.map(r=>[r.date,r.trucks])),days=[];
  for(const cursor=new Date(start);cursor<=end;cursor.setUTCDate(cursor.getUTCDate()+1)){
    const date=cursor.toISOString().slice(0,10);
    const base=defaults.filter(r=>r.effective_date<=date).at(-1)?.trucks??17;
    days.push({date,trucks:byDate.has(date)?byDate.get(date):base,default_trucks:base,override:byDate.has(date)});
  }
  return {days,truck_days:days.reduce((sum,d)=>sum+d.trucks,0)};
}
