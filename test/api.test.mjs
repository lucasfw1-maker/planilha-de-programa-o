import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir=mkdtempSync(join(tmpdir(),'concresuper-test-'));
let child, base, admin, seller, other, manager, controller, pumpId, appointmentId, requestId;
const password='Teste-Apenas-2027!';
async function request(path, {method='GET',data,cookie,origin}={}) {
 const res=await fetch(base+path,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},body:data?JSON.stringify(data):undefined});
 return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
}
const booking={customer:'Cliente Teste',work_name:'Obra Centro',work:'Obra Centro',date:'2027-01-04',start:'07:00',duration:120,type:'bomba',planned_volume:24,gravel:'1+0',resistance:'30 MPa',piece:'Laje',notes:'Com fibra; slump máximo 16',trips:3};
before(async()=>{
 child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',DB_PATH:join(dir,'db.sqlite')},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Servidor não iniciou')),10000);child.once('error',reject);child.stdout.on('data',chunk=>{const match=String(chunk).match(/porta (\d+)/);if(match){base='http://127.0.0.1:'+match[1]+'/api';clearTimeout(timeout);resolve();}});child.stderr.on('data',chunk=>{if(String(chunk).includes('Error'))reject(Error(String(chunk)));});});
});
after(()=>{child?.kill();rmSync(dir,{recursive:true,force:true});});

test('cadastro inicial, sessão, senha e proteção de origem',async()=>{
 assert.equal((await request('/appointments?from=2027-01-01&to=2027-01-31')).status,401);
 assert.equal((await request('/session')).body.needsSetup,true);
 const r=await request('/bootstrap',{method:'POST',data:{name:'Administrador Teste',username:'lucas.wiebbelling',password}});assert.equal(r.status,200);admin=r.cookie;assert.equal(r.body.user.role,'programador');
 assert.equal((await request('/bootstrap',{method:'POST',data:{name:'Outro',username:'outro.usuario',password}})).status,409);
 assert.equal((await request('/login',{method:'POST',data:{username:'lucas.wiebbelling',password:'incorreta'}})).status,401);
 assert.equal((await request('/settings',{method:'PATCH',cookie:admin,origin:'https://externo.invalid',data:{buffer:0}})).status,403);
});
test('usuários, perfis e bomba são cadastrados sem senhas nas respostas',async()=>{
 for(const role of ['vendedor','gerente','controlador']){assert.equal((await request('/users',{method:'POST',cookie:admin,data:{name:role,username:role,password,role}})).status,200);const r=await request('/login',{method:'POST',data:{username:role,password}});
 assert.equal(r.body.user.mustChangePassword,true);
 assert.equal((await request('/meta',{cookie:r.cookie})).status,403);
 const changed=await request('/change-password',{method:'POST',cookie:r.cookie,data:{currentPassword:password,newPassword:password+'novo'}});assert.equal(changed.status,200);
 if(role==='vendedor')seller={cookie:changed.cookie,id:changed.body.user.id};if(role==='gerente')manager=changed.cookie;if(role==='controlador')controller=changed.cookie;}
 await request('/users',{method:'POST',cookie:admin,data:{name:'Outra vendedora',username:'outra.vendedora',password,role:'vendedor'}});
 const otherLogin=await request('/login',{method:'POST',data:{username:'outra.vendedora',password}});
 other=(await request('/change-password',{method:'POST',cookie:otherLogin.cookie,data:{currentPassword:password,newPassword:password+'novo'}})).cookie;
 const users=await request('/users',{cookie:admin});assert(!JSON.stringify(users.body).includes('password'));
 assert.equal((await request('/users',{cookie:seller.cookie})).status,403);
 const p=await request('/pumps',{method:'POST',cookie:admin,data:{name:'BL216',description:'Teste'}});pumpId=p.body.id;assert.equal(p.status,200);
});
test('agendamento, margem de deslocamento, conflito e entrega convencional',async()=>{
 const data={...booking,pump_id:pumpId,seller_id:seller.id};
 const r=await request('/appointments',{method:'POST',cookie:admin,data});assert.equal(r.status,200);appointmentId=r.body.id;
 assert.equal((await request('/appointments',{method:'POST',cookie:seller.cookie,data})).status,403);
 const conflict=await request('/appointments',{method:'POST',cookie:manager,data:{...data,start:'09:15'}});assert.equal(conflict.status,409);assert.match(conflict.body.error,/Conflito/);
 assert.equal((await request('/appointments',{method:'POST',cookie:controller,data:{...data,start:'09:30'}})).status,200);
 assert.equal((await request('/appointments',{method:'POST',cookie:admin,data:{...data,type:'convencional',pump_id:null}})).status,200);
 const available=await request('/appointments?from=2027-01-04&to=2027-01-04',{cookie:seller.cookie});assert.equal(available.body.length,3);assert(available.body.every(a=>a.own_booking&&a.customer&&a.seller_id===seller.id));
});
test('solicitação identifica vendedor autenticado, aprovação verifica conflito e evita duplicidade',async()=>{
 const r=await request('/requests',{method:'POST',cookie:seller.cookie,data:{...booking,date:'2027-01-05',seller_id:999}});assert.equal(r.status,200);requestId=r.body.id;
 const list=await request('/requests',{cookie:seller.cookie});assert.equal(list.body[0].seller_id,seller.id);assert.equal(list.body[0].notes,booking.notes);
 assert.equal((await request('/requests',{cookie:other})).body.length,0);
 assert.equal((await request('/requests/'+requestId,{method:'PATCH',cookie:seller.cookie,data:{status:'aprovada',pump_id:pumpId}})).status,403);
 assert.equal((await request('/requests/'+requestId,{method:'PATCH',cookie:manager,data:{status:'aprovada',pump_id:pumpId}})).status,200);
 assert.equal((await request('/requests/'+requestId,{method:'PATCH',cookie:manager,data:{status:'aprovada',pump_id:pumpId}})).status,409);
});
test('volume entregue não altera programado e relatório respeita filtros e vendedor',async()=>{
 assert.equal((await request('/appointments/'+appointmentId,{method:'PATCH',cookie:controller,data:{delivered_volume:26,status:'concluido',planned_volume:999}})).status,409);assert.equal((await request('/appointments/'+appointmentId,{method:'PATCH',cookie:controller,data:{delivered_volume:26,status:'concluido'}})).status,200);
 const report=await request('/report?from=2027-01-04&to=2027-01-04&type=bomba&status=concluido',{cookie:admin});assert.equal(report.body.length,1);assert.equal(report.body[0].planned_volume,24);assert.equal(report.body[0].delivered_volume,26);
 assert.equal((await request('/report?from=2027-01-01&to=2027-01-31&seller='+seller.id,{cookie:other})).body.length,0);
 assert.equal((await request('/report?from=2027-02-01&to=2027-01-01',{cookie:admin})).status,400);
 const all=await request('/report?from=2027-01-01&to=2027-01-31',{cookie:admin});assert(all.body.some(a=>a.delivered_volume===null));
 const audit=await request('/audit',{cookie:admin});assert(audit.body.some(a=>a.action==='editar'&&a.user_name==='controlador'));assert(!JSON.stringify(audit.body).includes(password));
});
test('manutenção bloqueia reservas e datas inválidas são rejeitadas',async()=>{
 assert.equal((await request('/pumps/'+pumpId,{method:'PATCH',cookie:manager,data:{maintenance:true}})).status,409);
 const proposed=await request('/equipment-maintenance/requests',{method:'POST',cookie:admin,data:{equipment_type:'bomba',pump_id:pumpId,starts_at:'2027-01-06T00:00',ends_at:'2027-01-06T23:59',reason:'Teste de manutenção'}});assert.equal(proposed.status,200);assert.equal((await request('/equipment-maintenance/requests/'+proposed.body.id+'/accept',{method:'POST',cookie:controller,data:{side:'logistics',expected_revision:0}})).status,200);
 const data={...booking,date:'2027-01-06',pump_id:pumpId,seller_id:seller.id};
 assert.equal((await request('/appointments',{method:'POST',cookie:admin,data})).status,409);
 assert.equal((await request('/appointments',{method:'POST',cookie:admin,data:{...data,type:'convencional',date:'2027-02-30'}})).status,400);
 assert.equal((await request('/appointments',{method:'POST',cookie:admin,data:{...data,type:'convencional',start:'23:00',duration:120}})).status,400);
 await request('/logout',{method:'POST',cookie:other,data:{}});
 assert.equal((await request('/meta',{cookie:other})).status,401);
});

test('cadastro público, aprovação, redefinição e conta do Programador protegida',async()=>{
 const signup=await request('/signup',{method:'POST',data:{name:'Novo vendedor',username:'novo.vendedor',password,role:'programador'}});assert.equal(signup.status,200);
 assert.equal((await request('/login',{method:'POST',data:{username:'novo.vendedor',password}})).status,403);
 const users=(await request('/users',{cookie:admin})).body;
 const target=users.find(u=>u.username==='novo.vendedor');assert.equal(target.role,'vendedor');
 assert.equal((await request('/users/'+target.id,{method:'PATCH',cookie:manager,data:{status:'aprovado',role:'vendedor'}})).status,403);
 assert.equal((await request('/users/'+target.id,{method:'PATCH',cookie:admin,data:{status:'aprovado',role:'vendedor'}})).status,200);
 const login=await request('/login',{method:'POST',data:{username:'novo.vendedor',password}});assert.equal(login.status,200);
 assert.equal((await request('/users/'+target.id,{method:'PATCH',cookie:admin,data:{action:'reset-password',currentPassword:'errada',password:password+'temp'}})).status,403);
 assert.equal((await request('/users/'+target.id,{method:'PATCH',cookie:admin,data:{action:'reset-password',currentPassword:password,password:password+'temp'}})).status,200);
 assert.equal((await request('/meta',{cookie:login.cookie})).status,401);
 const temp=await request('/login',{method:'POST',data:{username:'novo.vendedor',password:password+'temp'}});assert.equal(temp.body.user.mustChangePassword,true);
 assert.equal((await request('/report?from=2027-01-01&to=2027-01-31',{cookie:temp.cookie})).status,403);
 assert.equal((await request('/users',{method:'POST',cookie:admin,data:{name:'Outro Programador',username:'outro.programador',password,role:'programador'}})).status,403);
 assert.equal((await request('/users/'+users.find(u=>u.role==='programador').id,{method:'PATCH',cookie:admin,data:{status:'bloqueado',role:'vendedor'}})).status,403);
});

