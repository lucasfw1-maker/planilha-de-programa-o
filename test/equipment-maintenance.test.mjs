import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'equipment-maintenance-')),password='Teste-Equipamentos-2027!';let server,base,admin,maintenance,logistics,manager,seller,pump,cb;
async function req(path,cookie,method='GET',data){const res=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
before(async()=>{server=spawn(process.execPath,['server.mjs'],{env:{...process.env,DB_PATH:join(dir,'db.sqlite'),PORT:'0'},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{server.stdout.on('data',value=>{const m=String(value).match(/porta (\d+)/);if(m)resolve('http://127.0.0.1:'+m[1]+'/api');});server.once('error',reject);});admin=(await req('/bootstrap',null,'POST',{name:'Admin',username:'admin.equip',password})).cookie;for(const role of ['manutencao','controlador','gerente','vendedor']){assert.equal((await req('/users',admin,'POST',{name:role,username:role,password,role})).status,200);const login=await req('/login',null,'POST',{username:role,password}),changed=await req('/change-password',login.cookie,'POST',{currentPassword:password,newPassword:password+'novo'});assert.equal(changed.status,200);if(role==='manutencao')maintenance=changed.cookie;if(role==='controlador')logistics=changed.cookie;if(role==='gerente')manager=changed.cookie;if(role==='vendedor')seller=changed.cookie;}
 pump=(await req('/pumps',admin,'POST',{name:'BL TESTE',plate:'ABC-1234',branch:'pacaembu'})).body.id;cb=(await req('/equipment-maintenance/equipment',manager,'POST',{code:'CB 01',plate:'DEF1G23',branch:'pacaembu'})).body.id;});
after(()=>{server?.kill();rmSync(dir,{recursive:true,force:true});});
test('perfil Manutenção tem apenas seu módulo, cadastro de equipamentos e perfil próprio',async()=>{for(const path of ['/appointments?from=2030-01-01&to=2030-01-31','/requests','/customers','/report?from=2030-01-01&to=2030-01-31','/users','/audit','/production?month=2030-01'])assert.equal((await req(path,maintenance)).status,403,path);assert.equal((await req('/equipment-maintenance/equipment',maintenance)).status,200);assert.equal((await req('/equipment-maintenance/requests',seller)).status,403);assert.equal((await req('/equipment-maintenance/equipment',logistics,'POST',{code:'CB 99'})).status,403);});
test('acordo exige pessoas diferentes e contraproposta invalida o aceite anterior',async()=>{
 const initial=await req('/equipment-maintenance/requests',maintenance,'POST',{equipment_type:'bomba',pump_id:pump,starts_at:'2030-01-10T07:00',ends_at:'2030-01-10T10:00',reason:'Troca preventiva de óleo'});assert.equal(initial.status,200,JSON.stringify(initial.body));const path='/equipment-maintenance/requests/'+initial.body.id;
 assert.equal((await req('/maintenance?from=2030-01-10&to=2030-01-10',admin)).body.length,0);
 assert.equal((await req(path+'/accept',maintenance,'POST',{side:'logistics',expected_revision:0})).status,403);
 const counter=await req(path+'/negotiate',logistics,'POST',{side:'logistics',expected_revision:0,starts_at:'2030-01-10T13:00',ends_at:'2030-01-10T16:00',reason:'Troca preventiva de óleo',note:'Após as concretagens'});assert.equal(counter.status,200);assert.equal(counter.body.maintenance_approved_by,null);assert.equal(counter.body.revision,1);
 assert.equal((await req(path+'/accept',maintenance,'POST',{side:'maintenance',expected_revision:0})).status,409);
 const accepted=await req(path+'/accept',maintenance,'POST',{side:'maintenance',expected_revision:1});assert.equal(accepted.status,200,JSON.stringify(accepted.body));assert.equal(accepted.body.status,'confirmado');
 assert.equal((await req(path+'/accept',maintenance,'POST',{side:'maintenance',expected_revision:1})).status,409);
 assert.equal((await req('/maintenance?from=2030-01-10&to=2030-01-10',admin)).body.length,1);const available=(await req('/availability?date=2030-01-10&start=14:00&duration=60',seller)).body;assert.equal(available.pumps.find(p=>p.id===pump).available,false);
 const history=(await req(path,maintenance)).body.events;assert.equal(history.length,4);assert(history.some(e=>e.action==='negociar outra data'));assert.equal((await req(path+'/cancel',logistics,'POST',{side:'logistics',expected_revision:1,note:'Cancelar'})).status,403);
 assert.equal((await req(path+'/cancel',manager,'POST',{side:'maintenance',expected_revision:1,note:'Serviço adiado'})).status,200);assert.equal((await req(path,maintenance)).body.events.length,5);
 const self=await req('/equipment-maintenance/requests',manager,'POST',{equipment_type:'bomba',pump_id:pump,starts_at:'2030-01-11T07:00',ends_at:'2030-01-11T09:00',reason:'Inspeção'});assert.equal((await req('/equipment-maintenance/requests/'+self.body.id+'/accept',manager,'POST',{side:'logistics',expected_revision:0})).status,409);
});
test('CBs disponíveis são calculados por filial e manutenção só desconta após os dois aceites',async()=>{
 const other=(await req('/equipment-maintenance/equipment',manager,'POST',{code:'CB 02',plate:'GHI2J34',branch:'aeroporto'})).body.id;
 assert.equal((await req('/fleet?from=2030-02-01&to=2030-02-01',admin)).body.days[0].trucks,2);assert.equal((await req('/fleet?from=2030-02-01&to=2030-02-01&branch=pacaembu',admin)).body.days[0].trucks,1);
 const job=await req('/equipment-maintenance/requests',maintenance,'POST',{equipment_type:'cb',cb_id:cb,starts_at:'2030-02-01T07:00',ends_at:'2030-02-02T00:00',reason:'Revisão dos freios'});assert.equal(job.status,200);
 assert.equal((await req('/fleet?from=2030-02-01&to=2030-02-01',admin)).body.days[0].trucks,2);
 assert.equal((await req('/equipment-maintenance/requests/'+job.body.id+'/accept',logistics,'POST',{side:'logistics',expected_revision:0})).status,200);
 const fleet=(await req('/fleet?from=2030-02-01&to=2030-02-02',admin)).body.days;assert.equal(fleet[0].trucks,1);assert.equal(fleet[0].maintenance_trucks,1);assert.equal(fleet[0].default_trucks,2);assert.equal(fleet[1].trucks,2);
 const calendar=(await req('/equipment-maintenance/calendar?from=2030-02-01&to=2030-02-01',seller)).body;assert.equal(calendar[0].cb_code,'CB 01');assert.equal(calendar[0].reason,'Revisão dos freios');assert.equal(calendar[0].equipment_plate,'DEF1G23');
 assert.equal((await req('/equipment-maintenance/equipment/'+other,manager,'PATCH',{active:false})).status,200);assert.equal((await req('/fleet?from=2030-02-03&to=2030-02-03',admin)).body.days[0].trucks,1);assert.equal((await req('/equipment-maintenance/equipment/'+other,manager,'PATCH',{active:true})).status,200);
 const report=(await req('/equipment-maintenance/report?from=2030-02-01&to=2030-02-02&branch=pacaembu',maintenance)).body;assert.equal(report.jobs.length,1);assert.equal(report.jobs[0].equipment_code,'CB 01');assert.equal((await req('/equipment-maintenance/report?from=2030-02-01&to=2030-02-02',logistics)).status,403);
});
test('bombas inativas não aparecem para novas reservas, placas e histórico são preservados',async()=>{
 assert.equal((await req('/pumps/'+pump,manager,'PATCH',{active:false})).status,200);assert(!(await req('/availability?date=2030-03-01&start=07:00&duration=60',seller)).body.pumps.some(p=>p.id===pump));
 assert.equal((await req('/pumps/'+pump,manager,'PATCH',{active:true,plate:'ABC1D23',branch:'aeroporto'})).status,200);const item=(await req('/meta',admin)).body.pumps.find(p=>p.id===pump);assert.equal(item.plate,'ABC1D23');assert.equal(item.branch,'aeroporto');assert.equal(item.active,1);
 assert.equal((await req('/pumps/'+pump,logistics,'PATCH',{active:false})).status,403);assert.equal((await req('/pumps/'+pump,manager,'PATCH',{plate:'INVÁLIDA'})).status,400);
 const history=(await req('/equipment-maintenance/report?from=2030-01-01&to=2030-01-31',maintenance)).body.jobs;assert(history.some(j=>j.equipment_plate==='ABC1234'&&j.branch==='pacaembu'));
});

test('obra existente gera aviso mas não impede confirmação; logística pode trocar a bomba depois',async()=>{
 const meta=(await req('/meta',admin)).body,sellerId=meta.sellers[0].id;
 const booking={customer:'Cliente manutenção',work_name:'Obra de teste',work:'Rua Teste',date:'2030-04-02',start:'07:00',duration:120,type:'bomba',pump_id:pump,seller_id:sellerId,planned_volume:20,gravel:'1+0',resistance:'30',piece:'Laje'};
 const created=await req('/appointments',admin,'POST',booking);assert.equal(created.status,200);
 const proposed=await req('/equipment-maintenance/requests',maintenance,'POST',{equipment_type:'bomba',pump_id:pump,starts_at:'2030-04-02T07:00',ends_at:'2030-04-02T10:00',reason:'Revisão com aviso para logística'});assert.equal(proposed.status,200);assert.equal(proposed.body.conflicts[0].id,created.body.id);
 const confirmed=await req('/equipment-maintenance/requests/'+proposed.body.id+'/accept',logistics,'POST',{side:'logistics',expected_revision:0});assert.equal(confirmed.status,200);assert.equal(confirmed.body.status,'confirmado');assert.equal(confirmed.body.conflicts.length,1);
 const original=(await req('/appointments/'+created.body.id,admin)).body;assert.equal(original.pump_id,pump);assert.equal(original.status,'confirmado');
 const backup=(await req('/pumps',admin,'POST',{name:'BL APOIO',plate:'JKL3M45',branch:'aeroporto'})).body.id;
 assert.equal((await req('/appointments/'+created.body.id,logistics,'PATCH',{pump_id:backup,reason:'Realocado devido à manutenção confirmada'})).status,200);
 const history=(await req('/equipment-maintenance/requests/'+proposed.body.id,maintenance)).body;assert.equal(history.conflicts.length,0);assert(history.events.some(e=>e.note.includes('obra(s) já agendada(s)')));
 const report=(await req('/equipment-maintenance/report?from=2030-04-01&to=2030-04-30',maintenance)).body;assert(report.events.some(e=>e.job_id===proposed.body.id&&e.action==='confirmar programação'));
});

test('consultar obras avisa antes da proposta e dois serviços do mesmo CB descontam só um caminhão',async()=>{
 const meta=(await req('/meta',admin)).body,sellerId=meta.sellers[0].id;
 const work=await req('/appointments',admin,'POST',{customer:'Cliente aviso',work_name:'Obra aviso',work:'Rua Aviso',date:'2030-05-01',start:'07:00',duration:120,type:'bomba',pump_id:pump,seller_id:sellerId,planned_volume:18,gravel:'1+0',resistance:'30',piece:'Laje'});assert.equal(work.status,200);
 const conflicts=await req('/equipment-maintenance/conflicts?pump_id='+pump+'&starts_at=2030-05-01T07:00&ends_at=2030-05-01T10:00',maintenance);assert.equal(conflicts.status,200);assert.equal(conflicts.body[0].id,work.body.id);
 for(const [start,end] of [['07:00','09:00'],['13:00','15:00']]){const job=await req('/equipment-maintenance/requests',maintenance,'POST',{equipment_type:'cb',cb_id:cb,starts_at:'2030-05-01T'+start,ends_at:'2030-05-01T'+end,reason:'Serviço '+start});assert.equal(job.status,200);assert.equal((await req('/equipment-maintenance/requests/'+job.body.id+'/accept',logistics,'POST',{side:'logistics',expected_revision:0})).status,200);}
 const fleet=(await req('/fleet?from=2030-05-01&to=2030-05-01&branch=pacaembu',admin)).body.days[0];assert.equal(fleet.maintenance_trucks,1);assert.equal(fleet.trucks,0);
 assert.equal((await req('/equipment-maintenance/equipment',manager,'POST',{code:'CB DUPLICADO',plate:'DEF1G23',branch:'aeroporto'})).status,409);
});

test('um CB em manutenção por vários dias é descontado em cada dia abrangido e retorna fora do período',async()=>{
 const proposed=await req('/equipment-maintenance/requests',maintenance,'POST',{equipment_type:'cb',cb_id:cb,starts_at:'2030-06-10T08:00',ends_at:'2030-06-13T17:00',reason:'Reforma da betoneira por vários dias'});assert.equal(proposed.status,200);
 assert.equal((await req('/equipment-maintenance/requests/'+proposed.body.id+'/accept',logistics,'POST',{side:'logistics',expected_revision:0})).status,200);
 const days=(await req('/fleet?from=2030-06-09&to=2030-06-14&branch=pacaembu',admin)).body.days;assert.deepEqual(days.map(d=>d.trucks),[1,0,0,0,0,1]);assert.deepEqual(days.map(d=>d.maintenance_trucks),[0,1,1,1,1,0]);
 for(const day of ['2030-06-10','2030-06-11','2030-06-12','2030-06-13']){const calendar=(await req('/equipment-maintenance/calendar?from='+day+'&to='+day,seller)).body;assert(calendar.some(j=>j.id===proposed.body.id&&j.reason==='Reforma da betoneira por vários dias'));}
 assert(!(await req('/equipment-maintenance/calendar?from=2030-06-14&to=2030-06-14',seller)).body.some(j=>j.id===proposed.body.id));
});
