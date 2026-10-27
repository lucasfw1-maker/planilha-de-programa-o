export async function migrateConcrete(client){
 const tx=await client.transaction('write');
 try{
  if(!(await tx.execute("SELECT value FROM settings WHERE key='concrete_v1'")).rows.length){
   for(const table of ['appointments','requests','customers']){
    const columns=(await tx.execute('PRAGMA table_info('+table+')')).rows;
    if(!columns.some(c=>c.name==='slump'))await tx.execute('ALTER TABLE '+table+" ADD COLUMN slump TEXT NOT NULL DEFAULT ''");
   }
   await tx.execute("INSERT OR IGNORE INTO settings VALUES('concrete_v1','1')");
  }
  await tx.commit();
 }catch(error){try{await tx.rollback();}catch{}throw error;}finally{tx.close();}
}