test('consulta de disponibilidade não expõe clientes e respeita intervalo e manutenção',async()=>{
 let r=await request('/availability?date=2027-01-04&start=07:00&duration=120',{cookie:seller.cookie});assert.equal(r.status,200);assert.equal(r.body.pumps[0].available,false);assert(!JSON.stringify(r.body).includes(booking.customer.toLocaleUpperCase('pt-BR')));
 await request('/pumps/'+pumpId,{method:'PATCH',cookie:admin,data:{maintenance:false}});
 r=await request('/availability?date=2027-01-04&start=11:00&duration=60',{cookie:seller.cookie});assert.equal(r.body.pumps[0].available,false);
 r=await request('/availability?date=2027-01-04&start=12:00&duration=60',{cookie:seller.cookie});assert.equal(r.body.pumps[0].available,true);
});

test('reservas concorrentes não confirmam a mesma bomba no mesmo intervalo', async () => {
 const data={...booking,date:'2027-01-20',start:'07:00',pump_id:pumpId,seller_id:seller.id};
 const results=await Promise.all([
  request('/appointments',{method:'POST',cookie:admin,data}),
  request('/appointments',{method:'POST',cookie:manager,data:{...data,customer:'Outro cliente'}})
 ]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const rows=await request('/appointments?from=2027-01-20&to=2027-01-20',{cookie:admin});
 assert.equal(rows.body.length,1);
});

test('cancelamento exige motivo, preserva recurso e libera disponibilidade',async()=>{
 const created=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,date:'2027-03-10',customer:'José da Silva',pump_id:pumpId,seller_id:seller.id}});
 const id=created.body.id;assert.equal(created.status,200);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:controller,data:{status:'cancelado'}})).status,400);
 assert.equal((await request('/appointments/'+id,{cookie:admin})).body.status,'confirmado');
 const cancel=await request('/appointments/'+id,{method:'PATCH',cookie:controller,data:{action:'cancelar',status:'cancelado',reason:'Cliente solicitou o cancelamento'}});assert.equal(cancel.status,200);
 const current=(await request('/appointments/'+id,{cookie:admin})).body;assert.equal(current.status,'cancelado');assert.equal(current.pump_id,pumpId);
 const free=await request('/availability?date=2027-03-10&start=07:00&duration=120',{cookie:seller.cookie});assert.equal(free.body.pumps[0].available,true);
 const history=(await request('/appointments/'+id+'/history',{cookie:admin})).body;assert.equal(history.length,1);assert.equal(history[0].kind,'cancelado');assert.equal(history[0].actor_name,'controlador');assert.equal(history[0].before.date,'2027-03-10');assert.equal(history[0].before.pump_id,pumpId);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:admin,data:{action:'cancelar',status:'cancelado',reason:'Repetido'}})).status,409);
 const report=await request('/changes?from=2027-03-01&to=2027-03-31&basis=before&kind=cancelado&customer=JOSE',{cookie:manager});assert.equal(report.body.length,1);assert.equal(report.body[0].reason,'Cliente solicitou o cancelamento');
 const otherLogin=await request('/login',{method:'POST',data:{username:'outra.vendedora',password:password+'novo'}});other=otherLogin.cookie;
 assert.equal((await request('/appointments/'+id+'/history',{cookie:other})).status,404);
 assert.equal((await request('/changes?from=2000-01-01&to=2099-01-01&seller='+seller.id,{cookie:other})).body.length,0);
});

test('remarcações preservam cada data, filtram por cliente e não gravam conflitos',async()=>{
 const created=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,date:'2027-03-11',customer:'José da Silva',pump_id:pumpId,seller_id:seller.id}});assert.equal(created.status,200);const id=created.body.id;
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:seller.cookie,data:{date:'2027-04-11',reason:'Teste'}})).status,403);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:admin,data:{date:'2027-04-11'}})).status,400);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:admin,data:{action:'remarcar',date:'2027-04-11',reason:'Chuva'}})).status,200);
 const stale=(await request('/appointments/'+id,{cookie:admin})).body;
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:manager,data:{action:'remarcar',date:'2027-04-12',reason:'A pedido do cliente'}})).status,200);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:admin,data:{date:'2027-04-13',reason:'Concorrente',expected:stale}})).status,409);
 const conflict=await request('/appointments/'+id,{method:'PATCH',cookie:admin,data:{date:'2027-01-20',reason:'Destino já ocupado'}});assert.equal(conflict.status,409);
 const history=(await request('/appointments/'+id+'/history',{cookie:admin})).body;assert.equal(history.length,2);assert.equal(history[0].before.date,'2027-04-11');assert.equal(history[0].after.date,'2027-04-12');assert.equal(history[1].before.date,'2027-03-11');
 const before=await request('/changes?from=2027-03-01&to=2027-03-31&basis=before&kind=remarcado&customer=silva',{cookie:seller.cookie});assert.equal(before.body.length,1);
 const after=await request('/changes?from=2027-04-01&to=2027-04-30&basis=after&kind=remarcado&customer=jose',{cookie:admin});assert.equal(after.body.length,2);
 assert.equal((await request('/appointments/'+id,{cookie:admin})).body.date,'2027-04-12');
});

test('clientes são salvos, reutilizados por nome normalizado e isolados por vendedor',async()=>{
 let rows=(await request('/customers?q=JOSE',{cookie:seller.cookie})).body;assert.equal(rows.length,1);assert.equal(rows[0].gravel,booking.gravel);assert.equal(rows[0].notes,booking.notes);
 assert.equal((await request('/customers?seller='+seller.id,{cookie:other})).body.length,0);
 const requestResult=await request('/requests',{method:'POST',cookie:seller.cookie,data:{...booking,customer:'JOSÉ DA SILVA',work:'Nova obra',notes:'Com fibra especial',planned_volume:32,type:'convencional'}});assert.equal(requestResult.status,200);
 rows=(await request('/customers?q=jose',{cookie:admin})).body;assert.equal(rows.length,1);assert.equal(rows[0].work,'Nova obra');assert.equal(rows[0].planned_volume,32);assert.equal(rows[0].notes,'Com fibra especial');
 const old=(await request('/changes?from=2027-03-01&to=2027-03-31&basis=before&kind=cancelado&customer=jose',{cookie:admin})).body;assert.equal(old[0].work,booking.work);
});

test('reativação exige motivo e mantém cancelamento anterior no histórico',async()=>{
 const created=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,date:'2027-05-10',customer:'Cliente Reativação',pump_id:pumpId,seller_id:seller.id}});const id=created.body.id;
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:admin,data:{action:'cancelar',status:'confirmado',reason:'Inválido'}})).status,400);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:admin,data:{action:'cancelar',status:'cancelado',reason:'Cliente suspendeu'}})).status,200);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:admin,data:{date:'2027-05-11',reason:'Alteração oculta'}})).status,400);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:manager,data:{status:'confirmado'}})).status,400);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:manager,data:{action:'remarcar',status:'confirmado',reason:'Cliente confirmou novamente'}})).status,200);
 const events=(await request('/appointments/'+id+'/history',{cookie:admin})).body;assert.deepEqual(events.map(e=>e.kind),['remarcado','cancelado']);
 const report=(await request('/changes?from=2027-05-01&to=2027-05-31&basis=before&kind=cancelado',{cookie:admin})).body;assert.equal(report[0].current_status,'confirmado');
});

test('viagens são calculadas por capacidade, com arredondamento e sem aceitar total adulterado',async()=>{
 for(const [volume,capacity,trips]of [[80,8,10],[80.1,8,11],[90,9,10],[90.1,9,11],[100,10,10],[100.1,10,11]]){
  const r=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,date:'2030-06-01',customer:`Cálculo ${capacity} ${volume}`,type:'convencional',seller_id:seller.id,planned_volume:volume,load_capacity:capacity,trips:999}});assert.equal(r.status,200);
  const saved=(await request('/appointments/'+r.body.id,{cookie:admin})).body;assert.equal(saved.trips,trips);assert.equal(saved.load_capacity,capacity);
 }
 assert.equal((await request('/appointments',{method:'POST',cookie:admin,data:{...booking,type:'convencional',seller_id:seller.id,load_capacity:0}})).status,400);
 assert.equal((await request('/appointments',{method:'POST',cookie:admin,data:{...booking,type:'convencional',seller_id:seller.id,load_capacity:7}})).status,400);
});

