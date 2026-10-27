export async function migrateContacts(client){
 const tx=await client.transaction('write');
 try{
  if(!(await tx.execute("SELECT value FROM settings WHERE key='contacts_v1'")).rows.length){
   for(const table of ['appointments','requests','customers']){
    const columns=(await tx.execute('PRAGMA table_info('+table+')')).rows;
    for(const field of ['contact_name','contact_phone'])if(!columns.some(c=>c.name===field))await tx.execute('ALTER TABLE '+table+' ADD COLUMN '+field+" TEXT NOT NULL DEFAULT ''");
   }
   await tx.execute("INSERT OR IGNORE INTO settings VALUES('contacts_v1','1')");
  }
  await tx.commit();
 }catch(error){try{await tx.rollback();}catch{}throw error;}finally{tx.close();}
}
