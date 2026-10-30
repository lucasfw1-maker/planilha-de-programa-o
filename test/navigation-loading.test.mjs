import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),source=app.slice(app.indexOf('let pageLoadGeneration='),app.indexOf('\nfunction isManager()'));
function setup(page='customers',role='programador'){
 const calls=[],state={page,user:{role},customerQuery:'',date:'2026-10-28',mode:'month',requests:[],appointments:[],technicalTickets:[],maintenanceJobs:[]};
 const context=vm.createContext({state,labOperator:()=>false,labPages:[],canLab:()=>false,canAppointmentChanges:()=>['programador','gerente','controlador','gerente_concresuper','vendedor'].includes(state.user.role),URLSearchParams,Promise,today:()=> '2026-10-28',shift:()=> '2026-11-03',monthRange:()=>['2026-10-01','2026-10-31'],range:()=>['2026-10-28','2026-10-28'],engineeringRole:()=>['engenharia','gerente_engenharia'].includes(state.user.role),canTickets:()=>['programador','engenharia','gerente_engenharia','vendedor','gerente_concresuper'].includes(state.user.role),isManager:()=>['programador','gerente','controlador','gerente_concresuper'].includes(state.user.role),canManageProduction:()=>['programador','gerente','gerente_concresuper'].includes(state.user.role),loadingReportDate:()=> '2026-10-29',api:path=>new Promise((resolve,reject)=>{calls.push({path,resolve,reject});})});
 vm.runInContext(source+'\nglobalThis.loadPage=load;',context);return {state,calls,load:context.loadPage};
}
const resolveCalls=calls=>calls.forEach(call=>call.resolve(call.path==='/meta'?{pumps:[],profiles:[]} :call.path.includes('/summary')?{pending:0,pending_maintenance:0,pending_logistics:0,version:'0'}:[]));
test('Clientes inicia consultas independentes juntas e não carrega agenda nem históricos completos',async()=>{
 const {state,calls,load}=setup(),promise=load();assert.equal(calls.length,5);assert.deepEqual(calls.map(c=>c.path).sort(),['/meta','/appointment-change-requests/summary','/technical-tickets/summary','/equipment-maintenance/summary','/customers?q='].sort());
 const customers=calls.find(c=>c.path.startsWith('/customers'));customers.resolve([{id:1,name:'CLIENTE'}]);resolveCalls(calls.filter(c=>c!==customers));assert.equal(await promise,true);assert.equal(state.customers[0].name,'CLIENTE');
});
test('agenda carrega dados do período em paralelo, sem cadastro completo da frota ou histórico de chamados',async()=>{
 const {calls,load}=setup('agenda'),promise=load();const version=calls.find(c=>c.path==='/agenda-version');assert(version);assert(!calls.some(c=>c.path.startsWith('/appointments?')));version.resolve({version:'first'});await Promise.resolve();assert.equal(calls.length,12);assert(calls.some(c=>c.path==='/appointments?from=2026-10-01&to=2026-10-31'));assert(calls.some(c=>c.path.startsWith('/equipment-maintenance/calendar?')));assert(!calls.some(c=>c.path==='/equipment-maintenance/equipment'||c.path==='/equipment-maintenance/requests'||c.path.startsWith('/technical-tickets?')));resolveCalls(calls);assert.equal(await promise,true);
});
test('resposta atrasada de outro menu não substitui a tela nem seus dados',async()=>{
 const {state,calls,load}=setup(),first=load(),firstCalls=[...calls];state.page='requests';const second=load(),secondCalls=calls.slice(firstCalls.length);resolveCalls(secondCalls);assert.equal(await second,true);resolveCalls(firstCalls);assert.equal(await first,false);assert.equal(state.page,'requests');assert.equal(state.customers,undefined);
});
test('Engenharia carrega somente chamados e metadados, removendo dados de outro perfil da memória',async()=>{
 const {state,calls,load}=setup('home','engenharia');state.requests=[{private:true}];state.maintenanceSummary={pending_logistics:10};const promise=load();assert.equal(state.page,'tickets');assert.deepEqual(calls.map(c=>c.path).sort(),['/meta','/technical-tickets/summary','/technical-tickets?status=todos'].sort());resolveCalls(calls);assert.equal(await promise,true);assert.equal(state.requests.length,0);assert.equal(state.maintenanceSummary,null);
});

test('atualização de fundo não aplica dados se um formulário começar a ser editado durante a consulta',async()=>{
 const {state,calls,load}=setup();const result=load({canCommit:()=>false});resolveCalls(calls);assert.equal(await result,false);assert.equal(state.customers,undefined);
});