test('frota usa 17 como padrão e somente gerente ou programador podem ajustar dias e vigência',async()=>{
 const path='/fleet?from=2030-06-01&to=2030-06-03';
 assert.equal((await request(path,{cookie:seller.cookie})).status,403);
 assert.deepEqual((await request(path,{cookie:controller})).body.days.map(d=>d.trucks),[17,17,17]);
 assert.equal((await request('/fleet',{method:'PATCH',cookie:controller,data:{date:'2030-06-01',trucks:10}})).status,403);
 assert.equal((await request('/fleet',{method:'PATCH',cookie:manager,data:{date:'2030-06-01',trucks:10,scope:'day'}})).status,200);
 assert.equal((await request('/fleet',{method:'PATCH',cookie:manager,data:{date:'2030-06-02',trucks:15,scope:'from'}})).status,200);
 assert.deepEqual((await request(path,{cookie:admin})).body.days.map(d=>d.trucks),[10,15,15]);
 assert.equal((await request('/fleet?from=2030-05-31&to=2030-05-31',{cookie:admin})).body.days[0].trucks,17);
 await request('/fleet',{method:'PATCH',cookie:manager,data:{date:'2030-06-03',trucks:0,scope:'day'}});
 assert.equal((await request(path,{cookie:admin})).body.truck_days,25);
 await request('/fleet',{method:'PATCH',cookie:manager,data:{date:'2030-06-01',scope:'clear'}});
 assert.equal((await request(path,{cookie:admin})).body.days[0].trucks,17);
 assert.equal((await request('/fleet',{method:'PATCH',cookie:manager,data:{date:'2030-06-01',trucks:-1}})).status,400);
 assert.equal((await request('/fleet',{method:'PATCH',cookie:manager,data:{date:'2030-06-01',trucks:1.5}})).status,400);
});

test('meta mensal usa volumes confirmados, exclui cancelados e acompanha remarcação sem divisão por zero',async()=>{
 const url='/production?month=2030-06';
 assert.equal((await request(url,{cookie:seller.cookie})).status,403);
 const empty=(await request(url,{cookie:controller})).body;assert.equal(empty.target,null);assert.equal(empty.percent,null);assert(Math.abs(empty.programmed-540.3)<1e-8);
 assert.equal((await request('/production',{method:'PATCH',cookie:controller,data:{month:'2030-06',volume:1000}})).status,403);
 let response=await request('/production',{method:'PATCH',cookie:manager,data:{month:'2030-06',volume:1000}});assert.equal(response.status,200);assert(Math.abs(response.body.percent-54.03)<1e-8);assert(Math.abs(response.body.remaining-459.7)<1e-8);assert(Math.abs(response.body.remaining_percent-45.97)<1e-8);
 const rows=(await request('/appointments?from=2030-06-01&to=2030-06-01',{cookie:admin})).body;
 const canceled=rows.find(a=>a.planned_volume===100.1),moved=rows.find(a=>a.planned_volume===90);
 await request('/appointments/'+canceled.id,{method:'PATCH',cookie:manager,data:{action:'cancelar',status:'cancelado',reason:'Obra cancelada'}});
 await request('/appointments/'+moved.id,{method:'PATCH',cookie:manager,data:{action:'remarcar',date:'2030-07-01',reason:'Cliente mudou o mês'}});
 await request('/requests',{method:'POST',cookie:seller.cookie,data:{...booking,date:'2030-06-01',type:'convencional',planned_volume:999}});
 response=await request(url,{cookie:admin});assert(Math.abs(response.body.programmed-350.2)<1e-8);
 assert.equal((await request('/production?month=2030-07',{cookie:admin})).body.programmed,90);
 response=await request('/production',{method:'PATCH',cookie:admin,data:{month:'2030-06',volume:300}});assert.equal(response.body.remaining,0);assert.equal(response.body.remaining_percent,0);assert(response.body.percent>100);assert(Math.abs(response.body.surplus-50.2)<1e-8);
 assert.equal((await request('/production',{method:'PATCH',cookie:manager,data:{month:'2030-06',volume:0}})).status,400);
 assert.equal((await request('/production?month=2030-13',{cookie:manager})).status,400);
});

test('relatório de produção compara programado e entregue e calcula necessidade diária',async()=>{
 const rows=(await request('/appointments?from=2030-06-01&to=2030-06-30',{cookie:admin})).body;
 const first=rows.find(a=>a.status!=='cancelado');
 await request('/appointments/'+first.id,{method:'PATCH',cookie:manager,data:{delivered_volume:50}});
 await request('/production',{method:'PATCH',cookie:manager,data:{month:'2030-06',volume:1000}});
 const result=await request('/production?month=2030-06&reference=2030-06-30&basis=all',{cookie:controller});assert.equal(result.status,200);
 assert.equal(result.body.delivered,50);assert.equal(result.body.delivery_percent,5);assert.equal(result.body.delivery_remaining,950);assert.equal(result.body.delivery_remaining_percent,95);assert.equal(result.body.days_remaining,1);assert.equal(result.body.required_delivery_daily,950);assert(Math.abs(result.body.required_programming_daily-649.8)<1e-8);assert.equal(result.body.daily.length,30);assert(result.body.missing>0);
 const ended=(await request('/production?month=2030-06&reference=2030-07-01&basis=all',{cookie:admin})).body;assert.equal(ended.days_remaining,0);assert.equal(ended.required_delivery_daily,null);
 assert.equal((await request('/production?month=2030-06&basis=inválido',{cookie:admin})).status,400);
 assert.equal((await request('/production?month=2030-06&reference=2030-02-30',{cookie:admin})).status,400);
 const empty=(await request('/production?month=2040-01&reference=2040-01-01&basis=mon_sat',{cookie:admin})).body;assert.equal(empty.target,null);assert.equal(empty.required_delivery_daily,null);assert.equal(empty.programmed,0);
 await request('/appointments/'+first.id,{method:'PATCH',cookie:manager,data:{action:'cancelar',status:'cancelado',reason:'Cancelado o saldo após entrega parcial'}});
 const partial=(await request('/production?month=2030-06',{cookie:admin})).body;assert.equal(partial.delivered,50);assert(Math.abs(partial.programmed-270.2)<1e-8);
 assert(Array.isArray(partial.sellers));assert(Math.abs(partial.sellers.reduce((n,s)=>n+s.programmed,0)-partial.programmed)<1e-8);assert.equal(partial.sellers.reduce((n,s)=>n+s.delivered,0),partial.delivered);assert.equal(partial.sellers.find(s=>s.id===seller.id).delivered,50);assert(partial.sellers.some(s=>s.programmed===0&&s.delivered===0));
});

test('gerência permite cadastro de bombas ao gerente e mantém controlador sem essa permissão',async()=>{
 assert.equal((await request('/pumps',{method:'POST',cookie:controller,data:{name:'NÃO CADASTRAR'}})).status,403);
 assert.equal((await request('/pumps',{method:'POST',cookie:seller.cookie,data:{name:'NÃO CADASTRAR'}})).status,403);
 assert.equal((await request('/pumps',{method:'POST',cookie:manager,data:{name:'BLM1',description:'Bomba de teste'}})).status,200);
});

