import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {SCHEMA} from '../schema.mjs';

test('migração atualiza somente previsões futuras e mantém viagens antigas e canceladas',()=>{
 const dir=mkdtempSync(join(tmpdir(),'concre-fleet-')),path=join(dir,'legacy.sqlite');
 try{
  const db=new DatabaseSync(path);db.exec(SCHEMA.replaceAll(', load_capacity REAL',''));
  db.exec("INSERT INTO users(id,name,username,password,role) VALUES(1,'Programador','admin','hash-ficticio','programador'),(2,'Vendedor','seller','hash-ficticio','vendedor')");
  const insert=db.prepare("INSERT INTO appointments(customer,work,date,start,duration,type,seller_id,planned_volume,gravel,resistance,piece,status,trips) VALUES('Cliente','Obra',?,'07:00',120,'convencional',2,200,'1','30','Laje',?,1)");
  insert.run('2000-01-01','confirmado');insert.run('2099-01-01','confirmado');insert.run('2099-01-01','concluido');insert.run('2099-01-01','cancelado');db.close();
  const script="import {initialize,query} from './storage.mjs';await initialize(); console.log(JSON.stringify(await query('SELECT date,status,trips,load_capacity FROM appointments ORDER BY id')));";
  const run=()=>{const p=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,DB_PATH:path,TURSO_DATABASE_URL:'',TURSO_AUTH_TOKEN:'',VERCEL:''}});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);};
  const result=run();assert.equal(result[0].trips,1);assert.equal(result[0].load_capacity,null);assert.equal(result[1].trips,23);assert.equal(result[1].load_capacity,9);assert.equal(result[2].trips,1);assert.equal(result[3].trips,1);assert.deepEqual(run(),result);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
