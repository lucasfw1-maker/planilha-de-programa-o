import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {migrateLabMoisture} from '../laboratory-migration.mjs';
test('migração preserva medições anteriores sem inventar pesos ou tempo e pode repetir',async()=>{
 const client=createClient({url:'file::memory:'});
 try{
  await client.executeMultiple(`CREATE TABLE users(id INTEGER PRIMARY KEY);INSERT INTO users VALUES(1);CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE lab_moisture(id INTEGER PRIMARY KEY,measured_at TEXT NOT NULL,material TEXT NOT NULL,stock TEXT NOT NULL,moisture_percent REAL NOT NULL CHECK(moisture_percent>=0 AND moisture_percent<=100),notes TEXT NOT NULL DEFAULT '',revision INTEGER NOT NULL DEFAULT 0,created_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX lab_moisture_time ON lab_moisture(measured_at,material,stock);
INSERT INTO lab_moisture VALUES(7,'2026-10-28T07:00','Areia fina','Baia 1',5.2,'Medição antiga',0,1,'2026-10-28','2026-10-28');`);
  await migrateLabMoisture(client);await migrateLabMoisture(client);
  const row=(await client.execute('SELECT * FROM lab_moisture')).rows[0];
  assert.equal(row.id,7);assert.equal(row.moisture_percent,5.2);assert.equal(row.material,'Areia fina');assert.equal(row.notes,'Medição antiga');assert.equal(row.weather,null);assert.equal(row.wet_mass_g,null);assert.equal(row.dry_mass_g,null);
  await client.execute("INSERT INTO lab_moisture(measured_at,material,stock,moisture_percent,weather,wet_mass_g,dry_mass_g,created_by,created_at,updated_at) VALUES('2026-10-28T08:00','','Baia 1',150,'chuva',250,100,1,'2026-10-28','2026-10-28')");
  assert.equal((await client.execute('SELECT COUNT(*) n FROM lab_moisture')).rows[0].n,2);
 }finally{client.close();}
});