test('manutenção confirmada por duas pessoas bloqueia reservas sem cancelar obras existentes',async()=>{
 const pump=(await request('/meta',{cookie:admin})).body.pumps.find(p=>p.name==='BLM1');
 const created=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,date:'2030-08-10',pump_id:pump.id,seller_id:seller.id}});assert.equal(created.status,200);
 const period={equipment_type:'bomba',pump_id:pump.id,starts_at:'2030-08-10T08:00',ends_at:'2030-08-10T10:00',reason:'Troca de mangueira'};
 const maintenance=await request('/equipment-maintenance/requests',{method:'POST',cookie:admin,data:period});assert.equal(maintenance.status,200);
 const path='/equipment-maintenance/requests/'+maintenance.body.id;
 assert.equal(maintenance.body.conflicts.length,1,'A proposta avisa sobre as obras existentes sem impedir sua criação');
 assert.equal((await request('/appointments/'+created.body.id,{cookie:admin})).body.status,'confirmado');
 assert.equal((await request(path+'/negotiate',{method:'POST',cookie:controller,data:{side:'logistics',expected_revision:0,...period,starts_at:'2030-08-10T12:00',ends_at:'2030-08-10T14:00',note:'Após a obra'}})).status,200);
 assert.equal((await request(path+'/accept',{method:'POST',cookie:admin,data:{side:'maintenance',expected_revision:1}})).status,200);
 assert.equal((await request('/appointments',{method:'POST',cookie:admin,data:{...booking,date:'2030-08-10',start:'12:00',pump_id:pump.id,seller_id:seller.id}})).status,409);
 const publicList=await request('/maintenance?from=2030-08-10&to=2030-08-10',{cookie:seller.cookie});assert.equal(publicList.body.length,1);assert(!('reason' in publicList.body[0]));
 assert.equal((await request(path+'/cancel',{method:'POST',cookie:manager,data:{side:'maintenance',expected_revision:1,note:'Serviço não será necessário'}})).status,200);
 const overnight=await request('/equipment-maintenance/requests',{method:'POST',cookie:admin,data:{...period,starts_at:'2030-08-10T23:00',ends_at:'2030-08-11T03:00'}});assert.equal(overnight.status,200);assert.equal((await request('/equipment-maintenance/requests/'+overnight.body.id+'/accept',{method:'POST',cookie:controller,data:{side:'logistics',expected_revision:0}})).status,200);
 assert.equal((await request('/availability?date=2030-08-11&start=02:00&duration=60',{cookie:seller.cookie})).body.pumps.find(p=>p.id===pump.id).maintenance,true);
 assert.equal((await request('/availability?date=2030-08-11&start=03:00&duration=60',{cookie:seller.cookie})).body.pumps.find(p=>p.id===pump.id).available,true);
});

 test('informações comerciais: vendedor só altera próprias obras e gestão altera todas',async()=>{
 const created=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,type:'convencional',date:'2031-01-10',customer:'Dallo',seller_id:seller.id}});assert.equal(created.status,200);
 const id=created.body.id,path='/appointments/'+id+'/information';
 assert.equal((await request(path,{method:'PATCH',cookie:other,data:{expected_version:0,customer_code:'INVASAO'}})).status,404);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:seller.cookie,data:{planned_volume:999}})).status,403);
 const update=await request(path,{method:'PATCH',cookie:seller.cookie,data:{expected_version:0,customer_code:'05310',order_code:'2020',order_item:'1',planned_volume:999,seller_id:999}});assert.equal(update.status,200);
 let row=(await request('/appointments/'+id,{cookie:seller.cookie})).body;assert.equal(row.customer_code,'05310');assert.equal(row.order_code,'2020');assert.equal(row.order_item,'1');assert.equal(row.planned_volume,24);assert.equal(row.seller_id,seller.id);
 assert.equal((await request(path,{method:'PATCH',cookie:seller.cookie,data:{expected_version:0,order_code:'stale'}})).status,409);
 assert.equal((await request(path,{method:'PATCH',cookie:seller.cookie,data:{expected_version:1,order_code:'<script>'}})).status,400);
 for(const [i,cookie]of [admin,manager,controller].entries())assert.equal((await request(path,{method:'PATCH',cookie,data:{expected_version:i+1,order_code:'2020'}})).status,200);
 const foreign=(await request('/appointments?from=2031-01-10&to=2031-01-10',{cookie:other})).body.find(a=>a.id===id);assert.equal(foreign.status,'ocupado');assert.equal(foreign.customer,'DALLO');assert.equal(foreign.seller_id,seller.id);assert.equal(typeof foreign.seller_name,'string');assert.equal(foreign.trips,3);assert.equal(foreign.required_cbs,2);assert(!foreign.customer_code&&!foreign.order_code&&!foreign.own_booking&&!foreign.planned_volume);
 const next=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,type:'convencional',date:'2031-01-11',customer:'DALLO',seller_id:seller.id}});assert.equal(next.status,200);
 row=(await request('/appointments/'+next.body.id,{cookie:seller.cookie})).body;assert.equal(row.customer_code,'05310');assert.equal(row.order_code,'');assert.equal(row.order_item,'');
 const customer=(await request('/customers?q=dallo',{cookie:seller.cookie})).body[0];assert.equal(customer.customer_code,'05310');
 const report=(await request('/report?from=2031-01-10&to=2031-01-11',{cookie:admin})).body;assert.equal(report.find(a=>a.id===id).order_item,'1');
 });

test('foto de perfil é individual, rejeita conteúdo ativo e pode ser removida',async()=>{
 assert.equal((await request('/profile/photo',{method:'PATCH',cookie:seller.cookie,data:{image:'data:image/svg+xml;base64,PHN2Zz4='}})).status,400);
 assert.equal((await request('/profile/photo',{method:'PATCH',cookie:seller.cookie,data:{image:'data:image/jpeg;base64,YWJjZA=='}})).status,400);
 assert.equal((await request('/profile/photo',{method:'PATCH',cookie:seller.cookie,data:{image:'data:image/jpeg;base64,'+'A'.repeat(180000)}})).status,413);
 assert.equal((await request('/profile/photo',{method:'PATCH',cookie:seller.cookie,data:{image:null,user_id:1}})).status,200);
 assert.equal((await request('/profile-photo/'+seller.id,{cookie:other})).status,404);
 const meta=(await request('/meta',{cookie:seller.cookie})).body;assert(meta.profiles.every(p=>p.id===seller.id));assert.equal(meta.profiles[0].version,null);
 assert.equal((await request('/profile/photo',{method:'PATCH',data:{image:null}})).status,401);
});

test('contato é formatado, reaproveitado e protegido por vendedor sem alterar obras antigas',async()=>{
 const created=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,type:'convencional',date:'2032-02-10',customer:'Contato Obra',seller_id:seller.id,contact_name:'Ana Silva',contact_phone:'45912345678'}});assert.equal(created.status,200);const id=created.body.id;
 let a=(await request('/appointments/'+id,{cookie:seller.cookie})).body;assert.equal(a.contact_phone,'(45) 9 1234-5678');
 const path='/appointments/'+id+'/information';
 assert.equal((await request(path,{method:'PATCH',cookie:other,data:{expected_version:0,contact_name:'Invasão'}})).status,404);
 assert.equal((await request(path,{method:'PATCH',cookie:seller.cookie,data:{expected_version:0,contact_name:'Bruno',contact_phone:'+55 (45) 3333-4444'}})).status,200);
 a=(await request('/appointments/'+id,{cookie:seller.cookie})).body;assert.equal(a.contact_name,'Bruno');assert.equal(a.contact_phone,'(45) 3333-4444');
 assert.equal((await request(path,{method:'PATCH',cookie:seller.cookie,data:{expected_version:0,contact_phone:'45999998888'}})).status,409);
 const second=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,type:'convencional',date:'2032-02-11',customer:'CONTATO OBRA',planned_volume:72,seller_id:seller.id}});assert.equal(second.status,200);
 const b=(await request('/appointments/'+second.body.id,{cookie:seller.cookie})).body;assert.equal(b.contact_name,'Bruno');assert.equal(b.contact_phone,'(45) 3333-4444');
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:controller,data:{contact_name:'Carla',contact_phone:'45999998888',expected_information_version:1}})).status,200);
 assert.equal((await request(path,{method:'PATCH',cookie:seller.cookie,data:{expected_version:1,contact_name:'Desatualizado'}})).status,409);
 let c=(await request('/customers?q=contato obra',{cookie:seller.cookie})).body[0];assert.equal(c.contact_name,'Carla');assert.equal(c.contact_phone,'(45) 9 9999-8888');assert.equal(c.planned_volume,72);
 assert.equal((await request('/appointments/'+second.body.id,{cookie:seller.cookie})).body.contact_name,'Bruno');
 const foreign=(await request('/appointments?from=2032-02-10&to=2032-02-11',{cookie:other})).body;assert(foreign.every(r=>!('contact_name' in r)&&!('contact_phone' in r)));
 const report=(await request('/report?from=2032-02-10&to=2032-02-11',{cookie:admin})).body;assert.equal(report.find(r=>r.id===id).contact_phone,'(45) 9 9999-8888');
 assert.equal((await request('/appointments/'+second.body.id,{method:'PATCH',cookie:controller,data:{delivered_volume:72,contact_name:'Bruno',contact_phone:'(45) 3333-4444'}})).status,200);
 assert.equal((await request('/customers?q=contato obra',{cookie:seller.cookie})).body[0].contact_name,'Carla');
 for(const contact_phone of ['123','telefone','(45) 9 9999-999999'])assert.equal((await request(path,{method:'PATCH',cookie:seller.cookie,data:{expected_version:2,contact_phone}})).status,400);
 assert.equal((await request(path,{method:'PATCH',cookie:seller.cookie,data:{expected_version:2,contact_name:'X'.repeat(121)}})).status,400);
 assert.equal((await request(path,{method:'PATCH',cookie:seller.cookie,data:{expected_version:2,contact_name:'',contact_phone:''}})).status,200);
 c=(await request('/customers?q=contato obra',{cookie:seller.cookie})).body[0];assert.equal(c.contact_name,'');assert.equal(c.contact_phone,'');
});
test('aprovação de reserva transporta contato e telefone para o agendamento',async()=>{
 const result=await request('/requests',{method:'POST',cookie:seller.cookie,data:{...booking,type:'convencional',date:'2032-03-10',customer:'Contato Reserva',contact_name:'Engenheiro João',contact_phone:'55 45 9 8765 4321'}});assert.equal(result.status,200);
 assert.equal((await request('/requests/'+result.body.id,{method:'PATCH',cookie:controller,data:{status:'aprovada'}})).status,200);
 const row=(await request('/report?from=2032-03-10&to=2032-03-10',{cookie:admin})).body.find(r=>r.request_id===result.body.id);assert.equal(row.contact_name,'Engenheiro João');assert.equal(row.contact_phone,'(45) 9 8765-4321');
});

