import {createHash} from 'node:crypto';
// Include schema and migration bodies so a new database version never reuses an old fast path.
// Bump this revision when changing a migration dependency outside its function body.
const revision='database-startup-v1';
export async function prepareDatabase(client,schema,migrations){
 const fingerprint=createHash('sha256').update(JSON.stringify([revision,schema,migrations.map(fn=>fn.toString())])).digest('hex');
 let saved;
 try{saved=(await client.execute("SELECT value FROM settings WHERE key='database_startup_fingerprint'")).rows[0]?.value;}
 catch(error){if(!/no such table: (?:main\.)?settings/i.test(error.message))throw error;}
 if(saved===fingerprint)return {migrated:false};
 await client.executeMultiple(schema);
 for(const migrate of migrations)await migrate(client);
 // Only mark completion after every migration succeeded; failures retry on the next instance.
 await client.execute({sql:"INSERT INTO settings(key,value) VALUES('database_startup_fingerprint',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",args:[fingerprint]});
 return {migrated:true};
}
