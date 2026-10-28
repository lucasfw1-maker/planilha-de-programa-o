import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { migrateHistory, migrateCustomers } from './history-migration.mjs';
import { migrateTripEstimates } from './fleet-migration.mjs';
import { migrateCommercial } from './commercial-migration.mjs';
import { migrateContacts } from './contact-migration.mjs';
import {migrateEquipment} from './equipment-migration.mjs';
import {migrateMaintenanceRole} from './maintenance-role-migration.mjs';
import {migrateWorkNames} from './work-name-migration.mjs';
import { migrateConcrete } from './concrete-migration.mjs';
import {migrateLabTrials} from './laboratory-trials-migration.mjs';
import {migrateLabStaff} from './laboratory-staff-migration.mjs';
import {migrateLabMolding} from './laboratory-molding-migration.mjs';
import {migrateLabExpiryHours} from './laboratory-expiry-hours-migration.mjs';
import {migrateLabSlump} from './laboratory-slump-migration.mjs';
import {migrateLabExpiry} from './laboratory-expiry-migration.mjs';
import {migrateLabSets} from './laboratory-sets-migration.mjs';
import {migrateLabMoisture} from './laboratory-migration.mjs';
import { SCHEMA } from './schema.mjs';

const context = new AsyncLocalStorage();
let initialization, client, localMode, queue = Promise.resolve();
const configurationError = message => Object.assign(new Error(message), {status:503});
async function exclusive(fn) {
  const previous=queue;
  let release;
  queue=new Promise(resolve=>{release=resolve;});
  await previous;
  try{return await fn();}finally{release();}
}
export function initialize() {
  if (!initialization) initialization = open().catch(error=>{initialization=undefined;throw error;});
  return initialization;
}
async function open() {
  let url=process.env.TURSO_DATABASE_URL;
  localMode=!url;
  if(url) {
    const parsed=new URL(url);
    if(!['https:','libsql:'].includes(parsed.protocol) || parsed.searchParams.get('tls')==='0') throw configurationError('O banco remoto deve usar HTTPS ou libsql com TLS.');
    if(!process.env.TURSO_AUTH_TOKEN)throw configurationError('Configure TURSO_AUTH_TOKEN na hospedagem.');
  } else {
    if(process.env.VERCEL || process.env.STORAGE_BACKEND==='turso')throw configurationError('Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN. Na Vercel, o banco local fica desabilitado para preservar os dados.');
    const path=process.env.DB_PATH||join(dirname(fileURLToPath(import.meta.url)),'.data','cascavel.sqlite');
    if(path!==':memory:')mkdirSync(dirname(resolve(path)),{recursive:true});
    url=path===':memory:'?'file::memory:':pathToFileURL(resolve(path)).href;
  }
  const candidate=createClient({url,authToken:process.env.TURSO_AUTH_TOKEN,intMode:'number'});
  try {
    if(localMode)await candidate.executeMultiple('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
    await candidate.executeMultiple(SCHEMA);
    await migrateMaintenanceRole(candidate);
    await migrateEquipment(candidate);
    await migrateContacts(candidate);
    await migrateConcrete(candidate);
    await migrateTripEstimates(candidate);
    await migrateHistory(candidate);
    await migrateCustomers(candidate);
    await migrateCommercial(candidate);
    await migrateWorkNames(candidate);
    await migrateLabMoisture(candidate);
    await migrateLabSets(candidate);
    await migrateLabExpiry(candidate);
    await migrateLabSlump(candidate);
    await migrateLabExpiryHours(candidate);
    await migrateLabMolding(candidate);
    await migrateLabStaff(candidate);
    await migrateLabTrials(candidate);
    client=candidate;
  }catch(error){
    candidate.close();
    if(!localMode)throw configurationError('Não foi possível inicializar o banco remoto. Confira o endereço, a credencial e a rede da hospedagem.');
    throw error;
  }
}
async function execute(sql,args,mode) {
  await initialize();
  const tx=context.getStore();
  const call=async()=>{
    const result=await (tx||client).execute({sql,args});
    if(mode==='run')return {lastInsertRowid:Number(result.lastInsertRowid||0),changes:result.rowsAffected};
    return mode==='one'?result.rows[0]:result.rows;
  };
  return localMode&&!tx?exclusive(call):call();
}
export const query=(sql,...args)=>execute(sql,args,'query');
export const one=(sql,...args)=>execute(sql,args,'one');
export const run=(sql,...args)=>execute(sql,args,'run');
export async function transaction(fn) {
  await initialize();
  if(context.getStore())throw new Error('Transações aninhadas não são permitidas.');
  const work=async()=>{
    const tx=await client.transaction('write');
    try {const value=await context.run(tx,fn);await tx.commit();return value;}
    catch(error){try{await tx.rollback();}catch{}throw error;}
    finally{tx.close();}
  };
  return localMode?exclusive(work):work();
}