test('slump acompanha agenda, cliente e reserva; brita aceita somente as quatro opções atuais',async()=>{
 const ids=[];
 for(const gravel of ['1+0','0','2','Massa Preta']){
  const result=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,date:'2033-01-10',type:'convencional',customer:'Concreto '+gravel,seller_id:seller.id,gravel,slump:'12 ± 2 cm'}});assert.equal(result.status,200);ids.push(result.body.id);
  const a=(await request('/appointments/'+result.body.id,{cookie:seller.cookie})).body;assert.equal(a.slump,'12 ± 2');assert.equal(a.gravel,gravel);
 }
 for(const gravel of ['1','Brita 3','','Areia'])assert.equal((await request('/appointments',{method:'POST',cookie:admin,data:{...booking,type:'convencional',seller_id:seller.id,gravel}})).status,400);
 assert.equal((await request('/requests',{method:'POST',cookie:seller.cookie,data:{...booking,type:'convencional',gravel:'3'}})).status,400);
 const id=ids[0],path='/appointments/'+id+'/information';
 assert.equal((await request(path,{method:'PATCH',cookie:other,data:{expected_version:0,slump:'16'}})).status,404);
 assert.equal((await request(path,{method:'PATCH',cookie:seller.cookie,data:{expected_version:0,slump:16}})).status,200);
 assert.equal((await request('/appointments/'+id,{cookie:seller.cookie})).body.slump,'16');
 assert.equal((await request(path,{method:'PATCH',cookie:seller.cookie,data:{expected_version:1,slump:'x'.repeat(61)}})).status,400);
 const next=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,type:'convencional',date:'2033-01-11',customer:'Concreto 1+0',seller_id:seller.id,planned_volume:88,gravel:'2'}});assert.equal(next.status,200);
 assert.equal((await request('/appointments/'+next.body.id,{cookie:seller.cookie})).body.slump,'16');
 assert.equal((await request(path,{method:'PATCH',cookie:seller.cookie,data:{expected_version:1,slump:'10 ± 2 cm'}})).status,200);
 const customer=(await request('/customers?q='+encodeURIComponent('concreto 1+0'),{cookie:seller.cookie})).body[0];assert.equal(customer.slump,'10 ± 2');assert.equal(customer.gravel,'2');assert.equal(customer.planned_volume,88);
 assert.equal((await request('/appointments/'+next.body.id,{cookie:seller.cookie})).body.slump,'16');
 const approved=await request('/requests',{method:'POST',cookie:seller.cookie,data:{...booking,type:'convencional',date:'2033-01-12',customer:'Reserva slump',gravel:'Massa Preta',slump:'Máximo 16'}});assert.equal(approved.status,200);
 assert.equal((await request('/requests/'+approved.body.id,{method:'PATCH',cookie:controller,data:{status:'aprovada'}})).status,200);
 const row=(await request('/report?from=2033-01-12&to=2033-01-12',{cookie:admin})).body.find(a=>a.request_id===approved.body.id);assert.equal(row.slump,'Máximo 16');assert.equal(row.gravel,'Massa Preta');
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:manager,data:{gravel:'0',slump:'14'}})).status,200);
 assert.equal((await request('/appointments/'+id,{cookie:seller.cookie})).body.gravel,'0');
});
test('somente Programador pode gerenciar fotos da equipe',async()=>{
 const path='/users/'+seller.id+'/photo';
 for(const cookie of [seller.cookie,other,manager,controller])assert.equal((await request(path,{method:'PATCH',cookie,data:{image:null}})).status,403);
 assert.equal((await request('/users/999999/photo',{method:'PATCH',cookie:admin,data:{image:null}})).status,404);
 assert.equal((await request(path,{method:'PATCH',cookie:admin,data:{image:'data:image/svg+xml;base64,PHN2Zz4='}})).status,400);
 assert.equal((await request(path,{method:'PATCH',cookie:admin,data:{image:null}})).status,200);
 const events=(await request('/audit',{cookie:admin})).body;assert(events.some(e=>e.action==='remover foto'&&e.entity_id===seller.id));
});

test('Programador corrige nome e vendedor em todas as obras e reservas, preservando cada endereço',async()=>{
 const target=(await request('/session',{cookie:other})).body.user.id,ids=[];
 for(const [date,work,type]of [['2020-04-01','Rua Primeiro Endereço','bomba'],['2036-04-02','Rua Segundo Endereço','convencional'],['2036-04-03','Rua Terceiro Endereço','convencional']]){
  const r=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,customer:'rede de Clientes',date,work,type,pump_id:type==='bomba'?pumpId:null,seller_id:seller.id,planned_volume:40,contact_name:'Responsável',contact_phone:'45912345678',slump:'12+-2'}});assert.equal(r.status,200);ids.push(r.body.id);
 }
 assert.equal((await request('/appointments/'+ids[0]+'/information',{method:'PATCH',cookie:seller.cookie,data:{expected_version:0,customer_code:'0087',order_code:'Pedido1',order_item:'01'}})).status,200);
 assert.equal((await request('/appointments/'+ids[0],{method:'PATCH',cookie:controller,data:{delivered_volume:38,status:'concluido'}})).status,200);
 assert.equal((await request('/appointments/'+ids[1],{method:'PATCH',cookie:controller,data:{status:'cancelado',reason:'Cliente cancelou esta data'}})).status,200);
 const pending=await request('/requests',{method:'POST',cookie:seller.cookie,data:{...booking,customer:'REDE DE CLIENTES',work:'Rua Quarto Endereço',date:'2036-04-04',type:'convencional'}});assert.equal(pending.status,200);
 const client=(await request('/customers?q=rede de clientes',{cookie:admin})).body[0],path='/customers/'+client.id;
 for(const cookie of [seller.cookie,other,manager,controller]){
  assert.equal((await request(path+'/edit-preview',{cookie})).status,403);
  assert.equal((await request(path,{method:'PATCH',cookie,data:{name:'Invasão',seller_id:target}})).status,403);
 }
 const oldAddressList=(await request(path+'/addresses',{cookie:seller.cookie})).body;assert.equal(oldAddressList.length,4);assert(oldAddressList.includes('Rua Segundo Endereço'));
 assert.equal((await request(path+'/addresses',{cookie:other})).status,404);
 const input={name:'Rede corrigida',seller_id:target},preview=await request(path+'/edit-preview?'+new URLSearchParams({name:input.name,seller:String(target)}),{cookie:admin});assert.equal(preview.status,200);assert.equal(preview.body.proposed.name,'REDE CORRIGIDA');assert.equal(preview.body.counts.appointments,3);assert.equal(preview.body.counts.requests,1);assert.equal(preview.body.counts.events,1);
 const snapshots=await Promise.all(ids.map(id=>request('/appointments/'+id,{cookie:admin}).then(r=>r.body)));
 assert.equal((await request(path,{method:'PATCH',cookie:admin,data:input})).status,409);
 const updated=await request(path,{method:'PATCH',cookie:admin,data:{...input,preview_token:preview.body.preview_token}});assert.equal(updated.status,200);
 for(const before of snapshots){
  const after=(await request('/appointments/'+before.id,{cookie:other})).body;assert.equal(after.customer,'REDE CORRIGIDA');assert.equal(after.seller_id,target);
  for(const key of ['work','date','start','duration','type','pump_id','planned_volume','delivered_volume','status','contact_name','contact_phone','slump','gravel','order_code','order_item'])assert.equal(after[key],before[key],key);
  assert.equal((await request('/appointments/'+before.id,{cookie:seller.cookie})).status,404);
 }
 assert.equal((await request('/appointments/'+ids[2]+'/information',{method:'PATCH',cookie:seller.cookie,data:{expected_version:1,order_item:'2'}})).status,404);
 const owned=(await request('/appointments/'+ids[2],{cookie:other})).body;assert.equal((await request('/appointments/'+ids[2]+'/information',{method:'PATCH',cookie:other,data:{expected_version:owned.information_version,order_item:'2'}})).status,200);
 assert.equal((await request('/customers?q=rede corrigida',{cookie:seller.cookie})).body.length,0);assert.equal((await request('/customers?q=rede corrigida',{cookie:other})).body.length,1);
 assert.equal((await request(path+'/addresses',{cookie:seller.cookie})).status,404);assert.deepEqual(new Set((await request(path+'/addresses',{cookie:other})).body),new Set(oldAddressList));
 const changes=(await request('/changes?from=2036-04-01&to=2036-04-30&basis=before&customer=rede corrigida',{cookie:other})).body;assert.equal(changes.length,1);assert.equal(changes[0].seller_id,target);assert.equal(changes[0].customer,'REDE CORRIGIDA');assert.equal(changes[0].before.customer,'REDE DE CLIENTES');assert.equal(changes[0].before.seller_id,seller.id);assert.equal(changes[0].actor_name,'controlador');
 assert.equal((await request('/changes?from=2036-04-01&to=2036-04-30&basis=before&customer=rede corrigida',{cookie:seller.cookie})).body.length,0);
 assert(!(await request('/requests',{cookie:seller.cookie})).body.some(r=>r.id===pending.body.id));assert((await request('/requests',{cookie:other})).body.some(r=>r.id===pending.body.id&&r.customer==='REDE CORRIGIDA'));
 assert.equal((await request('/requests/'+pending.body.id,{method:'PATCH',cookie:controller,data:{status:'aprovada'}})).status,200);
 const approved=(await request('/report?from=2036-04-04&to=2036-04-04',{cookie:other})).body.find(a=>a.request_id===pending.body.id);assert.equal(approved.customer,'REDE CORRIGIDA');assert.equal(approved.seller_id,target);assert.equal(approved.work,'Rua Quarto Endereço');
 const audit=(await request('/audit',{cookie:admin})).body.find(e=>e.action==='editar cliente');assert.equal(JSON.parse(audit.detail).before.name,'REDE DE CLIENTES');
});

