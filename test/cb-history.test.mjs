import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('frota preserva a situação e a filial vigentes em cada dia histórico',()=>{const dir=mkdtempSync(join(tmpdir(),'cb-history-'));try{const script=`
 import assert from 'node:assert/strict';import {initialize,run} from './storage.mjs';import {fleetRange} from './fleet.mjs';await initialize();
 await run("INSERT INTO users(id,name,username,password,role) VALUES(1,'Admin','admin','hash','programador')");
 await run("INSERT INTO maintenance_cbs(id,code,plate,branch,active,created_by) VALUES(1,'CB1','ABC1D23','aeroporto',0,1),(2,'CB2','DEF2G34','pacaembu',0,1)");
 await run("INSERT INTO settings(key,value) VALUES('fleet_registry_since','2020-01-01')");
 await run("INSERT INTO cb_fleet_history VALUES(1,'2020-01-01',1,'pacaembu'),(1,'2020-02-01',0,'pacaembu'),(1,'2020-03-01',1,'aeroporto'),(2,'2020-02-01',1,'pacaembu')");
 const get=async(date,branch)=>(await fleetRange(date,date,branch)).days[0].trucks;
 assert.equal(await get('2020-01-15','pacaembu'),1);assert.equal(await get('2020-01-15','aeroporto'),0);assert.equal(await get('2020-02-15','pacaembu'),1);assert.equal(await get('2020-02-15','aeroporto'),0);assert.equal(await get('2020-03-15','pacaembu'),1);assert.equal(await get('2020-03-15','aeroporto'),1);assert.equal(await get('2020-03-15',''),2);
 `;const result=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),env:{...process.env,DB_PATH:join(dir,'test.sqlite'),TURSO_DATABASE_URL:'',TURSO_AUTH_TOKEN:'',VERCEL:'',STORAGE_BACKEND:''},encoding:'utf8'});assert.equal(result.status,0,result.stderr);}finally{rmSync(dir,{recursive:true,force:true});}});
