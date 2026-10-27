import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {migrateConcrete} from '../concrete-migration.mjs';

test('slump é adicionado sem reinterpretar britas antigas ou apagar reservas existentes',async()=>{
 const client=createClient({url:'file::memory:'});
 try{
  await client.executeMultiple("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE appointments(id INTEGER PRIMARY KEY,gravel TEXT); CREATE TABLE requests(id INTEGER PRIMARY KEY,gravel TEXT); CREATE TABLE customers(id INTEGER PRIMARY KEY,gravel TEXT); INSERT INTO appointments VALUES(1,'1'); INSERT INTO requests VALUES(2,'Brita 1'); INSERT INTO customers VALUES(3,'1+0');");
  await migrateConcrete(client);
  for(const [table,before] of [['appointments','1'],['requests','Brita 1'],['customers','1+0']]){
   const row=(await client.execute('SELECT * FROM '+table)).rows[0];assert.equal(row.gravel,before);assert.equal(row.slump,'');
   await client.execute('UPDATE '+table+" SET slump='12 ± 2 cm'");
  }
  await migrateConcrete(client);
  for(const table of ['appointments','requests','customers'])assert.equal((await client.execute('SELECT slump FROM '+table)).rows[0].slump,'12 ± 2 cm');
 }finally{client.close();}
});
