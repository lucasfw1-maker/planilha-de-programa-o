import {one,query,run} from './storage.mjs';

export const PRESENCE_TTL=90000;
export async function onlineUsers(now=Date.now()){
 return query(`SELECT u.id,u.name,u.role,p.version FROM presence_clients c JOIN sessions s ON s.token=c.session_token JOIN users u ON u.id=s.user_id LEFT JOIN user_photos p ON p.user_id=u.id WHERE c.seen_at>=? AND s.expires>? AND u.active=1 AND u.status='aprovado' AND u.must_change=0 GROUP BY u.id,u.name,u.role,p.version ORDER BY u.name,u.id`,now-PRESENCE_TTL,now);
}
export async function userIsOnline(id,now=Date.now()){
 return Boolean(await one(`SELECT u.id FROM presence_clients c JOIN sessions s ON s.token=c.session_token JOIN users u ON u.id=s.user_id WHERE u.id=? AND c.seen_at>=? AND s.expires>? AND u.active=1 AND u.status='aprovado' AND u.must_change=0 LIMIT 1`,id,now-PRESENCE_TTL,now));
}
export async function updatePresence(token,clientId,online,now=Date.now()){
 if(typeof clientId!=='string'||!/^[A-Za-z0-9_-]{16,80}$/.test(clientId)||typeof online!=='boolean')throw Object.assign(new Error('Sinal de presença inválido.'),{status:400});
 if(!online){await run('DELETE FROM presence_clients WHERE session_token=? AND client_id=?',token,clientId);return;}
 await run(`INSERT INTO presence_clients(session_token,client_id,seen_at) SELECT token,?,? FROM sessions WHERE token=? AND expires>? ON CONFLICT(session_token,client_id) DO UPDATE SET seen_at=excluded.seen_at`,clientId,now,token,now);
 await run('DELETE FROM presence_clients WHERE seen_at<?',now-PRESENCE_TTL);
}
