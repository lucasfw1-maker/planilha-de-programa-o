import http from 'node:http';
import {query, one, run, transaction, initialize} from './storage.mjs';
import {randomBytes, scryptSync, timingSafeEqual, createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = dirname(fileURLToPath(import.meta.url));
const roles = ['programador', 'gerente', 'controlador', 'vendedor'];
const manager = u => ['programador', 'gerente', 'controlador'].includes(u.role);
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
function fields(b) {
  return {
    ...scheduling(b),
    customer: text(b.customer, 'cliente'),
    work: text(b.work, 'obra/endereço', 500),
    planned_volume: number(b.planned_volume, 'Volume', 0.1),
    gravel: text(b.gravel, 'brita'),
    resistance: text(b.resistance, 'resistência'),
    piece: text(b.piece, 'peça a concretar'),
    notes: String(b.notes || '').trim().slice(0, 2000),
    trips: number(b.trips ?? 0, 'Viagens previstas', 0, 10000)
  };
}
async function checkSeller(id) {
  const user = await one('SELECT * FROM users WHERE id=? AND active=1', Number(id));
  if (!user || user.role !== 'vendedor' || user.status !== 'aprovado') fail('Selecione um vendedor ativo.');
  return user.id;
}
async function checkPump(b, except = 0) {
  if (b.type === 'convencional' || b.status === 'cancelado') return null;
  const pump = await one('SELECT * FROM pumps WHERE id=?', Number(b.pump_id || 0));
  if (!pump) fail('Selecione a bomba.');
  if (pump.maintenance) fail('Esta bomba está em manutenção.', 409);
  const buffer = Number((await one("SELECT value FROM settings WHERE key='buffer_minutes'")).value);
  const start = minutes(b.start), end = start + Number(b.duration);
  const conflict = (await query("SELECT * FROM appointments WHERE date=? AND pump_id=? AND id<>? AND status<>'cancelado'", b.date, pump.id, except)).find(a => start < minutes(a.start) + a.duration + buffer && end + buffer > minutes(a.start));
  if (conflict) fail(`Conflito: ${pump.name} já reservada para ${conflict.customer} às ${conflict.start}. Margem entre obras: ${buffer} min.`, 409);
  return pump.id;
}
async function audit(u, action, entity, id, detail) {
  await run('INSERT INTO audit(user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)', u.id, action, entity, Number(id), JSON.stringify(detail));
}
async function createAppointment(b, u, requestId = null) {
  const data = fields(b);
  if (!Number.isInteger(data.trips)) fail('Viagens devem ser um número inteiro.');
  const seller = await checkSeller(b.seller_id);
  const pump = await checkPump({
    ...data,
    pump_id: b.pump_id
  });
  const result = await run(`INSERT INTO appointments(customer,work,date,start,duration,type,pump_id,seller_id,planned_volume,gravel,resistance,piece,notes,trips,request_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, data.customer, data.work, data.date, data.start, data.duration, data.type, pump, seller, data.planned_volume, data.gravel, data.resistance, data.piece, data.notes, data.trips, requestId);
  const id = Number(result.lastInsertRowid);
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
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail('Envie JSON.', 415);
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (Buffer.byteLength(data) > 32768) fail('Requisição muito grande.', 413);
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
async function api(req, res, url) {
  const path = url.pathname, method = req.method;
  if (!['GET', 'POST', 'PATCH'].includes(method)) fail('Método não permitido.', 405);
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
    if (token) await run('DELETE FROM sessions WHERE token=?', digest(token));
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
  if (path === '/api/meta' && method === 'GET') return {
    pumps: await query('SELECT * FROM pumps ORDER BY name'),
    sellers: manager(u) ? await query("SELECT id,name FROM users WHERE role='vendedor' AND active=1 AND status='aprovado' ORDER BY name") : [{
      id: u.id,
      name: u.name
    }],
    buffer: Number((await one("SELECT value FROM settings WHERE key='buffer_minutes'")).value),
    branch: 'Cascavel – PR'
  };
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
    return {
      buffer,
      pumps: (await query('SELECT * FROM pumps ORDER BY name')).map(p => ({
        id: p.id,
        name: p.name,
        maintenance: Boolean(p.maintenance),
        available: !p.maintenance && !bookings.some(a => a.pump_id === p.id && start < minutes(a.start) + a.duration + buffer && end + buffer > minutes(a.start))
      }))
    };
  }
  if (path === '/api/appointments' && method === 'GET') {
    const from = date(url.searchParams.get('from')), to = date(url.searchParams.get('to'));
    const rows = await query(`SELECT a.*,u.name seller_name,p.name pump_name FROM appointments a JOIN users u ON u.id=a.seller_id LEFT JOIN pumps p ON p.id=a.pump_id WHERE date BETWEEN ? AND ? ORDER BY date,start`, from, to);
    return manager(u) ? rows : rows.filter(a => a.status !== 'cancelado').map(a => ({
      id: a.id,
      date: a.date,
      start: a.start,
      duration: a.duration,
      type: a.type,
      pump_id: a.pump_id,
      status: 'ocupado'
    }));
  }
  if (path === '/api/appointments' && method === 'POST') {
    if (!manager(u)) fail('Sem permissão.', 403);
    const b = await body(req);
    return await transaction(async () => ({
      id: await createAppointment(b, u)
    }));
  }
  if ((/^\/api\/appointments\/\d+$/).test(path) && method === 'PATCH') {
    if (!manager(u)) fail('Sem permissão.', 403);
    const b = await body(req), id = Number(path.split('/').pop());
    return await transaction(async () => {
      const old = await one('SELECT * FROM appointments WHERE id=?', id);
      if (!old) fail('Agendamento não encontrado.', 404);
      const merged = {
        ...old,
        ...b
      };
      const data = scheduling(merged);
      const status = b.status ?? old.status;
      if (!['confirmado', 'andamento', 'concluido', 'cancelado'].includes(status)) fail('Status inválido.');
      const pump = await checkPump({
        ...data,
        status,
        pump_id: merged.pump_id
      }, id);
      const delivered = b.delivered_volume === undefined ? old.delivered_volume : b.delivered_volume === null || b.delivered_volume === '' ? null : number(b.delivered_volume, 'Volume entregue');
      const trips = number(b.trips ?? old.trips, 'Viagens', 0, 10000);
      if (!Number.isInteger(trips)) fail('Viagens devem ser inteiras.');
      await run('UPDATE appointments SET date=?,start=?,duration=?,type=?,pump_id=?,status=?,delivered_volume=?,trips=? WHERE id=?', data.date, data.start, data.duration, data.type, pump, status, delivered, trips, id);
      await audit(u, 'editar', 'agendamento', id, {
        antes: old,
        depois: await one('SELECT * FROM appointments WHERE id=?', id)
      });
      return {
        ok: true
      };
    });
  }
  if (path === '/api/requests' && method === 'GET') return manager(u) ? await query('SELECT r.*,u.name seller_name FROM requests r JOIN users u ON u.id=r.seller_id ORDER BY r.id DESC') : await query('SELECT r.*,u.name seller_name FROM requests r JOIN users u ON u.id=r.seller_id WHERE seller_id=? ORDER BY r.id DESC', u.id);
  if (path === '/api/requests' && method === 'POST') {
    const b = fields(await body(req));
    if (!Number.isInteger(b.trips)) fail('Viagens devem ser inteiras.');
    const seller = await checkSeller(u.id);
    return await transaction(async () => {
      const id = Number((await run('INSERT INTO requests(seller_id,customer,work,date,start,duration,type,planned_volume,gravel,resistance,piece,notes,trips) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', seller, b.customer, b.work, b.date, b.start, b.duration, b.type, b.planned_volume, b.gravel, b.resistance, b.piece, b.notes, b.trips)).lastInsertRowid);
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
        duration: b.duration || r.duration
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
    return await query(`SELECT a.*,u.name seller_name,p.name pump_name FROM appointments a JOIN users u ON u.id=a.seller_id LEFT JOIN pumps p ON p.id=a.pump_id WHERE date BETWEEN ? AND ? AND (?=0 OR seller_id=?) AND (?='' OR type=?) AND ((?='' AND a.status<>'cancelado') OR a.status=?) ORDER BY date,start`, from, to, seller, seller, type, type, status, status);
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
    if (u.role !== 'programador') fail('Sem permissão.', 403);
    const b = await body(req), name = text(b.name, 'nome da bomba', 50);
    if (await one('SELECT id FROM pumps WHERE name=?', name)) fail('Bomba já cadastrada.', 409);
    const id = Number((await run('INSERT INTO pumps(name,description) VALUES(?,?)', name, String(b.description || '').slice(0, 200))).lastInsertRowid);
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
  '/favicon.svg': ['favicon.svg', 'image/svg+xml'],
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8']
};
export async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {
    await initialize();
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      const data = await api(req, res, url);
      res.end(JSON.stringify(data));
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
