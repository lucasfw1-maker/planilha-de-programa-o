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
const booking={customer:'Cliente Teste',work:'Obra Centro',date:'2027-01-04',start:'07:00',duration:120,type:'bomba',planned_volume:24,gravel:'1+0',resistance:'30 MPa',piece:'Laje',notes:'Com fibra; slump máximo 16',trips:3};
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
 assert.equal((await request('/appointments/'+appointmentId,{method:'PATCH',cookie:controller,data:{delivered_volume:26,status:'concluido',planned_volume:999}})).status,200);
 const report=await request('/report?from=2027-01-04&to=2027-01-04&type=bomba&status=concluido',{cookie:admin});assert.equal(report.body.length,1);assert.equal(report.body[0].planned_volume,24);assert.equal(report.body[0].delivered_volume,26);
 assert.equal((await request('/report?from=2027-01-01&to=2027-01-31&seller='+seller.id,{cookie:other})).body.length,0);
 assert.equal((await request('/report?from=2027-02-01&to=2027-01-01',{cookie:admin})).status,400);
 const all=await request('/report?from=2027-01-01&to=2027-01-31',{cookie:admin});assert(all.body.some(a=>a.delivered_volume===null));
 const audit=await request('/audit',{cookie:admin});assert(audit.body.some(a=>a.action==='editar'&&a.user_name==='controlador'));assert(!JSON.stringify(audit.body).includes(password));
});
test('manutenção bloqueia reservas e datas inválidas são rejeitadas',async()=>{
 assert.equal((await request('/pumps/'+pumpId,{method:'PATCH',cookie:manager,data:{maintenance:true}})).status,200);
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
 let r=await request('/availability?date=2027-01-04&start=07:00&duration=120',{cookie:seller.cookie});assert.equal(r.status,200);assert.equal(r.body.pumps[0].available,false);assert(!JSON.stringify(r.body).includes('Cliente Teste'));
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

test('manutenção por período bloqueia novos serviços, alerta conflitos e preserva obras e produção existentes',async()=>{
 const pump=(await request('/meta',{cookie:admin})).body.pumps.find(p=>p.name==='BLM1');
 const created=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,date:'2030-08-10',pump_id:pump.id,seller_id:seller.id}});assert.equal(created.status,200);
 const period={pump_id:pump.id,starts_at:'2030-08-10T08:00',ends_at:'2030-08-10T10:00',reason:'Troca de mangueira'};
 assert.equal((await request('/maintenance',{method:'POST',cookie:seller.cookie,data:period})).status,403);
 assert.equal((await request('/maintenance',{method:'POST',cookie:controller,data:{...period,ends_at:'2030-08-10T07:00'}})).status,400);
 const maintenance=await request('/maintenance',{method:'POST',cookie:controller,data:period});assert.equal(maintenance.status,200);assert.equal(maintenance.body.conflicts.length,1);assert.equal(maintenance.body.conflicts[0].id,created.body.id);
 assert.equal((await request('/appointments/'+created.body.id,{cookie:admin})).body.status,'confirmado');
 const block=await request('/appointments',{method:'POST',cookie:admin,data:{...booking,date:'2030-08-10',start:'08:00',pump_id:pump.id,seller_id:seller.id}});assert.equal(block.status,409);assert.match(block.body.error,/manutenção/);
 assert.equal((await request('/appointments/'+created.body.id,{method:'PATCH',cookie:admin,data:{delivered_volume:18}})).status,200);
 assert.equal((await request('/appointments/'+created.body.id,{method:'PATCH',cookie:manager,data:{date:'2030-08-10',start:'08:00',reason:'Tentativa de remarcar em manutenção'}})).status,409);
 const available=await request('/availability?date=2030-08-10&start=10:00&duration=60',{cookie:seller.cookie});assert.equal(available.body.pumps.find(p=>p.id===pump.id).available,true);
 const publicList=await request('/maintenance?from=2030-08-10&to=2030-08-10',{cookie:seller.cookie});assert.equal(publicList.body.length,1);assert(!('reason' in publicList.body[0]));assert(!('created_by' in publicList.body[0]));
 assert.equal((await request('/maintenance/'+maintenance.body.id,{method:'PATCH',cookie:manager,data:{reason:''}})).status,400);
 assert.equal((await request('/maintenance/'+maintenance.body.id,{method:'PATCH',cookie:manager,data:{reason:'Serviço não será necessário'}})).status,200);
 assert.equal((await request('/maintenance/'+maintenance.body.id,{method:'PATCH',cookie:manager,data:{reason:'Repetido'}})).status,409);
 const free=await request('/availability?date=2030-08-10&start=09:30&duration=30',{cookie:seller.cookie});assert.equal(free.body.pumps.find(p=>p.id===pump.id).available,true);
 const overnight=await request('/maintenance',{method:'POST',cookie:admin,data:{pump_id:pump.id,starts_at:'2030-08-10T23:00',ends_at:'2030-08-11T03:00',reason:'Manutenção noturna'}});assert.equal(overnight.status,200);
 const blocked=await request('/availability?date=2030-08-11&start=02:00&duration=60',{cookie:seller.cookie});assert.equal(blocked.body.pumps.find(p=>p.id===pump.id).maintenance,true);
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
 const foreign=(await request('/appointments?from=2031-01-10&to=2031-01-10',{cookie:other})).body.find(a=>a.id===id);assert.equal(foreign.status,'ocupado');assert.equal(foreign.customer,'Dallo');assert(!foreign.customer_code&&!foreign.order_code&&!foreign.own_booking&&!foreign.planned_volume);
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
