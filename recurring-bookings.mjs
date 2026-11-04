import {query,one,transaction} from './storage.mjs';
import {readContract,createContractAppointments} from './contracts.mjs';
import {createHash} from 'node:crypto';
import recurring from './public/recurring-bookings.js';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function recurringBookingsApi({u,b,preview,fields,checkSeller,checkPump,createAppointment,conventionalWarnings,audit}){
 if(!b||typeof b!=='object'||Array.isArray(b))fail('Confira os dados da repetição.');
 const signature=createHash('sha256').update(JSON.stringify(b)).digest('hex');
 if(!preview&&(typeof b.token!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(b.token)))fail('Abra novamente a repetição para confirmar os agendamentos.');
 async function prepare(){
  if(!b.common||Array.isArray(b.common)||!Array.isArray(b.occurrences)||!b.occurrences.length||b.occurrences.length>31)fail('Selecione de 1 a 31 dias para repetir.');
  let common={...b.common};
  if(b.contract_id){const c=await readContract(Number(b.contract_id));if(c.status!=='ativo'||Number(b.contract_version)!==c.version)fail('O contrato mudou. Abra novamente antes de repetir.',409);Object.assign(common,{customer:c.customer,work:c.address,work_name:c.work_name,seller_id:c.seller_id,contact_name:c.contact_name,contact_phone:c.contact_phone,expected_version:c.version});}
  fields(common);await checkSeller(common.seller_id);
  const allowed=new Set(recurring.dates(common.date,b.period,b.includeSaturday)),seen=new Set();
  const rows=b.occurrences.map(row=>{if(!row||!allowed.has(row.date)||seen.has(row.date))fail('Confira as datas da repetição: não inclua domingos, dias repetidos ou datas fora do período.');seen.add(row.date);return {...common,date:row.date,start:row.start,duration:row.duration,pump_id:row.pump_id};});
  return {common,rows};
 }
 async function validate(row){const data=fields(row);const weekday=new Date(data.date+'T12:00:00Z').getUTCDay();if(weekday===6&&Number(data.start.slice(0,2))*60+Number(data.start.slice(3))+data.duration>720)fail('No sábado, o atendimento deve terminar até 12:00.');await checkPump({...data,pump_id:row.pump_id});return conventionalWarnings(row);}
 if(preview){const {rows}=await prepare(),result=[];for(const row of rows){try{result.push({date:row.date,ok:true,warnings:await validate(row)});}catch(e){if(!e.status)throw e;result.push({date:row.date,ok:false,message:e.message});}}return {rows:result,valid:result.every(r=>r.ok),count:result.length};}
 return transaction(async()=>{
  const replay=await one("SELECT detail FROM audit WHERE user_id=? AND entity='repeticao' AND action='criar' AND json_extract(detail,'$.token')=?",u.id,b.token);
  if(replay){const saved=JSON.parse(replay.detail);if(saved.signature!==signature)fail('Esta repetição já foi criada. Abra uma nova programação.',409);return {ids:saved.ids,count:saved.ids.length,replayed:true};}
  const {common,rows}=await prepare();for(const row of rows){try{await validate(row);}catch(e){if(!e.status)throw e;fail(`${row.date}: ${e.message}`,e.status);}}
  const ids=[];if(b.contract_id)ids.push(...await createContractAppointments(Number(b.contract_id),common,u,createAppointment,rows));else for(const row of rows)ids.push(await createAppointment(row,u));
  await audit(u,'criar','repeticao',0,{token:b.token,signature,ids});return {ids,count:ids.length};
 });
}
