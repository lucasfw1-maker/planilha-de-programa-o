const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
export async function migrateWorkNames(client){
 const tx=await client.transaction('write');
 try{
  if(!(await tx.execute("SELECT value FROM settings WHERE key='work_names_v1'")).rows.length){
   for(const table of ['appointments','requests','customers']){
    const columns=(await tx.execute('PRAGMA table_info('+table+')')).rows;
    if(!columns.some(c=>c.name==='work_name'))await tx.execute('ALTER TABLE '+table+" ADD COLUMN work_name TEXT NOT NULL DEFAULT ''");
   }
   const contracts=(await tx.execute("SELECT k.id,k.work_name,k.address,COALESCE(c.name,k.customer) customer,COALESCE(c.seller_id,k.seller_id) seller_id FROM active_contracts k LEFT JOIN customers c ON c.id=k.customer_id")).rows;
   const byId=new Map(contracts.map(c=>[c.id,c])),links=new Map((await tx.execute('SELECT contract_id,appointment_id,snapshot_json FROM contract_bookings')).rows.map(b=>{let name='';try{name=JSON.parse(b.snapshot_json||'{}').work_name||'';}catch{}return [b.appointment_id,name||byId.get(b.contract_id)?.work_name||''];}));
   for(const table of ['appointments','requests','customers']){
    const rows=(await tx.execute('SELECT * FROM '+table+" WHERE work_name=''")).rows;
    for(const row of rows){
     const names=[...new Set(contracts.filter(c=>c.seller_id===row.seller_id&&key(c.customer)===key(row.customer||row.name)&&key(c.address)===key(row.work)).map(c=>c.work_name))],linked=table==='appointments'?links.get(row.id):null,name=linked||(names.length===1?names[0]:'');
     if(name)await tx.execute({sql:'UPDATE '+table+' SET work_name=? WHERE id=?',args:[name,row.id]});
    }
   }
   await tx.execute("INSERT OR IGNORE INTO settings VALUES('work_names_v1','1')");
  }
  await tx.commit();
 }catch(error){try{await tx.rollback();}catch{}throw error;}finally{tx.close();}
}
