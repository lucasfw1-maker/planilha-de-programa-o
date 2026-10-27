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
