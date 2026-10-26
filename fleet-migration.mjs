export async function migrateTripEstimates(client){
  if((await client.execute("SELECT value FROM settings WHERE key='trip_estimates_v1'")).rows.length)return;
  const tx=await client.transaction('write');
  try{
    if(!(await tx.execute("SELECT value FROM settings WHERE key='trip_estimates_v1'")).rows.length){
      for(const table of ['appointments','requests','customers']){
        const columns=(await tx.execute('PRAGMA table_info('+table+')')).rows;
        if(!columns.some(c=>c.name==='load_capacity'))await tx.execute('ALTER TABLE '+table+' ADD COLUMN load_capacity REAL');
      }
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const calculation='CAST(planned_volume/9.0 AS INTEGER) + CASE WHEN planned_volume > 9*CAST(planned_volume/9.0 AS INTEGER) THEN 1 ELSE 0 END';
      await tx.execute({sql:`UPDATE appointments SET load_capacity=9,trips=${calculation} WHERE load_capacity IS NULL AND date>=? AND status IN ('confirmado','andamento')`,args:[today]});
      await tx.execute({sql:`UPDATE requests SET load_capacity=9,trips=${calculation} WHERE load_capacity IS NULL AND date>=? AND status IN ('pendente','ajuste')`,args:[today]});
      await tx.execute("INSERT OR IGNORE INTO settings VALUES('trip_estimates_v1','1')");
    }
    await tx.commit();
  }catch(error){try{await tx.rollback();}catch{}throw error;}finally{tx.close();}
}
