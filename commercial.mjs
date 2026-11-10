import bookingInformation from './public/booking-information.js';
import {withContractWorkNames} from './contracts.mjs';
import {query} from './storage.mjs';
import {customerKey} from './customers.mjs';
export function commercialCode(value,label){
  if(value===undefined||value===null)return '';
  if(typeof value!=='string'||value.length>60||!/^[A-Za-z0-9._-]*$/.test(value.trim()))throw Object.assign(new Error(`${label}: use até 60 letras, números, pontos, hífens ou sublinhados.`),{status:400});
  return value.trim();
}
// Only reuse a code from the same seller, customer and work address.
export async function savedCustomerCode(name,seller,work){
 if(!String(work||'').trim())return '';
 const rows=await query("SELECT customer,work,customer_code FROM appointments WHERE seller_id=? AND customer_code<>'' ORDER BY id DESC",seller);
 return rows.find(a=>customerKey(a.customer)===customerKey(name)&&customerKey(a.work)===customerKey(work))?.customer_code||'';
}
export async function withCustomerCodes(rows){
 // Existing appointments keep their own code; customer defaults cannot fill another work.
 return withContractWorkNames(rows);
}

export async function bookingInformationSummary(user,now=new Date()){
 const current=bookingInformation.clock(now),date=bookingInformation.nextDate(current.date),slot=current.slot;
 if(!['vendedor','controlador'].includes(user.role))return {date,slot:null,pending:0,rows:[]};
 const rows=await withCustomerCodes(await query(`SELECT a.*,u.name seller_name FROM appointments a JOIN users u ON u.id=a.seller_id WHERE a.date=? AND a.status NOT IN ('cancelado','remarcado') ${user.role==='vendedor'?'AND a.seller_id=?':''} ORDER BY a.start,a.id`,date,...(user.role==='vendedor'?[user.id]:[])));
 const pending=rows.filter(a=>!bookingInformation.complete(a)).map(a=>({id:a.id,customer:a.customer,work_name:a.work_name,work:a.work,date:a.date,start:a.start,seller_name:a.seller_name,missing:bookingInformation.missing(a)}));
 return {date,slot,pending:pending.length,rows:pending};
}