test('unificar clientes mantém todos os endereços, códigos das obras e os dados mais recentes',async()=>{
 const target=(await request('/session',{cookie:other})).body.user.id;
 const post=async(customer,work,sellerId,contact_name)=>{const r=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,customer,work,seller_id:sellerId,type:'convencional',date:'2037-05-10',contact_name,contact_phone:'45912345678'}});assert.equal(r.status,200);return r.body.id;};
 const a=await post('Cliente origem','Endereço origem 1',seller.id,'Contato Origem');
 assert.equal((await request('/appointments/'+a+'/information',{method:'PATCH',cookie:seller.cookie,data:{expected_version:0,customer_code:'111'}})).status,200);
 const b=await post('Cliente origem','Endereço origem 2',seller.id,'Contato Origem');
 const c=await post('Cliente destino','Endereço destino 1',target,'Contato Mais Recente');
 assert.equal((await request('/appointments/'+c+'/information',{method:'PATCH',cookie:other,data:{expected_version:0,customer_code:'222'}})).status,200);
 const source=(await request('/customers?q=cliente origem',{cookie:admin})).body[0],destination=(await request('/customers?q=cliente destino',{cookie:admin})).body[0],path='/customers/'+source.id,input={name:'cliente destino',seller_id:target};
 const preview=(await request(path+'/edit-preview?'+new URLSearchParams({name:input.name,seller:String(target)}),{cookie:admin})).body;assert.equal(preview.destination.id,destination.id);assert.equal(preview.counts.appointments,3);
 assert.equal((await request(path,{method:'PATCH',cookie:admin,data:{...input,preview_token:preview.preview_token}})).status,409);
 const saved=await request(path,{method:'PATCH',cookie:admin,data:{...input,preview_token:preview.preview_token,merge_existing:true}});assert.equal(saved.status,200);assert.equal(saved.body.customer_id,destination.id);assert.equal(saved.body.merged,true);
 const clients=(await request('/customers?q=cliente destino',{cookie:other})).body;assert.equal(clients.length,1);assert.equal(clients[0].contact_name,'Contato Mais Recente');
 const addresses=(await request('/customers/'+destination.id+'/addresses',{cookie:other})).body;assert.deepEqual(new Set(addresses),new Set(['Endereço origem 1','Endereço origem 2','Endereço destino 1']));
 for(const [id,code] of [[a,'111'],[b,'111'],[c,'222']]){const row=(await request('/appointments/'+id,{cookie:other})).body;assert.equal(row.customer,'CLIENTE DESTINO');assert.equal(row.seller_id,target);assert.equal(row.customer_code,code);}
 const audit=(await request('/audit',{cookie:admin})).body.find(e=>e.action==='editar cliente'&&e.entity_id===destination.id);assert.equal(JSON.parse(audit.detail).destination_before.id,destination.id);
});

test('edição do cliente rejeita prévia desatualizada e mantém dados atômicos',async()=>{
 const target=(await request('/session',{cookie:other})).body.user.id;
 const bookingResult=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,type:'convencional',customer:'Cliente concorrente',seller_id:seller.id,date:'2038-06-10'}});assert.equal(bookingResult.status,200);
 const client=(await request('/customers?q=cliente concorrente',{cookie:admin})).body[0],path='/customers/'+client.id,input={name:'nome novo',seller_id:target};
 assert.equal((await request(path+'/edit-preview?name=',{cookie:admin})).status,400);assert.equal((await request(path+'/edit-preview?seller=99999',{cookie:admin})).status,400);
 const preview=(await request(path+'/edit-preview?'+new URLSearchParams({name:input.name,seller:String(target)}),{cookie:admin})).body;
 await request('/appointments/'+bookingResult.body.id+'/information',{method:'PATCH',cookie:seller.cookie,data:{expected_version:0,order_code:'Atualizado'}});
 assert.equal((await request(path,{method:'PATCH',cookie:admin,data:{...input,preview_token:preview.preview_token}})).status,409);
 const row=(await request('/appointments/'+bookingResult.body.id,{cookie:seller.cookie})).body;assert.equal(row.customer,'CLIENTE CONCORRENTE');assert.equal(row.order_code,'Atualizado');assert.equal(row.seller_id,seller.id);
 assert.equal((await request('/customers?q=nome novo',{cookie:other})).body.length,0);
 const current=(await request(path+'/edit-preview?name='+encodeURIComponent('Cliente corrigido'),{cookie:admin})).body;
 assert.equal((await request(path,{method:'PATCH',cookie:admin,data:{name:'Cliente corrigido',preview_token:current.preview_token}})).status,200);
 assert.equal((await request('/appointments/'+bookingResult.body.id,{cookie:seller.cookie})).body.customer,'CLIENTE CORRIGIDO');
});

test('usuários online dependem de atividade, não apenas do login, e nunca expõem sessões',async()=>{
 assert.equal((await request('/presence')).status,401);assert.deepEqual((await request('/presence',{cookie:admin})).body.users,[]);
 assert.equal((await request('/presence',{method:'POST',cookie:seller.cookie,data:{client_id:'bad',online:true}})).status,400);
 const target=(await request('/session',{cookie:other})).body.user.id;
 let presence=await request('/presence',{method:'POST',cookie:seller.cookie,data:{client_id:'presence-seller-tab-one',online:true,user_id:target}});assert.equal(presence.status,200);assert.equal(presence.body.users.length,1);assert.equal(presence.body.users[0].id,seller.id);assert.equal(presence.body.users[0].role,'vendedor');
 await request('/presence',{method:'POST',cookie:seller.cookie,data:{client_id:'presence-seller-tab-two',online:true}});
 assert.equal((await request('/presence',{cookie:controller})).body.users.length,1);
 await request('/presence',{method:'POST',cookie:seller.cookie,data:{client_id:'presence-seller-tab-one',online:false}});
 assert.equal((await request('/presence',{cookie:manager})).body.users.length,1);
 presence=await request('/presence',{method:'POST',cookie:other,data:{client_id:'presence-other-user-tab',online:true}});assert.equal(presence.body.users.length,2);
 const serialized=JSON.stringify(presence.body);assert(!serialized.includes('session_token'));assert(!serialized.includes('password'));assert(!serialized.includes('contact_phone'));assert(!serialized.includes('username'));
 await request('/logout',{method:'POST',cookie:other,data:{}});
 assert(!(await request('/presence',{cookie:admin})).body.users.some(user=>user.id===target));
 await request('/presence',{method:'POST',cookie:seller.cookie,data:{client_id:'presence-seller-tab-two',online:false}});
 assert.deepEqual((await request('/presence',{cookie:admin})).body.users,[]);
});

test('contratos: permissões, acompanhamento, agendamento atômico, conclusão e relatório histórico',async()=>{
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),tomorrow=new Date(today+'T12:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);const next=tomorrow.toISOString().slice(0,10);
 assert.equal((await request('/contracts',{cookie:seller.cookie})).status,403);
 const input={customer:'Cliente contrato',seller_id:seller.id,work_name:'Edifício contrato',address:'Rua dos contratos, 20',contact_name:'João',contact_phone:'45999998888',next_contact:today,last_piece:'Fundação',last_date:'2020-01-01',last_volume:20};
 assert.equal((await request('/contracts',{method:'POST',cookie:controller,data:{...input,next_contact:'2026-02-30'}})).status,400);
 const created=await request('/contracts',{method:'POST',cookie:controller,data:input});assert.equal(created.status,200,JSON.stringify(created.body));const id=created.body.id;
 let list=(await request('/contracts',{cookie:manager})).body;const contract=list.find(c=>c.id===id);assert.equal(contract.customer,'CLIENTE CONTRATO');assert.equal(contract.due,true);assert.equal(contract.contact_phone,'(45) 9 9999-8888');
 for(const path of ['/contracts/'+id,'/contracts/report?date='+today,'/contracts/'+id+'/contacts','/contracts/'+id+'/bookings','/contracts/'+id+'/close'])assert.equal((await request(path,{method:path.endsWith('contacts')||path.endsWith('bookings')||path.endsWith('close')?'POST':'GET',cookie:seller.cookie,data:path.endsWith('contacts')||path.endsWith('bookings')||path.endsWith('close')?{}:undefined})).status,403);
 let saved=await request('/contracts/'+id+'/contacts',{method:'POST',cookie:controller,data:{expected_version:0,contact_notes:'Cliente solicitou uma nova laje',next_contact:next}});assert.equal(saved.status,200);
 assert.equal((await request('/contracts/'+id+'/contacts',{method:'POST',cookie:manager,data:{expected_version:0,contact_notes:'Não deve duplicar',next_contact:next}})).status,409);
 const payload={...booking,customer:'TENTATIVA TROCA',seller_id:999999,type:'convencional',date:today,work:'ENDEREÇO ERRADO',planned_volume:27,piece:'Laje do contrato',expected_version:1,contact_notes:'Combinado por telefone, agendando hoje',next_contact:next};
 assert.equal((await request('/contracts/'+id+'/bookings',{method:'POST',cookie:controller,data:{...payload,planned_volume:-1}})).status,400);
 let details=(await request('/contracts/'+id,{cookie:manager})).body;assert.equal(details.contacts.length,1);assert.equal(details.version,1);
 const booked=await request('/contracts/'+id+'/bookings',{method:'POST',cookie:controller,data:payload});assert.equal(booked.status,200,JSON.stringify(booked.body));const appointment=booked.body.id;
 details=(await request('/contracts/'+id,{cookie:manager})).body;assert.equal(details.contacts.length,2);assert.equal(details.bookings.length,1);assert.equal(details.bookings[0].customer,'CLIENTE CONTRATO');assert.equal(details.bookings[0].seller_id,seller.id);assert.equal(details.bookings[0].work,input.address);
 assert.equal((await request('/contracts/'+id+'/bookings',{method:'POST',cookie:controller,data:payload})).status,409);
 list=(await request('/contracts',{cookie:controller})).body;assert.equal(list.find(c=>c.id===id).last_piece,'Fundação');assert.equal(list.find(c=>c.id===id).due,false);
 assert.equal((await request('/appointments/'+appointment,{method:'PATCH',cookie:manager,data:{status:'concluido',delivered_volume:26}})).status,200);
 list=(await request('/contracts',{cookie:controller})).body;assert.equal(list.find(c=>c.id===id).last_piece,'Laje do contrato');assert.equal(list.find(c=>c.id===id).last_volume,26);
 const report=(await request('/contracts/report?date='+today,{cookie:manager})).body;const row=report.rows.find(r=>r.appointment_id===appointment);assert.equal(row.date,today);assert.equal(row.planned_volume,27);assert.equal(row.resistance,booking.resistance);assert.equal(row.contact_date,today);assert(row.booked_at);
 assert.equal((await request('/appointments/'+appointment,{method:'PATCH',cookie:manager,data:{date:next,reason:'Remarcação depois da ligação'}})).status,200);
 const changed=(await request('/contracts/report?date='+today,{cookie:manager})).body.rows.find(r=>r.appointment_id===appointment);assert.equal(changed.date,today);assert.equal(changed.current_date,next);
 assert.equal((await request('/appointments/'+appointment,{method:'PATCH',cookie:manager,data:{status:'cancelado',reason:'Cliente cancelou depois da remarcação'}})).status,200);
 const clientReport=(await request('/contracts/'+id+'/customer-report',{cookie:controller})).body;assert.equal(clientReport.totals.scheduled,1);assert.equal(clientReport.totals.rescheduled,1);assert.equal(clientReport.totals.cancelled,1);assert.equal(clientReport.totals.planned,27);assert.equal(clientReport.totals.active_planned,0);assert.equal(clientReport.totals.delivered,26);assert.equal(clientReport.events.length,2);assert.equal((await request('/contracts/'+id+'/customer-report',{cookie:seller.cookie})).status,403);
 const client=(await request('/customers?q=Cliente contrato',{cookie:manager})).body[0];const info=(await request('/contracts/customer-info?id='+client.id,{cookie:controller})).body;assert(info.addresses.includes(input.address));assert.equal(info.completed.length,0,'Concretagens futuras não viram última concretagem');
 saved=await request('/contracts/'+id+'/close',{method:'POST',cookie:manager,data:{expected_version:2,reason:'Obra finalizada'}});assert.equal(saved.status,200);
 assert(!(await request('/contracts',{cookie:controller})).body.some(c=>c.id===id));assert((await request('/contracts?status=encerrado',{cookie:controller})).body.some(c=>c.id===id));
 assert.equal((await request('/contracts/'+id+'/contacts',{method:'POST',cookie:controller,data:{expected_version:3,contact_notes:'Contrato encerrado',next_contact:next}})).status,409);
 assert.equal((await request('/contracts/'+id,{cookie:manager})).body.contacts.length,2);
});

