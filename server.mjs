import {seedPresentation} from './presentation-seed.mjs';
import {cbUtilization} from './cb-utilization.mjs';
import cbEstimate from './public/cb-estimate.js';
import {appointmentChangesApi} from './appointment-changes.mjs';
import {shiftRosterApi} from './shift-roster.mjs';
import {laboratoryApi,labStaffRole} from './laboratory.mjs';
import {technicalTicketsApi,ticketsAccess} from './technical-tickets.mjs';
import {equipmentMaintenanceApi,maintenanceAccess} from './equipment-maintenance.mjs';
import {plateValue,checkBranch,equipmentState} from './equipment.mjs';
import {contractsApi,withContractWorkNames} from './contracts.mjs';
import http from 'node:http';
import {onlineUsers,userIsOnline,updatePresence} from './presence.mjs';
import {customerEditPreview,editCustomer} from './customer-edit.mjs';
import {gravelValue,slumpValue} from './concrete.mjs';
import {contactFields} from './contacts.mjs';
import {commercialCode,savedCustomerCode,withCustomerCodes} from './commercial.mjs';
import {slotWindow,overlaps} from './maintenance.mjs';
import {checkMonth,monthlyProduction,monthlyGoalHistory} from './production.mjs';
import {estimateTrips,fleetRange} from './fleet.mjs';
import {localDay} from './changes.mjs';
import {saveCustomer,customerKey,customerName,customerAddresses,customerWorks} from './customers.mjs';
import {changeKind,recordChange,searchName} from './changes.mjs';
import {query, one, run, transaction, initialize} from './storage.mjs';
import {randomBytes, scryptSync, timingSafeEqual, createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = dirname(fileURLToPath(import.meta.url));
const roles = ['programador', 'gerente', 'controlador', 'vendedor', 'manutencao', 'engenharia', 'gerente_engenharia', 'gerente_concresuper', 'laboratorista', 'auxiliar_laboratorio'];
const productionManager=u=>['gerente','programador','gerente_concresuper'].includes(u.role);
const manager = u => ['programador', 'gerente', 'controlador', 'gerente_concresuper'].includes(u.role);
const safeUser = u => ({
  id: u.id,
  name: u.name,
  username: u.username,
  role: u.role,
  status: u.status,
  mustChangePassword: Boolean(u.must_change)
});
const digest = t => createHash('sha256').update(t).digest('hex');
function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64, {
    N: 32768,
    maxmem: 64 * 1024 * 1024
  }).toString('hex');
}
function passwordValid(password, hash) {
  const [salt, key] = hash.split(':');
  return timingSafeEqual(scryptSync(password, salt, 64, {
    N: 32768,
    maxmem: 64 * 1024 * 1024
  }), Buffer.from(key, 'hex'));
}
function fail(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
function text(value, name, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`Preencha ${name} corretamente.`);
  return value.trim();
}
function number(value, name, min = 0, max = 100000) {
  if (value === null || value === '' || typeof value === 'boolean' || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) fail(`${name}: valor inválido.`);
  return Number(value);
}
function date(value) {
  if (typeof value !== 'string' || !(/^\d{4}-\d{2}-\d{2}$/).test(value) || isNaN(Date.parse(value)) || new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) !== value) fail('Data inválida.');
  return value;
}
const minutes = s => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
function scheduling(b) {
  const start = text(b.start, 'horário');
  if (!(/^([01]\d|2[0-3]):[0-5]\d$/).test(start)) fail('Horário inválido.');
  const duration = number(b.duration, 'Duração', 15, 1440);
  if (!Number.isInteger(duration) || minutes(start) + duration > 1440) fail('O término deve estar dentro do mesmo dia. Divida reservas de vários dias.');
  const type = b.type;
  if (!['bomba', 'convencional'].includes(type)) fail('Tipo de entrega inválido.');
  return {
    date: date(b.date),
    start,
    duration,
    type
  };
}
function fields(b,{allowLegacyGravel=false}={}) {
  return {
    ...scheduling(b),
    ...contactFields(b),
    customer: customerName(text(b.customer, 'cliente')),
    work: text(b.work, 'endereço da obra', 500),
    work_name: text(allowLegacyGravel?(b.work_name||b.customer):b.work_name,'nome da obra',200),
    planned_volume: number(b.planned_volume, 'Volume', 0.1),
    gravel: gravelValue(b.gravel,{legacy:allowLegacyGravel}),
    slump: slumpValue(b.slump),
    resistance: text(b.resistance, 'resistência'),
    piece: text(b.piece, 'peça a concretar'),
    notes: String(b.notes || '').trim().slice(0, 2000),
    ...estimateTrips(number(b.planned_volume,'Volume',0.1),b.load_capacity===undefined||b.load_capacity===null||b.load_capacity===''?9:b.load_capacity)
  };
}
async function checkSeller(id) {
  const user = await one('SELECT * FROM users WHERE id=? AND active=1', Number(id));
  if (!user || user.role !== 'vendedor' || user.status !== 'aprovado') fail('Selecione um vendedor ativo.');
  return user.id;
}
async function conventionalWarnings(b,except=0){if(b.type!=='convencional'||b.status==='cancelado')return [];const rows=await query("SELECT start FROM appointments WHERE date=? AND type='convencional' AND status<>'cancelado' AND id<>? ORDER BY start",b.date,except),close=[...new Set(rows.filter(r=>Math.abs(minutes(r.start)-minutes(b.start))<10).map(r=>r.start))];return close.length?['Atenção: há saída convencional às '+close.join(', ')+'. Mantenha 10 minutos entre saídas.']:[];}
async function checkPump(b, except = 0) {
  if (b.type === 'convencional') return null;
  if (b.status === 'cancelado') {
    const id=Number(b.pump_id||0);
    return id && await one('SELECT id FROM pumps WHERE id=?',id) ? id : null;
  }
  const pump = await one('SELECT * FROM pumps WHERE id=?', Number(b.pump_id || 0));
  if (!pump) fail('Selecione a bomba.');
  if (!pump.active) fail('Esta bomba está inativa.',409);
  if (pump.maintenance) fail('Esta bomba possui um bloqueio antigo de manutenção. Libere-o no painel de manutenções antes de agendar.', 409);
  const window=slotWindow(b.date,b.start,b.duration);
  const maintenance=await one('SELECT * FROM maintenance_periods WHERE pump_id=? AND cancelled_at IS NULL AND starts_at<? AND ends_at>? ORDER BY starts_at LIMIT 1',pump.id,window.end,window.start);
  if(maintenance)fail(`Conflito de manutenção: ${pump.name}, de ${maintenance.starts_at.replace('T',' ')} até ${maintenance.ends_at.replace('T',' ')}. Motivo: ${maintenance.reason}`,409);
  const buffer = Number((await one("SELECT value FROM settings WHERE key='buffer_minutes'")).value);
  const start = minutes(b.start), end = start + Number(b.duration);
  const conflict = (await query("SELECT * FROM appointments WHERE date=? AND pump_id=? AND id<>? AND status<>'cancelado'", b.date, pump.id, except)).find(a => start < minutes(a.start) + a.duration + buffer && end + buffer > minutes(a.start));
  if (conflict) fail(`Conflito: ${pump.name} já reservada para ${conflict.customer} às ${conflict.start}. Margem entre obras: ${buffer} min.`, 409);
  return pump.id;
}
async function audit(u, action, entity, id, detail) {
  await run('INSERT INTO audit(user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)', u.id, action, entity, Number(id), JSON.stringify(detail));
}
async function detailsForCustomer(input,seller){
 const saved=await one('SELECT contact_name,contact_phone,slump FROM customers WHERE seller_id=? AND name_key=?',seller,customerKey(input.customer));
 return {...contactFields(input,saved||{}),slump:slumpValue(input.slump===undefined?saved?.slump:input.slump)};
}
async function saveContactForAppointment(appointment,contact){
 if(!await one('SELECT id FROM customers WHERE seller_id=? AND name_key=?',appointment.seller_id,customerKey(appointment.customer)))await saveCustomer(appointment,appointment.seller_id);
 await run('UPDATE customers SET contact_name=?,contact_phone=?,updated_at=? WHERE seller_id=? AND name_key=?',contact.contact_name,contact.contact_phone,new Date().toISOString(),appointment.seller_id,customerKey(appointment.customer));
}
async function saveConcreteForAppointment(appointment,concrete){
 if(!await one('SELECT id FROM customers WHERE seller_id=? AND name_key=?',appointment.seller_id,customerKey(appointment.customer)))await saveCustomer(appointment,appointment.seller_id);
 await run('UPDATE customers SET gravel=COALESCE(?,gravel),slump=COALESCE(?,slump),updated_at=? WHERE seller_id=? AND name_key=?',concrete.gravel??null,concrete.slump??null,new Date().toISOString(),appointment.seller_id,customerKey(appointment.customer));
}
async function createAppointment(b, u, requestId = null) {
  const data = fields(b,{allowLegacyGravel:requestId!==null});
  if (!Number.isInteger(data.trips)) fail('Viagens devem ser um número inteiro.');
  const seller = await checkSeller(b.seller_id);
  const customerCode=await savedCustomerCode(data.customer,seller);
  Object.assign(data,await detailsForCustomer(b,seller));
  const pump = await checkPump({
    ...data,
    pump_id: b.pump_id
  });
  const result = await run(`INSERT INTO appointments(customer,work,date,start,duration,type,pump_id,seller_id,planned_volume,gravel,resistance,piece,notes,trips,load_capacity,request_id,customer_code,contact_name,contact_phone,slump,work_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, data.customer, data.work, data.date, data.start, data.duration, data.type, pump, seller, data.planned_volume, data.gravel, data.resistance, data.piece, data.notes, data.trips, data.load_capacity, requestId, customerCode, data.contact_name, data.contact_phone, data.slump,data.work_name);
  const id = Number(result.lastInsertRowid);
  await saveCustomer(data,seller);
  await audit(u, 'criar', 'agendamento', id, data);
  return id;
}
async function throttle(req, key) {
  const address = process.env.VERCEL
    ? String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
    : req.socket?.remoteAddress || 'unknown';
  const id = digest(address + ':' + key);
  const allowed = await transaction(async () => {
    const now = Date.now();
    await run('DELETE FROM rate_limits WHERE expires<?', now);
    const item = await one('SELECT count FROM rate_limits WHERE key=?', id);
    if (item && item.count >= 20) return false;
    if (item) await run('UPDATE rate_limits SET count=count+1 WHERE key=?', id);
    else await run('INSERT INTO rate_limits VALUES(?,?,?)', id, 1, now + 15 * 60000);
    return true;
  });
  if (!allowed) fail('Muitas tentativas. Tente novamente em 15 minutos.', 429);
}
async function body(req, limit=32768) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail('Envie JSON.', 415);
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (Buffer.byteLength(data) > limit) fail('Requisição muito grande.', 413);
  }
  try {
    return JSON.parse(data || '{}');
  } catch {
    fail('JSON inválido.');
  }
}
async function session(req) {
  const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('session='))?.slice(8);
  return token && await one('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.active=1', digest(token), Date.now());
}
async function login(res, u) {
  const token = randomBytes(32).toString('hex');
  await run('DELETE FROM sessions WHERE expires<?', Date.now());
  await run('INSERT INTO sessions VALUES(?,?,?)', digest(token), u.id, Date.now() + 12 * 3600000);
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.COOKIE_SECURE === 'true' || process.env.VERCEL ? '; Secure' : ''}`);
  return safeUser(u);
}
function userFields(b) {
  const name = text(b.name, 'nome');
  const username = text(b.username, 'nome de usuário').toLowerCase();
  if (!(/^[a-z0-9_.-]{3,32}$/).test(username)) fail('Usuário: use de 3 a 32 letras, números, pontos, hífens ou sublinhados.');
  if (typeof b.password !== 'string' || b.password.length < 8 || b.password.length > 128) fail('A senha deve ter entre 8 e 128 caracteres.');
  if (!roles.includes(b.role)) fail('Perfil inválido.');
  return {
    name,
    username,
    role: b.role,
    password: passwordHash(b.password)
  };
}
async function updateAppointment(u,id,b){
      const old = await one('SELECT * FROM appointments WHERE id=?', id);
      if (!old) fail('Agendamento não encontrado.', 404);
      const merged = {
        ...old,
        ...b
      };
      const data = scheduling(merged),contact=contactFields(b,old),concrete={gravel:b.gravel===undefined||b.gravel===old.gravel?old.gravel:gravelValue(b.gravel),slump:slumpValue(b.slump===undefined?old.slump:b.slump)};
      const customer=b.customer===undefined?old.customer:customerName(text(b.customer,'cliente',200)),notes=b.notes===undefined?old.notes:typeof b.notes==='string'&&b.notes.length<=2000?b.notes.trim():(fail('Confira as observações.'),''),work=b.work===undefined?old.work:text(b.work,'endereço da obra',500),piece=b.piece===undefined?old.piece:text(b.piece,'peça a concretar',200),resistance=b.resistance===undefined?old.resistance:text(b.resistance,'resistência',200);
      const status = b.status ?? old.status;
      if (!['confirmado', 'andamento', 'concluido', 'cancelado'].includes(status)) fail('Status inválido.');
      const changed=['date','start','duration','type'].some(k=>data[k]!==old[k]) || (data.type==='bomba'&&Number(merged.pump_id)!==old.pump_id) || (old.status==='cancelado'&&status!=='cancelado');
      const pump=changed||status==='cancelado'?await checkPump({...data,status,pump_id:merged.pump_id},id):old.pump_id;
      const delivered = b.delivered_volume === undefined ? old.delivered_volume : b.delivered_volume === null || b.delivered_volume === '' ? null : number(b.delivered_volume, 'Volume entregue');
      const cbDemand=b.cb_demand_override===undefined?old.cb_demand_override:b.cb_demand_override===null||b.cb_demand_override===''?null:number(b.cb_demand_override,'CBs necessários',0,1000);if(cbDemand!==null&&!Number.isInteger(cbDemand))fail('Informe uma quantidade inteira de CBs.');if(cbDemand!==old.cb_demand_override&&(!Number.isInteger(b.expected_information_version)||b.expected_information_version!==old.information_version))fail('O pedido mudou. Abra novamente para ajustar os CBs.',409);
      const plannedVolume=b.planned_volume===undefined?old.planned_volume:number(b.planned_volume,'Volume programado',0.1),volumeChanged=plannedVolume!==old.planned_volume;if(volumeChanged&&(b.expected_planned_volume===undefined||Number(b.expected_planned_volume)!==old.planned_volume))fail('O volume programado mudou. Abra o pedido novamente antes de editar.',409);
      const selected=b.load_capacity!==undefined?b.load_capacity:old.load_capacity;
      const automatic=(selected!==null&&selected!==undefined&&selected!==''?selected:null) ?? (volumeChanged||data.date>=localDay(new Date()) && ['confirmado','andamento'].includes(status)?9:null);
      const estimate=automatic!==null?estimateTrips(plannedVolume,automatic):{trips:old.trips,load_capacity:null};
      const {trips,load_capacity}=estimate;
      if(b.action && !['cancelar','remarcar'].includes(b.action))fail('Ação de agendamento inválida.');
      if(b.action==='cancelar' && status!=='cancelado')fail('Confirme o cancelamento do agendamento.');
      const workName=b.work_name===undefined?old.work_name:text(b.work_name,'nome da obra',200),workNameChanged=workName!==old.work_name;
      const after={...old,...data,...contact,...concrete,work_name:workName,customer,notes,work,piece,resistance,pump_id:pump,status,planned_volume:plannedVolume,cb_demand_override:cbDemand,delivered_volume:delivered,trips,load_capacity};
      if(old.status==='cancelado' && status==='cancelado' && ['date','start','duration','pump_id','type'].some(key=>old[key]!==after[key]))fail('Para mudar a programação de uma obra cancelada, use Remarcar agendamento.');
      const kind=changeKind(old,after);
      const needsReason=kind==='cancelado'||old.date!==after.date||(old.status==='cancelado'&&after.status!=='cancelado');
      const reason=needsReason?text(b.reason,'o motivo do cancelamento ou da mudança de data',1000):kind?(typeof b.reason==='string'&&b.reason.trim()?text(b.reason,'o motivo',1000):'Ajuste operacional na mesma data.'):'';
      if(b.expected && ['date','start','duration','pump_id','type','status'].some(key=>b.expected[key]!==old[key]))fail('Este agendamento foi alterado por outra pessoa. Atualize a agenda antes de tentar novamente.',409);
      if(b.action==='cancelar' && old.status==='cancelado')fail('Este agendamento já está cancelado.',409);
      if(b.action==='remarcar' && kind!=='remarcado')fail('Altere a data, o horário, a duração ou o recurso para remarcar.');
      await recordChange(u,old,after,reason);
      const contactChanged=contact.contact_name!==old.contact_name||contact.contact_phone!==old.contact_phone,concreteChanged=concrete.gravel!==old.gravel||concrete.slump!==old.slump,resistanceChanged=resistance!==old.resistance,workChanged=work!==old.work,pieceChanged=piece!==old.piece,informationChanged=contactChanged||concreteChanged||workNameChanged||resistanceChanged||workChanged||pieceChanged||customer!==old.customer||notes!==old.notes||cbDemand!==old.cb_demand_override;
      if(informationChanged&&b.expected_information_version!==undefined&&b.expected_information_version!==old.information_version)fail('As informações foram atualizadas por outra pessoa. Abra a obra novamente.',409);
      await run('UPDATE appointments SET date=?,start=?,duration=?,type=?,pump_id=?,status=?,planned_volume=?,delivered_volume=?,trips=?,load_capacity=?,contact_name=?,contact_phone=?,gravel=?,slump=?,work_name=?,work=?,piece=?,resistance=?,customer=?,notes=?,cb_demand_override=?,information_version=information_version+? WHERE id=?', data.date, data.start, data.duration, data.type, pump, status, plannedVolume, delivered, trips, load_capacity, contact.contact_name, contact.contact_phone,concrete.gravel,concrete.slump,workName,work,piece,resistance,customer,notes,cbDemand,informationChanged?1:0,id);
      if(workNameChanged||workChanged)await run("UPDATE customers SET work_name=?,work=? WHERE seller_id=? AND name_key=? AND work=? AND (work_name=? OR work_name='')",workName,work,old.seller_id,customerKey(old.customer),old.work,old.work_name);
      if(customer!==old.customer)await saveCustomer(after,old.seller_id);
      if(contactChanged)await saveContactForAppointment(after,contact);
      if(concreteChanged)await saveConcreteForAppointment(old,{...(concrete.gravel!==old.gravel?{gravel:concrete.gravel}:{}),...(concrete.slump!==old.slump?{slump:concrete.slump}:{})});
      await audit(u, 'editar', 'agendamento', id, {
        antes: old,
        depois: await one('SELECT * FROM appointments WHERE id=?', id)
      });
      return {
        ok: true,warnings:await conventionalWarnings(after,id)
      };
}
function normalizeRequestedChanges(old,b){const full=fields({...old,...b},{allowLegacyGravel:true});if(b.gravel!==undefined&&b.gravel!==old.gravel)full.gravel=gravelValue(b.gravel);if(full.type==='bomba'&&(!Number.isSafeInteger(Number(b.pump_id??old.pump_id))||Number(b.pump_id??old.pump_id)<1))fail('Selecione uma bomba válida.');const status=b.status??old.status;if(!['confirmado','andamento','concluido','cancelado'].includes(status))fail('Situação inválida.');const override=b.cb_demand_override===undefined?old.cb_demand_override:b.cb_demand_override===null||b.cb_demand_override===''?null:number(b.cb_demand_override,'CBs necessários',0,1000);if(override!==null&&!Number.isInteger(override))fail('Informe CBs inteiros.');return {...full,status,cb_demand_override:override,pump_id:full.type==='convencional'?null:Number(b.pump_id??old.pump_id),delivered_volume:b.delivered_volume===undefined?old.delivered_volume:b.delivered_volume===null||b.delivered_volume===''?null:number(b.delivered_volume,'Volume entregue')};}
async function api(req, res, url) {
  const path = url.pathname, method = req.method;
  if (!['GET', 'POST', 'PATCH'].includes(method)&&!(method==='DELETE'&&/^\/api\/laboratory\/moisture\/\d+$/.test(path))) fail('Método não permitido.', 405);
  if (method !== 'GET' && req.headers.origin) {
    const expected = process.env.APP_ORIGIN || `${process.env.VERCEL ? 'https' : 'http'}://${req.headers.host}`;
    if (req.headers.origin !== expected) fail('Origem não permitida.', 403);
  }
  if (path === '/api/session' && method === 'GET') {
    const u = await session(req);
    return {
      user: u ? safeUser(u) : null,
      needsSetup: !await one('SELECT id FROM users LIMIT 1'),
      branch: 'Cascavel – PR'
    };
  }
  if (path === '/api/signup' && method === 'POST') {
    await throttle(req, 'signup');
    if (!await one('SELECT id FROM users LIMIT 1')) fail('Configure primeiro o Programador.', 409);
    const b = userFields({
      ...await body(req),
      role: 'vendedor'
    });
    if (await one('SELECT id FROM users WHERE username=?', b.username)) fail('Nome de usuário indisponível.', 409);
    await run("INSERT INTO users(name,username,password,role,status) VALUES(?,?,?,?,'pendente')", b.name, b.username, b.password, b.role);
    return {
      message: 'Cadastro solicitado. Aguarde a aprovação do Programador.'
    };
  }
  if (path === '/api/bootstrap' && method === 'POST') {
    await throttle(req, 'bootstrap');
    const b = await body(req);
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress);
    if (process.env.ADMIN_SETUP_TOKEN) {
      if (process.env.ADMIN_SETUP_TOKEN.length < 32) fail('O código de configuração deve ter pelo menos 32 caracteres.', 503);
      if (typeof b.setupToken !== 'string' || digest(b.setupToken) !== digest(process.env.ADMIN_SETUP_TOKEN)) fail('Código de configuração inválido.', 403);
    } else if (!local || process.env.NODE_ENV === 'production' || process.env.VERCEL) fail('Configure ADMIN_SETUP_TOKEN na hospedagem.', 403);
    return await transaction(async () => {
      if (await one('SELECT id FROM users LIMIT 1')) fail('Administrador já cadastrado.', 409);
      const d = userFields({
        ...b,
        role: 'programador'
      });
      const id = Number((await run('INSERT INTO users(name,username,password,role) VALUES(?,?,?,?)', d.name, d.username, d.password, d.role)).lastInsertRowid);
      return {
        user: await login(res, await one('SELECT * FROM users WHERE id=?', id))
      };
    });
  }
  if (path === '/api/login' && method === 'POST') {
    await throttle(req, 'login');
    const b = await body(req);
    const u = await one('SELECT * FROM users WHERE username=? AND active=1', String(b.username || '').toLowerCase().trim());
    if (typeof b.password !== 'string' || b.password.length > 128) fail('Usuário ou senha incorretos.', 401);
    const valid = passwordValid(b.password, u?.password || ('0').repeat(32) + ':' + ('0').repeat(128));
    if (!u || !valid) fail('Usuário ou senha incorretos.', 401);
    if (u.status !== 'aprovado') fail('Acesso pendente de aprovação ou bloqueado pelo Programador.', 403);
    return {
      user: await login(res, u)
    };
  }
  const u = await session(req);
  if (!u) fail('Entre para continuar.', 401);
  if (path === '/api/logout' && method === 'POST') {
    const token = (req.headers.cookie || '').match(/(?:^|;\s*)session=([^;]+)/)?.[1];
    if (token) await transaction(async()=>{await run('DELETE FROM presence_clients WHERE session_token=?',digest(token));await run('DELETE FROM sessions WHERE token=?',digest(token));});
    res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return {
      ok: true
    };
  }
  if (path === '/api/change-password' && method === 'POST') {
    await throttle(req, 'change-password');
    const b = await body(req);
    if (typeof b.currentPassword !== 'string' || b.currentPassword.length > 128 || !passwordValid(b.currentPassword, u.password)) fail('Senha atual incorreta.', 403);
    if (typeof b.newPassword !== 'string' || b.newPassword.length < 8 || b.newPassword.length > 128) fail('A nova senha deve ter entre 8 e 128 caracteres.');
    if (b.newPassword === b.currentPassword) fail('Escolha uma senha diferente da atual.');
    const hash = passwordHash(b.newPassword);
    return await transaction(async () => {
      await run('UPDATE users SET password=?,must_change=0 WHERE id=?', hash, u.id);
      await run('DELETE FROM sessions WHERE user_id=?', u.id);
      await audit(u, 'trocar senha', 'usuario', u.id, {});
      return {
        user: await login(res, await one('SELECT * FROM users WHERE id=?', u.id))
      };
    });
  }
  if (u.status !== 'aprovado') fail('Acesso não aprovado.', 403);
  if (u.must_change) fail('Troque a senha temporária antes de acessar os módulos.', 403);
  if(labStaffRole(u)&&!path.startsWith('/api/laboratory')&&!['/api/meta','/api/presence','/api/profile/photo','/api/notification-summary'].includes(path)&&!/^\/api\/profile-photo\/\d+$/.test(path))fail('Acesso restrito ao Laboratório, CPs e Umidade da areia.',403);
  if(u.role==='manutencao'&&!path.startsWith('/api/equipment-maintenance')&&!['/api/meta','/api/presence','/api/profile/photo','/api/notification-summary'].includes(path)&&!/^\/api\/profile-photo\/\d+$/.test(path))fail('Acesso exclusivo ao módulo Manutenção.',403);
  if(['engenharia','gerente_engenharia'].includes(u.role)&&!path.startsWith('/api/technical-tickets')&&!path.startsWith('/api/laboratory')&&!['/api/meta','/api/presence','/api/profile/photo','/api/notification-summary'].includes(path)&&!/^\/api\/profile-photo\/\d+$/.test(path))fail('Acesso restrito aos módulos de Engenharia e Laboratório.',403);
  if(path==='/api/notification-summary'&&method==='GET'){
    const summary=(path,handler)=>handler({path,method,url,u,res,manager,body:()=>body(req)});
    const [ticketSummary,maintenanceSummary,appointmentChangeSummary]=await Promise.all([
      ticketsAccess(u)?summary('/api/technical-tickets/summary',technicalTicketsApi):null,
      ['manutencao','gerente','programador','controlador','gerente_concresuper'].includes(u.role)?summary('/api/equipment-maintenance/summary',equipmentMaintenanceApi):null,
      manager(u)||u.role==='vendedor'?summary('/api/appointment-change-requests/summary',appointmentChangesApi):null
    ]);
    return {ticketSummary,maintenanceSummary,appointmentChangeSummary};
  }
  if(path==='/api/presentation-seed'&&method==='POST')return seedPresentation(u,await body(req));
  if(path.startsWith('/api/appointment-change-requests'))return appointmentChangesApi({path,method,url,u,body:()=>body(req),manager,normalize:normalizeRequestedChanges,apply:updateAppointment,audit});
  if(path==='/api/shifts'||path.startsWith('/api/shifts/'))return shiftRosterApi({path,method,url,u,body:()=>body(req,220000)});
  if(path.startsWith('/api/laboratory'))return laboratoryApi({path,method,url,u,res,body:()=>body(req,200000)});
  if(path.startsWith('/api/technical-tickets'))return technicalTicketsApi({path,method,url,u,res,body:()=>body(req,3200000)});
  if(path.startsWith('/api/equipment-maintenance'))return equipmentMaintenanceApi({path,method,url,u,body:()=>body(req)});
  if(path.startsWith('/api/contracts'))return contractsApi({path,method,url,u,body:()=>body(req),createAppointment});
  if(path==='/api/presence'&&method==='GET')return {users:await onlineUsers(),ttl_seconds:90};
  if(path==='/api/presence'&&method==='POST'){
    const b=await body(req),token=(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith('session='))?.slice(8);
    await updatePresence(digest(token),b.client_id,b.online);
    return b.online?{users:await onlineUsers(),ttl_seconds:90}:{ok:true};
  }
  const userPhotoPath=path.match(/^\/api\/users\/(\d+)\/photo$/);
  if((path==='/api/profile/photo'||userPhotoPath) && method==='PATCH') {
    if(userPhotoPath&&u.role!=='programador')fail('Somente o Programador pode alterar fotos da equipe.',403);
    const targetId=userPhotoPath?Number(userPhotoPath[1]):u.id;
    if(!await one('SELECT id FROM users WHERE id=?',targetId))fail('Usuário não encontrado.',404);
    const b=await body(req,180000),image=b.image;
    if(image!==null){
      if(typeof image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))fail('Envie uma foto JPEG válida.');
      const bytes=Buffer.from(image.split(',')[1],'base64');
      if(bytes.length>120000||bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)fail('Foto inválida ou maior que 120 KB.');
      await run('INSERT INTO user_photos(user_id,image,version) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET image=excluded.image,version=excluded.version',targetId,image,randomBytes(12).toString('hex'));
    }else await run('DELETE FROM user_photos WHERE user_id=?',targetId);
    if(userPhotoPath)await audit(u,image===null?'remover foto':'alterar foto','usuario',targetId,{});
    return {ok:true};
  }
  if(/^\/api\/profile-photo\/\d+$/.test(path)&&method==='GET'){
    const id=Number(path.split('/').pop());
    if(!manager(u)&&id!==u.id&&!await userIsOnline(id))fail('Foto não encontrada.',404);
    const photo=await one('SELECT image FROM user_photos WHERE user_id=?',id);if(!photo)fail('Foto não encontrada.',404);
    res.setHeader('Content-Type','image/jpeg');res.end(Buffer.from(photo.image.split(',')[1],'base64'));return;
  }
  if(path==='/api/cb-utilization'&&method==='GET'){if(!manager(u))fail('Sem permissão.',403);return cbUtilization(date(url.searchParams.get('date')));}
  if(path==='/api/conventional-availability'&&method==='GET'){if(!manager(u)&&u.role!=='vendedor')fail('Sem permissão.',403);const day=date(url.searchParams.get('date')),start=url.searchParams.get('start');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start||''))fail('Horário inválido.');const rows=await query("SELECT start FROM appointments WHERE date=? AND type='convencional' AND status<>'cancelado' AND id<>? ORDER BY start",day,Number(url.searchParams.get('except')||0)),times=rows.map(r=>r.start),conflicts=times.filter(value=>Math.abs(minutes(value)-minutes(start))<10);let candidate=Math.ceil(minutes(start)/10)*10;while(candidate<1440&&times.some(t=>Math.abs(minutes(t)-candidate)<10))candidate+=10;return {conflicts,next_start:candidate<1440?String(Math.floor(candidate/60)).padStart(2,'0')+':'+String(candidate%60).padStart(2,'0'):null};}
  if(path==='/api/agenda-version'&&method==='GET'){
    const latest=await one('SELECT COALESCE(MAX(id),0) revision FROM audit');
    return {version:digest('agenda:'+latest.revision)};
  }
  if (path === '/api/meta' && method === 'GET') {
    if(labStaffRole(u))return {profiles:await query('SELECT u.id,u.name,p.version FROM users u LEFT JOIN user_photos p ON p.user_id=u.id WHERE u.id=?',u.id),pumps:[],sellers:[],buffer:0,branch:'Cascavel – PR'};
    const [profiles,pumps,sellers,settings]=await Promise.all([
      query('SELECT u.id,u.name,p.version FROM users u LEFT JOIN user_photos p ON p.user_id=u.id WHERE (?=1 OR u.id=?)',manager(u)?1:0,u.id),
      query('SELECT * FROM pumps ORDER BY name'),
      manager(u)?query("SELECT id,name FROM users WHERE role='vendedor' AND active=1 AND status='aprovado' ORDER BY name"):Promise.resolve([{id:u.id,name:u.name}]),
      one("SELECT value FROM settings WHERE key='buffer_minutes'")
    ]);
    return {profiles,pumps,sellers,buffer:Number(settings.value),branch:'Cascavel – PR'};
  }

  if(path==='/api/fleet' && method==='GET') {
    if(!manager(u))fail('Sem permissão.',403);
    return await fleetRange(date(url.searchParams.get('from')),date(url.searchParams.get('to')),checkBranch(url.searchParams.get('branch')||'',true));
  }
  if(path==='/api/fleet' && method==='PATCH') {
    if(!productionManager(u))fail('Sem permissão.',403);
    const b=await body(req),day=date(b.date),scope=b.scope||'day';
    if(!['day','from','clear'].includes(scope))fail('Escolha como aplicar a quantidade de caminhões.');
    const registry=await one("SELECT value FROM settings WHERE key='fleet_registry_since'");if(registry&&day>=registry.value)fail('A frota desta data é calculada pelos CBs ativos cadastrados na Gerência.',409);
    const trucks=scope==='clear'?null:number(b.trucks,'Caminhões disponíveis',0,1000);
    if(trucks!==null&&!Number.isInteger(trucks))fail('Informe uma quantidade inteira de caminhões.');
    return await transaction(async()=>{
      const before=await fleetRange(day,day);
      if(scope==='clear')await run('DELETE FROM fleet_days WHERE date=?',day);
      else if(scope==='from')await run(`INSERT INTO fleet_defaults(effective_date,trucks,updated_by,updated_at) VALUES(?,?,?,?) ON CONFLICT(effective_date) DO UPDATE SET trucks=excluded.trucks,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,day,trucks,u.id,new Date().toISOString());
      else await run(`INSERT INTO fleet_days(date,trucks,updated_by,updated_at) VALUES(?,?,?,?) ON CONFLICT(date) DO UPDATE SET trucks=excluded.trucks,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,day,trucks,u.id,new Date().toISOString());
      await audit(u,'ajustar frota','frota',0,{date:day,scope,trucks,before:before.days[0]});
      return await fleetRange(day,day);
    });
  }
  if(path==='/api/production/goals'&&method==='GET'){
    if(!manager(u))fail('Sem permissão.',403);
    return monthlyGoalHistory(url.searchParams.get('period')||'past');
  }
  if(path==='/api/production' && method==='GET') {
    if(!manager(u))fail('Sem permissão.',403);
    const reference=url.searchParams.get('reference');
    return await monthlyProduction(checkMonth(url.searchParams.get('month')),{reference:reference?date(reference):undefined,basis:url.searchParams.get('basis')||'mon_sat'});
  }
  if(path==='/api/production' && method==='PATCH') {
    if(!productionManager(u))fail('Somente Gerente e Programador podem alterar a meta mensal.',403);
    const b=await body(req),month=checkMonth(b.month),volume=number(b.volume,'Meta de volume',0.1,100000000);
    return await transaction(async()=>{
      const before=await monthlyProduction(month);
      await run(`INSERT INTO monthly_goals(month,volume,updated_by,updated_at) VALUES(?,?,?,?) ON CONFLICT(month) DO UPDATE SET volume=excluded.volume,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,month,volume,u.id,new Date().toISOString());
      await audit(u,'ajustar meta mensal','meta_mensal',0,{month,volume,before:before.target});
      return await monthlyProduction(month);
    });
  }
  if (path === '/api/availability' && method === 'GET') {
    const slot = scheduling({
      date: url.searchParams.get('date'),
      start: url.searchParams.get('start'),
      duration: url.searchParams.get('duration'),
      type: 'bomba'
    });
    const buffer = Number((await one("SELECT value FROM settings WHERE key='buffer_minutes'")).value);
    const bookings = await query("SELECT pump_id,start,duration FROM appointments WHERE date=? AND status<>'cancelado'", slot.date);
    const start = minutes(slot.start), end = start + slot.duration;
    const window=slotWindow(slot.date,slot.start,slot.duration);
    const maintenance=await query('SELECT pump_id FROM maintenance_periods WHERE cancelled_at IS NULL AND starts_at<? AND ends_at>?',window.end,window.start);
    return {
      buffer,
      pumps: (await query('SELECT * FROM pumps WHERE active=1 ORDER BY name')).map(p => ({
        id: p.id,
        name: p.name,
        maintenance: Boolean(p.maintenance||maintenance.some(m=>m.pump_id===p.id)),
        available: !p.maintenance && !maintenance.some(m=>m.pump_id===p.id) && !bookings.some(a => a.pump_id === p.id && start < minutes(a.start) + a.duration + buffer && end + buffer > minutes(a.start))
      }))
    };
  }
  if(path==='/api/maintenance' && method==='GET') {
    const from=date(url.searchParams.get('from')),to=date(url.searchParams.get('to'));
    if(from>to)fail('Confira o período de manutenção.');
    const end=new Date(to+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+1);
    const rows=await query(`SELECT m.*,p.name pump_name,u.name created_by_name FROM maintenance_periods m JOIN pumps p ON p.id=m.pump_id JOIN users u ON u.id=m.created_by WHERE starts_at<? AND ends_at>? AND cancelled_at IS NULL ORDER BY starts_at`,end.toISOString().slice(0,10)+'T00:00',from+'T00:00');
    return manager(u)?rows:rows.map(m=>({id:m.id,pump_id:m.pump_id,starts_at:m.starts_at,ends_at:m.ends_at,pump_name:m.pump_name}));
  }
  if(path==='/api/maintenance'&&method==='POST'){if(!manager(u))fail('Sem permissão.',403);fail('Use a proposta de manutenção e aguarde a aceitação dos dois lados.',409);}
  if((/^\/api\/maintenance\/\d+$/).test(path)&&method==='PATCH') {
    if(!manager(u))fail('Sem permissão.',403);
    const b=await body(req),id=Number(path.split('/').pop()),reason=text(b.reason,'o motivo para cancelar o período',1000);
    return await transaction(async()=>{
      const item=await one('SELECT * FROM maintenance_periods WHERE id=?',id);if(!item)fail('Manutenção não encontrada.',404);
      if(await one('SELECT id FROM maintenance_jobs WHERE period_id=?',id))fail('Cancele pela programação de equipamentos para preservar o histórico.',409);
      if(item.cancelled_at)fail('Este período já está cancelado.',409);
      await run('UPDATE maintenance_periods SET cancelled_by=?,cancelled_at=?,cancel_reason=? WHERE id=?',u.id,new Date().toISOString(),reason,id);
      await audit(u,'cancelar manutenção','manutencao',id,{reason,before:item});return {ok:true};
    });
  }
  if (path === '/api/appointments' && method === 'GET') {
    const from = date(url.searchParams.get('from')), to = date(url.searchParams.get('to'));
    const rows = await query(`SELECT a.*,u.name seller_name,p.name pump_name,photo.version seller_photo_version FROM appointments a JOIN users u ON u.id=a.seller_id LEFT JOIN pumps p ON p.id=a.pump_id LEFT JOIN user_photos photo ON photo.user_id=a.seller_id WHERE date BETWEEN ? AND ? ORDER BY date,start`, from, to);
    const full=await withCustomerCodes(manager(u)?rows:rows.filter(a=>a.seller_id===u.id));
    if(manager(u))return full;
    const own=new Map(full.map(a=>[a.id,a]));
    return rows.filter(a=>a.status!=='cancelado').map(a=>a.seller_id===u.id?{...own.get(a.id),own_booking:true}:{id:a.id,date:a.date,start:a.start,duration:a.duration,type:a.type,pump_id:a.pump_id,customer:a.customer,status:'ocupado',seller_id:a.seller_id,seller_name:a.seller_name,seller_photo_version:a.seller_photo_version,trips:a.trips,required_cbs:cbEstimate.requiredCBs(a)});
  }
  if(/^\/api\/appointments\/\d+\/seller-photo$/.test(path)&&method==='GET'){
    if(!manager(u)&&u.role!=='vendedor')fail('Sem permissão.',403);
    const row=await one("SELECT photo.image,a.status FROM appointments a JOIN user_photos photo ON photo.user_id=a.seller_id WHERE a.id=?",Number(path.split('/')[3]));
    if(!row||!manager(u)&&row.status==='cancelado')fail('Foto não encontrada.',404);
    res.setHeader('Content-Type','image/jpeg');res.setHeader('Cache-Control','private, no-store');res.end(Buffer.from(row.image.split(',')[1],'base64'));return;
  }
  if (path === '/api/appointments' && method === 'POST') {
    if (!manager(u)) fail('Sem permissão.', 403);
    const b = await body(req);
    return await transaction(async()=>{const id=await createAppointment(b,u);return {id,warnings:await conventionalWarnings(b,id)};});
  }
  if((/^\/api\/appointments\/\d+$/).test(path) && method==='GET') {
    const a=await one('SELECT a.*,u.name seller_name,p.name pump_name FROM appointments a JOIN users u ON u.id=a.seller_id LEFT JOIN pumps p ON p.id=a.pump_id WHERE a.id=?',Number(path.split('/').pop()));
    if(!a || (!manager(u)&&a.seller_id!==u.id))fail('Agendamento não encontrado.',404);
    return (await withCustomerCodes([a]))[0];
  }
  if ((/^\/api\/appointments\/\d+$/).test(path) && method === 'PATCH') {if(!manager(u))fail('Sem permissão.',403);const b=await body(req),id=Number(path.split('/').pop());return transaction(()=>updateAppointment(u,id,b));}

  if((/^\/api\/appointments\/\d+\/information$/).test(path)&&method==='PATCH') {
    const b=await body(req),id=Number(path.split('/')[3]);
    return await transaction(async()=>{
      const old=await one('SELECT * FROM appointments WHERE id=?',id);
      if(!old||(!manager(u)&&old.seller_id!==u.id))fail('Agendamento não encontrado.',404);
      if(!Number.isInteger(b.expected_version)||b.expected_version!==old.information_version)fail('As informações foram alteradas por outra pessoa. Abra a obra novamente para atualizar.',409);
      const saved=await savedCustomerCode(old.customer,old.seller_id),previousCode=old.customer_code||saved;
      const code=commercialCode(b.customer_code===undefined?previousCode:b.customer_code,'Código do cliente'),order=commercialCode(b.order_code===undefined?old.order_code:b.order_code,'Código do pedido'),item=commercialCode(b.order_item===undefined?old.order_item:b.order_item,'Item do pedido');
      const contact=contactFields(b,old),slump=slumpValue(b.slump===undefined?old.slump:b.slump);
      await run('UPDATE appointments SET customer_code=?,order_code=?,order_item=?,contact_name=?,contact_phone=?,slump=?,information_version=information_version+1 WHERE id=?',code,order,item,contact.contact_name,contact.contact_phone,slump,id);
      if(slump!==old.slump)await saveConcreteForAppointment(old,{slump});
      if(contact.contact_name!==old.contact_name||contact.contact_phone!==old.contact_phone)await saveContactForAppointment(old,contact);
      if(!await one('SELECT id FROM customers WHERE seller_id=? AND name_key=?',old.seller_id,customerKey(old.customer)))await saveCustomer(old,old.seller_id);
      if(code!==previousCode||!saved)await run('UPDATE customers SET customer_code=?,updated_at=? WHERE seller_id=? AND name_key=?',code,new Date().toISOString(),old.seller_id,customerKey(old.customer));
      await audit(u,'adicionar informações','agendamento',id,{antes:{customer_code:old.customer_code,order_code:old.order_code,order_item:old.order_item,contact_name:old.contact_name,contact_phone:old.contact_phone,slump:old.slump},depois:{customer_code:code,order_code:order,order_item:item,...contact,slump}});
      return {ok:true,information_version:old.information_version+1};
    });
  }
  if ((/^\/api\/appointments\/\d+\/history$/).test(path) && method==='GET') {
    const id=Number(path.split('/')[3]);
    const appointment=await one('SELECT * FROM appointments WHERE id=?',id);
    if(!appointment || (!manager(u)&&appointment.seller_id!==u.id))fail('Agendamento não encontrado.',404);
    const events=await query('SELECT e.*,u.name actor_name FROM appointment_events e LEFT JOIN users u ON u.id=e.actor_id WHERE appointment_id=? ORDER BY e.id DESC',id);
    return withContractWorkNames(events.map(e=>({...e,before:JSON.parse(e.before_json),after:JSON.parse(e.after_json),before_json:undefined,after_json:undefined})));
  }
  if(path==='/api/changes' && method==='GET') {
    const from=date(url.searchParams.get('from')),to=date(url.searchParams.get('to'));
    if(from>to)fail('A data inicial deve ser anterior à final.');
    const basis=url.searchParams.get('basis')||'event';
    if(!['event','before','after'].includes(basis))fail('Referência de data inválida.');
    const kind=url.searchParams.get('kind')||'';
    if(kind && !['cancelado','remarcado'].includes(kind))fail('Tipo de ocorrência inválido.');
    const seller=u.role==='vendedor'?u.id:Number(url.searchParams.get('seller')||0);
    if(!Number.isInteger(seller)||seller<0)fail('Vendedor inválido.');
    const customer=searchName((url.searchParams.get('customer')||'').slice(0,200));
    const column={event:'e.event_date',before:"json_extract(e.before_json,'$.date')",after:"json_extract(e.after_json,'$.date')"}[basis];
    const includeUnknown=url.searchParams.get('unknown')==='1' && basis==='event';
    const events=await query(`SELECT e.*,u.name actor_name,s.name seller_name,a.status current_status,a.date current_date FROM appointment_events e JOIN appointments a ON a.id=e.appointment_id LEFT JOIN users u ON u.id=e.actor_id LEFT JOIN users s ON s.id=e.seller_id WHERE ((${column} BETWEEN ? AND ?) OR (?=1 AND e.event_date IS NULL)) AND (?='' OR e.kind=?) AND (?=0 OR e.seller_id=?) AND (?='' OR instr(e.customer_search,?)>0) ORDER BY e.created_at DESC,e.id DESC`,from,to,includeUnknown?1:0,kind,kind,seller,seller,customer,customer);
    return withContractWorkNames(events.map(e=>({...e,before:JSON.parse(e.before_json),after:JSON.parse(e.after_json),before_json:undefined,after_json:undefined})));
  }
  if(path==='/api/customers' && method==='GET') {
    const seller=manager(u)?Number(url.searchParams.get('seller')||0):u.id;
    if(!Number.isInteger(seller)||seller<0)fail('Vendedor inválido.');
    const name=customerKey((url.searchParams.get('q')||'').slice(0,200));
    return await query(`SELECT c.*,u.name seller_name FROM customers c JOIN users u ON u.id=c.seller_id WHERE (?=0 OR c.seller_id=?) AND (?='' OR instr(c.name_key,?)>0) ORDER BY c.name LIMIT 100`,seller,seller,name,name);
  }
  const customerWorksPath=path.match(/^\/api\/customers\/(\d+)\/works$/);
  if(customerWorksPath&&method==='GET')return customerWorks(Number(customerWorksPath[1]),u);
  const customerAddressesPath=path.match(/^\/api\/customers\/(\d+)\/addresses$/);
  if(customerAddressesPath&&method==='GET')return customerAddresses(Number(customerAddressesPath[1]),u);
  const customerPreviewPath=path.match(/^\/api\/customers\/(\d+)\/edit-preview$/),customerEditPath=path.match(/^\/api\/customers\/(\d+)$/);
  if((customerPreviewPath&&method==='GET')||(customerEditPath&&method==='PATCH')){
    if(u.role!=='programador')fail('Somente o Programador pode editar nome e vendedor do cliente.',403);
    if(customerPreviewPath)return customerEditPreview(Number(customerPreviewPath[1]),{name:url.searchParams.get('name')??undefined,seller_id:url.searchParams.get('seller')??undefined},u);
    return editCustomer(Number(customerEditPath[1]),await body(req),u);
  }
  if (path === '/api/requests' && method === 'GET') return manager(u) ? await query('SELECT r.*,u.name seller_name FROM requests r JOIN users u ON u.id=r.seller_id ORDER BY r.id DESC') : await query('SELECT r.*,u.name seller_name FROM requests r JOIN users u ON u.id=r.seller_id WHERE seller_id=? ORDER BY r.id DESC', u.id);
  if (path === '/api/requests' && method === 'POST') {
    const input=await body(req),b = fields(input);
    if (!Number.isInteger(b.trips)) fail('Viagens devem ser inteiras.');
    const seller = await checkSeller(u.id);
    return await transaction(async () => {
      Object.assign(b,await detailsForCustomer(input,seller));
      const id = Number((await run('INSERT INTO requests(seller_id,customer,work,date,start,duration,type,planned_volume,gravel,resistance,piece,notes,trips,load_capacity,contact_name,contact_phone,slump,work_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', seller, b.customer, b.work, b.date, b.start, b.duration, b.type, b.planned_volume, b.gravel, b.resistance, b.piece, b.notes, b.trips, b.load_capacity,b.contact_name,b.contact_phone,b.slump,b.work_name)).lastInsertRowid);
      await saveCustomer(b,seller);
      await audit(u, 'solicitar', 'solicitacao', id, b);
      return {
        id
      };
    });
  }
  if ((/^\/api\/requests\/\d+$/).test(path) && method === 'PATCH') {
    if (!manager(u)) fail('Sem permissão.', 403);
    const b = await body(req), id = Number(path.split('/').pop());
    return await transaction(async () => {
      const r = await one('SELECT * FROM requests WHERE id=?', id);
      if (!r) fail('Solicitação não encontrada.', 404);
      if (r.status !== 'pendente' && r.status !== 'ajuste') fail('Solicitação já respondida.', 409);
      if (!['aprovada', 'recusada', 'ajuste'].includes(b.status)) fail('Resposta inválida.');
      if (b.status !== 'aprovada' && !String(b.response || '').trim()) fail('Informe o motivo ou a proposta de ajuste.');
      if (b.status === 'aprovada') await createAppointment({
        ...r,
        pump_id: b.pump_id,
        date: b.date || r.date,
        start: b.start || r.start,
        duration: b.duration || r.duration,
        load_capacity: b.load_capacity ?? r.load_capacity ?? 9
      }, u, id);
      await run('UPDATE requests SET status=?,response=? WHERE id=?', b.status, String(b.response || '').slice(0, 2000), id);
      await audit(u, b.status, 'solicitacao', id, b);
      return {
        ok: true
      };
    });
  }
  if (path === '/api/report' && method === 'GET') {
    const from = date(url.searchParams.get('from')), to = date(url.searchParams.get('to'));
    if (from > to) fail('A data inicial deve ser anterior à final.');
    const seller = u.role === 'vendedor' ? u.id : Number(url.searchParams.get('seller') || 0);
    const type = url.searchParams.get('type') || '';
    const status = url.searchParams.get('status') || '';
    return await withCustomerCodes(await query(`SELECT a.*,u.name seller_name,p.name pump_name FROM appointments a JOIN users u ON u.id=a.seller_id LEFT JOIN pumps p ON p.id=a.pump_id WHERE date BETWEEN ? AND ? AND (?=0 OR seller_id=?) AND (?='' OR type=?) AND ((?='' AND a.status<>'cancelado') OR a.status=?) ORDER BY date,start`, from, to, seller, seller, type, type, status, status));
  }
  if (path === '/api/users' && method === 'GET') {
    if (u.role !== 'programador') fail('Sem permissão.', 403);
    return await query('SELECT id,name,username,role,active,status,must_change FROM users ORDER BY name');
  }
  if (path === '/api/users' && method === 'POST') {
    if (u.role !== 'programador') fail('Sem permissão.', 403);
    const b = userFields(await body(req));
    if (b.role === 'programador') fail('O perfil Programador pertence somente à conta inicial.', 403);
    if (await one('SELECT id FROM users WHERE username=?', b.username)) fail('Nome de usuário já cadastrado.', 409);
    return await transaction(async () => {
      const id = Number((await run('INSERT INTO users(name,username,password,role,must_change) VALUES(?,?,?,?,1)', b.name, b.username, b.password, b.role)).lastInsertRowid);
      await audit(u, 'criar', 'usuario', id, {
        name: b.name,
        role: b.role
      });
      return {
        id
      };
    });
  }
  if ((/^\/api\/users\/\d+$/).test(path) && method === 'PATCH') {
    if (u.role !== 'programador') fail('Sem permissão.', 403);
    const id = Number(path.split('/').pop()), b = await body(req);
    const target = await one('SELECT * FROM users WHERE id=?', id);
    if (!target) fail('Usuário não encontrado.', 404);
    if(b.action==='rename'){
      const name=text(b.name,'nome',200);
      return transaction(async()=>{
        const current=await one('SELECT name FROM users WHERE id=?',id);
        if(typeof b.expected_name!=='string'||current.name!==b.expected_name)fail('O nome foi alterado por outra sessão. Atualize a lista e tente novamente.',409);
        if(name!==current.name){await run('UPDATE users SET name=? WHERE id=?',name,id);await audit(u,'editar nome','usuario',id,{before:current.name,after:name});}
        return {id,name};
      });
    }
    if (id === u.id || target.role === 'programador') fail('Sua conta de Programador é protegida.', 403);
    if (b.action === 'reset-password') {
      await throttle(req, 'reset-password');
      if (typeof b.currentPassword !== 'string' || b.currentPassword.length > 128 || !passwordValid(b.currentPassword, u.password)) fail('Confirme sua senha de Programador.', 403);
      if (typeof b.password !== 'string' || b.password.length < 8 || b.password.length > 128) fail('Senha temporária: entre 8 e 128 caracteres.');
      const hash = passwordHash(b.password);
      return await transaction(async () => {
        await run('UPDATE users SET password=?,must_change=1 WHERE id=?', hash, id);
        await run('DELETE FROM sessions WHERE user_id=?', id);
        await audit(u, 'redefinir senha', 'usuario', id, {});
        return {
          ok: true
        };
      });
    }
    if (!['aprovado', 'bloqueado'].includes(b.status) || !roles.includes(b.role) || b.role === 'programador') fail('Perfil ou situação inválidos.');
    return await transaction(async () => {
      await run('UPDATE users SET role=?,status=? WHERE id=?', b.role, b.status, id);
      await run('DELETE FROM sessions WHERE user_id=?', id);
      await audit(u, 'alterar acesso', 'usuario', id, {
        role: b.role,
        status: b.status
      });
      return {
        ok: true
      };
    });
  }
  if (path === '/api/pumps' && method === 'POST') {
    if (!productionManager(u)) fail('Sem permissão.', 403);
    const b = await body(req), name = text(b.name, 'nome da bomba', 50);
    if (await one('SELECT id FROM pumps WHERE name=?', name)) fail('Bomba já cadastrada.', 409);
    if(plateValue(b.plate)&&await one('SELECT id FROM pumps WHERE plate=?',plateValue(b.plate)))fail('Essa placa já está cadastrada em outra bomba.',409);
    const id = Number((await run('INSERT INTO pumps(name,description,plate,branch) VALUES(?,?,?,?)', name, String(b.description || '').slice(0, 200),plateValue(b.plate),checkBranch(b.branch||'pacaembu'))).lastInsertRowid);
    await audit(u, 'criar', 'bomba', id, {
      name
    });
    return {
      id
    };
  }
  if ((/^\/api\/pumps\/\d+$/).test(path) && method === 'PATCH') {
    if (!manager(u)) fail('Sem permissão.', 403);
    const b = await body(req), id = Number(path.split('/').pop());
    if(b.active!==undefined||b.plate!==undefined||b.branch!==undefined)return equipmentState(u,'bomba',id,b);
    if(b.maintenance===true)fail('Envie uma proposta de manutenção para aprovação dos dois lados.',409);
    if (typeof b.maintenance !== 'boolean') fail('Estado inválido.');
    if (!await one('SELECT id FROM pumps WHERE id=?', id)) fail('Bomba não encontrada.', 404);
    await run('UPDATE pumps SET maintenance=? WHERE id=?', b.maintenance ? 1 : 0, id);
    await audit(u, 'manutencao', 'bomba', id, {
      maintenance: b.maintenance
    });
    return {
      ok: true
    };
  }
  if (path === '/api/settings' && method === 'PATCH') {
    if (u.role !== 'programador') fail('Sem permissão.', 403);
    const b = await body(req), buffer = number(b.buffer, 'Intervalo entre obras', 0, 240);
    await run("UPDATE settings SET value=? WHERE key='buffer_minutes'", String(buffer));
    await audit(u, 'configurar', 'sistema', 0, {
      buffer
    });
    return {
      ok: true
    };
  }
  if (path === '/api/audit' && method === 'GET') {
    if (u.role !== 'programador') fail('Sem permissão.', 403);
    return await query('SELECT a.*,u.name user_name FROM audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100');
  }
  fail('Recurso não encontrado.', 404);
}
const assets = {
  '/contracts.js': ['contracts.js', 'text/javascript; charset=utf-8'],
  '/vendor/pdf.mjs':['vendor/pdf.mjs','text/javascript; charset=utf-8'],
  '/vendor/pdf.worker.mjs':['vendor/pdf.worker.mjs','text/javascript; charset=utf-8'],
  '/vendor/html-to-image.js': ['vendor/html-to-image.js', 'text/javascript; charset=utf-8'],
  '/vendor/jspdf.umd.min.js': ['vendor/jspdf.umd.min.js', 'text/javascript; charset=utf-8'],
  '/laboratory-trials.js':['laboratory-trials.js','text/javascript; charset=utf-8'],
  '/shift-roster.js':['shift-roster.js','text/javascript; charset=utf-8'],
  '/laboratory.js':['laboratory.js','text/javascript; charset=utf-8'],
  '/technical-tickets.js':['technical-tickets.js','text/javascript; charset=utf-8'],
  '/equipment-maintenance.js': ['equipment-maintenance.js','text/javascript; charset=utf-8'],
  '/report-pdf.js': ['report-pdf.js', 'text/javascript; charset=utf-8'],
  '/slump-format.js': ['slump-format.js', 'text/javascript; charset=utf-8'],
  '/concretlog.css': ['concretlog.css', 'text/css; charset=utf-8'],
  '/concretlog-logo.png': ['concretlog-logo.png', 'image/png'],
  '/concretlog-symbol.png': ['concretlog-symbol.png', 'image/png'],
  '/concretlog-hero.png': ['concretlog-hero.png', 'image/png'],
  '/concresuper-symbol.png': ['concresuper-symbol.png', 'image/png'],
  '/logo-concresuper.png': ['logo-concresuper.png', 'image/png'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml'],
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/cb-estimate.js':['cb-estimate.js','text/javascript; charset=utf-8'],
  '/cb-utilization.js':['cb-utilization.js','text/javascript; charset=utf-8'],
  '/conventional-scheduling.js':['conventional-scheduling.js','text/javascript; charset=utf-8'],
  '/request-coalescer.js':['request-coalescer.js','text/javascript; charset=utf-8'],
  '/appointment-changes.js':['appointment-changes.js','text/javascript; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8']
};
export async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' blob:; frame-src 'self' blob:; object-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const started=performance.now();
      await initialize();
      const initialized=performance.now();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      const data = await api(req, res, url);
      if(!res.writableEnded){res.setHeader('Server-Timing',`init;dur=${(initialized-started).toFixed(1)},app;dur=${(performance.now()-initialized).toFixed(1)}`);res.end(JSON.stringify(data));}
    } else {
      const asset = assets[url.pathname];
      if (!asset || req.method !== 'GET') {
        res.writeHead(404);
        res.end('Não encontrado');
        return;
      }
      res.setHeader('Content-Type', asset[1]);
      res.end(readFileSync(join(ROOT, 'public', asset[0])));
    }
  } catch (e) {
    res.statusCode = e.status || 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (!e.status) console.error(e);
    res.end(JSON.stringify({
      error: e.status ? e.message : 'Erro interno. Consulte o registro do servidor.'
    }));
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await initialize();
  const server = http.createServer(handler);
  server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`Central Cascavel iniciada na porta ${server.address().port}`));
}
