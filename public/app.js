'use strict';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n => Number(n || 0).toLocaleString('pt-BR', {maximumFractionDigits: 1});
const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const shift = (d, days) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + days); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
const fmt = (d, opts = {}) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', opts);
const endTime = a => { const t = Number(a.start.slice(0,2))*60 + Number(a.start.slice(3)) + Number(a.duration); return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`; };
const roleNames = {programador:'Programador',controlador:'Controlador de logística',gerente:'Gerente',vendedor:'Vendedor'};
const programmerCrown = '<svg class="programmer-crown" viewBox="0 0 24 24" role="img" aria-label="Programador"><path d="m3 6 4 4 5-7 5 7 4-4-3 12H6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 21h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const statusNames = {confirmado:'Confirmado',andamento:'Em atendimento',concluido:'Concluído',cancelado:'Cancelado',pendente:'Pendente',aprovada:'Aprovada',recusada:'Recusada',ajuste:'Aguardando ajuste',ocupado:'Ocupado'};
const iconPaths = {
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 request:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/>',
 chart:'<path d="M4 3v18h17M8 16v-5M13 16V7M18 16v-8"/>',
 settings:'<path d="m9 3-1 3-3 1-2 4 2 3 1 4 4 2 3-1 4-1 2-4-1-3-1-4-4-2z"/><circle cx="11" cy="12" r="3"/>',
 pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 truck:'<path d="M2 5h12v12H2zM14 9h4l4 5v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
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
const brand = () => '<div class="brand"><img class="brand-logo" src="/favicon.svg" alt="Símbolo Concresuper"><div><strong>CONCRE<span class="brand-grey">SUPER</span></strong><small>CENTRAL DE PROGRAMAÇÃO</small></div></div>';
const badge = s => `<span class="badge ${esc(s)}">${esc(statusNames[s] || s)}</span>`;
let state = {user:null, page:'agenda', mode:'day', date:today(), appointments:[], requests:[], meta:{pumps:[],sellers:[],buffer:30}, from:today().slice(0,8)+'01', to:today(), seller:'', type:'', status:'', report:[], users:[], audit:[]};
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
    try { await onSubmit(Object.fromEntries(new FormData(form)), form); }
    catch (error) { formError(form, error.message); }
    finally { if (submit) submit.disabled = false; }
  };
  $$('[data-cancel]', modal).forEach(b => b.onclick = () => modal.close());
}
modal.addEventListener('close', () => { currentDialog = ''; if(!modal.open)modal.replaceChildren(); });
const footer = (submit = 'Salvar') => `<div class="form-error" role="alert"></div><div class="modal-footer"><button type="button" data-cancel>Cancelar</button><button type="submit" class="primary">${esc(submit)}</button></div>`;
function authScreen(setup, register=false) {
  modal.close();modal.replaceChildren();state.appointments=[];state.requests=[];state.report=[];state.users=[];state.audit=[];seen=new Map();
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
  if (['reports','next'].includes(state.page)) await loadReport();
  if (state.page==='settings') [state.users,state.audit] = await Promise.all([api('/users'),api('/audit')]);
}
async function refresh() { try {await load();render();} catch(e){toast(e.message,true);} }
function isManager() {return state.user.role!=='vendedor';}
function heading(title, subtitle, actions='') {return `<div class="page-heading"><div><div class="eyebrow">CENTRAL DE PROGRAMAÇÃO</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="actions">${actions}</div></div>`;}
function nav(page,name,ico,count='') {return `<button class="nav-item ${state.page===page?'active':''}" data-page="${page}">${icon(ico)}${name}${count?`<span class="count">${count}</span>`:''}</button>`;}
function render() {
  const pending=state.requests.filter(r=>r.status==='pendente').length;
  app.innerHTML=`<div class="shell"><aside class="sidebar">${brand()}<div class="nav-caption">OPERAÇÃO</div><nav>${nav('agenda','Agenda de obras','calendar')}${nav('requests',isManager()?'Solicitações':'Minhas solicitações','request',pending)}${nav('reports','Relatórios','chart')}${isManager()?nav('next','Agenda de amanhã','truck'):''}${state.user.role==='programador'?nav('settings','Configurações','settings'):''}<button class="nav-item" id="my-password">${icon('settings')} Alterar senha</button></nav><div class="sidebar-bottom"><div class="unit-tag">UNIDADE ATUAL<strong>Cascavel · PR</strong></div><div class="user-box"><div class="avatar">${esc(state.user.name.split(' ').map(x=>x[0]).slice(0,2).join(''))}</div><div><strong>${state.user.role==='programador'?programmerCrown+' ':''}${esc(state.user.name)}</strong><small>${roleNames[state.user.role]}</small></div><button class="logout" data-logout aria-label="Sair">${icon('logout')}</button></div></div></aside><main class="main"><header class="topbar"><div class="breadcrumb">Operação ${icon('right')} <strong>${({agenda:'Agenda de obras',requests:'Solicitações',reports:'Relatórios',next:'Agenda de amanhã',settings:'Configurações'})[state.page]}</strong></div><div class="top-actions"><span class="live"><i class="dot"></i> Cascavel · PR</span><button class="icon-only" id="notifications" aria-label="Notificações">${icon('bell')}${pending?`<span class="badge pendente">${pending}</span>`:''}</button><button class="icon-only mobile-password" id="mobile-password" aria-label="Alterar minha senha">${icon('settings')}</button><button class="icon-only" data-logout aria-label="Sair">${icon('logout')}</button></div></header><div class="content"><div class="branch-tabs"><button class="branch-tab">${icon('pin')} Cascavel · PR</button><span class="branch-note">Unidade de programação</span></div><section id="page-content">${pageContent()}</section><footer class="footer-note"><span>CONCRESUPER · Central de programação</span><span>Horários locais de Cascavel · UTC−3</span></footer></div></main></div>`;
  bindShell();bindPage();
}
function pageContent() {return ({agenda:agendaPage,requests:requestsPage,reports:reportPage,next:nextPage,settings:settingsPage})[state.page]();}
function stat(label,value,unit,note,ico) {return `<div class="stat"><div class="stat-top">${label}<span class="stat-icon">${icon(ico)}</span></div><div class="stat-value">${value} <span>${unit}</span></div><small>${note}</small></div>`;}
function agendaPage() {
  const rows=state.appointments.filter(a=>a.status!=='cancelado');
  const volume=rows.reduce((n,a)=>n+(a.planned_volume||0),0),trips=rows.reduce((n,a)=>n+(a.trips||0),0);
  const out=state.meta.pumps.filter(p=>p.maintenance).length;
  const stats=isManager()?stat('Volume programado',num(volume),'m³','No período selecionado','cube')+stat('Obras agendadas',rows.length,'obras',`${rows.filter(a=>a.type==='convencional').length} entregas convencionais`,'grid')+stat('Viagens previstas',trips,'viagens','Quantidade informada por obra','truck')+stat('Bombas da filial',state.meta.pumps.length,'bombas',`${out} em manutenção · veja horários livres abaixo`,'pump'):stat('Bombas da filial',state.meta.pumps.length,'bombas','Consulte os intervalos livres abaixo','pump')+stat('Suas solicitações',state.requests.length,'pedidos','Reservas sujeitas à aprovação','request')+stat('Aguardando resposta',state.requests.filter(r=>r.status==='pendente'||r.status==='ajuste').length,'pedidos','Acompanhe na aba Solicitações','clock')+stat('Pedidos aprovados',state.requests.filter(r=>r.status==='aprovada').length,'pedidos','Confirmações da logística','check');
  return heading('Agenda de obras','Planeje cada entrega. Encontre o próximo horário livre.',`<button id="availability">${icon('clock')} Consultar disponibilidade</button><button id="tomorrow">${icon('export')} Agenda de amanhã</button><button class="primary" id="new-booking">${icon('plus')} ${isManager()?'Novo agendamento':'Solicitar reserva'}</button>`)+`<div class="stats">${stats}</div><div class="workspace"><div class="panel"><div class="panel-header"><div><h2>${state.mode==='day'?fmt(state.date,{weekday:'long',day:'numeric',month:'long'}):state.mode==='week'?'Programação da semana':fmt(state.date,{month:'long',year:'numeric'})}</h2></div><small>Disponibilidade por intervalo</small></div><div class="toolbar"><div class="date-controls"><button id="previous" aria-label="Período anterior">${icon('left')}</button><input type="date" id="agenda-date" value="${state.date}" aria-label="Data da agenda"><button id="next-date" aria-label="Próximo período">${icon('right')}</button><button id="today">Hoje</button></div><div class="segmented">${[['day','Dia'],['week','Semana'],['month','Mês']].map(([m,l])=>`<button data-mode="${m}" class="${state.mode===m?'selected':''}">${l}</button>`).join('')}</div></div>${state.mode==='day'?dayGrid(rows):state.mode==='week'?weekGrid(rows):monthGrid(rows)}<div class="legend"><span><i></i> Com bomba</span><span><i class="blue"></i> Convencional</span><span><i class="yellow"></i> Em atendimento</span><span>${state.meta.buffer} min entre obras da mesma bomba</span></div></div>${agendaSide(rows)}</div>`;
}
function booking(a) {
  if(!isManager()) return `<div class="booking"><div class="booking-time">${a.start} — ${endTime(a)}</div><strong>Horário ocupado</strong><p>Consulte outro intervalo</p></div>`;
  return `<button class="booking ${a.type==='convencional'?'conventional':''} ${a.status}" data-booking="${a.id}"><div class="booking-time"><span>${a.start} — ${endTime(a)}</span><span>${num(a.planned_volume)} m³</span></div><strong>${esc(a.customer)}</strong><p>${esc(a.piece)} · ${esc(a.resistance)}<br>${esc(a.work)}</p><div class="booking-footer"><span>${esc(a.seller_name)}</span><span>${a.trips} viagens</span></div></button>`;
}
function slot(p,period) {return `<button class="slot" data-slot="${p?.id||''}" data-period="${period}" ${p?.maintenance?'disabled':''}>${p?.maintenance?'Em manutenção':icon('plus')+' Consultar / agendar'}</button>`;}
function dayGrid(rows) {
  const lanes=[...state.meta.pumps,{id:null,name:'Convencional',description:'Entrega sem bomba'}];
  return `<div class="schedule-head"><div>RECURSO</div><div>MANHÃ <span class="muted">· até 12h</span></div><div>TARDE <span class="muted">· a partir de 12h</span></div></div>${!state.meta.pumps.length?'<div class="notice">Nenhuma bomba cadastrada. O Programador pode adicioná-las em Configurações. As entregas convencionais já podem ser agendadas.</div>':''}${lanes.map(p=>{const own=rows.filter(a=>a.pump_id===p.id);return `<div class="lane"><div class="lane-name"><strong>${esc(p.name)}</strong><small>${p.maintenance?'Em manutenção':p.id?'Bombeamento':'Entrega direta'}</small>${p.id?`<small>${own.length} obra${own.length===1?'':'s'}</small>${isManager()?`<button class="resource-action" data-maintenance="${p.id}">${p.maintenance?'Liberar':'Manutenção'}</button>`:''}`:''}</div><div class="lane-cell">${own.filter(a=>a.start<'12:00').map(booking).join('')}${slot(p,'morning')}</div><div class="lane-cell">${own.filter(a=>endTime(a)>'12:00').map(a=>a.start<'12:00'?`<div class="hint">${icon('clock')} Ocupada até ${endTime(a)} · serviço iniciado pela manhã</div>`:booking(a)).join('')}${slot(p,'afternoon')}</div></div>`;}).join('')}`;
}
function weekGrid(rows) {
  const [from]=range();return `<div class="week-grid">${Array.from({length:7},(_,i)=>{const d=shift(from,i), list=rows.filter(a=>a.date===d);return `<div class="week-day"><button class="day-heading" data-day="${d}">${fmt(d,{weekday:'short'})} <strong>${d.slice(8)}</strong></button><small>${list.length} agendamentos</small>${list.map(booking).join('')}<button class="slot" data-new-date="${d}">${icon('plus')} Agendar</button></div>`;}).join('')}</div>`;
}
function monthGrid(rows) {
  const [first,last]=monthRange(state.date),offset=(new Date(first+'T12:00:00').getDay()+6)%7;
  return `<div class="month-grid">${['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].map(d=>`<div class="month-weekday">${d}</div>`).join('')}${Array.from({length:offset},()=>'<div class="month-day filler"></div>').join('')}${Array.from({length:Number(last.slice(8))},(_,i)=>{const d=shift(first,i),list=rows.filter(a=>a.date===d);return `<button class="month-day ${d===today()?'today':''}" data-day="${d}"><strong>${i+1}</strong>${list.length?`<small>${list.length} obras</small>${isManager()?`<small>${num(list.reduce((s,a)=>s+a.planned_volume,0))} m³</small>`:''}`:'<small>Ver horários</small>'}</button>`;}).join('')}</div>`;
}
function agendaSide(rows) {
  const pumpVolume=rows.filter(a=>a.type==='bomba').reduce((s,a)=>s+(a.planned_volume||0),0);
  const convVolume=rows.filter(a=>a.type==='convencional').reduce((s,a)=>s+(a.planned_volume||0),0);
  const pending=state.requests.filter(r=>r.status==='pendente'||r.status==='ajuste');
  return `<aside class="side-stack">${isManager()?`<div class="panel side-panel"><h2>Visão da operação</h2><p>Volumes do período selecionado</p><div class="summary-row"><span>Com bombeamento</span><strong>${num(pumpVolume)} m³</strong></div><div class="summary-row"><span>Convencional</span><strong>${num(convVolume)} m³</strong></div><div class="summary-row total"><span>Total programado</span><strong>${num(pumpVolume+convVolume)} m³</strong></div><div class="hint">${icon('info')} A quantidade de viagens é informada por obra. Veículos individuais ainda não são distribuídos.</div></div>`:''}<div class="panel side-panel"><h2>${isManager()?'Solicitações de reserva':'Seus pedidos'}</h2><p>${pending.length} aguardando análise ou ajuste</p>${pending.slice(0,3).map(r=>`<div class="pending-card"><strong>${esc(r.customer)}</strong><p>${fmt(r.date)} · ${r.start} · ${num(r.planned_volume)} m³</p><p>${esc(r.seller_name)}</p><button data-request="${r.id}">Ver solicitação ${icon('right')}</button></div>`).join('')||'<div class="empty">Tudo em dia.<br>Nenhuma solicitação pendente.</div>'}<button class="mini-link" data-goto="requests">Ver todas as solicitações ${icon('right')}</button></div><div class="panel side-panel"><h2>Planeje os próximos dias</h2><p>Alterne entre dia, semana e mês para consultar a agenda futura. Uma solicitação só reserva a bomba depois da aprovação.</p></div></aside>`;
}
function requestsPage() {
  return heading(isManager()?'Solicitações de reserva':'Minhas solicitações',isManager()?'Analise os pedidos dos vendedores e confirme a programação.':'Solicite um horário e acompanhe a resposta da logística.',!isManager()?`<button class="primary" id="new-booking">${icon('plus')} Solicitar reserva</button>`:'')+`<div class="notice">${isManager()?'A aprovação verifica conflitos novamente e cria o agendamento. Pedidos pendentes não bloqueiam bombas.':'Você consulta a disponibilidade sem visualizar dados de outros clientes. O vendedor é vinculado automaticamente à solicitação.'}</div><div class="panel"><div class="table-wrap"><table><thead><tr><th>CLIENTE / OBRA</th><th>DATA / HORÁRIO</th><th>VOLUME</th><th>VENDEDOR</th><th>SITUAÇÃO</th><th></th></tr></thead><tbody>${state.requests.map(r=>`<tr><td><strong>${esc(r.customer)}</strong><small>${esc(r.work)}</small></td><td>${fmt(r.date)}<small>${r.start} · ${r.duration} min</small></td><td>${num(r.planned_volume)} m³<small>${r.type==='bomba'?'Com bomba':'Convencional'}</small></td><td>${esc(r.seller_name)}</td><td>${badge(r.status)}</td><td><button data-request="${r.id}">Detalhes</button></td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Nenhuma solicitação por aqui ainda.</div></td></tr>'}</tbody></table></div></div>`;
}
async function loadReport() {
  const tomorrow=shift(today(),1),from=state.page==='next'?tomorrow:state.from,to=state.page==='next'?tomorrow:state.to;
  state.report=await api(`/report?from=${from}&to=${to}&seller=${encodeURIComponent(state.page==='next'?'':state.seller)}&type=${encodeURIComponent(state.page==='next'?'':state.type)}&status=${encodeURIComponent(state.page==='next'?'':state.status)}`);
}
function reportPage() {
  const rows=state.report, groups=new Map();
  for(const a of rows) {if(!groups.has(a.seller_id)) groups.set(a.seller_id,{name:a.seller_name,count:0,planned:0,delivered:0,missing:0}); const g=groups.get(a.seller_id);g.count++;g.planned+=a.planned_volume;if(a.delivered_volume===null)g.missing++;else g.delivered+=a.delivered_volume;}
  return heading('Relatórios','Volume programado e efetivamente entregue, por vendedor.',`<button id="export">${icon('export')} Exportar CSV</button><button id="print">Imprimir</button>`)+`<div class="panel"><form class="filters" id="report-filters"><label>Data inicial<input type="date" name="from" value="${state.from}" required></label><label>Data final<input type="date" name="to" value="${state.to}" required></label><label>Vendedor<select name="seller"><option value="">${isManager()?'Todos os vendedores':'Meu resultado'}</option>${state.meta.sellers.map(s=>`<option value="${s.id}" ${String(s.id)===state.seller?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Entrega<select name="type"><option value="">Todas</option><option value="bomba" ${state.type==='bomba'?'selected':''}>Com bomba</option><option value="convencional" ${state.type==='convencional'?'selected':''}>Convencional</option></select></label><label>Status<select name="status"><option value="">Ativas e concluídas</option>${['confirmado','andamento','concluido','cancelado'].map(s=>`<option value="${s}" ${state.status===s?'selected':''}>${statusNames[s]}</option>`).join('')}</select></label><button type="submit" class="primary">Filtrar</button><div class="actions span-2 no-print"><button type="button" data-shortcut="today">Hoje</button><button type="button" data-shortcut="week">Esta semana</button><button type="button" data-shortcut="month">Este mês</button><button type="button" data-shortcut="next">Próximo mês</button></div></form><div class="panel-header"><h2>Cascavel · PR</h2><small>${fmt(state.from)} a ${fmt(state.to)} · data programada da entrega</small></div>${reportTotals(rows)}<div class="table-wrap"><table><thead><tr><th>VENDEDOR</th><th>OBRAS</th><th>PROGRAMADO</th><th>ENTREGUE INFORMADO</th><th>DIFERENÇA</th></tr></thead><tbody>${[...groups.values()].map(g=>`<tr><td><strong>${esc(g.name)}</strong></td><td>${g.count}</td><td>${num(g.planned)} m³</td><td>${num(g.delivered)} m³${g.missing?`<small>${g.missing} obra(s) sem volume entregue</small>`:''}</td><td>${g.missing?'<span class="muted">Aguardando informações</span>':`${num(g.delivered-g.planned)} m³`}</td></tr>`).join('')||'<tr><td colspan="5"><div class="empty">Nenhuma programação no período selecionado.</div></td></tr>'}</tbody></table></div></div><h2 class="section-title detail-title">Detalhamento por obra</h2><div class="panel">${detailTable(rows)}</div>`;
}
function reportTotals(rows) {
  return `<div class="report-summary"><div><small>Programado</small><strong>${num(rows.reduce((s,a)=>s+a.planned_volume,0))} <span>m³</span></strong></div><div><small>Entregue informado</small><strong>${num(rows.reduce((s,a)=>s+(a.delivered_volume??0),0))} <span>m³</span></strong></div><div><small>Sem volume entregue</small><strong>${rows.filter(a=>a.delivered_volume===null).length} <span>obras</span></strong></div><div><small>Viagens previstas</small><strong>${rows.reduce((s,a)=>s+a.trips,0)} <span>viagens</span></strong></div></div>`;
}
function detailTable(rows) {
  return `<div class="table-wrap"><table><thead><tr><th>DATA / HORA</th><th>CLIENTE / OBRA</th><th>VENDEDOR</th><th>ENTREGA</th><th>PROGRAMADO</th><th>ENTREGUE</th><th>STATUS</th></tr></thead><tbody>${rows.map(a=>`<tr><td>${fmt(a.date)}<small>${a.start} — ${endTime(a)}</small></td><td><strong>${esc(a.customer)}</strong><small>${esc(a.work)}</small></td><td>${esc(a.seller_name)}</td><td>${esc(a.pump_name||'Convencional')}</td><td>${num(a.planned_volume)} m³</td><td>${a.delivered_volume===null?'<span class="muted">Não informado</span>':num(a.delivered_volume)+' m³'}</td><td>${badge(a.status)}</td></tr>`).join('')||'<tr><td colspan="7"><div class="empty">Nenhuma obra encontrada.</div></td></tr>'}</tbody></table></div>`;
}
function nextPage() {
  const rows=state.report;
  return heading('Agenda de amanhã',`${fmt(shift(today(),1),{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · Cascavel – PR`,`<button id="export">${icon('export')} Exportar CSV</button><button class="primary" id="print">Imprimir programação</button>`)+`<div class="notice no-print">Relatório para preparar os carregamentos. Exportação genérica em CSV; a importação direta depende do formato aceito pelo sistema da concreteira.</div><div class="panel">${reportTotals(rows)}<div class="table-wrap"><table><thead><tr><th>HORÁRIO</th><th>CLIENTE / OBRA</th><th>ENTREGA</th><th>CONCRETO</th><th>VOLUME / VIAGENS</th><th>VENDEDOR / OBSERVAÇÕES</th></tr></thead><tbody>${rows.map(a=>`<tr><td>${a.start}<small>Até ${endTime(a)}</small></td><td><strong>${esc(a.customer)}</strong><small>${esc(a.work)}</small><small>${esc(a.piece)}</small></td><td>${esc(a.pump_name||'Convencional')}</td><td>${esc(a.resistance)}<small>Brita ${esc(a.gravel)}</small></td><td>${num(a.planned_volume)} m³<small>${a.trips} viagens previstas</small></td><td>${esc(a.seller_name)}<small>${esc(a.notes||'Sem observações')}</small></td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Ainda não há obras programadas para amanhã.</div></td></tr>'}</tbody></table></div></div>`;
}
function settingsPage() {
  return heading('Configurações','Cadastros e regras da unidade Cascavel – PR.')+`<div class="notice">Perfil Programador · acesso administrativo. Esta primeira versão atende à filial Cascavel. Novas filiais e login compartilhado serão integrados após definir a estrutura do outro sistema.</div><div class="settings-grid"><div><div class="panel"><div class="panel-header"><h2>Equipe e acessos</h2><button class="soft" id="new-user">${icon('plus')} Novo usuário</button></div>${state.users.map(u=>`<div class="list-row"><div><strong>${esc(u.name)}</strong><small>${esc(u.username)}</small></div><div><span class="badge">${roleNames[u.role]}</span><small>${esc(u.status)}${u.must_change?' · senha temporária':''}</small>${u.role!=='programador'?`<div class="actions user-actions"><button data-user-access="${u.id}">Acesso</button><button data-user-reset="${u.id}">Redefinir senha</button></div>`:''}</div></div>`).join('')}</div><div class="panel"><div class="panel-header"><h2>Bombas da filial</h2><button class="soft" id="new-pump">${icon('plus')} Cadastrar bomba</button></div>${state.meta.pumps.map(p=>`<div class="list-row"><div><strong>${esc(p.name)}</strong><small>${esc(p.description||'Bombeamento de concreto')}</small></div><button data-maintenance="${p.id}" class="${p.maintenance?'danger':''}">${p.maintenance?'Liberar bomba':'Marcar manutenção'}</button></div>`).join('')||'<div class="empty">Cadastre os códigos reais das bombas da filial.</div>'}</div></div><div><div class="panel"><div class="panel-header"><h2>Regras de agendamento</h2></div><form id="settings-form" class="settings-form"><label>Intervalo mínimo entre obras (minutos)<input type="number" min="0" max="240" name="buffer" value="${state.meta.buffer}" required></label><p class="subtitle">Tempo reservado para deslocamento e preparação da mesma bomba. Alterar esta regra não reorganiza reservas existentes.</p><button class="primary" type="submit">Salvar configuração</button></form></div><div class="panel"><div class="panel-header"><h2>Histórico de alterações</h2><small>Últimas 100 ações</small></div>${state.audit.slice(0,12).map(a=>`<div class="audit-item"><strong>${esc(a.user_name)}</strong> · ${esc(a.action)} ${esc(a.entity)} #${a.entity_id}<br><small>${esc(a.created_at)} UTC</small></div>`).join('')||'<div class="empty">Nenhuma alteração registrada.</div>'}</div></div></div>`;
}
function bindShell() {
  $$('[data-page],[data-goto]').forEach(b=>b.onclick=async()=>{state.page=b.dataset.page||b.dataset.goto;await refresh();});
  $$('[data-logout]').forEach(b=>b.onclick=async()=>{try{await api('/logout',{method:'POST',body:'{}'});clearInterval(poll);state.user=null;await boot();}catch(e){toast(e.message,true);}});
  $('#notifications').onclick=()=>showNotifications();
  if($('#my-password'))$('#my-password').onclick=()=>passwordChange(false);
  if($('#mobile-password'))$('#mobile-password').onclick=()=>passwordChange(false);
}
function bindPage() {
  if($('#new-booking'))$('#new-booking').onclick=()=>bookingForm();
  if($('#availability'))$('#availability').onclick=availabilityForm;
  if($('#tomorrow'))$('#tomorrow').onclick=async()=>{if(!isManager()){state.date=shift(today(),1);state.mode='day';}else state.page='next';await refresh();};
  if($('#agenda-date'))$('#agenda-date').onchange=async e=>{if(e.target.value){state.date=e.target.value;await refresh();}};
  for(const [id,dir] of [['previous',-1],['next-date',1]])if($('#'+id))$('#'+id).onclick=async()=>{if(state.mode==='month'){const d=new Date(state.date+'T12:00:00');d.setDate(1);d.setMonth(d.getMonth()+dir);state.date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;}else state.date=shift(state.date,dir*(state.mode==='week'?7:1));await refresh();};
  if($('#today'))$('#today').onclick=async()=>{state.date=today();await refresh();};
  $$('[data-mode]').forEach(b=>b.onclick=async()=>{state.mode=b.dataset.mode;await refresh();});
  $$('[data-day]').forEach(b=>b.onclick=async()=>{state.date=b.dataset.day;state.mode='day';await refresh();});
  $$('[data-new-date]').forEach(b=>b.onclick=()=>bookingForm({date:b.dataset.newDate}));
  $$('[data-slot]').forEach(b=>b.onclick=()=>bookingForm({pump_id:b.dataset.slot,type:b.dataset.slot?'bomba':'convencional',start:b.dataset.period==='morning'?'07:00':'13:00'}));
  $$('[data-booking]').forEach(b=>b.onclick=()=>editBooking(state.appointments.find(a=>a.id===Number(b.dataset.booking))));
  $$('[data-request]').forEach(b=>b.onclick=()=>requestDetails(state.requests.find(r=>r.id===Number(b.dataset.request))));
  if($('#print'))$('#print').onclick=()=>window.print();
  if($('#export'))$('#export').onclick=exportCsv;
  if($('#report-filters'))$('#report-filters').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));if(data.from>data.to)return toast('A data inicial deve ser anterior à final.',true);Object.assign(state,data);await refresh();};
  $$('[data-shortcut]').forEach(b=>b.onclick=async()=>{let from=today(),to=today();const action=b.dataset.shortcut;if(action==='week'){const day=new Date(from+'T12:00:00').getDay();from=shift(from,-((day+6)%7));to=shift(from,6);}if(action==='month')[from,to]=monthRange(today());if(action==='next'){const d=new Date(today()+'T12:00:00');d.setDate(1);d.setMonth(d.getMonth()+1);[from,to]=monthRange(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`);}state.from=from;state.to=to;await refresh();});
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
  dialog(request?'Solicitar reserva':'Novo agendamento','Cascavel – PR · Horários e duração flexíveis',`<form id="booking-form"><div class="form-grid"><label class="span-2">Cliente *<input name="customer" required maxlength="200" placeholder="Nome do cliente"></label><label class="span-2">Obra / endereço *<input name="work" required maxlength="500" placeholder="Identificação e localização da obra"></label><label>Data *<input type="date" name="date" required value="${prefill.date||state.date}"></label><label>Horário de início *<input type="time" name="start" required value="${prefill.start||'07:00'}"></label><label>Duração prevista (minutos) *<input type="number" name="duration" min="15" max="1440" step="1" required value="120"></label><label>Tipo de entrega *<select name="type"><option value="bomba">Com bomba</option><option value="convencional" ${prefill.type==='convencional'?'selected':''}>Convencional — sem bomba</option></select></label>${!request?`<label id="pump-field">Bomba *<select name="pump_id">${pumpOptions(prefill.pump_id)}</select></label><label>Vendedor responsável *<select name="seller_id" required><option value="">Selecione o vendedor</option>${state.meta.sellers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>`:''}<label>Volume programado (m³) *<input type="number" name="planned_volume" min="0.1" step="0.1" required placeholder="Ex.: 32"></label><label>Viagens previstas<input type="number" name="trips" min="0" step="1" value="0" required></label><label>Brita *<input name="gravel" required placeholder="Ex.: Brita 1"></label><label>Resistência / Fck *<input name="resistance" required placeholder="Ex.: 30 MPa"></label><label class="span-2">Peça a concretar *<input name="piece" required placeholder="Ex.: Laje, fundação, pilares"></label><label class="span-2">Observações<textarea name="notes" maxlength="2000" placeholder="Ex.: com fibra, slump máximo 16, cuidados de acesso…"></textarea></label></div><div class="hint">${icon('info')}${request?'O pedido será analisado pela logística. Não há bloqueio de horário até a aprovação.':`A reserva considera a duração e ${state.meta.buffer} minutos entre obras da mesma bomba. O volume programado será preservado após o cadastro.`}</div>${footer(request?'Enviar solicitação':'Confirmar agendamento')}</form>`,async data=>{
    await api(request?'/requests':'/appointments',{method:'POST',body:JSON.stringify(data)});modal.close();toast(request?'Solicitação enviada à logística.':'Agendamento confirmado.');await refresh();
  });
  const type=$('[name=type]',modal);type.onchange=()=>{const el=$('#pump-field',modal);if(el){el.hidden=type.value==='convencional';$('[name=pump_id]',modal).required=type.value==='bomba';}};type.onchange();
}
function editBooking(a) {
  if(!a)return;
  dialog(a.customer,'Editar agenda e registrar volume entregue',`<div class="detail-grid"><div><small>Obra</small>${esc(a.work)}</div><div><small>Vendedor</small>${esc(a.seller_name)}</div><div><small>Concreto</small>${esc(a.gravel)} · ${esc(a.resistance)}</div><div><small>Peça / programado</small>${esc(a.piece)} · ${num(a.planned_volume)} m³</div></div>${a.notes?`<div class="notes-box">${esc(a.notes)}</div>`:''}<form><div class="form-grid"><label>Data<input type="date" name="date" required value="${a.date}"></label><label>Horário de início<input type="time" name="start" required value="${a.start}"></label><label>Duração (minutos)<input type="number" name="duration" min="15" max="1440" required value="${a.duration}"></label><label>Tipo<select name="type"><option value="bomba">Com bomba</option><option value="convencional" ${a.type==='convencional'?'selected':''}>Convencional</option></select></label><label>Bomba<select name="pump_id">${pumpOptions(a.pump_id)}</select></label><label>Situação<select name="status">${['confirmado','andamento','concluido','cancelado'].map(s=>`<option value="${s}" ${a.status===s?'selected':''}>${statusNames[s]}</option>`).join('')}</select></label><label>Volume realmente entregue (m³)<input type="number" name="delivered_volume" min="0" step="0.1" value="${a.delivered_volume??''}" placeholder="Ainda não informado"></label><label>Viagens previstas<input type="number" name="trips" min="0" step="1" value="${a.trips}" required></label></div><div class="hint">${icon('info')} Deixe o volume entregue vazio enquanto não houver informação. O volume programado original não é alterado.</div>${footer('Salvar alterações')}</form>`,async data=>{await api('/appointments/'+a.id,{method:'PATCH',body:JSON.stringify(data)});modal.close();toast('Agendamento atualizado.');await refresh();});
}
function requestDetails(r) {
  if(!r)return;
  const canReview=isManager()&&['pendente','ajuste'].includes(r.status);
  dialog('Solicitação #'+r.id,r.customer+' · '+r.seller_name,`<div class="detail-grid"><div><small>Data / horário</small>${fmt(r.date)} · ${r.start}</div><div><small>Duração prevista</small>${r.duration} minutos</div><div><small>Cliente</small>${esc(r.customer)}</div><div><small>Obra</small>${esc(r.work)}</div><div><small>Volume / viagens</small>${num(r.planned_volume)} m³ · ${r.trips} viagens</div><div><small>Tipo de entrega</small>${r.type==='bomba'?'Com bomba':'Convencional'}</div><div><small>Brita / Fck</small>${esc(r.gravel)} · ${esc(r.resistance)}</div><div><small>Peça</small>${esc(r.piece)}</div></div>${r.notes?`<div class="notes-box">${esc(r.notes)}</div>`:''}${r.response?`<div class="notice">Resposta da logística: ${esc(r.response)}</div>`:''}${canReview?`<form><div class="form-grid"><label class="span-2">Decisão<select name="status"><option value="aprovada">Aprovar e criar agendamento</option><option value="ajuste">Propor ajuste</option><option value="recusada">Recusar solicitação</option></select></label>${r.type==='bomba'?`<label class="span-2">Bomba para aprovação<select name="pump_id">${pumpOptions()}</select></label>`:''}<label>Data da confirmação<input type="date" name="date" value="${r.date}" required></label><label>Horário<input type="time" name="start" value="${r.start}" required></label><label>Duração (minutos)<input type="number" name="duration" min="15" max="1440" value="${r.duration}" required></label><label class="span-2">Resposta / motivo<textarea name="response" placeholder="Explique recusas ou propostas de outro horário"></textarea></label></div>${footer('Registrar resposta')}</form>`:`<p>${badge(r.status)}</p>`}`,canReview?async data=>{await api('/requests/'+r.id,{method:'PATCH',body:JSON.stringify(data)});modal.close();toast('Resposta registrada.');await refresh();}:null);
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
  dialog('Central de notificações',isManager()?'Pedidos dos vendedores para análise':'Acompanhe as respostas da logística',list.length?list.map(r=>`<div class="notification"><strong>${esc(r.customer)}</strong> ${badge(r.status)}<small>${fmt(r.date)} · ${r.start} · ${num(r.planned_volume)} m³ · ${esc(r.seller_name)}</small>${r.response?`<p>${esc(r.response)}</p>`:''}<button data-open-request="${r.id}">Ver solicitação</button></div>`).join(''):'<div class="empty">Nenhuma notificação por aqui.</div>',null);
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
  const header=['Filial','Data','Início','Término previsto','Cliente','Obra','Vendedor','Tipo','Bomba','Programado m³','Entregue m³','Viagens previstas','Brita','Fck','Peça','Observações','Status'];
  const records=state.report.map(a=>['Cascavel PR',fmt(a.date),a.start,endTime(a),a.customer,a.work,a.seller_name,a.type,a.pump_name||'',String(a.planned_volume).replace('.',','),a.delivered_volume===null?'Não informado':String(a.delivered_volume).replace('.',','),a.trips,a.gravel,a.resistance,a.piece,a.notes,statusNames[a.status]]);
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
  dialog('Consultar disponibilidade','Bombas livres no intervalo solicitado, com margem entre obras',`<form><div class="form-grid"><label class="span-2">Data<input type="date" name="date" value="${state.date}" required></label><label>Início<input type="time" name="start" value="07:00" required></label><label>Duração (minutos)<input type="number" name="duration" value="120" min="15" max="1440" required></label></div>${footer('Consultar bombas')}<div id="availability-result" aria-live="polite"></div></form>`,async data=>{
    const result=await api('/availability?'+new URLSearchParams(data));
    $('#availability-result',modal).innerHTML=`<div class="hint">${icon('info')} Inclui ${result.buffer} minutos entre atendimentos. Uma consulta não reserva o horário.</div>`+result.pumps.map(p=>`<div class="list-row"><strong>${esc(p.name)}</strong><span class="badge ${p.available?'concluido':'ocupado'}">${p.available?'Disponível':p.maintenance?'Manutenção':'Ocupada no intervalo'}</span></div>`).join('')+(result.pumps.length?'':'<div class="empty">Nenhuma bomba cadastrada.</div>');
  });
}
