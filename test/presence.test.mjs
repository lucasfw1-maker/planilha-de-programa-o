import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('presença expira, deduplica abas/dispositivos e respeita bloqueio e revogação da sessão',()=>{
 const dir=mkdtempSync(join(tmpdir(),'concretlog-presence-'));
 try{
  const script=`
   import assert from 'node:assert/strict';
   import {initialize,run,query} from './storage.mjs';
   import {onlineUsers,userIsOnline,updatePresence,PRESENCE_TTL} from './presence.mjs';
   await initialize();const now=Date.now();
   await run("INSERT INTO users(id,name,username,password,role) VALUES(1,'Pessoa online','pessoa','hash-teste','vendedor')");
   await run('INSERT INTO sessions VALUES(?,?,?)','session-one',1,now+3600000);
   await run('INSERT INTO sessions VALUES(?,?,?)','session-two',1,now+3600000);
   assert.equal((await onlineUsers(now)).length,0);
   await updatePresence('session-one','presence-client-one',true,now);
   await updatePresence('session-one','presence-client-two',true,now);
   await updatePresence('session-two','presence-client-device',true,now);
   assert.equal((await onlineUsers(now)).length,1);assert.equal(await userIsOnline(1,now),true);
   await updatePresence('session-one','presence-client-one',false,now);
   await updatePresence('session-one','presence-client-two',false,now);
   assert.equal((await onlineUsers(now)).length,1);
   await run('DELETE FROM sessions WHERE token=?','session-two');
   assert.equal((await onlineUsers(now)).length,0);
   await updatePresence('session-one','presence-client-one',true,now);
   assert.equal((await onlineUsers(now+PRESENCE_TTL+1)).length,0);
   assert.equal(await userIsOnline(1,now+PRESENCE_TTL+1),false);
   await run('UPDATE users SET active=0 WHERE id=1');assert.equal((await onlineUsers(now)).length,0);
   await run("UPDATE users SET active=1,status='pendente' WHERE id=1");assert.equal((await onlineUsers(now)).length,0);
   await run("UPDATE users SET status='aprovado',must_change=1 WHERE id=1");assert.equal((await onlineUsers(now)).length,0);
   await run('UPDATE users SET must_change=0 WHERE id=1');assert.equal((await onlineUsers(now)).length,1);
   await run('UPDATE sessions SET expires=? WHERE token=?',now-1,'session-one');assert.equal((await onlineUsers(now)).length,0);
   await updatePresence('nonexistent-session','presence-client-fake',true,now);assert.equal((await query('SELECT * FROM presence_clients WHERE session_token=?','nonexistent-session')).length,0);
   await assert.rejects(()=>updatePresence('session-one','bad',true,now),{status:400});
  `;
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),env:{...process.env,DB_PATH:join(dir,'test.sqlite'),TURSO_DATABASE_URL:'',TURSO_AUTH_TOKEN:'',VERCEL:'',STORAGE_BACKEND:''},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
