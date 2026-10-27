import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'technical-tickets-')),password='Teste-Chamados-2026!';let server,base,admin,seller,other,engineer,engineeringManager,logistics,maintenance,director,ticketId,attachmentId;
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN9sAAAAASUVORK5CYII=';
const pdf=Buffer.from('%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF').toString('base64');
async function req(path,cookie,method='GET',data){const response=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
const fields={customer:'Cliente Exemplo',customer_code:'5310',order_code:'4090',concreting_date:'2026-10-27',type:'tecnico',description:'Solicito apoio técnico para avaliar a concretagem.',attachments:[{name:'concretagem.png',mime:'image/png',data:png}]};
before(async()=>{server=spawn(process.execPath,['server.mjs'],{env:{...process.env,DB_PATH:join(dir,'db.sqlite'),PORT:'0'},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{server.stdout.on('data',value=>{const m=String(value).match(/porta (\d+)/);if(m)resolve('http://127.0.0.1:'+m[1]+'/api');});server.once('error',reject);});admin=(await req('/bootstrap',null,'POST',{name:'Programador',username:'admin.tickets',password})).cookie;
 for(const [username,role] of [['vendedor.um','vendedor'],['vendedor.dois','vendedor'],['eng.um','engenharia'],['eng.gerente','gerente_engenharia'],['logistica','controlador'],['oficina','manutencao'],['diretor','gerente_concresuper']]){const created=await req('/users',admin,'POST',{name:username,username,password,role});assert.equal(created.status,200,JSON.stringify(created.body));const login=await req('/login',null,'POST',{username,password}),changed=await req('/change-password',login.cookie,'POST',{currentPassword:password,newPassword:password+'Pessoal'});assert.equal(changed.status,200);if(username==='vendedor.um')seller=changed.cookie;if(username==='vendedor.dois')other=changed.cookie;if(role==='engenharia')engineer=changed.cookie;if(role==='gerente_engenharia')engineeringManager=changed.cookie;if(role==='controlador')logistics=changed.cookie;if(role==='manutencao')maintenance=changed.cookie;if(role==='gerente_concresuper')director=changed.cookie;}
});
after(()=>{server?.kill();rmSync(dir,{recursive:true,force:true});});
test('novos perfis têm acesso apenas à Engenharia; vendedor vê somente os próprios chamados e anexos',async()=>{
 for(const who of [engineer,engineeringManager])for(const path of ['/appointments?from=2026-10-01&to=2026-10-31','/requests','/customers','/users','/equipment-maintenance/requests','/audit'])assert.equal((await req(path,who)).status,403,path);
 for(const who of [logistics,maintenance])assert.equal((await req('/technical-tickets',who)).status,403);
 const created=await req('/technical-tickets',seller,'POST',{...fields,seller_id:999});assert.equal(created.status,200,JSON.stringify(created.body));ticketId=created.body.id;assert.equal(created.body.customer,'CLIENTE EXEMPLO');
 assert.equal((await req('/technical-tickets?status=todos',other)).body.length,0);assert.equal((await req('/technical-tickets/'+ticketId,other)).status,404);assert.equal((await req('/technical-tickets/'+ticketId+'/messages',other,'POST',{message:'Tentativa indevida',expected_revision:0})).status,404);
 const detail=(await req('/technical-tickets/'+ticketId,engineer)).body;assert.equal(detail.mix_code,'');assert.equal(detail.order_item,'');assert.equal(detail.messages.length,1);attachmentId=detail.messages[0].attachments[0].id;
 assert.equal((await fetch(base+'/technical-tickets/attachments/'+attachmentId,{headers:{cookie:other}})).status,404);
 const image=await fetch(base+'/technical-tickets/attachments/'+attachmentId+'?download=1',{headers:{cookie:engineer}});assert.equal(image.status,200);assert.match(image.headers.get('content-disposition'),/^attachment/);assert.deepEqual(Buffer.from(await image.arrayBuffer()),Buffer.from(png,'base64'));
});
test('atendimento é assumido atomicamente por uma pessoa e não permite respostas concorrentes de colegas',async()=>{
 assert.equal((await req('/technical-tickets/'+ticketId+'/accept',seller,'POST',{expected_revision:0})).status,403);
 assert.equal((await req('/technical-tickets/'+ticketId+'/messages',engineer,'POST',{message:'Sem assumir',resolve:true,expected_revision:0})).status,409);
 const [a,b]=await Promise.all([req('/technical-tickets/'+ticketId+'/accept',engineer,'POST',{expected_revision:0}),req('/technical-tickets/'+ticketId+'/accept',engineeringManager,'POST',{expected_revision:0})]);assert.deepEqual([a.status,b.status].sort(),[200,409]);
 const winner=a.status===200?engineer:engineeringManager,loser=a.status===200?engineeringManager:engineer,assigned=(await req('/technical-tickets/'+ticketId,seller)).body;assert.equal(assigned.status,'em_atendimento');assert(assigned.assigned_name);assert(assigned.assigned_by);
 assert.equal((await req('/technical-tickets/'+ticketId+'/messages',loser,'POST',{message:'Não pode atender junto.',resolve:true,expected_revision:1})).status,409);
 assert.equal((await req('/technical-tickets/'+ticketId+'/messages',winner,'POST',{message:'Orientação e laudo técnico anexados.',resolve:true,expected_revision:0})).status,409);
 const response=await req('/technical-tickets/'+ticketId+'/messages',winner,'POST',{message:'Orientação e laudo técnico anexados.',resolve:true,expected_revision:1,attachments:[{name:'laudo.pdf',mime:'application/pdf',data:pdf}]});assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.status,'atendido');assert.equal(response.body.attended_by,response.body.assigned_by);
 const answered=(await req('/technical-tickets/'+ticketId,seller)).body;assert.equal(answered.messages.length,2);assert.equal(answered.messages[1].author_id,assigned.assigned_by);assert(assigned.assigned_name);const file=await fetch(base+'/technical-tickets/attachments/'+answered.messages[1].attachments[0].id,{headers:{cookie:seller}});assert.equal(file.status,200);assert.equal(file.headers.get('content-type'),'application/pdf');assert.match(file.headers.get('content-disposition'),/^attachment/);assert.deepEqual(Buffer.from(await file.arrayBuffer()),Buffer.from(pdf,'base64'));
 assert.equal((await req('/technical-tickets/'+ticketId+'/messages',seller,'POST',{message:'Fechado',expected_revision:2})).status,409);
});
test('Gerente Engenharia responde e gera indicadores sem duplicar conclusão; relatórios são restritos',async()=>{
 const created=(await req('/technical-tickets',other,'POST',{...fields,customer:'Cliente Comercial',type:'comercial',attachments:[]})).body;
 assert.equal((await req('/technical-tickets/'+created.id+'/accept',engineeringManager,'POST',{expected_revision:0})).status,200);
 const response=await req('/technical-tickets/'+created.id+'/messages',engineeringManager,'POST',{message:'Solicitação comercial atendida.',resolve:true,expected_revision:1});assert.equal(response.status,200);const stamp=response.body.attended_at;
 assert.equal((await req('/technical-tickets/'+created.id+'/messages',engineeringManager,'POST',{message:'Complemento da resposta.',resolve:true,expected_revision:2})).body.attended_at,stamp);
 const day=response.body.attended_date,path='/technical-tickets/report?from='+day+'&to='+day;
 for(const who of [seller,other,engineer,logistics])assert.equal((await req(path,who)).status,403);
 const report=(await req(path,engineeringManager)).body;assert.equal(report.total_created,2);assert.equal(report.total_attended,2);assert.equal(report.by_seller.length,2);assert.equal(report.by_type.length,2);assert.equal(report.by_seller.reduce((n,s)=>n+s.attended,0),2);
 assert.equal((await req(path,admin)).status,200);assert.equal((await req('/technical-tickets/report?from=2026-02-30&to=2026-03-02',engineeringManager)).status,400);
 assert.equal((await req('/technical-tickets?status=todos',seller)).body.length,1);assert.equal((await req('/technical-tickets?status=todos',other)).body.length,1);
});
test('anexos validam tipo e tamanho; vendedor não envia PDF e participantes têm acesso às fotos',async()=>{
 assert.equal((await req('/technical-tickets',seller,'POST',{...fields,attachments:[{name:'falso.png',mime:'image/png',data:pdf}]})).status,400);
 assert.equal((await req('/technical-tickets',seller,'POST',{...fields,attachments:[{name:'arquivo.pdf',mime:'application/pdf',data:pdf}]})).status,400);
 assert.equal((await req('/technical-tickets',seller,'POST',{...fields,attachments:Array(6).fill(fields.attachments[0])})).status,400);
 assert.equal((await req('/technical-tickets',seller,'POST',{...fields,attachments:[{name:'html.svg',mime:'image/svg+xml',data:Buffer.from('<svg/>').toString('base64')}]})).status,400);
 const me=(await req('/technical-tickets/'+ticketId,seller)).body.seller_id;
 const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,217]).toString('base64');assert.equal((await req('/profile/photo',seller,'PATCH',{image})).status,200);
 const owned=await fetch(base+'/technical-tickets/'+ticketId+'/photos/'+me,{headers:{cookie:engineer}});assert.equal(owned.status,200);assert.equal(owned.headers.get('content-type'),'image/jpeg');assert.equal((await fetch(base+'/technical-tickets/'+ticketId+'/photos/'+me,{headers:{cookie:other}})).status,404);
 assert.equal((await req('/technical-tickets/'+ticketId,seller)).body.seller_photo_version.length,24);
});

test('Gerente Concresuper acessa todos os módulos de negócio e não acessa Configurações',async()=>{
 for(const path of ['/appointments?from=2026-10-01&to=2026-10-31','/requests','/customers','/report?from=2026-10-01&to=2026-10-31','/contracts?status=ativo','/equipment-maintenance/equipment','/equipment-maintenance/requests','/equipment-maintenance/calendar?from=2026-10-01&to=2026-10-31','/equipment-maintenance/report?all=1','/production?month=2026-10','/production/goals?period=past','/fleet?from=2026-10-01&to=2026-10-31','/technical-tickets?status=todos','/technical-tickets/report?from=2026-10-01&to=2026-10-31'])assert.equal((await req(path,director)).status,200,path);
 assert.equal((await req('/users',director)).status,403);assert.equal((await req('/audit',director)).status,403);assert.equal((await req('/settings',director,'PATCH',{buffer:30})).status,403);
 assert.equal((await req('/users',director,'POST',{name:'Não permitido',username:'nao.permitido',role:'vendedor',password})).status,403);
});
