import {fleetRange} from './fleet.mjs';
import {cbPeriodSummary} from './cb-utilization.mjs';
import {query,one} from './storage.mjs';
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
const minute=value=>Number(value.slice(0,2))*60+Number(value.slice(3));
const time=value=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
export function availabilityMonthBounds(month){
 if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1900||Number(month.slice(0,4))>9998)fail('Informe um mês válido.');
 const last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10);
 return {from:month+'-01',to:last,next:new Date(Date.parse(last+'T00:00:00Z')+86400000).toISOString().slice(0,10)};
}
export function availabilityWorkingWindow(start='07:00',end='18:00'){
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||minute(end)<=minute(start))fail('O fim da jornada deve ser depois do início, no mesmo dia.');
 return {start,end,from:minute(start),to:minute(end)};
}
export function mergeAvailabilityWindows(windows,from,to){
 const sorted=windows.map(([a,b])=>[Math.max(from,a),Math.min(to,b)]).filter(([a,b])=>a<b).sort((a,b)=>a[0]-b[0]),merged=[];
 for(const [a,b]of sorted){const last=merged.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else merged.push([a,b]);}return merged;
}
export function buildAvailabilityCalendar({month,pumps,appointments,maintenance,buffer=30,start='07:00',end='18:00',equipment='all'}){
 if(!['all','bl','bm'].includes(equipment))fail('Selecione um tipo de equipamento válido.');
 const bounds=availabilityMonthBounds(month),window=availabilityWorkingWindow(start,end),kind=name=>String(name).match(/^\s*(BL|BM)(?=\d|\s|[-.•]|$)/i)?.[1]?.toLowerCase(),active=pumps.filter(p=>p.active===1&&(equipment==='all'||kind(p.name)===equipment)),activeIds=new Set(active.map(p=>p.id)),days=[];
 for(let date=bounds.from;date<=bounds.to;date=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10)){
  const works=appointments.filter(a=>a.date===date&&a.status!=='cancelado'&&(equipment==='all'||a.type==='bomba'&&activeIds.has(a.pump_id))),dayStart=Date.parse(date+'T00:00:00Z');
  const rows=active.map(p=>{
   const booked=works.filter(a=>a.type==='bomba'&&Number(a.pump_id)===p.id).map(a=>[minute(a.start)-buffer,minute(a.start)+Number(a.duration)+buffer]);
   const periods=maintenance.filter(m=>m.pump_id===p.id&&!m.cancelled_at).map(m=>[(Date.parse(m.starts_at+'Z')-dayStart)/60000,(Date.parse(m.ends_at+'Z')-dayStart)/60000]);
   if(p.maintenance)periods.push([window.from,window.to]);
   const blocked=mergeAvailabilityWindows([...booked,...periods],window.from,window.to),free=[];let cursor=window.from;
   for(const [a,b]of blocked){if(a>cursor)free.push({start:time(cursor),end:time(a),minutes:a-cursor});cursor=Math.max(cursor,b);}if(cursor<window.to)free.push({start:time(cursor),end:time(window.to),minutes:window.to-cursor});
   return {id:p.id,name:p.name,blocked_minutes:blocked.reduce((n,[a,b])=>n+b-a,0),maintenance:mergeAvailabilityWindows(periods,window.from,window.to).length>0,free_windows:free};
  });
  const capacity=active.length*(window.to-window.from),blocked=rows.reduce((n,p)=>n+p.blocked_minutes,0),ratio=capacity?blocked/capacity:0;
  days.push({date,status:!capacity?'unavailable':blocked>=capacity?'full':ratio>.65?'busy':'free',percentage:Math.round(ratio*1000)/10,occupied_minutes:blocked,capacity_minutes:capacity,works,pumps:rows});
 }
 return {month,equipment,...bounds,day_start:start,day_end:end,buffer,pump_count:active.length,days};
}
export async function availabilityCalendarData({month,start='07:00',end='18:00',user,manager,equipment='all'}){
 const {from,to,next}=availabilityMonthBounds(month);availabilityWorkingWindow(start,end);if(!['all','bl','bm'].includes(equipment))fail('Selecione um tipo de equipamento válido.');
 const [pumps,appointments,maintenance,setting,fleet]=await Promise.all([
  query('SELECT id,name,active,maintenance FROM pumps WHERE active=1 ORDER BY name'),
  query("SELECT a.id,a.date,a.start,a.duration,a.type,a.pump_id,a.customer,a.work_name,a.seller_id,a.status,a.planned_volume,a.cb_demand_override,u.name seller_name,p.name pump_name FROM appointments a JOIN users u ON u.id=a.seller_id LEFT JOIN pumps p ON p.id=a.pump_id WHERE a.date BETWEEN ? AND ? AND a.status<>'cancelado' ORDER BY a.date,a.start,a.id",from,to),
  query('SELECT pump_id,starts_at,ends_at FROM maintenance_periods WHERE cancelled_at IS NULL AND starts_at<? AND ends_at>?',next+'T00:00',from+'T00:00'),
  one("SELECT value FROM settings WHERE key='buffer_minutes'"),
  fleetRange(from,to)
 ]);
 const visible=appointments.map(({planned_volume,cb_demand_override,...a})=>({...a,work_name:manager||a.seller_id===user.id?a.work_name:undefined}));
 const result=buildAvailabilityCalendar({month,pumps,appointments:visible,maintenance,buffer:Number(setting?.value??30),start,end,equipment}),byDate=new Map(fleet.days.map(d=>[d.date,d]));
 for(const day of result.days){const f=byDate.get(day.date),works=appointments.filter(a=>a.date===day.date);day.cbs={roster_applied:f.roster_applied,morning:cbPeriodSummary(works,f.morning_trucks,0,720),afternoon:cbPeriodSummary(works,f.afternoon_trucks,720,1440)};}
 return result;
}
