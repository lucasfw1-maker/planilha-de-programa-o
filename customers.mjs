import {run,one,query} from './storage.mjs';
export const customerName=value=>String(value||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('pt-BR');
export const customerKey = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
export const CUSTOMER_UPSERT = `INSERT INTO customers(seller_id,name,name_key,work,gravel,resistance,piece,notes,planned_volume,trips,duration,type,load_capacity,contact_name,contact_phone,slump,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(seller_id,name_key) DO UPDATE SET name=excluded.name,work=excluded.work,gravel=excluded.gravel,resistance=excluded.resistance,piece=excluded.piece,notes=excluded.notes,planned_volume=excluded.planned_volume,trips=excluded.trips,duration=excluded.duration,type=excluded.type,load_capacity=excluded.load_capacity,contact_name=excluded.contact_name,contact_phone=excluded.contact_phone,slump=excluded.slump,updated_at=excluded.updated_at`;
export const customerArgs = (data,seller,stamp=new Date().toISOString()) => [seller,customerName(data.customer),customerKey(data.customer),data.work,data.gravel,data.resistance,data.piece,data.notes||'',data.planned_volume,data.trips||0,data.duration,data.type,data.load_capacity||9,data.contact_name||'',data.contact_phone||'',data.slump||'',stamp];
export async function saveCustomer(data,seller) {await run(CUSTOMER_UPSERT,...customerArgs(data,seller));}

export async function customerAddresses(id,user){
 const client=await one('SELECT * FROM customers WHERE id=?',id);
 if(!client||(user.role==='vendedor'&&client.seller_id!==user.id))throw Object.assign(new Error('Cliente não encontrado.'),{status:404});
 const rows=await query('SELECT customer,work,created_at FROM appointments WHERE seller_id=? UNION ALL SELECT customer,work,created_at FROM requests WHERE seller_id=? ORDER BY created_at DESC',client.seller_id,client.seller_id);
 const unique=new Map();
 for(const work of [client.work,...rows.filter(row=>customerKey(row.customer)===client.name_key).map(row=>row.work)]){
  const address=String(work||'').trim();
  if(address&&!unique.has(customerKey(address)))unique.set(customerKey(address),address);
 }
 return [...unique.values()];
}