test('contratos recuperam a concretagem da obra correta e acompanham a unificação do cliente',async()=>{
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 for(const [work,date,piece,volume] of [['Rua A','2020-03-01','Fundação A',11],['Rua B','2021-03-01','Laje B',17],['Rua A','2040-03-01','Obra futura',99]]){
  const result=await request('/appointments',{method:'POST',cookie:controller,data:{...booking,customer:'Histórico contrato',seller_id:seller.id,type:'convencional',work,date,piece}});assert.equal(result.status,200);
  assert.equal((await request('/appointments/'+result.body.id,{method:'PATCH',cookie:manager,data:{status:'concluido',delivered_volume:volume}})).status,200);
 }
 const customer=(await request('/customers?q=Histórico contrato',{cookie:manager})).body[0],ids=[];
 for(const address of ['Rua A','Rua B']){const saved=await request('/contracts',{method:'POST',cookie:controller,data:{customer_id:customer.id,work_name:'Edifício '+address,address,next_contact:today}});assert.equal(saved.status,200,JSON.stringify(saved.body));ids.push(saved.body.id);}
 const rows=(await request('/contracts',{cookie:controller})).body;assert.equal(rows.find(c=>c.id===ids[0]).last_piece,'Fundação A');assert.equal(rows.find(c=>c.id===ids[0]).last_volume,11);assert.equal(rows.find(c=>c.id===ids[1]).last_piece,'Laje B');
 const info=(await request('/contracts/customer-info?id='+customer.id,{cookie:controller})).body;assert.equal(info.completed.length,2);assert.deepEqual(new Set(info.addresses),new Set(['Rua A','Rua B']));
 assert.equal((await request('/appointments',{method:'POST',cookie:controller,data:{...booking,customer:'Destino contratos',seller_id:seller.id,type:'convencional',work:'Rua C'}})).status,200);
 const destination=(await request('/customers?q=Destino contratos',{cookie:manager})).body[0],preview=(await request('/customers/'+customer.id+'/edit-preview?name=Destino%20contratos',{cookie:admin})).body;
 assert.equal((await request('/customers/'+customer.id,{method:'PATCH',cookie:admin,data:{name:'Destino contratos',preview_token:preview.preview_token,merge_existing:true}})).status,200);
 for(const id of ids){const c=(await request('/contracts/'+id,{cookie:controller})).body;assert.equal(c.customer_id,destination.id);assert.equal(c.customer,'DESTINO CONTRATOS');assert.equal(c.version,1);}
});

test('relatórios identificam o nome da obra do contrato ativo pelo cliente, vendedor e endereço',async()=>{
 const customer='Cliente nomes de obras',a=(await request('/appointments',{method:'POST',cookie:controller,data:{...booking,customer,seller_id:seller.id,type:'convencional',work:'Rua do prédio A',work_name:'Residencial Alameda',date:'2027-05-03'}})).body.id;
 const b=(await request('/appointments',{method:'POST',cookie:controller,data:{...booking,customer,seller_id:seller.id,type:'convencional',work:'Rua do prédio B',work_name:'Edifício B',date:'2027-05-03'}})).body.id;
 const c=(await request('/contracts',{method:'POST',cookie:controller,data:{customer,seller_id:seller.id,work_name:'Residencial Alameda',address:'Rua do prédio A',next_contact:'2027-05-03'}}));assert.equal(c.status,200);
 let rows=(await request('/report?from=2027-05-03&to=2027-05-03',{cookie:manager})).body;assert.equal(rows.find(r=>r.id===a).work_name,'Residencial Alameda');assert.equal(rows.find(r=>r.id===b).work_name,'Edifício B');
 assert.equal((await request('/appointments/'+a,{cookie:seller.cookie})).body.work_name,'Residencial Alameda');
 assert.equal((await request('/appointments/'+a,{method:'PATCH',cookie:manager,data:{status:'cancelado',reason:'Cliente solicitou cancelamento'}})).status,200);
 const events=(await request('/changes?from=2027-05-03&to=2027-05-03&basis=before',{cookie:manager})).body;assert.equal(events.find(e=>e.appointment_id===a).work_name,'Residencial Alameda');
 const report=(await request('/contracts/'+c.body.id+'/customer-report',{cookie:manager})).body;assert.equal(report.appointments.find(r=>r.id===a).work_name,'Residencial Alameda');assert.equal(report.appointments.find(r=>r.id===b).work_name,'Edifício B');
 assert.equal((await request('/contracts/'+c.body.id+'/close',{method:'POST',cookie:controller,data:{expected_version:0,reason:'Contrato encerrado'}})).status,200);
 rows=(await request('/report?from=2027-05-03&to=2027-05-03&status=cancelado',{cookie:manager})).body;assert.equal(rows.find(r=>r.id===a).work_name,'Residencial Alameda');
});

test('nome da obra é obrigatório, salvo por cliente/endereço e acompanha solicitações aprovadas',async()=>{
 const customer='Cliente catálogo obras',data={...booking,customer,seller_id:seller.id,type:'convencional',date:'2039-09-01'};
 for(const work_name of [undefined,'','   '])assert.equal((await request('/appointments',{method:'POST',cookie:admin,data:{...data,work_name}})).status,400);
 assert.equal((await request('/requests',{method:'POST',cookie:seller.cookie,data:{...data,work_name:''}})).status,400);
 const a=await request('/appointments',{method:'POST',cookie:admin,data:{...data,work_name:'Residencial Sul',work:'Rua Sul'}});assert.equal(a.status,200);
 const b=await request('/requests',{method:'POST',cookie:seller.cookie,data:{...data,work_name:'Edifício Norte',work:'Rua Norte'}});assert.equal(b.status,200);
 assert.equal((await request('/requests/'+b.body.id,{method:'PATCH',cookie:controller,data:{status:'aprovada'}})).status,200);
 const client=(await request('/customers?q=Cliente catálogo obras',{cookie:admin})).body[0];assert.equal(client.work_name,'Edifício Norte');
 const works=(await request('/customers/'+client.id+'/works',{cookie:seller.cookie})).body;assert.deepEqual(new Set(works.map(w=>w.work_name+'|'+w.address)),new Set(['Residencial Sul|Rua Sul','Edifício Norte|Rua Norte']));
 const approved=(await request('/appointments?from=2039-09-01&to=2039-09-01',{cookie:admin})).body.find(a=>a.request_id===b.body.id);assert.equal(approved.work_name,'Edifício Norte');
 assert.equal((await request('/appointments/'+a.body.id,{method:'PATCH',cookie:manager,data:{work_name:'Residencial Sul revisado',expected_information_version:0}})).status,200);
 assert.equal((await request('/customers?q=Cliente catálogo obras',{cookie:admin})).body[0].work_name,'Edifício Norte','Editar a obra antiga não troca o nome da obra mais recente');
 assert((await request('/customers/'+client.id+'/works',{cookie:controller})).body.some(w=>w.work_name==='Residencial Sul revisado'));
 const otherLogin=(await request('/login',{method:'POST',data:{username:'outra.vendedora',password:password+'novo'}})).cookie;assert.equal((await request('/customers/'+client.id+'/works',{cookie:otherLogin})).status,404);
});

