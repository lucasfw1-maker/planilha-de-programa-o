export async function migrateCommercial(client){
  if((await client.execute("SELECT value FROM settings WHERE key='commercial_v1'")).rows.length)return;
  const tx=await client.transaction('write');
  try{
    if(!(await tx.execute("SELECT value FROM settings WHERE key='commercial_v1'")).rows.length){
      for(const table of ['appointments','customers']){
        const columns=(await tx.execute('PRAGMA table_info('+table+')')).rows;
        const fields=table==='appointments'?[['customer_code',"TEXT NOT NULL DEFAULT ''"],['order_code',"TEXT NOT NULL DEFAULT ''"],['order_item',"TEXT NOT NULL DEFAULT ''"],['information_version','INTEGER NOT NULL DEFAULT 0']]:[['customer_code',"TEXT NOT NULL DEFAULT ''"]];
        for(const [name,definition]of fields)if(!columns.some(c=>c.name===name))await tx.execute('ALTER TABLE '+table+' ADD COLUMN '+name+' '+definition);
      }
      await tx.execute("INSERT OR IGNORE INTO settings VALUES('commercial_v1','1')");
    }
    await tx.commit();
  }catch(error){try{await tx.rollback();}catch{}throw error;}finally{tx.close();}
}
