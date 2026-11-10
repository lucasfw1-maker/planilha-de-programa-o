import {query,one,run,transaction} from './storage.mjs';
import {customerKey} from './customers.mjs';
import {isPresentationTarget} from './presentation-seed.mjs';
export const workCodeCampaign='work-codes-by-address-20261110';
const key=value=>customerKey(value),numeric=value=>/^\d+$/.test(value)?BigInt(value).toString():null;
export function planWorkCodes(rows){
 const reserved=new Set(rows.map(a=>numeric(String(a.customer_code||'').trim())).filter(v=>v!==null)),groups=new Map(),changes=[],skipped=[];
 for(const a of [...rows].sort((a,b)=>a.id-b.id)){
  if(!key(a.work))continue;
  const customer=JSON.stringify([a.seller_id,key(a.customer)]);if(!groups.has(customer))groups.set(customer,new Map());
  const works=groups.get(customer),address=key(a.work);if(!works.has(address))works.set(address,[]);works.get(address).push(a);
 }
 for(const works of groups.values()){
  const entries=[...works.values()];if(entries.length<2)continue;
  const originals=entries.map(list=>[...list].reverse().find(a=>String(a.customer_code||'').trim())?.customer_code||'');
  const base=originals.find(code=>numeric(code)!==null);if(base===undefined){if(originals.some(Boolean))skipped.push(entries[0][0].customer);continue;}
  const used=new Set();
  // Reserve existing distinct codes before allocating numbers for duplicate/blank works.
  const keep=originals.map(code=>{if(!code)return false;const n=numeric(code),identity=n===null?'text:'+code:'number:'+n;if(used.has(identity))return false;used.add(identity);return true;});
  let candidate=BigInt(base);
  for(let i=0;i<entries.length;i++){
   let code=originals[i];
   if(!keep[i]){do{candidate++;}while(reserved.has(candidate.toString()));code=candidate.toString();if(base.startsWith('0'))code=code.padStart(base.length,'0');reserved.add(candidate.toString());}
   for(const a of entries[i])if(String(a.customer_code||'')!==code)changes.push({id:a.id,customer:a.customer,seller_id:a.seller_id,work:a.work,before:a.customer_code||'',after:code,information_version:a.information_version});
  }
 }
 return {changes,skipped};
}
export async function normalizeWorkCodes(user,campaign){
 if(!isPresentationTarget(user))throw Object.assign(new Error('Correção disponível somente para o Programador responsável.'),{status:403});
 if(campaign!==workCodeCampaign)throw Object.assign(new Error('Correção inválida.'),{status:400});
 return transaction(async()=>{
  const done=await one('SELECT value FROM settings WHERE key=?',campaign);if(done)return {already_applied:true,...JSON.parse(done.value)};
  const plan=planWorkCodes(await query('SELECT id,customer,seller_id,work,customer_code,information_version FROM appointments ORDER BY id'));
  const summary={updated:plan.changes.length,works:new Set(plan.changes.map(a=>JSON.stringify([a.seller_id,key(a.customer),key(a.work)]))).size,skipped:plan.skipped};
  // This audit is the backup of every previous code. It commits atomically with the changes.
  await run('INSERT INTO audit(user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',user.id,'separar códigos por obra','correcao_codigos',null,JSON.stringify({campaign,...summary,changes:plan.changes}));
  for(let offset=0;offset<plan.changes.length;offset+=150){
   const batch=plan.changes.slice(offset,offset+150);
   await run(`UPDATE appointments SET customer_code=CASE id ${batch.map(()=>'WHEN ? THEN ?').join(' ')} END,information_version=information_version+1 WHERE id IN (${batch.map(()=>'?').join(',')})`,...batch.flatMap(a=>[a.id,a.after]),...batch.map(a=>a.id));
  }
  await run('INSERT INTO settings(key,value) VALUES(?,?)',campaign,JSON.stringify(summary));
  return {already_applied:false,...summary};
 });
}
