import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {prepareDatabase} from '../database-startup.mjs';
const schema='CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE IF NOT EXISTS records(id INTEGER PRIMARY KEY);';
test('startup skips completed schema and migrations, but detects new schema/migration versions',async()=>{
 const client=createClient({url:'file::memory:'});let runs=0,ddl=0;const executeMultiple=client.executeMultiple.bind(client);client.executeMultiple=async sql=>{ddl++;return executeMultiple(sql);};
 const migrations=[async c=>{runs++;await c.execute('CREATE TABLE IF NOT EXISTS migrated(id INTEGER)');}];
 try{assert.equal((await prepareDatabase(client,schema,migrations)).migrated,true);assert.equal(runs,1);assert.equal((await prepareDatabase(client,schema,migrations)).migrated,false);assert.equal(runs,1);assert.equal(ddl,1);await prepareDatabase(client,schema+' CREATE INDEX IF NOT EXISTS record_idx ON records(id);',migrations);assert.equal(runs,2);await prepareDatabase(client,schema,[...migrations,async c=>c.execute('CREATE TABLE IF NOT EXISTS another(id INTEGER)')]);assert.equal(runs,3);assert((await client.execute("SELECT name FROM sqlite_master WHERE name='another'")).rows.length);}finally{client.close();}
});
test('failed migration is never marked complete and is retried',async()=>{
 const client=createClient({url:'file::memory:'});let fail=true,runs=0;const migrations=[async()=>{runs++;if(fail)throw new Error('migration failed');}];try{await assert.rejects(prepareDatabase(client,schema,migrations),/migration failed/);assert.equal((await client.execute("SELECT * FROM settings WHERE key='database_startup_fingerprint'")).rows.length,0);fail=false;await prepareDatabase(client,schema,migrations);assert.equal(runs,2);await prepareDatabase(client,schema,migrations);assert.equal(runs,2);}finally{client.close();}
});
test('database/network errors are propagated without executing schema',async()=>{
 let ddl=0;await assert.rejects(prepareDatabase({execute:async()=>{throw new Error('network unavailable');},executeMultiple:async()=>{ddl++;}},schema,[]),/network unavailable/);assert.equal(ddl,0);
});
