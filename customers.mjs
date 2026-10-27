import {run,one,query} from './storage.mjs';
export const customerName=value=>String(value||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('pt-BR');
export const customerKey = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
export const CUSTOMER_UPSERT = `INSERT INTO customers(seller_id,name,name_key,work,gravel,resistance,piece,notes,planned_volume,trips,duration,type,load_capacity,contact_name,contact_phone,slump,work_name,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(seller_id,name_key) DO UPDATE SET name=excluded.name,work=excluded.work,gravel=excluded.gravel,resistance=excluded.resistance,piece=excluded.piece,notes=excluded.notes,planned_volume=excluded.planned_volume,trips=excluded.trips,duration=excluded.duration,type=excluded.type,load_capacity=excluded.load_capacity,contact_name=excluded.contact_name,contact_phone=excluded.contact_phone,slump=excluded.slump,work_name=excluded.work_name,updated_at=excluded.updated_at`;
export const customerArgs = (data,seller,stamp=new Date().toISOString()) => [seller,customerName(data.customer),customerKey(data.customer),data.work,data.gravel,data.resistance,data.piece,data.notes||'',data.planned_volume,data.trips||0,data.duration,data.type,data.load_capacity||9,data.contact_name||'',data.contact_phone||'',data.slump||'',data.work_name||'',stamp];
export async function saveCustomer(data,seller) {await run(CUSTOMER_UPSERT,...customerArgs(data,seller));}

export async function customerAddresses(id,user){return [...new Set((await customerWorks(id,user)).map(work=>work.address))];}

export async function customerWorks(id,user){
 const client=await one('SELECT * FROM customers WHERE id=?',id);
 if(!client||(user.role==='vendedor'&&client.seller_id!==user.id))throw Object.assign(new Error('Cliente não encontrado.'),{status:404});
 const rows=await query('SELECT customer,work,work_name,created_at,id FROM appointments WHERE seller_id=? UNION ALL SELECT customer,work,work_name,created_at,id FROM requests WHERE seller_id=? ORDER BY created_at DESC,id DESC',client.seller_id,client.seller_id);
 const contracts=(await query("SELECT k.address,k.work_name,k.customer,k.seller_id,c.name registered_name,c.seller_id registered_seller_id FROM active_contracts k LEFT JOIN customers c ON c.id=k.customer_id WHERE COALESCE(c.seller_id,k.seller_id)=?",client.seller_id)).filter(c=>customerKey(c.registered_name||c.customer)===client.name_key);
 const unique=new Map();
 for(const row of [{work:client.work,work_name:client.work_name},...rows.filter(r=>customerKey(r.customer)===client.name_key),...contracts.map(c=>({work:c.address,work_name:c.work_name}))]){
  const address=String(row.work||'').trim(),names=[...new Set(contracts.filter(c=>customerKey(c.address)===customerKey(address)).map(c=>c.work_name))],name=row.work_name||(names.length===1?names[0]:''),key=JSON.stringify([customerKey(address),customerKey(name)]);
  if(address&&!unique.has(key))unique.set(key,{address,work_name:name});
 }
 const works=[...unique.values()];return works.filter(w=>w.work_name||!works.some(other=>other.work_name&&customerKey(other.address)===customerKey(w.address)));
}
