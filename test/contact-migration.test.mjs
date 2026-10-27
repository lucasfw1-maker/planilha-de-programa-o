import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {migrateContacts} from '../contact-migration.mjs';

test('contatos são adicionados ao banco antigo sem alterar obras, reservas ou clientes',async()=>{
 const client=createClient({url:'file::memory:'});
 try{
  await client.executeMultiple("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE appointments(id INTEGER PRIMARY KEY,customer TEXT,planned_volume REAL); CREATE TABLE requests(id INTEGER PRIMARY KEY,customer TEXT,status TEXT); CREATE TABLE customers(id INTEGER PRIMARY KEY,name TEXT,notes TEXT); INSERT INTO appointments VALUES(1,'Obra antiga',120); INSERT INTO requests VALUES(2,'Reserva antiga','pendente'); INSERT INTO customers VALUES(3,'Cliente antigo','Com fibra');");
  await migrateContacts(client);
  assert.equal((await client.execute('SELECT * FROM appointments')).rows[0].planned_volume,120);
  assert.equal((await client.execute('SELECT * FROM requests')).rows[0].status,'pendente');
  assert.equal((await client.execute('SELECT * FROM customers')).rows[0].notes,'Com fibra');
  for(const table of ['appointments','requests','customers']){
   const row=(await client.execute('SELECT * FROM '+table)).rows[0];assert.equal(row.contact_name,'');assert.equal(row.contact_phone,'');
   await client.execute('UPDATE '+table+" SET contact_name='Ana',contact_phone='(45) 9 1234-5678'");
  }
  await migrateContacts(client);
  for(const table of ['appointments','requests','customers'])assert.equal((await client.execute('SELECT contact_phone FROM '+table)).rows[0].contact_phone,'(45) 9 1234-5678');
 }finally{client.close();}
});
