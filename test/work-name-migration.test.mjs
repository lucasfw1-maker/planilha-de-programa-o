import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {migrateWorkNames} from '../work-name-migration.mjs';

test('nomes de obras são adicionados sem perder dados antigos; contratos são recuperados e a migração é idempotente',async()=>{
 const client=createClient({url:'file::memory:'});
 try{
  await client.executeMultiple(`CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);
   CREATE TABLE customers(id INTEGER PRIMARY KEY,name TEXT,seller_id INTEGER,work TEXT);
   CREATE TABLE appointments(id INTEGER PRIMARY KEY,customer TEXT,seller_id INTEGER,work TEXT);
   CREATE TABLE requests(id INTEGER PRIMARY KEY,customer TEXT,seller_id INTEGER,work TEXT);
   CREATE TABLE active_contracts(id INTEGER PRIMARY KEY,customer_id INTEGER,customer TEXT,seller_id INTEGER,address TEXT,work_name TEXT,status TEXT);
   CREATE TABLE contract_bookings(contract_id INTEGER,appointment_id INTEGER,snapshot_json TEXT);
   INSERT INTO customers VALUES(1,'Dallo',2,'Rua A');
   INSERT INTO appointments VALUES(1,'Dallo',2,'Rua A'),(2,'Dallo',2,'Rua B'),(3,'Outro',2,'Rua A');
   INSERT INTO requests VALUES(1,'Dallo',2,'Rua A');
   INSERT INTO active_contracts VALUES(1,1,'Dallo',2,'Rua A','Residencial A','ativo');`);
  await migrateWorkNames(client);
  for(const table of ['appointments','requests','customers']){const row=(await client.execute('SELECT * FROM '+table+' WHERE id=1')).rows[0];assert.equal(row.work_name,'Residencial A');assert.equal(row.work,'Rua A');}
  assert.equal((await client.execute('SELECT * FROM appointments WHERE id=2')).rows[0].work_name,'');assert.equal((await client.execute('SELECT * FROM appointments WHERE id=3')).rows[0].work_name,'');
  await client.execute("UPDATE appointments SET work_name='Nome revisado' WHERE id=1");await migrateWorkNames(client);assert.equal((await client.execute('SELECT * FROM appointments WHERE id=1')).rows[0].work_name,'Nome revisado');
 }finally{client.close();}
});
