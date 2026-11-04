import {one,query,run,transaction} from './storage.mjs';
import {shiftAccess,shiftDay} from './shift-roster.mjs';
import {withCustomerCodes} from './commercial.mjs';
import {createHash} from 'node:crypto';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function pumpProgramsApi({path,method,url,u,body}){
 if(!shiftAccess(u))fail('Acesso reservado à logística e gestão.',403);
 if(path==='/api/pump-programs'&&method==='GET'){
  const from=shiftDay(url.searchParams.get('from')),to=shiftDay(url.searchParams.get('to'));if(from>to||(Date.parse(to)-Date.parse(from))/86400000>366)fail('Escolha um período de até 366 dias.');
  const pump=Number(url.searchParams.get('pump_id')||0);if(!Number.isSafeInteger(pump)||pump<0)fail('Escolha uma bomba válida.');
  const [cards,pumps]=await Promise.all([query('SELECT r.id,r.pump_id,r.pump_name,r.date,r.version,r.works_count,r.created_at,u.name author_name FROM pump_program_reports r JOIN users u ON u.id=r.created_by WHERE r.date BETWEEN ? AND ? AND (?=0 OR r.pump_id=?) AND r.version=(SELECT MAX(v.version) FROM pump_program_reports v WHERE v.pump_id=r.pump_id AND v.date=r.date) ORDER BY r.date DESC,r.pump_name LIMIT 501',from,to,pump,pump),query('SELECT id,name,active FROM pumps ORDER BY name')]);return {cards:cards.slice(0,500),pumps,limited:cards.length>500};
 }
 if(path==='/api/pump-programs'&&method==='POST'){
  const b=await body();if(!b||typeof b!=='object'||Array.isArray(b))fail('Confira os dados da programação.');const date=shiftDay(b.date);if(typeof b.token!=='string'||!/^[\w-]{16,80}$/.test(b.token))fail('Abra novamente a geração para confirmar.');
  const selected=b.pump_ids;if(selected!==null&&(!Array.isArray(selected)||!selected.length||selected.length>200||selected.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(selected).size!==selected.length))fail('Escolha uma ou mais bombas.');
  const signature=createHash('sha256').update(JSON.stringify({date,selected})).digest('hex');
  return transaction(async()=>{
   const replay=await one("SELECT detail FROM audit WHERE user_id=? AND action='gerar_lote' AND entity='programacao_bomba' AND json_extract(detail,'$.token')=?",u.id,b.token);if(replay){const saved=JSON.parse(replay.detail);if(saved.signature!==signature)fail('Esta confirmação já foi utilizada. Abra uma nova geração.',409);return {ids:saved.ids,count:saved.ids.length};}
   const works=await withCustomerCodes(await query("SELECT a.*,u.name seller_name,p.name pump_name,p.plate pump_plate FROM appointments a JOIN users u ON u.id=a.seller_id JOIN pumps p ON p.id=a.pump_id WHERE a.date=? AND a.type='bomba' AND a.status<>'cancelado' ORDER BY a.start,a.id",date));
   const idsToCreate=selected||[...new Set(works.map(a=>a.pump_id))];if(!idsToCreate.length)fail('Não há obras de bombas nesta data.');
   const ids=[],stamp=new Date().toISOString();for(const pumpId of idsToCreate){const rows=works.filter(a=>a.pump_id===pumpId);if(!rows.length)fail('Uma das bombas não tem obras nesta data. Confira a seleção.');const pump={id:pumpId,name:rows[0].pump_name,plate:rows[0].pump_plate},version=(await one('SELECT COALESCE(MAX(version),0)+1 next FROM pump_program_reports WHERE pump_id=? AND date=?',pumpId,date)).next;
    const maintenance=await query('SELECT starts_at,ends_at,reason FROM maintenance_periods WHERE pump_id=? AND cancelled_at IS NULL AND starts_at<? AND ends_at>? ORDER BY starts_at',pumpId,new Date(Date.parse(date+'T12:00Z')+86400000).toISOString().slice(0,10)+'T00:00',date+'T00:00');
    const snapshot={date,pump,version,works:rows,maintenance,generated_at:stamp,generated_by:u.name,totals:{works:rows.length,volume:rows.reduce((n,a)=>n+a.planned_volume,0),trips:rows.reduce((n,a)=>n+a.trips,0)}};
    const result=await run('INSERT INTO pump_program_reports(pump_id,date,version,pump_name,works_count,snapshot_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)',pumpId,date,version,pump.name,rows.length,JSON.stringify(snapshot),u.id,stamp);ids.push(Number(result.lastInsertRowid));
   }
   await run("INSERT INTO audit(user_id,action,entity,entity_id,detail) VALUES(?,'gerar_lote','programacao_bomba',0,?)",u.id,JSON.stringify({token:b.token,signature,ids}));return {ids,count:ids.length};
  });
 }
 const match=path.match(/^\/api\/pump-programs\/(\d+)$/);if(match&&method==='GET'){
  let row=await one('SELECT * FROM pump_program_reports WHERE id=?',Number(match[1]));if(!row)fail('Programação não encontrada.',404);
  if(url.searchParams.has('version')){const version=Number(url.searchParams.get('version'));if(!Number.isSafeInteger(version)||version<1)fail('Versão inválida.');row=await one('SELECT * FROM pump_program_reports WHERE pump_id=? AND date=? AND version=?',row.pump_id,row.date,version);if(!row)fail('Versão não encontrada.',404);}
  return {id:row.id,...JSON.parse(row.snapshot_json),versions:await query('SELECT r.id,r.version,r.created_at,u.name author_name FROM pump_program_reports r JOIN users u ON u.id=r.created_by WHERE r.pump_id=? AND r.date=? ORDER BY version DESC',row.pump_id,row.date)};
 }
 fail('Operação inválida.',405);
}
