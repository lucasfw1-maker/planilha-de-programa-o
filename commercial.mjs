import bookingInformation from './public/booking-information.js';
import {withContractWorkNames} from './contracts.mjs';
import {query,one} from './storage.mjs';
import {customerKey} from './customers.mjs';
export function commercialCode(value,label){
  if(value===undefined||value===null)return '';
  if(typeof value!=='string'||value.length>60||!/^[A-Za-z0-9._-]*$/.test(value.trim()))throw Object.assign(new Error(`${label}: use até 60 letras, números, pontos, hífens ou sublinhados.`),{status:400});
  return value.trim();
}
export async function savedCustomerCode(name,seller){
  return (await one('SELECT customer_code FROM customers WHERE seller_id=? AND name_key=?',seller,customerKey(name)))?.customer_code||'';
}
export async function withCustomerCodes(rows){
  const sellers=[...new Set(rows.filter(a=>!a.customer_code).map(a=>a.seller_id))];
  if(!sellers.length)return withContractWorkNames(rows);
  const codes=await query(`SELECT seller_id,name_key,customer_code FROM customers WHERE seller_id IN (${sellers.map(()=>'?').join(',')}) AND customer_code<>''`,...sellers);
  const lookup=new Map(codes.map(c=>[c.seller_id+'|'+c.name_key,c.customer_code]));
  return withContractWorkNames(rows.map(a=>({...a,customer_code:a.customer_code||lookup.get(a.seller_id+'|'+customerKey(a.customer))||''})));
}

export async function bookingInformationSummary(user,now=new Date()){
 const {date,slot}=bookingInformation.clock(now);
 if(!['vendedor','controlador'].includes(user.role))return {date,slot:null,pending:0,rows:[]};
 const rows=await withCustomerCodes(await query(`SELECT a.*,u.name seller_name FROM appointments a JOIN users u ON u.id=a.seller_id WHERE a.date=? AND a.status NOT IN ('cancelado','remarcado') ${user.role==='vendedor'?'AND a.seller_id=?':''} ORDER BY a.start,a.id`,date,...(user.role==='vendedor'?[user.id]:[])));
 const pending=rows.filter(a=>!bookingInformation.complete(a)).map(a=>({id:a.id,customer:a.customer,work_name:a.work_name,work:a.work,date:a.date,start:a.start,seller_name:a.seller_name,missing:bookingInformation.missing(a)}));
 return {date,slot,pending:pending.length,rows:pending};
}
