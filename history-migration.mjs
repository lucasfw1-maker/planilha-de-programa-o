// Additive, idempotent recovery from existing audit records. No records are deleted.
const day = iso => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
const search = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
export async function migrateHistory(client) {
  if((await client.execute("SELECT value FROM settings WHERE key='history_v1'")).rows.length)return;
  const tx=await client.transaction('write');
  try{
    if(!(await tx.execute("SELECT value FROM settings WHERE key='history_v1'")).rows.length){
      const audits=(await tx.execute("SELECT * FROM audit WHERE entity='agendamento' AND action='editar' ORDER BY id")).rows;
      const knownCancel=new Set();
      for(const audit of audits){
        let data;try{data=JSON.parse(audit.detail);}catch{continue;}
        const a=data.antes,b=data.depois;if(!a||!b)continue;
        let kind=null;
        if(a.status!=='cancelado'&&b.status==='cancelado')kind='cancelado';
        else if(b.status!=='cancelado'&&(a.status==='cancelado'||['date','start','duration','type','pump_id'].some(k=>a[k]!==b[k])))kind='remarcado';
        if(!kind)continue;
        if(kind==='cancelado')knownCancel.add(Number(audit.entity_id));
        const stamp=String(audit.created_at).includes('T')?audit.created_at:String(audit.created_at).replace(' ','T')+'Z';
        await tx.execute({sql:`INSERT OR IGNORE INTO appointment_events(appointment_id,kind,reason,actor_id,customer,customer_search,work,seller_id,planned_volume,before_json,after_json,event_date,created_at,source_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,args:[Number(audit.entity_id),kind,'Motivo não registrado no código anterior.',audit.user_id,a.customer,search(a.customer),a.work,a.seller_id,a.planned_volume,JSON.stringify(a),JSON.stringify(b),day(stamp),stamp,'audit:'+audit.id]});
      }
      const old=(await tx.execute("SELECT * FROM appointments WHERE status='cancelado'")).rows;
      for(const a of old){
        if(knownCancel.has(a.id))continue;
        await tx.execute({sql:`INSERT OR IGNORE INTO appointment_events(appointment_id,kind,reason,actor_id,customer,customer_search,work,seller_id,planned_volume,before_json,after_json,event_date,created_at,source_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,args:[a.id,'cancelado','Cancelamento anterior sem data, responsável ou motivo registrados.',null,a.customer,search(a.customer),a.work,a.seller_id,a.planned_volume,JSON.stringify(a),JSON.stringify(a),null,null,'legacy-cancel:'+a.id]});
      }
      await tx.execute("INSERT OR IGNORE INTO settings VALUES('history_v1','1')");
    }
    await tx.commit();
  }catch(error){try{await tx.rollback();}catch{}throw error;}finally{tx.close();}
}

export async function migrateCustomers(client) {
  if((await client.execute("SELECT value FROM settings WHERE key='customers_v1'")).rows.length)return;
  const tx=await client.transaction('write');
  try{
    if(!(await tx.execute("SELECT value FROM settings WHERE key='customers_v1'")).rows.length){
      const rows=(await tx.execute('SELECT customer,work,seller_id,gravel,resistance,piece,notes,planned_volume,trips,duration,type,created_at FROM appointments UNION ALL SELECT customer,work,seller_id,gravel,resistance,piece,notes,planned_volume,trips,duration,type,created_at FROM requests ORDER BY created_at')).rows;
      for(const a of rows){
        const key=search(a.customer).replace(/\s+/g,' ');
        await tx.execute({sql:`INSERT INTO customers(seller_id,name,name_key,work,gravel,resistance,piece,notes,planned_volume,trips,duration,type,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(seller_id,name_key) DO UPDATE SET name=excluded.name,work=excluded.work,gravel=excluded.gravel,resistance=excluded.resistance,piece=excluded.piece,notes=excluded.notes,planned_volume=excluded.planned_volume,trips=excluded.trips,duration=excluded.duration,type=excluded.type,updated_at=excluded.updated_at`,args:[a.seller_id,a.customer,key,a.work,a.gravel,a.resistance,a.piece,a.notes,a.planned_volume,a.trips,a.duration,a.type,a.created_at]});
      }
      await tx.execute("INSERT OR IGNORE INTO settings VALUES('customers_v1','1')");
    }
    await tx.commit();
  }catch(error){try{await tx.rollback();}catch{}throw error;}finally{tx.close();}
}
