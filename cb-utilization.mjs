import {query} from './storage.mjs';import {fleetRange} from './fleet.mjs';
import cbEstimate from './public/cb-estimate.js';
export const estimatedCBs=cbEstimate.estimatedCBs;
const minute=time=>Number(time.slice(0,2))*60+Number(time.slice(3));
export function cbPeriodSummary(rows,available,from,to){
 const works=rows.filter(r=>minute(r.start)<to&&minute(r.start)+Number(r.duration)>from),required=works.reduce((sum,r)=>sum+cbEstimate.requiredCBs(r),0),alert=required>0&&required>=available;
 return {required,works:works.length,available,free:Math.max(0,available-required),shortage:Math.max(0,required-available),alert,level:alert?(required>available?'exceeded':'full'):'available'};
}
export async function cbUtilization(date){const [fleet,rows]=await Promise.all([fleetRange(date,date),query("SELECT id,start,duration,planned_volume,cb_demand_override FROM appointments WHERE date=? AND status<>'cancelado' ORDER BY start,id",date)]),day=fleet.days[0];return {date,available:day.trucks,roster_applied:day.roster_applied,morning:cbPeriodSummary(rows,day.morning_trucks,0,720),afternoon:cbPeriodSummary(rows,day.afternoon_trucks,720,1440)};}
