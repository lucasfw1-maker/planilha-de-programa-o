import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {migrateCommercial} from '../commercial-migration.mjs';

test('migração comercial preserva obras e clientes existentes e pode executar novamente',async()=>{
 const client=createClient({url:'file::memory:'});
 try{
  await client.executeMultiple("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE appointments(id INTEGER PRIMARY KEY,customer TEXT,planned_volume REAL); CREATE TABLE customers(id INTEGER PRIMARY KEY,name TEXT,notes TEXT); INSERT INTO appointments VALUES(7,'Cliente antigo',120); INSERT INTO customers VALUES(9,'Cliente antigo','Com fibra');");
  await migrateCommercial(client);
  const appointment=(await client.execute('SELECT * FROM appointments')).rows[0];
  assert.equal(appointment.id,7);assert.equal(appointment.planned_volume,120);assert.equal(appointment.customer_code,'');assert.equal(appointment.information_version,0);
  await client.execute("UPDATE appointments SET customer_code='001',order_code='020',order_item='1',information_version=1");
  await client.execute("UPDATE customers SET customer_code='001'");
  await migrateCommercial(client);
  const row=(await client.execute('SELECT * FROM appointments')).rows[0];assert.equal(row.customer_code,'001');assert.equal(row.order_code,'020');assert.equal(row.information_version,1);
  const customer=(await client.execute('SELECT * FROM customers')).rows[0];assert.equal(customer.notes,'Com fibra');assert.equal(customer.customer_code,'001');
 }finally{client.close();}
});
