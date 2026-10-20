import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

async function start(env={}) {
 const script="import http from 'node:http'; import handler from './api/index.mjs'; const s=http.createServer(handler);s.listen(0,'127.0.0.1',()=>console.log('READY:'+s.address().port));";
 const child=spawn(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TURSO_DATABASE_URL:'',TURSO_AUTH_TOKEN:'',VERCEL:'',ADMIN_SETUP_TOKEN:'',APP_ORIGIN:'',...env},stdio:['ignore','pipe','pipe']});
 const url=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{child.kill();reject(Error('Servidor não iniciou'));},10000);
  child.once('error',reject);child.once('exit',()=>reject(Error('Servidor encerrou antes de iniciar')));
  child.stdout.on('data',chunk=>{const m=String(chunk).match(/READY:(\d+)/);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});
 });
 return {url,async stop(){const exited=once(child,'exit');child.kill();await exited;}};
}
async function send(server,path,data,headers={}) {
 const response=await fetch(server.url+path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...headers},body:data?JSON.stringify(data):undefined});
 return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')};
}

test('entrada serverless não cria banco efêmero quando faltam credenciais',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'concre-vercel-'));
 const server=await start({VERCEL:'1',DB_PATH:join(dir,'nao-criar.sqlite')});
 try{
  const response=await send(server,'/api/session');assert.equal(response.status,503);assert.match(response.body.error,/TURSO_DATABASE_URL/);assert.deepEqual(readdirSync(dir),[]);
 }finally{await server.stop();rmSync(dir,{recursive:true,force:true});}
});
test('banco remoto recusa HTTP sem TLS e libsql com TLS desativado',async()=>{
 for(const url of ['http://example.invalid','libsql://example.invalid?tls=0']){
  const server=await start({VERCEL:'1',TURSO_DATABASE_URL:url,TURSO_AUTH_TOKEN:'valor-ficticio-de-teste'});
  try{const r=await send(server,'/api/session');assert.equal(r.status,503);assert.match(r.body.error,/TLS/);}finally{await server.stop();}
 }
});
test('cadastro inicial protegido, cookie seguro e persistência após reiniciar',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'concre-persist-'));
 const config={DB_PATH:join(dir,'persist.sqlite'),NODE_ENV:'production',COOKIE_SECURE:'true',APP_ORIGIN:'https://cascavel.example.test',ADMIN_SETUP_TOKEN:'codigo-apenas-de-teste-com-mais-de-32-caracteres'};
 let server=await start(config);
 const account={name:'Programador Teste',username:'programador.teste',password:'Senha-apenas-teste-2027!'};
 try{
  assert.equal((await send(server,'/api/bootstrap',account)).status,403);
  const r=await send(server,'/api/bootstrap',{...account,setupToken:config.ADMIN_SETUP_TOKEN},{Origin:config.APP_ORIGIN});assert.equal(r.status,200);assert.match(r.cookie,/HttpOnly/);assert.match(r.cookie,/SameSite=Strict/);assert.match(r.cookie,/Secure/);
  await server.stop();server=await start(config);
  const session=await send(server,'/api/session',null,{Cookie:r.cookie.split(';')[0]});assert.equal(session.body.needsSetup,false);assert.equal(session.body.user.username,account.username);
  for(let i=0;i<20;i++)assert.equal((await send(server,'/api/signup',{name:''})).status,400);
  await server.stop();server=await start(config);
  assert.equal((await send(server,'/api/signup',{name:''})).status,429);
 }finally{await server.stop();rmSync(dir,{recursive:true,force:true});}
});
