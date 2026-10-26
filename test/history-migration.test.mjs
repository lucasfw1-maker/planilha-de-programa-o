import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {SCHEMA} from '../schema.mjs';

test('migração recupera auditorias e cancelados antigos sem inventar datas e sem duplicar',()=>{
 const dir=mkdtempSync(join(tmpdir(),'concre-history-')),path=join(dir,'legacy.sqlite');
 try{
 const db=new DatabaseSync(path);db.exec(SCHEMA);
 db.exec("INSERT INTO users(id,name,username,password,role) VALUES(1,'Programador','admin','hash-ficticio','programador'),(2,'Vendedor','seller','hash-ficticio','vendedor'); INSERT INTO pumps(id,name) VALUES(1,'BL216');");
 const before={id:1,customer:'Cliente Árvore',work:'Obra antiga',date:'2026-10-27',start:'07:00',duration:120,type:'bomba',pump_id:1,seller_id:2,planned_volume:40,gravel:'1',resistance:'30',piece:'Laje',notes:'Fibra',status:'confirmado',trips:5};
 const insert=db.prepare('INSERT INTO appointments(id,customer,work,date,start,duration,type,pump_id,seller_id,planned_volume,gravel,resistance,piece,notes,status,trips) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
 for(const id of [1,2,3]){const a={...before,id,date:id===2?'2026-10-29':before.date,status:id===2?'confirmado':'cancelado'};insert.run(a.id,a.customer,a.work,a.date,a.start,a.duration,a.type,a.pump_id,a.seller_id,a.planned_volume,a.gravel,a.resistance,a.piece,a.notes,a.status,a.trips);}
 const audit=db.prepare("INSERT INTO audit(user_id,action,entity,entity_id,detail,created_at) VALUES(1,'editar','agendamento',?,?, '2026-10-26 14:00:00')");
 audit.run(1,JSON.stringify({antes:before,depois:{...before,status:'cancelado'}}));
 audit.run(2,JSON.stringify({antes:{...before,id:2},depois:{...before,id:2,date:'2026-10-29'}}));db.exec("UPDATE audit SET created_at='2026-10-26 01:00:00' WHERE entity_id=2");db.close();
 const script="import {initialize,query} from './storage.mjs';await initialize();const events=await query('SELECT kind,event_date,source_key FROM appointment_events ORDER BY id'); const clients=await query('SELECT name,notes FROM customers');console.log(JSON.stringify({events,clients}));";
 const run=()=>{const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,DB_PATH:path,TURSO_DATABASE_URL:'',TURSO_AUTH_TOKEN:'',VERCEL:''}});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);};
 const result=run();assert.equal(result.events.length,3);assert.equal(result.events.filter(e=>e.kind==='cancelado').length,2);assert.equal(result.events.filter(e=>e.event_date===null).length,1);assert.equal(result.events[0].event_date,'2026-10-26');assert.equal(result.events[1].event_date,'2026-10-25');assert.equal(result.clients.length,1);assert.equal(result.clients[0].notes,'Fibra');assert.deepEqual(run(),result);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
