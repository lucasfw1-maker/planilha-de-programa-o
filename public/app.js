'use strict';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n => Number(n || 0).toLocaleString('pt-BR', {maximumFractionDigits: 1});
const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const shift = (d, days) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + days); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
const fmt = (d, opts = {}) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', opts);
const endTime = a => { const t = Number(a.start.slice(0,2))*60 + Number(a.start.slice(3)) + Number(a.duration); return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`; };
const hoursValue = minutes => String(Number((Number(minutes) / 60).toFixed(10)));
const hoursLabel = minutes => new Intl.NumberFormat('pt-BR', {maximumFractionDigits:4}).format(Number(minutes)/60) + ' h';
function hoursField(label,minutes=120) {
  return `<div class="duration-field"><label>${esc(label)}<input type="text" inputmode="decimal" name="duration_hours" required value="${esc(hoursValue(minutes))}" placeholder="Ex.: 2 ou 1,5" aria-describedby="duration-hours-hint"></label><small id="duration-hours-hint">Ex.: 1,5 = 1 hora e meia</small></div>`;
}
function hoursToMinutes(value) {
  const input=String(value).trim();
  if(!/^(?:[0-9]+(?:[.,][0-9]+)?|[.,][0-9]+)$/.test(input))throw new Error('Informe a duração em horas. Ex.: 2 ou 1,5.');
  const hours=Number(input.replace(',','.'));
  if(!Number.isFinite(hours)||hours<0.25||hours>24)throw new Error('A duração deve ser entre 0,25 e 24 horas.');
  return Math.round(hours*60);
}
const roleNames = {programador:'Programador',controlador:'Controlador de logística',gerente:'Gerente',vendedor:'Vendedor'};
const programmerCrown = '<svg class="programmer-crown" viewBox="0 0 24 24" role="img" aria-label="Programador"><path d="m3 6 4 4 5-7 5 7 4-4-3 12H6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 21h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const statusNames = {confirmado:'Confirmado',andamento:'Em atendimento',concluido:'Concluído',cancelado:'Cancelado',remarcado:'Remarcado',pendente:'Pendente',aprovada:'Aprovada',recusada:'Recusada',ajuste:'Aguardando ajuste',ocupado:'Ocupado'};
const iconPaths = {
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 request:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/>',
 chart:'<path d="M4 3v18h17M8 16v-5M13 16V7M18 16v-8"/>',
 settings:'<path d="m9 3-1 3-3 1-2 4 2 3 1 4 4 2 3-1 4-1 2-4-1-3-1-4-4-2z"/><circle cx="11" cy="12" r="3"/>',
 pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 truck:'<path d="M2 17h20v-4l-3-4h-4v8M15 13h7M2 12v3H1"/><g transform="rotate(22 8 8.5)"><rect x="2" y="4" width="12" height="9" rx="4"/><path d="M7 4v9"/></g><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
 pump:'<path d="M3 17h18M5 17V9l7-5 7 5v8M9 17v-5h6v5M12 4V2"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 cube:'<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7 5l9 5"/>',
 left:'<path d="m14 6-6 6 6 6"/>',right:'<path d="m10 6 6 6-6 6"/>',
 export:'<path d="M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6"/>',
 logout:'<path d="M9 4H3v16h6M9 12h12m-5-5 5 5-5 5"/>',
 check:'<path d="m5 12 4 4L19 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
 users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.grid}</svg>`;
const brand = () => '<div class="brand"><img class="brand-logo" src="/concresuper-symbol.png?v=2" alt="Símbolo Concresuper"><div><strong>CONCRE<span class="brand-grey">SUPER</span></strong><small>CENTRAL DE PROGRAMAÇÃO</small></div></div>';
const badge = s => `<span class="badge ${esc(s)}">${esc(statusNames[s] || s)}</span>`;
let state = {user:null, page:'agenda', mode:'day', date:today(), appointments:[], requests:[],maintenances:[], meta:{pumps:[],sellers:[],buffer:30},fleet:null,production:null,goalMonth:'',productionReport:null,productionFleet:null,management:null,managementDate:today(),managementMonth:today().slice(0,7),productionFilters:{month:today().slice(0,7),reference:today(),basis:'mon_sat'}, from:today().slice(0,8)+'01', to:today(), seller:'', type:'', status:'', report:[], users:[], audit:[], changes:[], customers:[], customerQuery:'', changeFilters:{from:today().slice(0,8)+'01',to:today(),basis:'event',kind:'',customer:'',seller:'',unknown:''}};
let poll, seen = new Map(), currentDialog = '', polling = false;
const app = $('#app'), modal = $('#modal');
async function api(path, options = {}) {
  const response = await fetch('/api' + path, {credentials:'same-origin', ...options, headers:{'Content-Type':'application/json',...options.headers}});
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && state.user) { state.user = null; clearInterval(poll); modal.close(); await boot(); }
    throw new Error(data.error || 'Não foi possível concluir.');
  }
  return data;
}
function toast(message, error = false) {
  const el = document.createElement('div'); el.className = 'toast' + (error ? ' error' : ''); el.textContent = message;
  $('#toasts').append(el); setTimeout(() => el.remove(), 6500);
}
function formError(form, message) { const el = $('.form-error', form); if (el) { el.textContent = message; el.classList.add('visible'); } else toast(message,true); }
function dialog(title, subtitle, html, onSubmit) {
  currentDialog = title;
  modal.innerHTML = `<div class="modal-header"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button type="button" data-close class="icon-only" aria-label="Fechar">${icon('close')}</button></div><div class="modal-body">${html}</div>`;
  $('[data-close]', modal).onclick = () => modal.close();
  if (!modal.open) modal.showModal();
  const form = $('form', modal);
  if (form && onSubmit) form.onsubmit = async e => {
    e.preventDefault(); const submit = $('[type=submit]', form); if (submit) submit.disabled = true;
    try { const data=Object.fromEntries(new FormData(form)); if(data.duration_hours!==undefined){data.duration=hoursToMinutes(data.duration_hours);delete data.duration_hours;} await onSubmit(data, form); }
    catch (error) { formError(form, error.message); }
    finally { if (submit) submit.disabled = false; }
  };
  $$('[data-cancel]', modal).forEach(b => b.onclick = () => modal.close());
  bindTripCalculator();
}
modal.addEventListener('close', () => { currentDialog = ''; if(!modal.open)modal.replaceChildren(); });
const footer = (submit = 'Salvar') => `<div class="form-error" role="alert"></div><div class="modal-footer"><button type="button" data-cancel>Cancelar</button><button type="submit" class="primary">${esc(submit)}</button></div>`;
function authScreen(setup, register=false) {
  modal.close();modal.replaceChildren();state.appointments=[];state.requests=[];state.maintenances=[];state.report=[];state.users=[];state.audit=[];state.changes=[];state.customers=[];state.fleet=null;state.production=null;state.goalMonth='';state.productionReport=null;state.productionFleet=null;state.management=null;seen=new Map();
  app.innerHTML = `<main class="auth"><section class="auth-brand">${brand()}<div class="auth-message"><div class="eyebrow">LOGÍSTICA QUE CONECTA</div><h1>Cada obra.<br>No tempo certo.</h1><p>Uma visão completa da programação, das bombas e das entregas. Toda a operação, no mesmo lugar.</p></div><div class="auth-footer">CONCRESUPER · Super tecnologia em concreto</div></section><section class="auth-form-area"><form class="auth-form" id="auth-form"><div class="auth-unit">${icon('pin')} Unidade Cascavel · Paraná</div><h2>${setup?'Vamos começar':register?'Solicite seu acesso':'Bem-vindo de volta'}</h2><p>${setup?'Cadastre sua conta de Programador para configurar a filial e os acessos da equipe.':register?'Seu acesso e perfil dependerão da aprovação do Programador.':'Entre com seu usuário para acessar a central de programação.'}</p>${setup||register?'<label>Nome completo<input name="name" autocomplete="name" required maxlength="200" placeholder="Nome completo"></label>':''}<label>Nome de usuário<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="32" pattern="(?:[A-Za-z0-9_.]|-){3,32}" placeholder="Ex.: joao.silva"></label><label>Senha<input name="password" type="password" autocomplete="${setup||register?'new-password':'current-password'}" minlength="8" maxlength="128" required placeholder="${setup||register?'Pelo menos 8 caracteres':'Sua senha'}"></label>${setup?'<label>Código de configuração da hospedagem<input name="setupToken" type="password" autocomplete="off" placeholder="Opcional apenas no desenvolvimento local"></label>':''}<div class="form-error" role="alert"></div><button type="submit" class="primary">${setup?'Criar conta e configurar':register?'Solicitar cadastro':'Entrar na central'} ${icon('right')}</button>${!setup?`<button type="button" id="switch-auth">${register?'Já tenho acesso — entrar':'Solicitar meu cadastro'}</button>`:''}<div class="auth-footnote">Acesso individual · Contas sujeitas à aprovação.<br>O login segue o fluxo do sistema de obras, com contas separadas.</div></form></section></main>`;
  if($('#switch-auth'))$('#switch-auth').onclick=()=>authScreen(false,!register);
  $('#auth-form').onsubmit = async e => {
    e.preventDefault(); const form=e.target, button=$('[type=submit]',form);button.disabled=true;
    try {
      const data=await api(setup?'/bootstrap':register?'/signup':'/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});
      if(register){form.reset();toast(data.message);return;}
      state.user=data.user; state.page='agenda';
      if(state.user.mustChangePassword)return passwordChange(true);
      await load(); seen = new Map(state.requests.map(r=>[r.id,r.status])); render(); startPolling();
    } catch(error) {formError(form,error.message);} finally {button.disabled=false;}
  };
}
function passwordChange(required=false) {
  clearInterval(poll);
  app.innerHTML=`<main class="password-page"><section class="panel password-card"><div class="panel-header"><h2>${required?'Crie sua senha pessoal':'Alterar minha senha'}</h2></div><form id="password-form" class="settings-form"><p class="subtitle">${required?'Você entrou com uma senha temporária. Escolha uma nova senha para acessar o sistema.':'A troca encerra as demais sessões da sua conta.'}</p><label>Senha ${required?'temporária':'atual'}<input name="currentPassword" type="password" required minlength="8" maxlength="128" autocomplete="current-password"></label><label>Nova senha<input name="newPassword" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></label><label>Confirme a nova senha<input name="confirmation" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></label><div class="form-error" role="alert"></div><div class="actions"><button type="submit" class="primary">Salvar nova senha</button><button type="button" id="password-back">${required?'Sair':'Cancelar'}</button></div></form></section></main>`;
  $('#password-back').onclick=async()=>{if(required){await api('/logout',{method:'POST',body:'{}'});state.user=null;}await boot();};
  $('#password-form').onsubmit=async e=>{
    e.preventDefault();const form=e.target,data=Object.fromEntries(new FormData(form));
    if(data.newPassword!==data.confirmation)return formError(form,'A confirmação não corresponde à nova senha.');
    const button=$('[type=submit]',form);button.disabled=true;
    try{const result=await api('/change-password',{method:'POST',body:JSON.stringify(data)});state.user=result.user;state.page='agenda';await load();render();startPolling();toast('Senha alterada.');}catch(error){formError(form,error.message);}finally{button.disabled=false;}
  };
}
async function boot() {
  try {
    const session = await api('/session'); state.user = session.user;
    if (!state.user) return authScreen(session.needsSetup);
    if(state.user.mustChangePassword)return passwordChange(true);
    await load(); seen=new Map(state.requests.map(r=>[r.id,r.status])); render(); startPolling();
  } catch(error) {app.innerHTML=`<div class="empty">Não foi possível carregar a central.<br>${esc(error.message)}<br><button id="retry">Tentar novamente</button></div>`; $('#retry').onclick=boot;}
}
function range() {
  if (state.mode==='day') return [state.date,state.date];
  const d=new Date(state.date+'T12:00:00');
  if (state.mode==='week') { const first=shift(state.date,-((d.getDay()+6)%7)); return [first,shift(first,6)]; }
  return monthRange(state.date);
}
// Month boundaries avoid month 13 when browsing December.
function monthRange(date) {
  const d=new Date(date+'T12:00:00'), last=new Date(d.getFullYear(),d.getMonth()+1,0);
  return [date.slice(0,8)+'01',`${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`];
}
async function load() {
  const [from,to] = state.mode==='month' ? monthRange(state.date) : range();
  const [meta,appointments,requests] = await Promise.all([api('/meta'),api(`/appointments?from=${from}&to=${to}`),api('/requests')]);
  state.meta=meta;state.appointments=appointments;state.requests=requests;
  if(state.page==='agenda'){[state.maintenances,state.fleet,state.production]=await Promise.all([api(`/maintenance?from=${from}&to=${to}`),isManager()?api(`/fleet?from=${from}&to=${to}`):Promise.resolve(null),isManager()?api('/production?month='+(state.goalMonth||state.date.slice(0,7))):Promise.resolve(null)]);}
  if(state.page==='agenda'&&isManager()){
    const period=cbPeriodRange(),same=period.from===from&&period.to===to;
    const [bookings,fleet]=same?[state.appointments,state.fleet]:await Promise.all([api(`/appointments?from=${period.from}&to=${period.to}`),api(`/fleet?from=${period.from}&to=${period.to}`)]);
    state.cbProduction={...period,bookings,fleet};
  }
  if (['reports','next'].includes(state.page)) await loadReport();
  if(state.page==='production'&&isManager()){const params=new URLSearchParams(state.productionFilters);const [from,to]=monthRange(state.productionFilters.month+'-01');[state.productionReport,state.productionFleet]=await Promise.all([api('/production?'+params),api(`/fleet?from=${from}&to=${to}`)]);}
  if(state.page==='management'&&canManageProduction()){const [fleet,production,maintenance]=await Promise.all([api(`/fleet?from=${state.managementDate}&to=${state.managementDate}`),api('/production?month='+state.managementMonth),api(`/maintenance?from=${state.managementDate}&to=${state.managementDate}`)]);state.management={fleet,production};state.maintenances=maintenance;}
  if(state.page==='changes')state.changes=await api('/changes?'+new URLSearchParams(state.changeFilters));
  if(state.page==='customers')state.customers=await api('/customers?q='+encodeURIComponent(state.customerQuery));
  if (state.page==='settings') [state.users,state.audit] = await Promise.all([api('/users'),api('/audit')]);
}
async function refresh() { try {await load();render();} catch(e){toast(e.message,true);} }
function isManager() {return state.user.role!=='vendedor';}
function canManageProduction(){return ['gerente','programador'].includes(state.user.role);}
function heading(title, subtitle, actions='') {return `<div class="page-heading"><div><div class="eyebrow">CENTRAL DE PROGRAMAÇÃO</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="actions">${actions}</div></div>`;}
function nav(page,name,ico,count='') {return `<button class="nav-item ${state.page===page?'active':''}" data-page="${page}">${icon(ico)}${name}${count?`<span class="count">${count}</span>`:''}</button>`;}
function render() {
  const pending=state.requests.filter(r=>r.status==='pendente').length;
  app.innerHTML=`<div class="shell"><aside class="sidebar">${brand()}<div class="nav-caption">OPERAÇÃO</div><nav>${nav('agenda','Agenda de obras','calendar')}${nav('requests',isManager()?'Solicitações':'Minhas solicitações','request',pending)}${nav(['changes','production'].includes(state.page)?state.page:'reports','Relatórios','chart')}${nav('customers','Clientes','users')}${isManager()?nav('next','Agenda de amanhã','truck'):''}${canManageProduction()?nav('management','Gerência','pump'):''}${state.user.role==='programador'?nav('settings','Configurações','settings'):''}<button class="nav-item" id="my-password">${icon('settings')} Alterar senha</button></nav><div class="sidebar-bottom"><div class="unit-tag">UNIDADE ATUAL<strong>Cascavel · PR</strong></div><div class="user-box"><button class="profile-photo-button" id="my-photo" aria-label="Alterar foto de perfil">${profileAvatar(state.user.id,state.user.name)}</button><div><strong>${state.user.role==='programador'?programmerCrown+' ':''}${esc(state.user.name)}</strong><small>${roleNames[state.user.role]}</small></div><button class="logout" data-logout aria-label="Sair">${icon('logout')}</button></div></div></aside><main class="main"><header class="topbar"><div class="breadcrumb">Operação ${icon('right')} <strong>${({agenda:'Agenda de obras',requests:'Solicitações',reports:'Relatórios',next:'Agenda de amanhã',settings:'Configurações',changes:'Cancelamentos e remarcações',customers:'Clientes',production:'Produção e metas',management:'Gerência'})[state.page]}</strong></div><div class="top-actions"><span class="live"><i class="dot"></i> Cascavel · PR</span><button class="icon-only" id="notifications" aria-label="Notificações">${icon('bell')}${pending?`<span class="badge pendente">${pending}</span>`:''}</button><button class="icon-only mobile-password" id="mobile-password" aria-label="Alterar minha senha">${icon('settings')}</button><button class="icon-only" data-logout aria-label="Sair">${icon('logout')}</button></div></header><div class="content"><div class="branch-tabs"><button class="branch-tab">${icon('pin')} Cascavel · PR</button><span class="branch-note">Unidade de programação</span></div><section id="page-content">${pageContent()}</section><footer class="footer-note"><span>CONCRESUPER · Central de programação</span><span>Horários locais de Cascavel · UTC−3</span></footer></div></main></div>`;
  bindShell();bindPage();
}
function pageContent() {return ({agenda:agendaPage,requests:requestsPage,reports:reportPage,next:nextPage,settings:settingsPage,changes:changesPage,customers:customersPage,production:productionReportPage,management:managementPage})[state.page]();}
function stat(label,value,unit,note,ico) {return `<div class="stat"><div class="stat-top">${label}<span class="stat-icon">${icon(ico)}</span></div><div class="stat-value">${value} <span>${unit}</span></div><small>${note}</small></div>`;}
function agendaPage() {
  const rows=state.appointments.filter(a=>a.status!=='cancelado');
  const volume=rows.reduce((n,a)=>n+(a.planned_volume||0),0),trips=rows.reduce((n,a)=>n+(a.trips||0),0);
  const out=state.meta.pumps.filter(p=>p.maintenance||state.maintenances.some(m=>m.pump_id===p.id)).length;
  const stats=isManager()?stat('Volume programado',num(volume),'m³','No período selecionado','cube')+stat('Obras agendadas',rows.length,'obras',`${rows.filter(a=>a.type==='convencional').length} entregas convencionais`,'grid')+stat('Viagens previstas',trips,'viagens','Estimativa automática por capacidade','truck')+stat('Bombas da filial',state.meta.pumps.length,'bombas',`${out} com bloqueio no período · veja horários abaixo`,'pump'):stat('Bombas da filial',state.meta.pumps.length,'bombas','Consulte os intervalos livres abaixo','pump')+stat('Suas solicitações',state.requests.length,'pedidos','Reservas sujeitas à aprovação','request')+stat('Aguardando resposta',state.requests.filter(r=>r.status==='pendente'||r.status==='ajuste').length,'pedidos','Acompanhe na aba Solicitações','clock')+stat('Pedidos aprovados',state.requests.filter(r=>r.status==='aprovada').length,'pedidos','Confirmações da logística','check');
  return agendaHeader(`${isManager()?`<button id="register-maintenance">${icon('settings')} Bomba em manutenção</button>`:''}<button id="availability">${icon('clock')} Consultar disponibilidade</button><button id="tomorrow">${icon('export')} Agenda de amanhã</button><button class="primary" id="new-booking">${icon('plus')} ${isManager()?'Novo agendamento':'Solicitar reserva'}</button>`,rows)+`<div class="stats ${isManager()?'agenda-stats':''}">${stats}</div><div class="workspace"><div class="panel"><div class="panel-header"><div><h2>${state.mode==='day'?fmt(state.date,{weekday:'long',day:'numeric',month:'long'}):state.mode==='week'?'Programação da semana':fmt(state.date,{month:'long',year:'numeric'})}</h2></div><small>Disponibilidade por intervalo</small></div><div class="toolbar"><div class="date-controls"><button id="previous" aria-label="Período anterior">${icon('left')}</button><input type="date" id="agenda-date" value="${state.date}" aria-label="Data da agenda"><button id="next-date" aria-label="Próximo período">${icon('right')}</button><button id="today">Hoje</button></div><div class="segmented">${[['day','Dia'],['week','Semana'],['month','Mês']].map(([m,l])=>`<button data-mode="${m}" class="${state.mode===m?'selected':''}">${l}</button>`).join('')}</div></div>${state.mode==='day'?dayGrid(rows):state.mode==='week'?weekGrid(rows):monthGrid(rows)}<div class="legend"><span><i></i> Com bomba</span><span><i class="blue"></i> Convencional</span><span><i class="yellow"></i> Em atendimento</span><span>${state.meta.buffer} min entre obras da mesma bomba</span></div></div>${agendaSide(rows)}</div>`;
}
function booking(a) {
  if(!isManager()&&!a.own_booking)return `<div class="booking"><div class="booking-time">${a.start} — ${endTime(a)}</div><strong>Horário ocupado</strong><p>Consulte outro intervalo</p></div>`;
  const reference=commercialReference(a),tag=isManager()?'button':'div';
  return `<div class="booking-entry"><${tag} class="booking ${a.type==='convencional'?'conventional':''} ${a.status}" ${isManager()?`data-booking="${a.id}"`:''}><div class="booking-time"><span>${a.start} — ${endTime(a)}</span><span>${num(a.planned_volume)} m³</span></div><strong>${esc(a.customer)}</strong><p>${esc(a.piece)} · ${esc(a.resistance)}<br>${esc(a.work)}</p>${reference?`<p class="booking-reference">${esc(reference)}</p>`:''}<div class="booking-footer"><span>${sellerIdentity(a.seller_id,a.seller_name)}</span><span>${a.trips} viagens</span></div></${tag}><button class="booking-information" data-information="${a.id}">${icon('plus')} ${reference?'Editar informações':'Adicionar informações'}</button></div>`;
}
function slot(p,period) {return `<button class="slot" data-slot="${p?.id||''}" data-period="${period}" ${p?.maintenance?'disabled':''}>${p?.maintenance?'Em manutenção':icon('plus')+' Consultar / agendar'}</button>`;}
function dayGrid(rows) {
  const lanes=[...state.meta.pumps,{id:null,name:'Convencional',description:'Entrega sem bomba'}];
  return `<div class="schedule-head"><div>RECURSO</div><div>MANHÃ <span class="muted">· até 12h</span></div><div>TARDE <span class="muted">· a partir de 12h</span></div></div>${!state.meta.pumps.length?'<div class="notice">Nenhuma bomba cadastrada. Gerente ou Programador pode cadastrá-las em Gerência.</div>':''}${lanes.map(p=>{
    const own=rows.filter(a=>a.pump_id===p.id),maintenance=p.id?maintenanceOnDay(state.date,p.id):[];
    const dayStart=state.date+'T00:00',dayEnd=shift(state.date,1)+'T00:00';
    const full=p.maintenance||maintenance.some(m=>m.starts_at<=dayStart&&m.ends_at>=dayEnd),resource={...p,maintenance:full};
    const blocks=period=>maintenance.filter(m=>m.starts_at<(period==='morning'?state.date+'T12:00':dayEnd)&&m.ends_at>(period==='morning'?dayStart:state.date+'T12:00')).map(m=>`<div class="maintenance-block">${icon('settings')}<div><strong>Em manutenção</strong><small>${esc(maintenanceTime(m))}</small>${m.reason?`<p>${esc(m.reason)}</p>`:''}</div></div>`).join('');
    return `<div class="lane"><div class="lane-name"><strong>${esc(p.name)}</strong><small>${full?'Em manutenção':maintenance.length?'Bloqueio parcial':p.id?'Bombeamento':'Entrega direta'}</small>${p.id?`<small>${own.length} obra${own.length===1?'':'s'}</small>`:''}</div><div class="lane-cell">${blocks('morning')}${own.filter(a=>a.start<'12:00').map(booking).join('')}${slot(resource,'morning')}</div><div class="lane-cell">${blocks('afternoon')}${own.filter(a=>endTime(a)>'12:00').map(a=>a.start<'12:00'?`<div class="hint">${icon('clock')} Ocupada até ${endTime(a)} · serviço iniciado pela manhã</div>`:booking(a)).join('')}${slot(resource,'afternoon')}</div></div>`;
  }).join('')}`;
}
function weekGrid(rows) {
  const [from]=range();return `<div class="week-grid">${Array.from({length:7},(_,i)=>{const d=shift(from,i), list=rows.filter(a=>a.date===d);return `<div class="week-day"><button class="day-heading" data-day="${d}">${fmt(d,{weekday:'short'})} <strong>${d.slice(8)}</strong></button><small>${list.length} agendamentos${maintenanceOnDay(d).length?' · '+maintenanceOnDay(d).length+' manutenção(ões)':''}</small>${list.map(booking).join('')}<button class="slot" data-new-date="${d}">${icon('plus')} Agendar</button></div>`;}).join('')}</div>`;
}
function monthGrid(rows) {
  const [first,last]=monthRange(state.date),offset=(new Date(first+'T12:00:00').getDay()+6)%7;
  return `<div class="month-grid">${['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].map(d=>`<div class="month-weekday">${d}</div>`).join('')}${Array.from({length:offset},()=>'<div class="month-day filler"></div>').join('')}${Array.from({length:Number(last.slice(8))},(_,i)=>{const d=shift(first,i),list=rows.filter(a=>a.date===d);return `<button class="month-day ${d===today()?'today':''}" data-day="${d}"><strong>${i+1}</strong>${list.length?`<small>${list.length} obras</small>${isManager()?`<small>${num(list.reduce((s,a)=>s+a.planned_volume,0))} m³</small>`:''}`:'<small>Ver horários</small>'}${maintenanceOnDay(d).length?'<small>Manutenção programada</small>':''}</button>`;}).join('')}</div>`;
}
function agendaSide(rows) {
  const pumpVolume=rows.filter(a=>a.type==='bomba').reduce((s,a)=>s+(a.planned_volume||0),0);
  const convVolume=rows.filter(a=>a.type==='convencional').reduce((s,a)=>s+(a.planned_volume||0),0);
  const pending=state.requests.filter(r=>r.status==='pendente'||r.status==='ajuste');
  return `<aside class="side-stack">${isManager()?`<div class="panel side-panel"><h2>Visão da operação</h2><p>Volumes do período selecionado</p><div class="summary-row"><span>Com bombeamento</span><strong>${num(pumpVolume)} m³</strong></div><div class="summary-row"><span>Convencional</span><strong>${num(convVolume)} m³</strong></div><div class="summary-row total"><span>Total programado</span><strong>${num(pumpVolume+convVolume)} m³</strong></div><div class="hint">${icon('info')} Viagens estimadas pelo volume ÷ capacidade escolhida (8, 9 ou 10 m³), arredondadas para cima. A frota disponível pode variar por dia.</div></div>`:''}<div class="panel side-panel"><h2>${isManager()?'Solicitações de reserva':'Seus pedidos'}</h2><p>${pending.length} aguardando análise ou ajuste</p>${pending.slice(0,3).map(r=>`<div class="pending-card"><strong>${esc(r.customer)}</strong><p>${fmt(r.date)} · ${r.start} · ${num(r.planned_volume)} m³</p><p>${sellerIdentity(r.seller_id,r.seller_name)}</p><button data-request="${r.id}">Ver solicitação ${icon('right')}</button></div>`).join('')||'<div class="empty">Tudo em dia.<br>Nenhuma solicitação pendente.</div>'}<button class="mini-link" data-goto="requests">Ver todas as solicitações ${icon('right')}</button></div><div class="panel side-panel"><h2>Planeje os próximos dias</h2><p>Alterne entre dia, semana e mês para consultar a agenda futura. Uma solicitação só reserva a bomba depois da aprovação.</p></div></aside>`;
}
function requestsPage() {
  return heading(isManager()?'Solicitações de reserva':'Minhas solicitações',isManager()?'Analise os pedidos dos vendedores e confirme a programação.':'Solicite um horário e acompanhe a resposta da logística.',!isManager()?`<button class="primary" id="new-booking">${icon('plus')} Solicitar reserva</button>`:'')+`<div class="notice">${isManager()?'A aprovação verifica conflitos novamente e cria o agendamento. Pedidos pendentes não bloqueiam bombas.':'Você consulta a disponibilidade sem visualizar dados de outros clientes. O vendedor é vinculado automaticamente à solicitação.'}</div><div class="panel"><div class="table-wrap"><table><thead><tr><th>CLIENTE / OBRA</th><th>DATA / HORÁRIO</th><th>VOLUME</th><th>VENDEDOR</th><th>SITUAÇÃO</th><th></th></tr></thead><tbody>${state.requests.map(r=>`<tr><td><strong>${esc(r.customer)}</strong><small>${esc(r.work)}</small></td><td>${fmt(r.date)}<small>${r.start} · ${hoursLabel(r.duration)}</small></td><td>${num(r.planned_volume)} m³<small>${r.type==='bomba'?'Com bomba':'Convencional'}</small></td><td>${sellerIdentity(r.seller_id,r.seller_name)}</td><td>${badge(r.status)}</td><td><button data-request="${r.id}">Detalhes</button></td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Nenhuma solicitação por aqui ainda.</div></td></tr>'}</tbody></table></div></div>`;
}
async function loadReport() {
  const tomorrow=shift(today(),1),from=state.page==='next'?tomorrow:state.from,to=state.page==='next'?tomorrow:state.to;
  state.report=await api(`/report?from=${from}&to=${to}&seller=${encodeURIComponent(state.page==='next'?'':state.seller)}&type=${encodeURIComponent(state.page==='next'?'':state.type)}&status=${encodeURIComponent(state.page==='next'?'':state.status)}`);
}
function reportPage() {
  const rows=state.report, groups=new Map();
  for(const a of rows) {if(!groups.has(a.seller_id)) groups.set(a.seller_id,{id:a.seller_id,name:a.seller_name,count:0,planned:0,delivered:0,missing:0}); const g=groups.get(a.seller_id);g.count++;g.planned+=a.planned_volume;if(a.delivered_volume===null)g.missing++;else g.delivered+=a.delivered_volume;}
  return reportTabs('reports')+heading('Relatórios','Volume programado e efetivamente entregue, por vendedor.',`<button id="export">${icon('export')} Exportar CSV</button><button id="print">Imprimir</button>`)+reportHeader('Programação e volumes',`${fmt(state.from)} a ${fmt(state.to)}`)+`<div class="panel"><form class="filters" id="report-filters"><label>Data inicial<input type="date" name="from" value="${state.from}" required></label><label>Data final<input type="date" name="to" value="${state.to}" required></label><label>Vendedor<select name="seller"><option value="">${isManager()?'Todos os vendedores':'Meu resultado'}</option>${state.meta.sellers.map(s=>`<option value="${s.id}" ${String(s.id)===state.seller?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Entrega<select name="type"><option value="">Todas</option><option value="bomba" ${state.type==='bomba'?'selected':''}>Com bomba</option><option value="convencional" ${state.type==='convencional'?'selected':''}>Convencional</option></select></label><label>Status<select name="status"><option value="">Ativas e concluídas</option>${['confirmado','andamento','concluido','cancelado'].map(s=>`<option value="${s}" ${state.status===s?'selected':''}>${statusNames[s]}</option>`).join('')}</select></label><button type="submit" class="primary">Filtrar</button><div class="actions span-2 no-print"><button type="button" data-shortcut="today">Hoje</button><button type="button" data-shortcut="week">Esta semana</button><button type="button" data-shortcut="month">Este mês</button><button type="button" data-shortcut="next">Próximo mês</button></div></form><div class="panel-header"><h2>Cascavel · PR</h2><small>${fmt(state.from)} a ${fmt(state.to)} · data programada da entrega</small></div>${reportTotals(rows)}<div class="table-wrap"><table><thead><tr><th>VENDEDOR</th><th>OBRAS</th><th>PROGRAMADO</th><th>ENTREGUE INFORMADO</th><th>DIFERENÇA</th></tr></thead><tbody>${[...groups.values()].map(g=>`<tr><td>${sellerIdentity(g.id,g.name)}</td><td>${g.count}</td><td>${num(g.planned)} m³</td><td>${num(g.delivered)} m³${g.missing?`<small>${g.missing} obra(s) sem volume entregue</small>`:''}</td><td>${g.missing?'<span class="muted">Aguardando informações</span>':`${num(g.delivered-g.planned)} m³`}</td></tr>`).join('')||'<tr><td colspan="5"><div class="empty">Nenhuma programação no período selecionado.</div></td></tr>'}</tbody></table></div></div><h2 class="section-title detail-title">Detalhamento por obra</h2><div class="panel">${detailTable(rows)}</div>`;
}
function reportTotals(rows) {
  return `<div class="report-summary"><div><small>Programado</small><strong>${num(rows.reduce((s,a)=>s+a.planned_volume,0))} <span>m³</span></strong></div><div><small>Entregue informado</small><strong>${num(rows.reduce((s,a)=>s+(a.delivered_volume??0),0))} <span>m³</span></strong></div><div><small>Sem volume entregue</small><strong>${rows.filter(a=>a.delivered_volume===null).length} <span>obras</span></strong></div><div><small>Viagens previstas</small><strong>${rows.reduce((s,a)=>s+a.trips,0)} <span>viagens</span></strong></div></div>`;
}
function detailTable(rows) {
  return `<div class="table-wrap"><table><thead><tr><th>DATA / HORA</th><th>CLIENTE / OBRA</th><th>VENDEDOR</th><th>ENTREGA</th><th>PROGRAMADO</th><th>ENTREGUE</th><th>STATUS</th></tr></thead><tbody>${rows.map(a=>`<tr><td>${fmt(a.date)}<small>${a.start} — ${endTime(a)}</small></td><td><strong>${esc(a.customer)}</strong><small>${esc(a.work)}</small></td><td>${sellerIdentity(a.seller_id,a.seller_name)}</td><td>${esc(a.pump_name||'Convencional')}</td><td>${num(a.planned_volume)} m³</td><td>${a.delivered_volume===null?'<span class="muted">Não informado</span>':num(a.delivered_volume)+' m³'}</td><td>${badge(a.status)}</td></tr>`).join('')||'<tr><td colspan="7"><div class="empty">Nenhuma obra encontrada.</div></td></tr>'}</tbody></table></div>`;
}
function nextPage() {
  const rows=state.report;
  return heading('Agenda de amanhã',`${fmt(shift(today(),1),{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · Cascavel – PR`,`<button id="export">${icon('export')} Exportar CSV</button><button class="primary" id="print">Imprimir programação</button>`)+reportHeader('Programação de carregamentos',fmt(shift(today(),1),{day:'numeric',month:'long',year:'numeric'}))+`<div class="notice no-print">Relatório para preparar os carregamentos. Exportação genérica em CSV; a importação direta depende do formato aceito pelo sistema da concreteira.</div><div class="panel">${reportTotals(rows)}<div class="table-wrap"><table><thead><tr><th>HORÁRIO</th><th>CLIENTE / OBRA</th><th>ENTREGA</th><th>CONCRETO</th><th>VOLUME / VIAGENS</th><th>VENDEDOR / OBSERVAÇÕES</th></tr></thead><tbody>${rows.map(a=>`<tr><td>${a.start}<small>Até ${endTime(a)}</small></td><td><strong>${esc(commercialTitle(a))}</strong><small>${esc(a.work)}</small><small>${esc(a.piece)}</small></td><td>${esc(a.pump_name||'Convencional')}</td><td>${esc(a.resistance)}<small>Brita ${esc(a.gravel)}</small></td><td>${num(a.planned_volume)} m³<small>${a.trips} viagens previstas</small></td><td>${sellerIdentity(a.seller_id,a.seller_name)}<small>${esc(a.notes||'Sem observações')}</small></td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Ainda não há obras programadas para amanhã.</div></td></tr>'}</tbody></table></div></div>`;
}
function settingsPage() {
  return heading('Configurações','Cadastros e regras da unidade Cascavel – PR.')+`<div class="notice">Perfil Programador · acesso administrativo. Esta primeira versão atende à filial Cascavel. Novas filiais e login compartilhado serão integrados após definir a estrutura do outro sistema.</div><div class="settings-grid"><div><div class="panel"><div class="panel-header"><h2>Equipe e acessos</h2><button class="soft" id="new-user">${icon('plus')} Novo usuário</button></div>${state.users.map(u=>`<div class="list-row"><div class="team-member">${profileAvatar(u.id,u.name)}<div><strong>${esc(u.name)}</strong><small>${esc(u.username)}</small><small class="team-photo-status">${state.meta.profiles?.some(p=>p.id===u.id&&p.version)?'Com foto':'Sem foto'}</small></div></div><div><span class="badge">${roleNames[u.role]}</span><small>${esc(u.status)}${u.must_change?' · senha temporária':''}</small>${u.role!=='programador'?`<div class="actions user-actions"><button data-user-access="${u.id}">Acesso</button><button data-user-reset="${u.id}">Redefinir senha</button></div>`:''}</div></div>`).join('')}</div></div><div><div class="panel"><div class="panel-header"><h2>Regras de agendamento</h2></div><form id="settings-form" class="settings-form"><label>Intervalo mínimo entre obras (minutos)<input type="number" min="0" max="240" name="buffer" value="${state.meta.buffer}" required></label><p class="subtitle">Tempo reservado para deslocamento e preparação da mesma bomba. Alterar esta regra não reorganiza reservas existentes.</p><button class="primary" type="submit">Salvar configuração</button></form></div><div class="panel"><div class="panel-header"><h2>Histórico de alterações</h2><small>Últimas 100 ações</small></div>${state.audit.slice(0,12).map(a=>`<div class="audit-item"><strong>${esc(a.user_name)}</strong> · ${esc(a.action)} ${esc(a.entity)} #${a.entity_id}<br><small>${esc(a.created_at)} UTC</small></div>`).join('')||'<div class="empty">Nenhuma alteração registrada.</div>'}</div></div></div>`;
}
function bindShell() {
  $$('[data-page],[data-goto]').forEach(b=>b.onclick=async()=>{state.page=b.dataset.page||b.dataset.goto;await refresh();});
  $('#my-photo').onclick=openProfilePhoto;
  $$('[data-logout]').forEach(b=>b.onclick=async()=>{try{await api('/logout',{method:'POST',body:'{}'});clearInterval(poll);state.user=null;await boot();}catch(e){toast(e.message,true);}});
  $('#notifications').onclick=()=>showNotifications();
  if($('#my-password'))$('#my-password').onclick=()=>passwordChange(false);
  if($('#mobile-password'))$('#mobile-password').onclick=()=>passwordChange(false);
}
function bindPage() {
  if($('#new-booking'))$('#new-booking').onclick=()=>bookingForm();
  if($('#availability'))$('#availability').onclick=availabilityForm;
  if($('#register-maintenance'))$('#register-maintenance').onclick=()=>maintenanceForm();
  $$('[data-schedule-maintenance]').forEach(b=>b.onclick=()=>maintenanceForm(Number(b.dataset.scheduleMaintenance)));
  if($('#tomorrow'))$('#tomorrow').onclick=async()=>{if(!isManager()){state.date=shift(today(),1);state.mode='day';}else state.page='next';await refresh();};
  if($('#agenda-date'))$('#agenda-date').onchange=async e=>{if(e.target.value){state.date=e.target.value;await refresh();}};
  for(const [id,dir] of [['previous',-1],['next-date',1]])if($('#'+id))$('#'+id).onclick=async()=>{if(state.mode==='month'){const d=new Date(state.date+'T12:00:00');d.setDate(1);d.setMonth(d.getMonth()+dir);state.date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;}else state.date=shift(state.date,dir*(state.mode==='week'?7:1));await refresh();};
  if($('#today'))$('#today').onclick=async()=>{state.date=today();await refresh();};
  $$('[data-mode]').forEach(b=>b.onclick=async()=>{state.mode=b.dataset.mode;await refresh();});
  $$('[data-day]').forEach(b=>b.onclick=async()=>{state.date=b.dataset.day;state.mode='day';await refresh();});
  $$('[data-new-date]').forEach(b=>b.onclick=()=>bookingForm({date:b.dataset.newDate}));
  $$('[data-slot]').forEach(b=>b.onclick=()=>bookingForm({pump_id:b.dataset.slot,type:b.dataset.slot?'bomba':'convencional',start:b.dataset.period==='morning'?'07:00':'13:00'}));
  $$('[data-information]').forEach(b=>b.onclick=()=>openCommercialInformation(Number(b.dataset.information)));
  $$('[data-booking]').forEach(b=>b.onclick=()=>editBooking(state.appointments.find(a=>a.id===Number(b.dataset.booking))));
  $$('[data-request]').forEach(b=>b.onclick=()=>requestDetails(state.requests.find(r=>r.id===Number(b.dataset.request))));
  if($('#print'))$('#print').onclick=()=>window.print();
  if($('#export'))$('#export').onclick=state.page==='changes'?exportChanges:state.page==='production'?exportProduction:exportCsv;
  bindChangesAndCustomers();
  if($('#management-fleet-date'))$('#management-fleet-date').onchange=async e=>{if(e.target.value){state.managementDate=e.target.value;await refresh();}};
  if($('#management-goal-month'))$('#management-goal-month').onchange=async e=>{if(e.target.value){state.managementMonth=e.target.value;await refresh();}};
  if($('#management-adjust-fleet'))$('#management-adjust-fleet').onclick=()=>fleetForm(state.management.fleet,state.managementDate);
  if($('#management-adjust-goal'))$('#management-adjust-goal').onclick=()=>goalForm(state.management.production);
  if($('#production-filters'))$('#production-filters').onsubmit=async e=>{e.preventDefault();state.productionFilters=Object.fromEntries(new FormData(e.target));await refresh();};
  if($('#adjust-fleet'))$('#adjust-fleet').onclick=()=>fleetForm();
  if($('#edit-goal'))$('#edit-goal').onclick=()=>goalForm(state.page==='production'?state.productionReport:state.production);
  if($('#cb-period'))$('#cb-period').onchange=async e=>{const value=e.target.value;if(value==='custom'){e.target.value=state.cbPeriod||'today';return cbCustomPeriod();}state.cbPeriod=value;await refresh();};
  if($('#production-month'))$('#production-month').onchange=async e=>{if(e.target.value){state.goalMonth=e.target.value;await refresh();}};
  if($('#report-filters'))$('#report-filters').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));if(data.from>data.to)return toast('A data inicial deve ser anterior à final.',true);Object.assign(state,data);await refresh();};
  $$('[data-shortcut]').forEach(b=>b.onclick=async()=>{let from=today(),to=today();const action=b.dataset.shortcut;if(action==='week'){const day=new Date(from+'T12:00:00').getDay();from=shift(from,-((day+6)%7));to=shift(from,6);}if(action==='month')[from,to]=monthRange(today());if(action==='next'){const d=new Date(today()+'T12:00:00');d.setDate(1);d.setMonth(d.getMonth()+1);[from,to]=monthRange(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`);}if(state.page==='changes'){state.changeFilters.from=from;state.changeFilters.to=to;}else{state.from=from;state.to=to;}await refresh();});
  if($('#new-user'))$('#new-user').onclick=userForm;
  $$('[data-user-access]').forEach(b=>b.onclick=()=>userAccess(Number(b.dataset.userAccess)));
  $$('[data-user-reset]').forEach(b=>b.onclick=()=>resetUserPassword(Number(b.dataset.userReset)));
  if($('#new-pump'))$('#new-pump').onclick=pumpForm;
  $$('[data-maintenance]').forEach(b=>b.onclick=async()=>{const p=state.meta.pumps.find(p=>p.id===Number(b.dataset.maintenance));if(!confirm(p.maintenance?'Liberar esta bomba para novos agendamentos?':'Colocar em manutenção? Reservas existentes não serão canceladas; revise a agenda.'))return;try{await api('/pumps/'+p.id,{method:'PATCH',body:JSON.stringify({maintenance:!p.maintenance})});await refresh();}catch(e){toast(e.message,true);}});
  if($('#settings-form'))$('#settings-form').onsubmit=async e=>{e.preventDefault();try{await api('/settings',{method:'PATCH',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});toast('Configuração salva.');await refresh();}catch(error){toast(error.message,true);}};
}
function pumpOptions(selected='') {return '<option value="">Selecione a bomba</option>'+state.meta.pumps.map(p=>`<option value="${p.id}" ${String(p.id)===String(selected)?'selected':''} ${p.maintenance?'disabled':''}>${esc(p.name)}${p.maintenance?' · manutenção':''}</option>`).join('');}
function bookingForm(prefill={}) {
  const request=!isManager();
  dialog(request?'Solicitar reserva':'Novo agendamento','Cascavel – PR · Horários e duração flexíveis',`<form id="booking-form"><div class="form-grid"><label class="span-2">Cliente *<input name="customer" required maxlength="200" placeholder="Nome do cliente"></label><label class="span-2">Obra / endereço *<input name="work" required maxlength="500" placeholder="Identificação e localização da obra"></label><label>Data *<input type="date" name="date" required value="${prefill.date||state.date}"></label><label>Horário de início *<input type="time" name="start" required value="${prefill.start||'07:00'}"></label>${hoursField('Duração prevista (horas) *',120)}<label>Tipo de entrega *<select name="type"><option value="bomba">Com bomba</option><option value="convencional" ${prefill.type==='convencional'?'selected':''}>Convencional — sem bomba</option></select></label>${!request?`<label id="pump-field">Bomba *<select name="pump_id">${pumpOptions(prefill.pump_id)}</select></label><label>Vendedor responsável *<select name="seller_id" required><option value="">Selecione o vendedor</option>${state.meta.sellers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>`:''}<label>Volume programado (m³) *<input type="number" name="planned_volume" min="0.1" step="0.1" required placeholder="Ex.: 32"></label>${tripFields(0,9)}<label>Brita *<input name="gravel" required placeholder="Ex.: Brita 1"></label><label>Resistência / Fck *<input name="resistance" required placeholder="Ex.: 30 MPa"></label><label class="span-2">Peça a concretar *<input name="piece" required placeholder="Ex.: Laje, fundação, pilares"></label><label class="span-2">Observações<textarea name="notes" maxlength="2000" placeholder="Ex.: com fibra, slump máximo 16, cuidados de acesso…"></textarea></label></div><div class="hint">${icon('info')}${request?'O pedido será analisado pela logística. Não há bloqueio de horário até a aprovação.':`A reserva considera a duração e ${state.meta.buffer} minutos entre obras da mesma bomba. O volume programado será preservado após o cadastro.`}</div>${footer(request?'Enviar solicitação':'Confirmar agendamento')}</form>`,async data=>{
    await api(request?'/requests':'/appointments',{method:'POST',body:JSON.stringify(data)});modal.close();toast(request?'Solicitação enviada à logística.':'Agendamento confirmado.');await refresh();
  });
  const type=$('[name=type]',modal);type.onchange=()=>{const el=$('#pump-field',modal);if(el){el.hidden=type.value==='convencional';$('[name=pump_id]',modal).required=type.value==='bomba';}};type.onchange();
  customerPicker(prefill.customerRecord);
}
function editBooking(a) {
  if(!a)return;
  dialog(a.customer,'Editar agenda e registrar volume entregue',`<div class="booking-actions"><button type="button" id="reschedule-booking">${icon('calendar')} Remarcar agendamento</button>${a.status!=='cancelado'?'<button type="button" class="danger" id="cancel-booking">Cancelar agendamento</button>':''}<button type="button" id="booking-history">Histórico</button></div><div class="detail-grid"><div><small>Obra</small>${esc(a.work)}</div><div><small>Vendedor</small>${sellerIdentity(a.seller_id,a.seller_name)}</div><div><small>Concreto</small>${esc(a.gravel)} · ${esc(a.resistance)}</div><div><small>Peça / programado</small>${esc(a.piece)} · ${num(a.planned_volume)} m³</div></div>${a.notes?`<div class="notes-box">${esc(a.notes)}</div>`:''}<form><div class="form-grid"><label>Data<input type="date" name="date" required value="${a.date}"></label><label>Horário de início<input type="time" name="start" required value="${a.start}"></label>${hoursField('Duração (horas)',a.duration)}<label>Tipo<select name="type"><option value="bomba">Com bomba</option><option value="convencional" ${a.type==='convencional'?'selected':''}>Convencional</option></select></label><label>Bomba<select name="pump_id">${pumpOptions(a.pump_id)}</select></label><label>Situação<select name="status">${['confirmado','andamento','concluido','cancelado'].map(s=>`<option value="${s}" ${a.status===s?'selected':''}>${statusNames[s]}</option>`).join('')}</select></label><label>Volume realmente entregue (m³)<input type="number" name="delivered_volume" min="0" step="0.1" value="${a.delivered_volume??''}" placeholder="Ainda não informado"></label>${tripFields(a.planned_volume,a.load_capacity,a.trips)}</div><label class="change-reason">Motivo do cancelamento ou remarcação<textarea name="reason" maxlength="1000" placeholder="Obrigatório ao cancelar ou alterar a programação"></textarea></label><div class="hint">${icon('info')} Deixe o volume entregue vazio enquanto não houver informação. O volume programado original não é alterado.</div>${footer('Salvar alterações')}</form>`,async data=>{await api('/appointments/'+a.id,{method:'PATCH',body:JSON.stringify({...data,expected:expectedSchedule(a)})});modal.close();toast('Agendamento atualizado.');await refresh();});
  $('#reschedule-booking',modal).onclick=()=>changeBooking(a,'remarcar');
  if($('#cancel-booking',modal))$('#cancel-booking',modal).onclick=()=>changeBooking(a,'cancelar');
  $('#booking-history',modal).onclick=()=>bookingHistory(a);
}
function requestDetails(r) {
  if(!r)return;
  const canReview=isManager()&&['pendente','ajuste'].includes(r.status);
  dialog('Solicitação #'+r.id,r.customer+' · '+r.seller_name,`<div class="detail-grid"><div><small>Data / horário</small>${fmt(r.date)} · ${r.start}</div><div><small>Duração prevista</small>${hoursLabel(r.duration)}</div><div><small>Cliente</small>${esc(r.customer)}</div><div><small>Obra</small>${esc(r.work)}</div><div><small>Volume / viagens</small>${num(r.planned_volume)} m³ · ${r.trips} viagens</div><div><small>Tipo de entrega</small>${r.type==='bomba'?'Com bomba':'Convencional'}</div><div><small>Brita / Fck</small>${esc(r.gravel)} · ${esc(r.resistance)}</div><div><small>Peça</small>${esc(r.piece)}</div></div>${r.notes?`<div class="notes-box">${esc(r.notes)}</div>`:''}${r.response?`<div class="notice">Resposta da logística: ${esc(r.response)}</div>`:''}${canReview?`<form><div class="form-grid"><label class="span-2">Decisão<select name="status"><option value="aprovada">Aprovar e criar agendamento</option><option value="ajuste">Propor ajuste</option><option value="recusada">Recusar solicitação</option></select></label>${r.type==='bomba'?`<label class="span-2">Bomba para aprovação<select name="pump_id">${pumpOptions()}</select></label>`:''}<label>Data da confirmação<input type="date" name="date" value="${r.date}" required></label><label>Horário<input type="time" name="start" value="${r.start}" required></label>${hoursField('Duração (horas)',r.duration)}${tripFields(r.planned_volume,r.load_capacity||9)}<label class="span-2">Resposta / motivo<textarea name="response" placeholder="Explique recusas ou propostas de outro horário"></textarea></label></div>${footer('Registrar resposta')}</form>`:`<p>${badge(r.status)}</p>`}`,canReview?async data=>{await api('/requests/'+r.id,{method:'PATCH',body:JSON.stringify(data)});modal.close();toast('Resposta registrada.');await refresh();}:null);
}
function userForm() {
  dialog('Cadastrar usuário','Acesso aprovado com troca de senha no primeiro login',`<form><div class="form-grid"><label class="span-2">Nome completo<input name="name" required maxlength="200"></label><label class="span-2">Nome de usuário<input name="username" required minlength="3" maxlength="32" pattern="(?:[A-Za-z0-9_.]|-){3,32}" autocomplete="off"></label><label>Perfil<select name="role">${Object.entries(roleNames).filter(([r])=>r!=='programador').map(([r,n])=>`<option value="${r}" ${r==='vendedor'?'selected':''}>${n}</option>`).join('')}</select></label><label>Senha temporária<input name="password" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label><label class="span-2">Confirme a senha temporária<input name="confirmation" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label></div>${footer('Cadastrar usuário')}</form>`,async(data,form)=>{
    if(data.password!==data.confirmation)throw Error('As senhas não conferem.');
    await api('/users',{method:'POST',body:JSON.stringify(data)});form.reset();modal.close();toast('Usuário cadastrado. A troca da senha será obrigatória no primeiro acesso.');await refresh();
  });
}
function userAccess(id) {
  const user=state.users.find(u=>u.id===id);
  dialog('Acesso de '+user.name,'Aprovar, bloquear ou ajustar o perfil',`<form><div class="form-grid"><label>Perfil<select name="role">${Object.entries(roleNames).filter(([r])=>r!=='programador').map(([r,n])=>`<option value="${r}" ${r===user.role?'selected':''}>${n}</option>`).join('')}</select></label><label>Situação<select name="status"><option value="aprovado">Aprovado</option><option value="bloqueado" ${user.status==='bloqueado'?'selected':''}>Bloqueado</option></select></label></div>${footer('Salvar acesso')}</form>`,async data=>{await api('/users/'+id,{method:'PATCH',body:JSON.stringify(data)});modal.close();toast('Acesso atualizado.');await refresh();});
}
function resetUserPassword(id) {
  const user=state.users.find(u=>u.id===id);
  dialog('Redefinir senha','Usuário: '+user.name,`<form><div class="form-grid"><label class="span-2">Nova senha temporária<input name="password" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></label><label class="span-2">Confirme a senha temporária<input name="confirmation" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></label><label class="span-2">Sua senha de Programador<input name="currentPassword" type="password" required maxlength="128" autocomplete="current-password"></label></div><div class="hint">${icon('info')} As sessões desse usuário serão encerradas. Ele deverá criar uma senha pessoal no próximo acesso.</div>${footer('Redefinir senha')}</form>`,async(data,form)=>{if(data.password!==data.confirmation)throw Error('As senhas não conferem.');await api('/users/'+id,{method:'PATCH',body:JSON.stringify({...data,action:'reset-password'})});form.reset();modal.close();toast('Senha redefinida.');await refresh();});
}
function pumpForm() {
  dialog('Cadastrar bomba','Cadastre apenas os recursos reais da filial',`<form><div class="form-grid"><label class="span-2">Código da bomba<input name="name" required maxlength="50" placeholder="Ex.: BL216"></label><label class="span-2">Descrição<input name="description" maxlength="200" placeholder="Tipo, alcance ou identificação"></label></div>${footer('Cadastrar bomba')}</form>`,async data=>{await api('/pumps',{method:'POST',body:JSON.stringify(data)});modal.close();toast('Bomba cadastrada.');await refresh();});
}
function showNotifications(changed) {
  const list=changed||state.requests.filter(r=>isManager()?['pendente','ajuste'].includes(r.status):true).slice(0,10);
  dialog('Central de notificações',isManager()?'Pedidos dos vendedores para análise':'Acompanhe as respostas da logística',list.length?list.map(r=>`<div class="notification"><strong>${esc(r.customer)}</strong> ${badge(r.status)}<small>${fmt(r.date)} · ${r.start} · ${num(r.planned_volume)} m³ · ${sellerIdentity(r.seller_id,r.seller_name)}</small>${r.response?`<p>${esc(r.response)}</p>`:''}<button data-open-request="${r.id}">Ver solicitação</button></div>`).join(''):'<div class="empty">Nenhuma notificação por aqui.</div>',null);
  $$('[data-open-request]',modal).forEach(b=>b.onclick=()=>requestDetails(state.requests.find(r=>r.id===Number(b.dataset.openRequest))));
}
function startPolling() {
  clearInterval(poll);
  // Existing pending requests are shown once when the user signs in.
  const pending=state.requests.filter(r=>isManager()&&r.status==='pendente');
  if(pending.length&&!modal.open)showNotifications(pending.slice(0,5));
  poll=setInterval(async()=>{
    if(!state.user||polling)return;polling=true;
    try {
      const requests=await api('/requests');
      const changed=requests.filter(r=>isManager()?(!seen.has(r.id)&&r.status==='pendente'):(seen.has(r.id)&&seen.get(r.id)!==r.status));
      state.requests=requests;
      // Do not lose popups while another form is being filled out.
      if(changed.length){if(!modal.open){showNotifications(changed);changed.forEach(r=>seen.set(r.id,r.status));}else toast('Há novas atualizações nas solicitações.');}
      requests.filter(r=>!changed.includes(r)).forEach(r=>seen.set(r.id,r.status));
    } catch(e){ if(state.user)console.warn('Atualização de solicitações indisponível.'); }
    finally{polling=false;}
  },15000);
}
function csvCell(value) {
  let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
function exportCsv() {
  const header=['Filial','Data','Início','Término previsto','Cliente','Código do cliente','Código do pedido','Item do pedido','Obra','Vendedor','Tipo','Bomba','Programado m³','Entregue m³','Viagens previstas','Capacidade estimada (m³/viagem)','Brita','Fck','Peça','Observações','Status'];
  const records=state.report.map(a=>['Cascavel PR',fmt(a.date),a.start,endTime(a),state.page==='next'?commercialTitle(a):a.customer,a.customer_code||'',a.order_code||'',a.order_item||'',a.work,a.seller_name,a.type,a.pump_name||'',String(a.planned_volume).replace('.',','),a.delivered_volume===null?'Não informado':String(a.delivered_volume).replace('.',','),a.trips,a.load_capacity??'Previsão antiga',a.gravel,a.resistance,a.piece,a.notes,statusNames[a.status]]);
  const content='\uFEFF'+[header,...records].map(r=>r.map(csvCell).join(';')).join('\r\n');
  const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));link.download=`programacao-cascavel-${state.page==='next'?shift(today(),1):state.from}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}
boot();

function installPasswordFields(root) {
  let nextId = 0;
  const eye = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="eye-slash" d="m3 3 18 18"/></svg>';
  function enhance() {
    root.querySelectorAll('input[type="password"]:not([data-password-enhanced])').forEach(input => {
      input.dataset.passwordEnhanced = 'true';
      input.id ||= `password-field-${++nextId}`;
      const wrapper = document.createElement('span');
      wrapper.className = 'password-field';
      input.before(wrapper);
      wrapper.appendChild(input);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'password-toggle';
      toggle.setAttribute('aria-label', 'Mostrar senha');
      toggle.setAttribute('aria-pressed', 'false');
      toggle.setAttribute('aria-controls', input.id);
      toggle.innerHTML = eye;
      toggle.onclick = () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        toggle.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
        toggle.setAttribute('aria-pressed', String(show));
      };
      wrapper.appendChild(toggle);
    });
  }
  enhance();
  new MutationObserver(enhance).observe(root, { childList: true, subtree: true });
  root.addEventListener('reset', event => {
    event.target.querySelectorAll('[data-password-enhanced]').forEach(input => { input.type = 'password'; });
    event.target.querySelectorAll('.password-toggle').forEach(button => { button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-label', 'Mostrar senha'); });
  });
}

installPasswordFields(document.body);

function availabilityForm() {
  dialog('Consultar disponibilidade','Bombas livres no intervalo solicitado, com margem entre obras',`<form><div class="form-grid"><label class="span-2">Data<input type="date" name="date" value="${state.date}" required></label><label>Início<input type="time" name="start" value="07:00" required></label>${hoursField('Duração (horas)',120)}</div>${footer('Consultar bombas')}<div id="availability-result" aria-live="polite"></div></form>`,async data=>{
    const result=await api('/availability?'+new URLSearchParams(data));
    $('#availability-result',modal).innerHTML=`<div class="hint">${icon('info')} Inclui ${result.buffer} minutos entre atendimentos. Uma consulta não reserva o horário.</div>`+result.pumps.map(p=>`<div class="list-row"><strong>${esc(p.name)}</strong><span class="badge ${p.available?'concluido':'ocupado'}">${p.available?'Disponível':p.maintenance?'Manutenção':'Ocupada no intervalo'}</span></div>`).join('')+(result.pumps.length?'':'<div class="empty">Nenhuma bomba cadastrada.</div>');
  });
}

function reportTabs(active) {
  return `<div class="report-tabs no-print"><button data-page="reports" class="${active==='reports'?'selected':''}">${icon('chart')} Programação e volumes</button><button data-page="changes" class="${active==='changes'?'selected':''}">${icon('calendar')} Cancelamentos e remarcações</button>${isManager()?`<button data-page="production" class="${active==='production'?'selected':''}">${icon('cube')} Produção e metas</button>`:''}</div>`;
}
function expectedSchedule(a){return Object.fromEntries(['date','start','duration','pump_id','type','status'].map(k=>[k,a[k]]));}
function scheduleText(a){return `${fmt(a.date)} · ${a.start}–${endTime(a)} · ${a.type==='convencional'?'Convencional':a.pump_name||(a.pump_id?'Bomba #'+a.pump_id:'Bomba não registrada')}`;}
function eventTime(e){return e.created_at?new Date(e.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Data não registrada';}
function changeBooking(a,action){
  const cancel=action==='cancelar';
  dialog(cancel?'Cancelar agendamento':'Remarcar agendamento',a.customer+' · '+a.work,`<div class="notice">Programação atual: ${esc(scheduleText(a))}. ${cancel?'O cancelamento libera a bomba e mantém o histórico.':'A nova programação será conferida quanto a conflitos.'}</div><form><div class="form-grid">${!cancel?`<label>Nova data<input type="date" name="date" required value="${a.date}"></label><label>Novo horário<input type="time" name="start" required value="${a.start}"></label>${hoursField('Duração (horas)',a.duration)}<label>Tipo de entrega<select name="type"><option value="bomba">Com bomba</option><option value="convencional" ${a.type==='convencional'?'selected':''}>Convencional</option></select></label><label class="span-2" id="reschedule-pump">Bomba<select name="pump_id">${pumpOptions(a.pump_id)}</select></label>`:''}<label class="span-2">Motivo ${cancel?'do cancelamento':'da remarcação'} *<textarea name="reason" required maxlength="1000" placeholder="Ex.: solicitação do cliente, chuva, mudança no andamento da obra…"></textarea></label></div>${footer(cancel?'Confirmar cancelamento':'Confirmar remarcação')}</form>`,async data=>{
    const payload={...data,action,status:cancel?'cancelado':a.status==='cancelado'?'confirmado':a.status,expected:expectedSchedule(a)};
    await api('/appointments/'+a.id,{method:'PATCH',body:JSON.stringify(payload)});
    modal.close();toast(cancel?'Agendamento cancelado. Histórico preservado.':'Agendamento remarcado. Histórico preservado.');await refresh();
  });
  if(!cancel){const type=$('[name=type]',modal);type.onchange=()=>{$('#reschedule-pump',modal).hidden=type.value==='convencional';};type.onchange();}
}
async function bookingHistory(a){
  try{
    const events=await api('/appointments/'+a.id+'/history');
    dialog('Histórico do agendamento',a.customer+' · '+a.work,events.length?events.map(e=>`<article class="history-event"><div class="history-heading">${badge(e.kind)}<small>${esc(eventTime(e))}</small></div><p><strong>Antes:</strong> ${esc(scheduleText(e.before))}</p><p><strong>Depois:</strong> ${e.kind==='cancelado'?'Cancelado — horário liberado':esc(scheduleText(e.after))}</p><p><strong>Motivo:</strong> ${esc(e.reason)}</p><small>Registrado por ${esc(e.actor_name||'Responsável não registrado')}</small></article>`).join(''):'<div class="empty">Nenhum cancelamento ou remarcação registrado para esta obra.</div>');
  }catch(error){toast(error.message,true);}
}
function changeFiltersForm(){
  const f=state.changeFilters;
  return `<form class="filters" id="changes-filters"><label>Data inicial<input name="from" type="date" value="${f.from}" required></label><label>Data final<input name="to" type="date" value="${f.to}" required></label><label>Referência da data<select name="basis">${[['event','Data da alteração'],['before','Data anteriormente agendada'],['after','Nova data agendada']].map(([v,n])=>`<option value="${v}" ${f.basis===v?'selected':''}>${n}</option>`).join('')}</select></label><label>Ocorrência<select name="kind"><option value="">Cancelados e remarcados</option><option value="cancelado" ${f.kind==='cancelado'?'selected':''}>Cancelados</option><option value="remarcado" ${f.kind==='remarcado'?'selected':''}>Remarcados</option></select></label><label>Nome do cliente<input name="customer" value="${esc(f.customer)}" placeholder="Buscar cliente"></label><label>Vendedor<select name="seller"><option value="">${isManager()?'Todos os vendedores':'Meu resultado'}</option>${state.meta.sellers.map(s=>`<option value="${s.id}" ${String(s.id)===f.seller?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><button type="submit" class="primary">Filtrar ocorrências</button><label class="checkbox-label"><input type="checkbox" name="unknown" value="1" ${f.unknown==='1'?'checked':''}> Incluir registros antigos sem data da alteração</label><div class="actions no-print"><button type="button" data-shortcut="today">Hoje</button><button type="button" data-shortcut="week">Esta semana</button><button type="button" data-shortcut="month">Este mês</button><button type="button" data-shortcut="next">Próximo mês</button></div></form>`;
}
function changesPage(){
  const rows=state.changes,canceled=rows.filter(e=>e.kind==='cancelado'),rescheduled=rows.filter(e=>e.kind==='remarcado');
  const unique=new Set(rows.map(e=>e.appointment_id)).size;
  return reportTabs('changes')+heading('Cancelamentos e remarcações','Acompanhe os motivos, os clientes e o impacto na programação.',`<button id="export">${icon('export')} Exportar CSV</button><button id="print">Imprimir / salvar PDF</button>`)+reportHeader('Cancelamentos e remarcações',`${fmt(state.changeFilters.from)} a ${fmt(state.changeFilters.to)}`)+`<div class="panel">${changeFiltersForm()}<div class="panel-header"><h2>Cascavel · PR</h2><small>${fmt(state.changeFilters.from)} a ${fmt(state.changeFilters.to)} · ${esc({event:'Data da alteração',before:'Data anterior da agenda',after:'Nova data da agenda'}[state.changeFilters.basis])}${state.changeFilters.customer?' · Cliente: '+esc(state.changeFilters.customer):''}</small></div></div><div class="stats changes-stats">${stat('Cancelamentos',canceled.length,'ocorrências',num(canceled.reduce((s,e)=>s+e.planned_volume,0))+' m³ cancelados','close')}${stat('Remarcações',rescheduled.length,'ocorrências',num(rescheduled.reduce((s,e)=>s+e.planned_volume,0))+' m³ remarcados','calendar')}${stat('Obras envolvidas',unique,'obras','Contagem de agendamentos distintos','grid')}${stat('Volume movimentado',num(rows.reduce((s,e)=>s+e.planned_volume,0)),'m³','Soma por ocorrência, não por obra única','cube')}</div><div class="notice">Cada alteração é uma ocorrência. Uma mesma obra pode aparecer várias vezes; isso não representa uma nova venda. Os volumes são os programados no momento da alteração. Datas e responsáveis antigos não disponíveis ficam identificados como não registrados.</div>${changesCharts(rows)}<div class="panel"><div class="panel-header"><h2>Detalhamento das ocorrências</h2><small>${rows.length} registros</small></div><div class="table-wrap"><table><thead><tr><th>ALTERAÇÃO / RESPONSÁVEL</th><th>CLIENTE / VENDEDOR</th><th>TIPO / VOLUME</th><th>PROGRAMAÇÃO ANTERIOR</th><th>NOVA PROGRAMAÇÃO</th><th>MOTIVO</th><th class="no-print"></th></tr></thead><tbody>${rows.map(e=>`<tr><td>${esc(eventTime(e))}<small>${esc(e.actor_name||'Não registrado')}</small></td><td><strong>${esc(e.customer)}</strong><small>${esc(e.work)}</small><small>${sellerIdentity(e.seller_id,e.seller_name)}</small></td><td>${badge(e.kind)}<small>${num(e.planned_volume)} m³</small><small>Atual: ${esc(statusNames[e.current_status]||e.current_status)}</small></td><td>${esc(scheduleText(e.before))}</td><td>${e.kind==='cancelado'?'Cancelado':esc(scheduleText(e.after))}</td><td class="reason-cell">${esc(e.reason)}</td><td class="no-print"><button data-view-appointment="${e.appointment_id}">${isManager()?'Abrir obra':'Histórico'}</button></td></tr>`).join('')||'<tr><td colspan="7"><div class="empty">Nenhuma ocorrência encontrada para estes filtros.</div></td></tr>'}</tbody></table></div></div>`;
}
function changesCharts(rows){
  const days=new Map(),clients=new Map(),sellers=new Map();
  const basis=state.changeFilters.basis;
  const month=(new Date(state.changeFilters.to+'T12:00:00')-new Date(state.changeFilters.from+'T12:00:00'))/86400000>62;
  for(const e of rows){
    const d=basis==='before'?e.before.date:basis==='after'?e.after.date:e.event_date;
    if(d){const key=month?d.slice(0,7):d;const g=days.get(key)||{cancelado:0,remarcado:0};g[e.kind]++;days.set(key,g);}
    clients.set(e.customer,(clients.get(e.customer)||0)+1);
    const g=sellers.get(e.seller_id)||{id:e.seller_id,name:e.seller_name,cancelado:0,remarcado:0,count:0};g[e.kind]+=e.planned_volume;g.count++;sellers.set(e.seller_id,g);
  }
  const buckets=[...days].sort(([a],[b])=>a.localeCompare(b));
  return `<div class="analytics-grid"><section class="panel chart-wide"><div class="panel-header"><h2>${month?'Evolução mensal':'Evolução por dia'}</h2><small>Quantidade de ocorrências · referência do filtro</small></div><div class="analytics-chart">${buckets.length?columnChart(buckets,month):'<div class="empty">Sem ocorrências com data para desenhar o gráfico.</div>'}</div><div class="legend"><span><i class="red"></i> Cancelamentos</span><span><i class="purple"></i> Remarcações</span></div></section><section class="panel"><div class="panel-header"><h2>Clientes com mais ocorrências</h2><small>Até 6 clientes</small></div><div class="analytics-chart">${clients.size?rankingChart([...clients].sort((a,b)=>b[1]-a[1]).slice(0,6)):'<div class="empty">Sem clientes para comparar.</div>'}</div></section><section class="panel"><div class="panel-header"><h2>Impacto por vendedor</h2><small>Volumes por ocorrência</small></div><div class="analytics-chart">${sellers.size?sellerImpactChart([...sellers.values()]):'<div class="empty">Sem volumes para comparar.</div>'}</div><div class="table-wrap"><table><thead><tr><th>VENDEDOR</th><th>CANCELADO</th><th>REMARCADO</th><th>OCORRÊNCIAS</th></tr></thead><tbody>${[...sellers.values()].sort((a,b)=>b.count-a.count).map(s=>`<tr><td>${sellerIdentity(s.id,s.name)}</td><td>${num(s.cancelado)} m³</td><td>${num(s.remarcado)} m³</td><td>${s.count}</td></tr>`).join('')||'<tr><td colspan="4"><div class="empty">Sem dados para comparar.</div></td></tr>'}</tbody></table></div></section></div>`;
}
function columnChart(buckets,month){
  const w=Math.max(640,buckets.length*56+80),h=240,base=192,plot=150,max=Math.max(3,Math.ceil(Math.max(1,...buckets.map(([,g])=>Math.max(g.cancelado,g.remarcado)))/3)*3);
  const stride=(w-80)/buckets.length;
  const grid=Array.from({length:4},(_,i)=>{const v=max*i/3,y=base-plot*i/3;return `<line x1="45" y1="${y}" x2="${w-15}" y2="${y}" stroke="#e4ebe7"/><text x="34" y="${y+4}" text-anchor="end" fill="#7b8c83" font-size="10">${num(v)}</text>`;}).join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico de quantidade de cancelamentos e remarcações por período">${grid}${buckets.map(([d,g],i)=>{const x=50+i*stride;return `<g><title>${esc(d)}: ${g.cancelado} cancelamentos e ${g.remarcado} remarcações</title><rect x="${x}" y="${base-g.cancelado/max*plot}" width="14" height="${g.cancelado/max*plot}" rx="3" fill="#bf6262"/><rect x="${x+18}" y="${base-g.remarcado/max*plot}" width="14" height="${g.remarcado/max*plot}" rx="3" fill="#7775b8"/><text x="${x+16}" y="214" text-anchor="middle" fill="#71877b" font-size="10">${month?d.slice(5)+'/'+d.slice(0,4):fmt(d,{day:'2-digit',month:'2-digit'})}</text></g>`;}).join('')}</svg>`;
}
function rankingChart(items){
  const max=Math.max(1,...items.map(([,n])=>n)),height=Math.max(130,items.length*45+25);
  return `<svg viewBox="0 0 520 ${height}" role="img" aria-label="Gráfico dos clientes com mais cancelamentos e remarcações">${items.map(([name,n],i)=>{const y=12+i*45;return `<g><title>${esc(name)}: ${n} ocorrências</title><text x="20" y="${y+10}" font-size="11" fill="#385a49">${esc(name.length>40?name.slice(0,38)+'…':name)}</text><rect x="20" y="${y+18}" width="${n/max*420}" height="10" rx="4" fill="#378364"/><text x="${Math.min(485,50+n/max*420)}" y="${y+27}" font-size="11" fill="#385a49">${n}</text></g>`;}).join('')}</svg>`;
}
function downloadCsv(name,header,rows){
  const content='\uFEFF'+[header,...rows].map(r=>r.map(csvCell).join(';')).join('\r\n');
  const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}
function exportChanges(){
  downloadCsv('cancelamentos-remarcacoes-cascavel-'+state.changeFilters.from+'.csv',['Filial','Ocorrência','Data da alteração','Cliente','Obra','Vendedor','Volume m³','Data anterior','Hora anterior','Duração anterior (h)','Recurso anterior','Nova data','Novo horário','Nova duração (h)','Novo recurso','Motivo','Responsável','Situação atual'],state.changes.map(e=>['Cascavel PR',e.kind==='cancelado'?'Cancelamento':'Remarcação',eventTime(e),e.customer,e.work,e.seller_name,String(e.planned_volume).replace('.',','),fmt(e.before.date),e.before.start,hoursValue(e.before.duration).replace('.',','),e.before.pump_name||(e.before.type==='convencional'?'Convencional':e.before.pump_id),e.kind==='cancelado'?'':fmt(e.after.date),e.kind==='cancelado'?'':e.after.start,e.kind==='cancelado'?'':hoursValue(e.after.duration).replace('.',','),e.kind==='cancelado'?'':e.after.pump_name||e.after.pump_id||'Convencional',e.reason,e.actor_name||'Não registrado',statusNames[e.current_status]||e.current_status]));
}
function customersPage(){
  return heading('Clientes','Informações recuperadas dos agendamentos e solicitações da sua carteira.')+`<div class="panel"><form class="filters" id="customers-filter"><label>Nome do cliente<input name="q" value="${esc(state.customerQuery)}" placeholder="Buscar por nome"></label><button type="submit" class="primary">Buscar clientes</button></form><div class="notice">O cadastro guarda a última configuração utilizada por cliente e vendedor. Ao reutilizar, revise a obra, o volume e as especificações: elas podem mudar de uma entrega para outra. As agendas anteriores permanecem preservadas.</div><div class="table-wrap"><table><thead><tr><th>CLIENTE / ÚLTIMA OBRA</th><th>VENDEDOR</th><th>ÚLTIMA ESPECIFICAÇÃO</th><th>VOLUME / PEÇA</th><th></th></tr></thead><tbody>${state.customers.map(c=>`<tr><td><strong>${esc(c.name)}</strong>${c.customer_code?`<small>Código: ${esc(c.customer_code)}</small>`:''}<small>${esc(c.work)}</small></td><td>${sellerIdentity(c.seller_id,c.seller_name)}</td><td>${esc(c.gravel)} · ${esc(c.resistance)}</td><td>${num(c.planned_volume)} m³<small>${esc(c.piece)}</small></td><td><button data-customer-book="${c.id}">${icon('plus')} ${isManager()?'Nova agenda':'Solicitar reserva'}</button></td></tr>`).join('')||'<tr><td colspan="5"><div class="empty">Nenhum cliente encontrado. O cadastro é salvo automaticamente ao criar uma agenda ou solicitação.</div></td></tr>'}</tbody></table></div><div class="legend">Até 100 resultados por busca. Use parte do nome para localizar outros clientes.</div></div>`;
}
function customerPicker(selected){
  const form=$('#booking-form',modal);if(!form)return;
  $('.form-grid',form).insertAdjacentHTML('afterbegin','<label class="span-2">Preencher com cliente cadastrado<select id="customer-choice"><option value="">Novo cliente — preencher manualmente</option></select></label><div id="customer-prefill-note" class="notice span-2" hidden></div>');
  let customers=[],searchTimer;
  const apply=c=>{
    if(!c)return;
    const values={customer:c.name,work:c.work,gravel:c.gravel,resistance:c.resistance,piece:c.piece,notes:c.notes,planned_volume:c.planned_volume,load_capacity:c.load_capacity||9,duration_hours:hoursValue(c.duration),type:c.type,seller_id:c.seller_id};
    for(const [name,value]of Object.entries(values)){const field=$(`[name="${name}"]`,form);if(field)field.value=value;}
    $('[name=type]',form).onchange();
    form.updateTrips?.();
    const note=$('#customer-prefill-note',form);note.hidden=false;note.textContent=(c.customer_code?'Código do cliente: '+c.customer_code+'. ':'')+'Dados anteriores recuperados. Confira a obra, o volume, a resistência, a brita e as observações antes de confirmar esta nova entrega.';
  };
  const load=async(q='')=>{if(!form.isConnected||!modal.open)return;try{
    const list=await api('/customers?q='+encodeURIComponent(q));if(!form.isConnected)return;customers=list;
    $('#customer-choice',form).innerHTML='<option value="">Novo cliente — preencher manualmente</option>'+list.map(c=>`<option value="${c.id}">${esc(c.name)}${isManager()?' · '+esc(c.seller_name):''}</option>`).join('');
    if(selected){const choice=selected;selected=null;apply(choice);$('#customer-choice',form).value=choice.id;}
  }catch(error){if(form.isConnected)toast(error.message,true);}};
  $('#customer-choice',form).onchange=e=>apply(customers.find(c=>c.id===Number(e.target.value)));
  $('[name=customer]',form).addEventListener('input',e=>{clearTimeout(searchTimer);const q=e.target.value;searchTimer=setTimeout(()=>load(q),300);});
  load();
}
function bindChangesAndCustomers(){
  if($('#changes-filters')){const f=$('#changes-filters');const basis=$('[name=basis]',f),unknown=$('[name=unknown]',f);const toggle=()=>{unknown.disabled=basis.value!=='event';};basis.onchange=toggle;toggle();}
  if($('#changes-filters'))$('#changes-filters').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));if(data.from>data.to)return toast('Confira o período informado.',true);state.changeFilters={...state.changeFilters,...data,unknown:data.unknown||''};await refresh();};
  if($('#customers-filter'))$('#customers-filter').onsubmit=async e=>{e.preventDefault();state.customerQuery=new FormData(e.target).get('q');await refresh();};
  $$('[data-customer-book]').forEach(b=>b.onclick=()=>bookingForm({customerRecord:state.customers.find(c=>c.id===Number(b.dataset.customerBook))}));
  $$('[data-view-appointment]').forEach(b=>b.onclick=async()=>{try{const a=await api('/appointments/'+b.dataset.viewAppointment);if(isManager())editBooking(a);else await bookingHistory(a);}catch(error){toast(error.message,true);}});
}

function sellerImpactChart(items){
  const max=Math.max(1,...items.map(s=>s.cancelado+s.remarcado));
  return `<svg viewBox="0 0 520 ${Math.max(130,items.length*64+30)}" role="img" aria-label="Gráfico de volumes cancelados e remarcados por vendedor">${items.map((s,i)=>{const y=12+i*64,red=s.cancelado/max*390,purple=s.remarcado/max*390;return `<g><title>${esc(s.name)}: ${num(s.cancelado)} m³ cancelados, ${num(s.remarcado)} m³ remarcados</title>${sellerChartPhoto({...s,id:s.id},38,y-8)}<text x="65" y="${y+10}" fill="#385a49" font-size="11">${esc(s.name)}</text><rect x="20" y="${y+36}" width="${red}" height="11" rx="3" fill="#bf6262"/><rect x="${20+red}" y="${y+36}" width="${purple}" height="11" rx="3" fill="#7775b8"/><text x="${35+red+purple}" y="${y+45}" fill="#385a49" font-size="10">${num(s.cancelado+s.remarcado)} m³</text></g>`;}).join('')}</svg>`;
}

function tripFields(volume=0,capacity=9,legacyTrips=null){
  const legacy=capacity===null;
  return `<div class="trip-fields span-2" data-volume="${Number(volume)||0}" data-legacy="${legacyTrips??0}"><label>Capacidade para estimativa<select name="load_capacity">${legacy?'<option value="" selected>Manter previsão do registro antigo</option>':''}${[8,9,10].map(n=>`<option value="${n}" ${!legacy&&Number(capacity)===n?'selected':''}>${n===9?'9 m³ — média da frota':n+' m³ por viagem'}</option>`).join('')}</select></label><label>Viagens previstas (automático)<input name="trips" type="text" readonly value="${legacy?legacyTrips??0:Math.ceil((Number(volume)||0)/Number(capacity||9))}" aria-describedby="trip-estimate-hint"></label><small id="trip-estimate-hint">Volume ÷ capacidade, arredondado para cima. A média de 9 m³ pode ser usada em obras grandes com frota mista.</small></div>`;
}
function bindTripCalculator(){
  const root=$('.trip-fields',modal);if(!root)return;
  const form=root.closest('form'),volume=$('[name=planned_volume]',form),capacity=$('[name=load_capacity]',root),trips=$('[name=trips]',root);
  const update=()=>{const v=volume?Number(volume.value):Number(root.dataset.volume);trips.value=capacity.value?Math.ceil(Math.max(0,Number.isFinite(v)?v:0)/Number(capacity.value)):root.dataset.legacy;};
  capacity.addEventListener('change',update);if(volume)volume.addEventListener('input',update);form.updateTrips=update;update();
}
function agendaHeader(actions,rows){
  if(!isManager()||!state.production)return heading('Agenda de obras','Planeje cada entrega. Encontre o próximo horário livre.',actions);
  const p=state.production,days=state.fleet?.days||[],truckDays=state.fleet?.truck_days||0;
  const cb=state.cbProduction,cbRows=cb.bookings,cbTruckDays=cb.fleet.truck_days;
  const planned=cbRows.filter(a=>a.status!=='cancelado').reduce((sum,a)=>sum+a.planned_volume,0),informed=cbRows.filter(a=>a.delivered_volume!==null),delivered=informed.reduce((sum,a)=>sum+a.delivered_volume,0);
  const count=state.mode==='day'?(days[0]?.trucks??17):truckDays/Math.max(1,days.length);
  const base=state.mode==='day'?(days[0]?.default_trucks??17):days.reduce((sum,d)=>sum+d.default_trucks,0)/Math.max(1,days.length);
  const unit=cb.from===cb.to?'m³/CB':'m³/CB/dia',cbPlanned=cbTruckDays?planned/cbTruckDays:null,cbDelivered=cbTruckDays&&informed.length?delivered/cbTruckDays:null;
  const agendaLabel=state.mode==='day'?fmt(state.date,{day:'2-digit',month:'2-digit'}):state.mode==='week'?'semana da agenda':'mês da agenda';
  const cbRatio=cbTruckDays>0&&planned>0&&informed.length?delivered/planned*100:null;
  const rings=[
    metricRing('target',{label:'Meta mensal',value:p.target?num(p.target):'—',unit:'m³',percent:p.target?100:null,reference:true,detail:fmt(p.month+'-01',{month:'short',year:'numeric'}),tone:'reference'}),
    metricRing('programmed',{label:'Programado no mês',value:num(p.programmed),unit:'m³',percent:p.percent,detail:p.target?num(p.percent)+'% da meta':'Meta não definida',tone:'green'}),
    metricRing('delivered',{label:'Entregue no mês',value:num(p.delivered),unit:'m³ informados',percent:p.delivery_percent,detail:p.target?num(p.delivery_percent)+'% da meta':'Meta não definida',tone:'blue'}),
    metricRing('remaining',{label:'Falta programar',value:p.remaining===null?'—':num(p.remaining),unit:'m³',percent:p.remaining_percent,detail:p.target?(p.surplus>0?'Meta superada':num(p.remaining_percent)+'% restante'):'Meta não definida',tone:'amber'}),
    metricRing('cb-production',{label:'Produção por CB',value:cbPlanned===null?'—':num(cbPlanned),unit:unit+' previstos',percent:cbRatio,detail:cbDelivered===null?'Período: '+cb.label:'Entregue: '+num(cbDelivered)+' '+unit,tone:'teal',controls:cbPeriodControl(cb),description:'Produção prevista por CB no período escolhido. O cálculo considera os caminhões disponíveis em cada dia. O arco indica o entregue informado em relação ao previsto.'}),
    metricRing('fleet',{label:state.mode==='day'?'CBs disponíveis':'CBs/dia · média',value:num(count),unit:'caminhões',percent:base>0?count/base*100:null,detail:state.mode==='day'?num(count)+' caminhões disponíveis':'Agenda: '+agendaLabel,tone:'slate',description:'Frota disponível em relação ao padrão vigente.'})
  ].join('');
  const zero=days.some(d=>d.trucks===0&&rows.some(a=>a.date===d.date));
  return `<section class="agenda-header"><div class="agenda-title"><div class="eyebrow">CENTRAL DE PROGRAMAÇÃO</div><h1>Agenda de obras</h1><p class="subtitle">Planeje cada entrega. Encontre o próximo horário livre.</p></div><div class="agenda-top-metrics"><div class="ring-controls"><label>Mês dos indicadores<input type="month" id="production-month" value="${p.month}"></label>${canManageProduction()?`<button id="edit-goal">${p.target?'Alterar meta':'Definir meta'}</button><button id="adjust-fleet">Ajustar frota</button>`:''}</div><div class="metric-rings" aria-label="Indicadores de metas e produção">${rings}</div>${zero?'<p class="ring-warning">Há obra programada em dia sem caminhões disponíveis.</p>':''}</div><div class="agenda-actions actions">${actions}</div></section>`;
}
function metricRing(key,{label,value,unit,percent,detail,tone,reference=false,description='',controls=''}){
  const known=percent!==null&&Number.isFinite(Number(percent)),progress=known?Math.min(100,Math.max(0,Number(percent))):0;
  const accessible=`${label}: ${value} ${unit}. ${detail}. ${description}`;
  const role=known&&!reference?`role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}" aria-valuetext="${esc(accessible)}"`:'role="img"';
  return `<article class="ring-metric ring-${tone}" data-metric="${key}" data-percent="${known?Number(percent):''}"><div class="ring-label">${esc(label)}</div><div class="metric-ring" ${role} aria-label="${esc(accessible)}"><svg viewBox="0 0 88 88" aria-hidden="true"><circle class="metric-track" cx="44" cy="44" r="36"/>${progress>0?`<circle class="metric-arc" cx="44" cy="44" r="36" pathLength="100" stroke-dasharray="${progress} ${100-progress}" transform="rotate(-90 44 44)"/>`:''}</svg><div class="ring-value"><strong class="ring-main-value ${String(value).length>7?'ring-long-value':''}">${esc(value)}</strong><span>${esc(unit)}</span></div></div><small class="ring-detail">${esc(detail)}</small>${controls}</article>`;
}
function goalForm(p=state.production){
  dialog('Meta mensal de volume','Gerente e Programador · Cascavel – PR',`<form><div class="form-grid"><label>Mês<input name="month" type="month" value="${p.month}" required></label><label>Meta de volume (m³)<input name="volume" type="number" min="0.1" max="100000000" step="0.1" value="${p.target??''}" placeholder="Ex.: 10000" required></label></div><div class="hint">${icon('info')} A meta vale somente para o mês escolhido. O volume programado é calculado pelas agendas confirmadas e concluídas; não é digitado manualmente.</div>${footer('Salvar meta mensal')}</form>`,async data=>{await api('/production',{method:'PATCH',body:JSON.stringify(data)});state.goalMonth=data.month;if(state.page==='production')state.productionFilters.month=data.month;if(state.page==='management')state.managementMonth=data.month;modal.close();toast('Meta mensal salva.');await refresh();});
}
function fleetForm(data=state.fleet,selectedDate=state.date){
  const current=data?.days.find(d=>d.date===selectedDate)||data?.days[0];
  dialog('Caminhões disponíveis','Gerente e Programador · Quantidade usada no indicador de produção',`<form><div class="form-grid"><label>Data<input type="date" name="date" value="${selectedDate}" required></label><label>Caminhões disponíveis<input type="number" name="trucks" min="0" max="1000" step="1" value="${current?.trucks??17}" required></label><label class="span-2">Aplicar quantidade<select name="scope"><option value="day">Somente nesta data</option><option value="from">Novo padrão a partir desta data</option><option value="clear">Remover ajuste desta data e usar o padrão</option></select></label></div><div class="hint">${icon('info')} O padrão inicial é 17 caminhões. Ajustes específicos do dia têm prioridade sobre o padrão. A alteração não distribui veículos nem cancela obras automaticamente.</div>${footer('Salvar frota')}</form>`,async data=>{await api('/fleet',{method:'PATCH',body:JSON.stringify(data)});modal.close();toast('Frota disponível atualizada.');await refresh();});
  const form=$('form',modal),day=$('[name=date]',form),trucks=$('[name=trucks]',form);
  day.onchange=async()=>{if(!day.value)return;const expected=day.value;try{const result=await api(`/fleet?from=${day.value}&to=${day.value}`);if(form.isConnected&&day.value===expected)trucks.value=result.days[0].trucks;}catch(error){formError(form,error.message);}};
}

function reportHeader(title,period){
  return `<header class="report-document-header"><div class="report-brand-banner"><img class="report-official-logo" src="/logo-concresuper.png" alt="Concresuper — Super tecnologia em concreto"><span>PROGRAMAÇÃO E LOGÍSTICA</span></div><div class="report-document-title"><h2>${esc(title)}</h2><strong>Cascavel · PR</strong></div><div class="report-document-period">${esc(period)}</div></header>`;
}
function productionReportPage(){
  const p=state.productionReport;if(!p)return '<div class="empty">Carregando produção…</div>';
  const f=state.productionFilters,fleet=new Map((state.productionFleet?.days||[]).map(d=>[d.date,d.trucks]));
  const unit=daysName(p.basis),daily=p.daily;
  return reportTabs('production')+heading('Produção e metas','Programado, entregue informado e o volume diário necessário para alcançar a meta.',`<button id="export">${icon('export')} Exportar CSV</button><button id="print">Imprimir / salvar PDF</button>${canManageProduction()?`<button class="primary" id="edit-goal">${p.target?'Alterar meta':'Definir meta'}</button>`:''}`)+reportHeader('Relatório de produção e meta mensal',fmt(p.month+'-01',{month:'long',year:'numeric'}))+`<div class="panel"><form class="filters" id="production-filters"><label>Mês do relatório<input type="month" name="month" value="${f.month}" required></label><label>Data de referência<input type="date" name="reference" value="${f.reference}" required></label><label>Dias para a projeção<select name="basis">${[['mon_sat','Segunda a sábado'],['mon_fri','Segunda a sexta'],['all','Todos os dias']].map(([v,l])=>`<option value="${v}" ${f.basis===v?'selected':''}>${l}</option>`).join('')}</select></label><button type="submit" class="primary">Atualizar projeção</button></form><div class="panel-header"><h2>Meta mensal: ${p.target?num(p.target)+' m³':'não definida'}</h2><small>Referência: ${fmt(p.reference)} · ${p.days_remaining} dias restantes · ${unit}</small></div></div><div class="stats production-report-stats">${stat('Volume programado',num(p.programmed),'m³',p.target?num(p.percent)+'% da meta':'Sem meta definida','calendar')}${stat('Entregue informado',num(p.delivered),'m³',p.target?num(p.delivery_percent)+'% da meta':'Preencha os volumes efetivos','cube')}${stat('Falta programar',p.remaining===null?'—':num(p.remaining),'m³',p.target?num(p.remaining_percent)+'% da meta':'Defina a meta mensal','request')}${stat('Falta entregar',p.delivery_remaining===null?'—':num(p.delivery_remaining),'m³',p.target?num(p.delivery_remaining_percent)+'% da meta · com base no informado':'Defina a meta mensal','truck')}</div><div class="projection-grid"><section class="panel projection-card"><div class="eyebrow">RITMO NECESSÁRIO DE ENTREGAS</div><strong>${p.required_delivery_daily===null?'—':num(p.required_delivery_daily)} <span>m³/dia</span></strong><p>${projectionMessage(p,p.required_delivery_daily,'entregar')}</p></section><section class="panel projection-card"><div class="eyebrow">RITMO NECESSÁRIO DE NOVAS PROGRAMAÇÕES</div><strong>${p.required_programming_daily===null?'—':num(p.required_programming_daily)} <span>m³/dia</span></strong><p>${projectionMessage(p,p.required_programming_daily,'programar')}</p></section></div><div class="notice">A projeção considera ${unit.toLowerCase()} a partir de ${fmt(p.reference)} (inclusive), até o fim do mês. Feriados e paralisações não são descontados. Volumes já entregues permanecem na produção mesmo quando a obra é cancelada. Os volumes refletem os registros atuais e a data agendada da obra; a data de referência ajusta a contagem de dias, não reconstrói um histórico de entregas.</div>${p.missing?`<div class="notice warning">${p.missing} obra(s) sem volume entregue informado. Atualize esses registros para melhorar a projeção; o cálculo usa somente as entregas registradas.</div>`:''}<div class="analytics-grid"><section class="panel chart-wide"><div class="panel-header"><h2>Volume diário</h2><small>Por data programada · m³</small></div><div class="analytics-chart">${volumeBars(daily)}</div><div class="legend"><span><i></i> Programado</span><span><i class="blue"></i> Entregue informado</span></div></section><section class="panel chart-wide"><div class="panel-header"><h2>Avanço acumulado no mês</h2><small>Programado, entregue informado e meta mensal · m³</small></div><div class="analytics-chart">${cumulativeProduction(daily,p.target)}</div><div class="legend"><span><i></i> Programado</span><span><i class="blue"></i> Entregue informado</span><span><i class="yellow"></i> Meta mensal</span></div></section></div>${sellerVolumePanel(p.sellers||[])}<div class="panel"><div class="panel-header"><h2>Produção por dia e caminhão</h2><small>CB = caminhão betoneira disponível no dia</small></div><div class="table-wrap"><table><thead><tr><th>DATA</th><th>PROGRAMADO</th><th>ENTREGUE INFORMADO</th><th>CBs DISPONÍVEIS</th><th>PREVISTO / CB</th><th>ENTREGUE / CB</th><th>SEM VOLUME INFORMADO</th></tr></thead><tbody>${daily.map(d=>{const count=fleet.get(d.date)??17;return `<tr><td>${fmt(d.date)}<small>${fmt(d.date,{weekday:'short'})}</small></td><td>${num(d.programmed)} m³</td><td>${d.works&&!d.informed?'Não informado':num(d.delivered)+' m³'}</td><td>${count}</td><td>${count?num(d.programmed/count)+' m³':'—'}</td><td>${count&&d.informed>0?num(d.delivered/count)+' m³':'—'}</td><td>${d.missing}</td></tr>`;}).join('')}</tbody></table></div></div>`;
}
function daysName(basis){return {mon_sat:'Segunda a sábado',mon_fri:'Segunda a sexta',all:'Todos os dias'}[basis];}
function projectionMessage(p,value,verb){
  if(!p.target)return 'Defina a meta mensal para calcular a projeção.';
  if(value===0)return `A meta já foi alcançada pelo volume ${verb==='entregar'?'entregue informado':'programado'}.`;
  if(value===null)return 'Não há mais dias considerados disponíveis neste mês. O saldo continua indicado acima.';
  return `Média a ${verb} em cada um dos ${p.days_remaining} dias restantes para alcançar ${num(p.target)} m³.`;
}
function volumeBars(days){
  const w=1100,h=260,base=205,plot=165,step=(w-75)/days.length,max=Math.max(1,...days.map(d=>Math.max(d.programmed,d.delivered)));
  const axes=Array.from({length:5},(_,i)=>{const y=base-i*plot/4;return `<line x1="50" y1="${y}" x2="${w-15}" y2="${y}" stroke="#e4ebe7"/><text x="43" y="${y+4}" text-anchor="end" fill="#829388" font-size="9">${num(max*i/4)}</text>`;}).join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico dos volumes diários programados e entregues informados">${axes}${days.map((d,i)=>{const x=55+i*step;return `<g><title>${fmt(d.date)}: ${num(d.programmed)} m³ programados, ${num(d.delivered)} m³ entregues informados, ${d.missing} obras sem volume</title><rect x="${x}" y="${base-d.programmed/max*plot}" width="10" height="${d.programmed/max*plot}" fill="#358362" rx="2"/><rect x="${x+12}" y="${base-d.delivered/max*plot}" width="10" height="${d.delivered/max*plot}" fill="#688abf" rx="2"/><text x="${x+11}" y="225" text-anchor="middle" fill="#7a8e80" font-size="9">${d.date.slice(8)}</text></g>`;}).join('')}</svg>`;
}
function cumulativeProduction(days,target){
  const w=1100,h=260,base=205,plot=165,total=days.reduce((s,d)=>s+d.programmed,0),actual=days.reduce((s,d)=>s+d.delivered,0),max=Math.max(1,target||0,total,actual);
  let plan=0,done=0;const planned=[],delivered=[];
  for(let i=0;i<days.length;i++){const x=55+i*(w-80)/Math.max(1,days.length-1);plan+=days[i].programmed;done+=days[i].delivered;planned.push(x+','+(base-plan/max*plot));delivered.push(x+','+(base-done/max*plot));}
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico acumulado de volumes e meta mensal">${Array.from({length:5},(_,i)=>{const y=base-i*plot/4;return `<line x1="50" y1="${y}" x2="${w-15}" y2="${y}" stroke="#e4ebe7"/><text x="43" y="${y+4}" text-anchor="end" fill="#829388" font-size="9">${num(max*i/4)}</text>`;}).join('')}${target?`<line x1="50" y1="${base-target/max*plot}" x2="${w-15}" y2="${base-target/max*plot}" stroke="#be9a4f" stroke-width="2" stroke-dasharray="6 5"><title>Meta: ${num(target)} m³</title></line>`:''}<polyline points="${planned.join(' ')}" fill="none" stroke="#358362" stroke-width="3"/><polyline points="${delivered.join(' ')}" fill="none" stroke="#688abf" stroke-width="3"/>${days.filter((d,i)=>i%5===0||i===days.length-1).map(d=>{const i=days.indexOf(d),x=55+i*(w-80)/Math.max(1,days.length-1);return `<text x="${x}" y="225" fill="#7a8e80" font-size="10" text-anchor="middle">${d.date.slice(8)}</text>`;}).join('')}</svg>`;
}
function exportProduction(){
  const p=state.productionReport,fleet=new Map((state.productionFleet?.days||[]).map(d=>[d.date,d.trucks]));
  const value=n=>n===null?'Não calculado':String(n).replace('.',',');
  const header=['Seção','Referência','Meta m³','Programado m³','Entregue informado m³','Programado/meta %','Entregue/meta %','Falta programar m³','Falta entregar m³','Dias restantes','Programar m³/dia','Entregar m³/dia','CBs-dia disponíveis','Programado m³/CB','Entregue informado m³/CB','Obras sem volume entregue'];
  const rows=[['Resumo',p.month,value(p.target),value(p.programmed),value(p.delivered),value(p.percent),value(p.delivery_percent),value(p.remaining),value(p.delivery_remaining),p.days_remaining,value(p.required_programming_daily),value(p.required_delivery_daily),state.productionFleet.truck_days,'','',p.missing],['Projeção',`${fmt(p.reference)} · ${daysName(p.basis)}`,...Array(14).fill('')]];
  for(const d of p.daily){const count=fleet.get(d.date)??17;rows.push(['Diário',fmt(d.date),'',value(d.programmed),d.works&&!d.informed?'Não informado':value(d.delivered),'','','','','','','',count,count?value(d.programmed/count):'Sem frota',count&&d.informed>0?value(d.delivered/count):'Não informado',d.missing]);}
  for(const seller of p.sellers||[])rows.push(['Vendedor',seller.name,'',value(seller.programmed),seller.informed?value(seller.delivered):seller.missing?'Não informado':'0','','','','','','','','','','',seller.missing]);
  downloadCsv('producao-e-metas-cascavel-'+p.month+'.csv',header,rows);
}

function managementPage(){
  if(!canManageProduction())return '<div class="empty">Acesso reservado ao Gerente e Programador.</div>';
  const m=state.management;if(!m)return '<div class="empty">Carregando gerência…</div>';
  const fleet=m.fleet.days[0],p=m.production;
  return heading('Gerência','Bombas, caminhões disponíveis e metas da unidade Cascavel – PR.')+`<div class="notice">As alterações ficam registradas com usuário, data e hora. O Gerente e o Programador podem gerenciar esta área; o Controlador consulta os indicadores na agenda.</div><div class="management-grid"><section class="panel"><div class="panel-header"><h2>Caminhões betoneira disponíveis</h2></div><div class="management-body"><label>Consultar frota da data<input type="date" id="management-fleet-date" value="${state.managementDate}"></label><div class="management-value">${fleet.trucks} <span>CBs disponíveis</span></div><p>${fleet.override?'Ajuste específico desta data.':'Quantidade padrão vigente nesta data.'} Padrão: ${fleet.default_trucks} caminhões.</p><button class="primary" id="management-adjust-fleet">${icon('truck')} Alterar quantidade de CBs</button><small>Defina somente para um dia ou um novo padrão a partir de uma data. Ajustes específicos prevalecem.</small></div></section><section class="panel"><div class="panel-header"><h2>Meta mensal de volume</h2></div><div class="management-body"><label>Consultar mês da meta<input type="month" id="management-goal-month" value="${state.managementMonth}"></label><div class="management-value">${p.target?num(p.target):'Não definida'} <span>${p.target?'m³ de meta':''}</span></div><p>${num(p.programmed)} m³ programados${p.target?' · '+num(p.percent)+'% da meta':''}.</p><button class="primary" id="management-adjust-goal">${icon('chart')} ${p.target?'Alterar meta mensal':'Definir meta mensal'}</button><small>O volume programado e os percentuais são calculados automaticamente pelas agendas.</small></div></section><section class="panel management-pumps"><div class="panel-header"><h2>Bombas da filial</h2><button class="soft" id="new-pump">${icon('plus')} Cadastrar bomba</button></div>${state.meta.pumps.map(p=>`<div class="list-row"><div><strong>${esc(p.name)}</strong><small>${esc(p.description||'Bombeamento de concreto')}</small></div><div class="actions"><span class="badge ${p.maintenance||state.maintenances.some(m=>m.pump_id===p.id)?'pendente':'concluido'}">${p.maintenance?'Bloqueio antigo':state.maintenances.some(m=>m.pump_id===p.id)?'Manutenção na data':'Sem bloqueio nesta data'}</span><button data-schedule-maintenance="${p.id}">Programar manutenção</button></div></div>`).join('')||'<div class="empty">Cadastre os códigos e descrições das bombas da filial.</div>'}</section></div>`;
}

function maintenanceOnDay(date,pumpId){
  const start=date+'T00:00',end=shift(date,1)+'T00:00';
  return state.maintenances.filter(m=>(!pumpId||m.pump_id===pumpId)&&m.starts_at<end&&m.ends_at>start);
}
function maintenanceTime(m){
  const format=value=>fmt(value.slice(0,10))+' '+value.slice(11,16);
  return format(m.starts_at)+' até '+format(m.ends_at);
}
function maintenanceForm(selectedPump){
  const baseDate=state.page==='management'?state.managementDate:state.date;
  dialog('Bomba em manutenção','Escolha a bomba, o período e o motivo do bloqueio',`<form><div class="form-grid"><label class="span-2">Bomba *<select name="pump_id" required><option value="">Selecione a bomba</option>${state.meta.pumps.map(p=>`<option value="${p.id}" ${p.id===selectedPump?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label>Início da manutenção *<input type="datetime-local" name="starts_at" required value="${baseDate}T07:00"></label><label>Fim da manutenção *<input type="datetime-local" name="ends_at" required value="${baseDate}T18:00"></label><label class="span-2">Motivo da manutenção *<textarea name="reason" required maxlength="1000" placeholder="Descreva o serviço, defeito ou motivo da indisponibilidade"></textarea></label></div><div class="hint">${icon('info')} Novos agendamentos e remarcações ficam bloqueados apenas quando coincidem com o período. Obras já marcadas serão sinalizadas para revisão e não serão canceladas.</div>${footer('Registrar manutenção')}</form>${state.meta.pumps.some(p=>p.maintenance)?`<section class="maintenance-list"><h3>Bloqueios antigos sem período</h3>${state.meta.pumps.filter(p=>p.maintenance).map(p=>`<div class="list-row" data-legacy-row="${p.id}"><div><strong>${esc(p.name)}</strong><small>Bloqueio anterior sem datas. Continua impedindo novos serviços até ser liberado.</small></div><button data-release-legacy="${p.id}">Liberar bloqueio antigo</button></div>`).join('')}</section>`:''}<section class="maintenance-list"><h3>Períodos na agenda consultada</h3>${state.maintenances.length?state.maintenances.map(m=>`<article class="history-event"><strong>${esc(m.pump_name)}</strong><small>${esc(maintenanceTime(m))}</small><p>${esc(m.reason||'Manutenção programada')}</p><button data-cancel-maintenance="${m.id}">Cancelar período</button></article>`).join(''):'<p class="subtitle">Nenhuma manutenção no período consultado.</p>'}</section>`,async data=>{
    const result=await api('/maintenance',{method:'POST',body:JSON.stringify(data)});modal.close();await refresh();
    if(result.conflicts.length){
      dialog('Manutenção registrada — revisar obras','Os agendamentos abaixo coincidem com a manutenção. Nenhum foi cancelado.',`<div class="notice warning">${result.conflicts.length} obra(s) precisam de conferência. Remarque ou ajuste a manutenção conforme a operação.</div>${result.conflicts.map(a=>`<div class="list-row"><div><strong>${esc(a.customer)}</strong><small>${fmt(a.date)} · ${a.start}–${endTime(a)}</small></div><button data-maintenance-reschedule="${a.id}">Remarcar obra</button></div>`).join('')}`);
      $$('[data-maintenance-reschedule]',modal).forEach(b=>b.onclick=async()=>{try{const a=await api('/appointments/'+b.dataset.maintenanceReschedule);changeBooking(a,'remarcar');}catch(error){toast(error.message,true);}});
    }else toast('Manutenção registrada. O período já está bloqueado.');
  });
  $$('[data-cancel-maintenance]',modal).forEach(b=>b.onclick=()=>cancelMaintenance(Number(b.dataset.cancelMaintenance)));
  $$('[data-release-legacy]',modal).forEach(b=>b.onclick=async()=>{
    if(!confirm('Liberar o bloqueio antigo? Os períodos de manutenção cadastrados continuarão valendo.'))return;
    try{await api('/pumps/'+b.dataset.releaseLegacy,{method:'PATCH',body:JSON.stringify({maintenance:false})});await refresh();$(`[data-legacy-row="${b.dataset.releaseLegacy}"]`,modal)?.remove();toast('Bloqueio antigo liberado.');}catch(error){toast(error.message,true);}
  });
}
function cancelMaintenance(id){
  const m=state.maintenances.find(m=>m.id===id);
  dialog('Cancelar período de manutenção',m?m.pump_name+' · '+maintenanceTime(m):'O registro ficará preservado no histórico',`<form><label>Motivo do cancelamento *<textarea name="reason" required maxlength="1000"></textarea></label>${footer('Confirmar cancelamento do período')}</form>`,async data=>{await api('/maintenance/'+id,{method:'PATCH',body:JSON.stringify(data)});modal.close();toast('Período de manutenção cancelado.');await refresh();});
}

function sellerVolumePanel(sellers){
  const max=Math.max(1,...sellers.map(s=>Math.max(s.programmed,s.delivered))),charts=[];
  for(let offset=0;offset<sellers.length;offset+=8){
    const group=sellers.slice(offset,offset+8),width=1100,height=410,baseline=245,plotHeight=195,step=1000/group.length;
    const grid=Array.from({length:5},(_,i)=>{const y=baseline-plotHeight*i/4;return `<line x1="55" y1="${y}" x2="1080" y2="${y}" stroke="#e3ebe5"/><text x="45" y="${y+4}" text-anchor="end" fill="#7b8e81" font-size="11">${num(max*i/4)}</text>`;}).join('');
    charts.push(`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico vertical de volume programado e entregue informado por vendedor${offset?' — continuação':''}"><text x="20" y="20" fill="#7b8e81" font-size="11">m³</text>${grid}${group.map((s,i)=>{
      const center=65+(i+.5)*step,barWidth=group.length>5?30:40,gap=10;
      const plannedHeight=s.programmed/max*plotHeight,actualHeight=s.delivered/max*plotHeight;
      const plannedX=center-gap/2-barWidth,actualX=center+gap/2;
      const plannedY=baseline-plannedHeight,actualY=baseline-actualHeight;
      const plannedLabelY=plannedY-6,actualLabelY=actualY-6;
      const words=s.name.split(/\s+/),lines=[''];
      for(const word of words){const last=lines.length-1;if((lines[last]+' '+word).trim().length>16&&lines[last])lines.push(word);else lines[last]=(lines[last]+' '+word).trim();}
      const shown=lines.slice(0,2);if(lines.length>2)shown[1]=shown[1].slice(0,14)+'…';
      return `<g data-seller-column="${s.id}"><title>${esc(s.name)}: ${num(s.programmed)} m³ programados, ${num(s.delivered)} m³ entregues informados; ${s.missing} obras sem volume entregue</title><rect data-volume-series="programmed" x="${plannedX}" y="${plannedY}" width="${barWidth}" height="${plannedHeight}" rx="3" fill="#358362"/><text data-volume-label="programmed" x="${plannedX+barWidth/2}" y="${plannedLabelY}" text-anchor="middle" fill="#3b6b52" font-size="12">${num(s.programmed)}</text><rect data-volume-series="delivered" x="${actualX}" y="${actualY}" width="${barWidth}" height="${actualHeight}" rx="3" fill="#688abf"/><text data-volume-label="delivered" x="${actualX+barWidth/2}" y="${actualLabelY}" text-anchor="middle" fill="#607ba5" font-size="12">${s.informed?num(s.delivered):s.missing?'Não informado':'0'}</text><text x="${center}" y="277" text-anchor="middle" fill="#345744" font-size="12">${shown.map((line,j)=>`<tspan x="${center}" dy="${j?17:0}">${esc(line)}</tspan>`).join('')}</text>${sellerChartPhoto(s,center,shown.length===2?315:300,72,true)}</g>`;
    }).join('')}</svg>`);
  }
  return `<section class="panel seller-volume-panel"><div class="panel-header"><h2>Programado × entregue por vendedor</h2><small>Volumes do mês selecionado · m³</small></div><div class="analytics-chart">${charts.join('')||'<div class="empty">Nenhum vendedor ou volume registrado neste mês.</div>'}</div><div class="legend"><span><i></i> Programado</span><span><i class="blue"></i> Entregue informado</span></div><div class="table-wrap"><table><thead><tr><th>VENDEDOR</th><th>PROGRAMADO</th><th>ENTREGUE INFORMADO</th><th>ENTREGUE / PROGRAMADO</th><th>SEM VOLUME INFORMADO</th></tr></thead><tbody>${sellers.map(s=>`<tr><td>${sellerIdentity(s.id,s.name)}</td><td>${num(s.programmed)} m³</td><td>${s.informed?num(s.delivered)+' m³':s.missing?'Não informado':'0 m³'}</td><td>${s.programmed&&s.informed?num(s.delivered/s.programmed*100)+'%':'—'}</td><td>${s.missing}</td></tr>`).join('')||'<tr><td colspan="5"><div class="empty">Sem dados para este período.</div></td></tr>'}</tbody></table></div></section>`;
}

function commercialReference(a){
  let text=a.customer_code||'';
  if(a.order_code)text+=(text?'/':'Pedido ')+a.order_code;
  if(a.order_item)text+=(a.order_code?'-':text?' · Item ':'Item ')+a.order_item;
  return text;
}
function commercialTitle(a){const reference=commercialReference(a);return a.customer+(reference?' '+reference:'');}
async function openCommercialInformation(id){
  try{
    const a=await api('/appointments/'+id);
    dialog('Adicionar informações',a.customer+' · '+fmt(a.date)+' · '+a.start,`<form><div class="form-grid"><label class="span-2">Código do cliente<input name="customer_code" type="text" maxlength="60" value="${esc(a.customer_code||'')}" autocomplete="off" placeholder="Ex.: 5310"></label><label>Código do pedido<input name="order_code" type="text" maxlength="60" value="${esc(a.order_code||'')}" autocomplete="off" placeholder="Ex.: 2020"></label><label>Item do pedido<input name="order_item" type="text" maxlength="60" value="${esc(a.order_item||'')}" autocomplete="off" placeholder="Ex.: 1"></label></div><div class="hint">${icon('info')} O código do cliente fica salvo no cadastro para as próximas agendas. Pedido e item pertencem somente a esta obra agendada. Data, volume e bomba não são alterados aqui.</div><div class="commercial-preview"><small>Referência no relatório</small><strong id="commercial-preview">${esc(commercialTitle(a))}</strong></div>${footer('Salvar informações')}</form>`,async data=>{
      await api('/appointments/'+id+'/information',{method:'PATCH',body:JSON.stringify({...data,expected_version:a.information_version})});modal.close();toast('Informações salvas. Código do cliente disponível para reutilização.');await refresh();
    });
    const form=$('form',modal);const preview=()=>{const values=Object.fromEntries(new FormData(form));$('#commercial-preview',form).textContent=commercialTitle({...a,...values});};
    $$('input',form).forEach(input=>input.addEventListener('input',preview));
  }catch(error){toast(error.message,true);}
}

function profileAvatar(id,name){
 const profile=state.meta?.profiles?.find(p=>p.id===Number(id));
 return profile?.version?`<img class="profile-avatar" src="/api/profile-photo/${profile.id}?v=${esc(profile.version)}" alt="Foto de ${esc(name||profile.name)}">`:`<span class="avatar profile-avatar" aria-hidden="true">${esc((name||'?').split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join(''))}</span>`;
}
function sellerIdentity(id,name){id ||= state.meta?.profiles?.find(p=>p.name===name)?.id;return `<span class="seller-identity">${profileAvatar(id,name)}<span>${esc(name||'—')}</span></span>`;}
function openProfilePhoto(){
 dialog('Foto de perfil','Sua foto aparecerá ao lado do seu nome nos relatórios.',`<form><div class="profile-photo-preview" id="photo-preview">${profileAvatar(state.user.id,state.user.name)}</div><label>Escolher foto<input id="profile-photo-file" type="file" accept="image/jpeg,image/png,image/webp"></label><p class="hint">A foto será ajustada automaticamente. Utilize uma imagem de até 10 MB.</p><div class="form-error" role="alert"></div><div class="form-footer"><button type="button" id="remove-photo">Remover foto</button><button type="submit" class="primary">Salvar foto</button></div></form>`,async()=>{
   if(!pendingPhoto)throw Error('Escolha uma foto antes de salvar.');
   await api('/profile/photo',{method:'PATCH',body:JSON.stringify({image:pendingPhoto})});modal.close();await refresh();toast('Foto atualizada.');
 });
 let pendingPhoto='';
 $('#profile-photo-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('Escolha uma imagem JPEG, PNG ou WebP de até 10 MB.');
   const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');canvas.width=canvas.height=192;
   const context=canvas.getContext('2d'),size=Math.min(bitmap.width,bitmap.height);context.fillStyle='#fff';context.fillRect(0,0,192,192);context.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,192,192);bitmap.close();
   pendingPhoto=canvas.toDataURL('image/jpeg',0.85);$('#photo-preview').innerHTML=`<img class="profile-avatar" src="${pendingPhoto}" alt="Prévia da foto">`;$('.form-error',modal).textContent='';
  }catch(error){pendingPhoto='';$('.form-error',modal).textContent=error.message;}
 };
 $('#remove-photo').onclick=async()=>{try{await api('/profile/photo',{method:'PATCH',body:JSON.stringify({image:null})});modal.close();await refresh();toast('Foto removida.');}catch(error){toast(error.message,true);}};
}

function sellerChartPhoto(s,x,y,size=36,shadow=false){
 const profile=state.meta?.profiles?.find(p=>p.id===s.id),clip='seller-photo-'+s.id,radius=size/2,cy=y+radius,filter='seller-photo-shadow-'+s.id;
 const frame=shadow?`<defs><filter id="${filter}" x="-60%" y="-60%" width="220%" height="240%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#173e31" flood-opacity="0.22"/></filter></defs><circle cx="${x}" cy="${cy}" r="${radius+2}" fill="white" stroke="white" stroke-width="2" filter="url(#${filter})"/>`:'';
 return frame+(profile?.version?`<defs><clipPath id="${clip}"><circle cx="${x}" cy="${cy}" r="${radius}"/></clipPath></defs><image data-seller-photo="${s.id}" href="/api/profile-photo/${s.id}?v=${esc(profile.version)}" x="${x-radius}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"><title>Foto de ${esc(s.name)}</title></image>`:`<g aria-label="${esc(s.name)} sem foto"><circle cx="${x}" cy="${cy}" r="${radius}" fill="#e6eeea"/><text x="${x}" y="${cy+size/9}" text-anchor="middle" fill="#527466" font-size="${size/3}">${esc(s.name.split(/\s+/).map(n=>n[0]).slice(0,2).join(''))}</text></g>`);
}

function cbPeriodRange(){
 const mode=state.cbPeriod||'today',day=today();
 if(mode==='month'){const [from,to]=monthRange((state.goalMonth||state.date.slice(0,7))+'-01');return {from,to,label:fmt(from,{month:'short',year:'numeric'})};}
 if(mode==='custom'&&state.cbCustom)return {...state.cbCustom,label:fmt(state.cbCustom.from,{day:'2-digit',month:'2-digit'})+' – '+fmt(state.cbCustom.to,{day:'2-digit',month:'2-digit'})};
 const date=shift(day,mode==='yesterday'?-1:mode==='tomorrow'?1:0);return {from:date,to:date,label:fmt(date,{day:'2-digit',month:'2-digit'})};
}
function cbPeriodControl(period){
 return `<select id="cb-period" class="cb-period-select" aria-label="Período da produção por CB" title="${esc(fmt(period.from)+' a '+fmt(period.to))}">${[['yesterday','Ontem'],['today','Hoje'],['tomorrow','Amanhã'],['month','Mês'],['custom','Personalizado']].map(([value,label])=>`<option value="${value}" ${value===(state.cbPeriod||'today')?'selected':''}>${label}</option>`).join('')}</select>`;
}
function cbCustomPeriod(){
 const period=state.cbCustom||cbPeriodRange();
 dialog('Período da produção por CB','Escolha até 366 dias para consultar este indicador.',`<form><div class="form-grid"><label>Data inicial<input type="date" name="from" value="${period.from}" required></label><label>Data final<input type="date" name="to" value="${period.to}" required></label></div>${footer('Aplicar período')}</form>`,async data=>{
  if(data.from>data.to||(new Date(data.to+'T12:00:00Z')-new Date(data.from+'T12:00:00Z'))/86400000>365)throw Error('Informe um período de até 366 dias, em ordem crescente.');
  state.cbCustom={from:data.from,to:data.to};state.cbPeriod='custom';modal.close();await refresh();
 });
}
