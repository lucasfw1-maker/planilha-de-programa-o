import {SCHEMA} from './schema.mjs';
export async function migrateLabMoisture(client){
 const tx=await client.transaction('write');
 try{
  if(!(await tx.execute("SELECT value FROM settings WHERE key='lab_moisture_weights_v1'")).rows.length){
   const columns=(await tx.execute('PRAGMA table_info(lab_moisture)')).rows.map(c=>c.name);
   if(!columns.includes('wet_mass_g')){
    const ddl=SCHEMA.match(/CREATE TABLE IF NOT EXISTS lab_moisture\([^;]+;/)[0].replace('lab_moisture(','lab_moisture_weights(');
    await tx.execute(ddl);
    const names=columns.join(',');
    await tx.execute('INSERT INTO lab_moisture_weights('+names+') SELECT '+names+' FROM lab_moisture');
    await tx.execute('DROP TABLE lab_moisture');
    await tx.execute('ALTER TABLE lab_moisture_weights RENAME TO lab_moisture');
    await tx.execute('CREATE INDEX IF NOT EXISTS lab_moisture_time ON lab_moisture(measured_at,material,stock)');
   }
   await tx.execute("INSERT OR IGNORE INTO settings VALUES('lab_moisture_weights_v1','1')");
  }
  await tx.commit();
 }catch(error){try{await tx.rollback();}catch{}throw error;}finally{tx.close();}
}
