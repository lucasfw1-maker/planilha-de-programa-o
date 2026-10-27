import {one,query,run,transaction} from './storage.mjs';
export const branches=['pacaembu','aeroporto'];
export function checkBranch(value,all=false){if(all&&(value===undefined||value===''))return '';if(!branches.includes(value))throw Object.assign(new Error('Escolha Filial Pacaembu ou Filial Aeroporto.'),{status:400});return value;}
export function plateValue(value=''){if(typeof value!=='string')throw Object.assign(new Error('Placa inválida.'),{status:400});const plate=value.toUpperCase().replace(/[^A-Z0-9]/g,'');if(plate&&!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate))throw Object.assign(new Error('Informe uma placa válida, por exemplo ABC-1234 ou ABC1D23.'),{status:400});return plate;}
export function cbCode(value){const number=String(value??'').trim().replace(/^CB[\s•-]*/i,'');if(!/^\d{1,6}$/.test(number)||Number(number)<1)throw Object.assign(new Error('Informe somente o número do CB, maior que zero.'),{status:400});return 'CB•'+String(Number(number)).padStart(2,'0');}
export function capacityValue(value){const capacity=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value.replace(',','.')):NaN;if(!Number.isFinite(capacity)||capacity<=0||capacity>100)throw Object.assign(new Error('Informe uma capacidade de carga válida em m³ (maior que zero e até 100).'),{status:400});return capacity;}
export async function equipmentState(u,kind,id,b){
 if(!['programador','gerente','gerente_concresuper'].includes(u.role))throw Object.assign(new Error('Somente Gerente e Programador podem editar os equipamentos.'),{status:403});
 return transaction(async()=>{
 const table=kind==='bomba'?'pumps':'maintenance_cbs',old=await one('SELECT * FROM '+table+' WHERE id=?',id);if(!old)throw Object.assign(new Error('Equipamento não encontrado.'),{status:404});
 const active=b.active===undefined?old.active:b.active;if(![true,false,0,1].includes(active))throw Object.assign(new Error('Situação inválida.'),{status:400});
 if(!active&&kind==='bomba'&&await one("SELECT id FROM appointments WHERE pump_id=? AND status IN ('confirmado','andamento') AND date>=?",id,new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())))throw Object.assign(new Error('Há obras futuras nessa bomba. Reprograme ou cancele essas obras antes de inativar.'),{status:409});
 const plate=b.plate===undefined?old.plate:plateValue(b.plate),branch=b.branch===undefined?old.branch:checkBranch(b.branch);
 if(plate&&await one('SELECT id FROM '+table+' WHERE plate=? AND id<>?',plate,id))throw Object.assign(new Error('Essa placa já está cadastrada em outro equipamento.'),{status:409});
 if(kind==='cb'&&b.capacity_m3!==undefined)await run('UPDATE maintenance_cbs SET capacity_m3=? WHERE id=?',capacityValue(b.capacity_m3),id);
 await run('UPDATE '+table+' SET active=?,plate=?,branch=? WHERE id=?',active?1:0,plate,branch,id);
 if(kind==='cb')await run('INSERT INTO cb_fleet_history(cb_id,effective_date,active,branch) VALUES(?,?,?,?) ON CONFLICT(cb_id,effective_date) DO UPDATE SET active=excluded.active,branch=excluded.branch',id,new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),active?1:0,branch);
 await run('INSERT INTO audit(user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',u.id,active?'atualizar equipamento':'inativar equipamento',kind,id,JSON.stringify({before:old,after:{...old,active:active?1:0,plate,branch,...(kind==='cb'&&b.capacity_m3!==undefined?{capacity_m3:capacityValue(b.capacity_m3)}:{})}}));return {ok:true};
 });
}