test('um cliente pode ter vários contratos/obras sem duplicar seu cadastro nem os contatos',async()=>{
 const input={customer:'Cliente várias obras',seller_id:seller.id,work_name:'Obra Um',address:'Endereço Um',contact_name:'Carlos',contact_phone:'45999998888',next_contact:'2039-09-02'};
 const a=await request('/contracts',{method:'POST',cookie:controller,data:input});assert.equal(a.status,200);
 const first=(await request('/contracts/'+a.body.id,{cookie:manager})).body;assert(first.customer_id);
 const b=await request('/contracts',{method:'POST',cookie:manager,data:{...input,customer_id:first.customer_id,work_name:'Obra Dois',address:'Endereço Dois',next_contact:'2039-09-03'}});assert.equal(b.status,200);
 const second=(await request('/contracts/'+b.body.id,{cookie:controller})).body;assert.equal(second.customer_id,first.customer_id);assert.equal(second.contact_name,'Carlos');assert.equal(second.contact_phone,'(45) 9 9999-8888');
 assert.equal((await request('/customers?q=Cliente várias obras',{cookie:admin})).body.length,1);
 assert.equal((await request('/contracts/'+a.body.id+'/close',{method:'POST',cookie:manager,data:{expected_version:0,reason:'Primeira obra finalizada'}})).status,200);
 assert.equal((await request('/contracts/'+b.body.id,{cookie:manager})).body.status,'ativo');
 const works=(await request('/customers/'+first.customer_id+'/works',{cookie:controller})).body;assert.deepEqual(new Set(works.map(w=>w.work_name)),new Set(['Obra Um','Obra Dois']));
});

test('histórico de metas separa meses anteriores/futuros e calcula volumes e percentuais sem duplicar cancelamentos',async()=>{
 assert.equal((await request('/production/goals')).status,401);assert.equal((await request('/production/goals',{cookie:seller.cookie})).status,403);assert.equal((await request('/production/goals?period=invalid',{cookie:manager})).status,400);
 const month=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date());
 for(const [month,volume] of [['1999-01',50],['2099-01',200]])assert.equal((await request('/production',{method:'PATCH',cookie:manager,data:{month,volume}})).status,200);
 const a=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,type:'convencional',seller_id:seller.id,date:'1999-01-05',planned_volume:80}});assert.equal(a.status,200);await request('/appointments/'+a.body.id,{method:'PATCH',cookie:manager,data:{delivered_volume:60,status:'concluido'}});
 const b=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,type:'convencional',seller_id:seller.id,date:'1999-01-06',planned_volume:40}});assert.equal(b.status,200);await request('/appointments/'+b.body.id,{method:'PATCH',cookie:manager,data:{delivered_volume:10,status:'cancelado',reason:'Saldo cancelado'}});
 assert.equal((await request('/appointments',{method:'POST',cookie:admin,data:{...booking,type:'convencional',seller_id:seller.id,date:'2099-01-05',planned_volume:100}})).status,200);
 const past=(await request('/production/goals?period=past',{cookie:manager})).body;assert.equal(past.current_month,month);assert(past.rows.every(g=>g.month<month));const history=past.rows.find(g=>g.month==='1999-01');assert.equal(history.target,50);assert.equal(history.programmed,80);assert.equal(history.delivered,70);assert.equal(history.percent,160);assert.equal(history.delivery_percent,140);
 const future=(await request('/production/goals?period=future',{cookie:controller})).body;assert(future.rows.every(g=>g.month>month));const planned=future.rows.find(g=>g.month==='2099-01');assert.equal(planned.programmed,100);assert.equal(planned.delivered,0);assert.equal(planned.percent,50);assert.equal(planned.delivery_percent,0);assert.equal(planned.missing,1);
 assert.equal((await request('/appointments/'+a.body.id,{method:'PATCH',cookie:manager,data:{date:'1999-02-05',reason:'Mudança de mês'}})).status,200);const updated=(await request('/production/goals?period=past',{cookie:manager})).body.rows.find(g=>g.month==='1999-01');assert.equal(updated.programmed,0);assert.equal(updated.delivered,10);assert.equal(updated.delivery_percent,20);
});


test('Programador edita nomes sem alterar credenciais, vínculos, acessos ou sessões',async()=>{
 const users=(await request('/users',{cookie:admin})).body,target=users.find(u=>u.role==='gerente');
 const changed=await request('/users/'+target.id,{method:'PATCH',cookie:admin,data:{action:'rename',name:'Gerente com nome atualizado',expected_name:target.name,username:'login-forjado',role:'programador',status:'bloqueado'}});assert.equal(changed.status,200);
 const after=(await request('/users',{cookie:admin})).body.find(u=>u.id===target.id);assert.equal(after.name,'Gerente com nome atualizado');for(const key of ['id','username','role','active','status','must_change'])assert.equal(after[key],target[key]);assert.equal((await request('/session',{cookie:manager})).body.user.name,after.name);
 assert.equal((await request('/users/'+target.id,{method:'PATCH',cookie:admin,data:{action:'rename',name:'Outra alteração',expected_name:target.name}})).status,409);
 assert.equal((await request('/users/'+target.id,{method:'PATCH',cookie:seller.cookie,data:{action:'rename',name:'Sem autorização',expected_name:after.name}})).status,403);
 for(const name of ['', '   ','x'.repeat(201)])assert.equal((await request('/users/'+target.id,{method:'PATCH',cookie:admin,data:{action:'rename',name,expected_name:after.name}})).status,400);
 const self=users.find(u=>u.role==='programador');assert.equal((await request('/users/'+self.id,{method:'PATCH',cookie:admin,data:{action:'rename',name:'Admin nome atualizado',expected_name:self.name}})).status,200);const session=(await request('/session',{cookie:admin})).body.user;assert.equal(session.name,'Admin nome atualizado');assert.equal(session.role,'programador');assert.equal((await request('/users/'+self.id,{method:'PATCH',cookie:admin,data:{status:'bloqueado',role:'vendedor'}})).status,403);
});

test('ajustes operacionais na mesma data dispensam motivo, mas mudança de data continua exigindo',async()=>{
 const created=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,date:'2040-03-11',start:'07:00',duration:60,type:'convencional',seller_id:seller.id}});assert.equal(created.status,200);const id=created.body.id;
 let edited=await request('/appointments/'+id,{method:'PATCH',cookie:manager,data:{start:'08:00',duration:90,delivered_volume:25}});assert.equal(edited.status,200);const current=(await request('/appointments/'+id,{cookie:admin})).body;assert.equal(current.start,'08:00');assert.equal(current.duration,90);assert.equal(current.delivered_volume,25);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:controller,data:{type:'bomba',pump_id:pumpId}})).status,200);
 const spare=await request('/pumps',{method:'POST',cookie:admin,data:{name:'BL AJUSTE SEM MOTIVO'}});assert.equal(spare.status,200);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:manager,data:{pump_id:spare.body.id}})).status,200);
 let history=(await request('/appointments/'+id+'/history',{cookie:admin})).body;assert.equal(history.length,3);assert(history.every(e=>e.actor_id&&e.reason==='Ajuste operacional na mesma data.'));assert.equal(history[0].before.pump_id,pumpId);assert.equal(history[0].after.pump_id,spare.body.id);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:manager,data:{date:'2040-03-12'}})).status,400);assert.equal((await request('/appointments/'+id,{cookie:admin})).body.date,'2040-03-11');
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:manager,data:{date:'2040-03-12',reason:'Cliente pediu outra data'}})).status,200);
 history=(await request('/appointments/'+id+'/history',{cookie:admin})).body;assert.equal(history.length,4);assert.equal(history[0].reason,'Cliente pediu outra data');assert.equal(history[0].before.date,'2040-03-11');assert.equal(history[0].after.date,'2040-03-12');
});

test('volume programado editável recalcula viagens e produção e protege contra sobrescrita',async()=>{
 const created=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,date:'2041-02-11',type:'convencional',seller_id:seller.id,planned_volume:250}});assert.equal(created.status,200);const id=created.body.id;
 for(const value of [0,-1,'',null,'abc'])assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:manager,data:{planned_volume:value,expected_planned_volume:250}})).status,400);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:seller.cookie,data:{planned_volume:90,expected_planned_volume:250}})).status,403);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:manager,data:{planned_volume:90,expected_planned_volume:250}})).status,200);
 let saved=(await request('/appointments/'+id,{cookie:admin})).body;assert.equal(saved.planned_volume,90);assert.equal(saved.trips,10);assert.equal(saved.date,'2041-02-11');assert.equal(saved.delivered_volume,null);
 const production=(await request('/production?month=2041-02',{cookie:manager})).body;assert.equal(production.programmed,90);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:manager,data:{planned_volume:150,expected_planned_volume:250}})).status,409);
 assert.equal((await request('/appointments/'+id,{method:'PATCH',cookie:manager,data:{delivered_volume:85}})).status,200);saved=(await request('/appointments/'+id,{cookie:admin})).body;assert.equal(saved.planned_volume,90);assert.equal(saved.delivered_volume,85);
 const audit=(await request('/audit',{cookie:admin})).body;const change=audit.find(e=>e.entity==='agendamento'&&e.entity_id===id&&JSON.parse(e.detail).antes?.planned_volume===250);assert(change);assert.equal(JSON.parse(change.detail).depois.planned_volume,90);assert(change.user_name);
});
