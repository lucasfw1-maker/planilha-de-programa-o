import {one,query} from './storage.mjs';
export function checkMonth(value){
  if(typeof value!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))throw Object.assign(new Error('Informe um mês válido.'),{status:400});
  return value;
}
export function projectionDays(month,reference,basis='mon_sat'){
  checkMonth(month);
  if(!['mon_sat','mon_fri','all'].includes(basis))throw Object.assign(new Error('Escolha os dias de operação.'),{status:400});
  const start=new Date(month+'-01T12:00:00Z'),end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);
  const days=[];
  for(const d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)){
    const key=d.toISOString().slice(0,10),w=d.getUTCDay(),operating=basis==='all'||(w!==0&&(basis!=='mon_fri'||w!==6));
    days.push({date:key,operating,remaining:operating&&key>=reference});
  }
  return days;
}
export async function monthlyProduction(month,options={}){
  checkMonth(month);
  const reference=options.reference||new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const basis=options.basis||'mon_sat',calendar=projectionDays(month,reference,basis),from=calendar[0].date,to=calendar.at(-1).date;
  const [grouped,goal,sellers]=await Promise.all([
    query("SELECT date,SUM(CASE WHEN status<>'cancelado' THEN planned_volume ELSE 0 END) programmed,COALESCE(SUM(delivered_volume),0) delivered,SUM(CASE WHEN status<>'cancelado' THEN 1 ELSE 0 END) works,SUM(CASE WHEN delivered_volume IS NOT NULL THEN 1 ELSE 0 END) informed,SUM(CASE WHEN status<>'cancelado' AND delivered_volume IS NULL THEN 1 ELSE 0 END) missing FROM appointments WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date",from,to),
    one('SELECT volume FROM monthly_goals WHERE month=?',month),
    query(`SELECT u.id,u.name,COALESCE(SUM(CASE WHEN a.status<>'cancelado' THEN a.planned_volume ELSE 0 END),0) programmed,COALESCE(SUM(a.delivered_volume),0) delivered,COUNT(a.id) works,SUM(CASE WHEN a.delivered_volume IS NOT NULL THEN 1 ELSE 0 END) informed,SUM(CASE WHEN a.status<>'cancelado' AND a.delivered_volume IS NULL THEN 1 ELSE 0 END) missing FROM users u LEFT JOIN appointments a ON a.seller_id=u.id AND a.date BETWEEN ? AND ? WHERE (u.role='vendedor' AND u.active=1 AND u.status='aprovado') OR a.id IS NOT NULL GROUP BY u.id,u.name ORDER BY programmed DESC,delivered DESC,u.name`,from,to)
  ]);
  const target=goal?.volume??null,lookup=new Map(grouped.map(d=>[d.date,d]));
  const daily=calendar.map(d=>({...d,...(lookup.get(d.date)||{programmed:0,delivered:0,works:0,informed:0,missing:0})}));
  const programmed=grouped.reduce((s,d)=>s+d.programmed,0),delivered=grouped.reduce((s,d)=>s+d.delivered,0),works=grouped.reduce((s,d)=>s+d.works,0),missing=grouped.reduce((s,d)=>s+d.missing,0);
  const remaining=target?Math.max(0,target-programmed):null,deliveryRemaining=target?Math.max(0,target-delivered):null,daysRemaining=calendar.filter(d=>d.remaining).length;
  return {month,target,programmed,delivered,works,missing,percent:target?programmed/target*100:null,remaining,remaining_percent:target?Math.max(0,100-programmed/target*100):null,surplus:target?Math.max(0,programmed-target):null,delivery_percent:target?delivered/target*100:null,delivery_remaining:deliveryRemaining,delivery_remaining_percent:target?Math.max(0,100-delivered/target*100):null,reference,basis,operating_days:calendar.filter(d=>d.operating).length,days_remaining:daysRemaining,required_programming_daily:target?(remaining===0?0:daysRemaining?remaining/daysRemaining:null):null,required_delivery_daily:target?(deliveryRemaining===0?0:daysRemaining?deliveryRemaining/daysRemaining:null):null,daily,sellers};
}

export async function monthlyGoalHistory(period='past',currentMonth=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date())){
 checkMonth(currentMonth);
 if(!['past','future'].includes(period))throw Object.assign(new Error('Escolha metas anteriores ou futuras.'),{status:400});
 const rows=await query(`SELECT g.month,g.volume target,COALESCE(SUM(CASE WHEN a.status<>'cancelado' THEN a.planned_volume ELSE 0 END),0) programmed,COALESCE(SUM(a.delivered_volume),0) delivered,SUM(CASE WHEN a.id IS NOT NULL AND a.status<>'cancelado' AND a.delivered_volume IS NULL THEN 1 ELSE 0 END) missing FROM monthly_goals g LEFT JOIN appointments a ON substr(a.date,1,7)=g.month WHERE g.month ${period==='past'?'<':'>'} ? GROUP BY g.month,g.volume ORDER BY g.month ${period==='past'?'DESC':'ASC'}`,currentMonth);
 return {period,current_month:currentMonth,rows:rows.map(row=>({...row,percent:row.programmed/row.target*100,delivery_percent:row.delivered/row.target*100}))};
}
