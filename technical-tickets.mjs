import {query,one,run,transaction} from './storage.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export const ticketsAccess=u=>['vendedor','engenharia','gerente_engenharia','programador','gerente_concresuper'].includes(u.role);
const engineer=u=>['engenharia','gerente_engenharia','programador','gerente_concresuper'].includes(u.role);
const reporting=u=>['gerente_engenharia','programador','gerente_concresuper'].includes(u.role);
const text=(value,label,max=200,optional=false)=>{if(optional&&(value===undefined||value===null||value===''))return '';if(typeof value!=='string'||(!optional&&!value.trim())||value.length>max)fail('Informe '+label+' (até '+max+' caracteres).');return value.trim();};
const day=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)fail('Data inválida.');return value;};
const localDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const select='SELECT t.*,s.name seller_name,sp.version seller_photo_version,c.name creator_name,a.name attended_by_name,ap.version attended_photo_version,assigned.name assigned_name,assigned.role assigned_role,assignedPhoto.version assigned_photo_version,a.role attended_role FROM technical_tickets t JOIN users s ON s.id=t.seller_id JOIN users c ON c.id=t.created_by LEFT JOIN users a ON a.id=t.attended_by LEFT JOIN user_photos sp ON sp.user_id=t.seller_id LEFT JOIN user_photos ap ON ap.user_id=t.attended_by LEFT JOIN users assigned ON assigned.id=t.assigned_by LEFT JOIN user_photos assignedPhoto ON assignedPhoto.user_id=t.assigned_by';
async function ticket(id,u){const row=await one(select+' WHERE t.id=?',id);if(!row||(u.role==='vendedor'&&row.seller_id!==u.id))fail('Chamado não encontrado.',404);return row;}
function attachments(values,u){
 if(values===undefined)return [];if(!Array.isArray(values)||values.length>5)fail('Envie até 5 anexos por mensagem.');let total=0;
 return values.map(a=>{
  if(!a||typeof a!=='object'||Array.isArray(a))fail('Anexo inválido.');
  const name=text(a.name,'o nome do anexo',180).replace(/[\x00-\x1f\x7f/\\]/g,'_'),mime=a.mime;
  if(!['image/jpeg','image/png','image/webp',...(engineer(u)?['application/pdf']:[])].includes(mime))fail(engineer(u)?'Envie imagens JPEG, PNG, WebP ou PDF.':'O vendedor pode anexar apenas imagens JPEG, PNG ou WebP.');
  if(typeof a.data!=='string'||a.data.length>1400000||!a.data.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(a.data))fail('Anexo inválido.');
  const bytes=Buffer.from(a.data,'base64');if(bytes.toString('base64')!==a.data)fail('Anexo inválido.');const size=bytes.length;total+=size;if(size>1000000||total>2000000)fail('Cada anexo deve ter até 1 MB, com limite de 2 MB por mensagem.',413);
  const valid=mime==='image/jpeg'?size>4&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217:mime==='image/png'?size>24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/webp'?size>16&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP':size>12&&bytes.toString('ascii',0,5)==='%PDF-'&&bytes.subarray(-1024).includes(Buffer.from('%%EOF'));
  if(!valid)fail('O conteúdo do anexo não corresponde ao formato informado.');return {name,mime,size,data:a.data};
 });
}
async function saveAttachments(ticketId,messageId,files,u){for(const f of files)await run('INSERT INTO technical_ticket_attachments(ticket_id,message_id,name,mime,size,data_base64,created_by) VALUES(?,?,?,?,?,?,?)',ticketId,messageId,f.name,f.mime,f.size,f.data,u.id);}
async function audit(u,action,id,detail){await run('INSERT INTO audit(user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',u.id,action,'chamado_tecnico_comercial',id,JSON.stringify(detail));}
export async function technicalTicketsApi({path,method,url,u,res,body}){
 if(!ticketsAccess(u))fail('Sem acesso aos chamados técnico/comerciais.',403);
 const route=path.slice('/api/technical-tickets'.length)||'/';
 if(route==='/meta'&&method==='GET')return {types:[{value:'tecnico',label:'Técnico'},{value:'comercial',label:'Comercial'}],sellers:['programador','gerente_concresuper'].includes(u.role)?await query("SELECT id,name FROM users WHERE role='vendedor' AND active=1 AND status='aprovado' ORDER BY name"):[],customers:u.role==='vendedor'?await query('SELECT name,customer_code FROM customers WHERE seller_id=? ORDER BY name',u.id):[]};
 if(route==='/report'&&method==='GET'){
  if(!reporting(u))fail('Somente Gerente Engenharia e Programador podem gerar os indicadores de chamados.',403);
  const from=day(url.searchParams.get('from')),to=day(url.searchParams.get('to'));if(from>to)fail('Confira o período do relatório.');
  const rows=await query(select+' WHERE t.created_date BETWEEN ? AND ? OR t.attended_date BETWEEN ? AND ? ORDER BY t.created_at,t.id',from,to,from,to),created=rows.filter(t=>t.created_date>=from&&t.created_date<=to),attended=rows.filter(t=>t.attended_date&&t.attended_date>=from&&t.attended_date<=to),createdIds=new Set(created.map(t=>t.id)),attendedIds=new Set(attended.map(t=>t.id)),bySeller=new Map(),byType=new Map();
  for(const t of rows){if(!bySeller.has(t.seller_id))bySeller.set(t.seller_id,{id:t.seller_id,name:t.seller_name,opened:0,attended:0});if(!byType.has(t.type))byType.set(t.type,{type:t.type,opened:0,attended:0});if(createdIds.has(t.id)){bySeller.get(t.seller_id).opened++;byType.get(t.type).opened++;}if(attendedIds.has(t.id)){bySeller.get(t.seller_id).attended++;byType.get(t.type).attended++;}}
  return {from,to,total_created:created.length,total_attended:attended.length,pending_created:created.filter(t=>t.status!=='atendido').length,in_progress:created.filter(t=>t.status==='em_atendimento').length,by_seller:[...bySeller.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),by_type:[...byType.values()],tickets:rows};
 }
 const photo=route.match(/^\/(\d+)\/photos\/(\d+)$/);
 if(photo&&method==='GET'){
  const row=await ticket(Number(photo[1]),u),userId=Number(photo[2]);if(userId!==row.seller_id&&userId!==row.created_by&&userId!==row.attended_by&&userId!==row.assigned_by&&!await one('SELECT id FROM technical_ticket_messages WHERE ticket_id=? AND author_id=?',row.id,userId))fail('Foto não encontrada.',404);
  const picture=await one('SELECT image FROM user_photos WHERE user_id=?',userId);if(!picture)fail('Foto não encontrada.',404);res.setHeader('Content-Type','image/jpeg');res.setHeader('Cache-Control','private, no-store');res.end(Buffer.from(picture.image.split(',')[1],'base64'));return;
 }
 const attachment=route.match(/^\/attachments\/(\d+)$/);
 if(attachment&&method==='GET'){
  const f=await one('SELECT * FROM technical_ticket_attachments WHERE id=?',Number(attachment[1]));if(!f)fail('Anexo não encontrado.',404);await ticket(f.ticket_id,u);
  res.setHeader('Content-Type',f.mime);res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Disposition',(f.mime==='application/pdf'||url.searchParams.get('download')==='1'?'attachment':'inline')+"; filename*=UTF-8''"+encodeURIComponent(f.name));res.end(Buffer.from(f.data_base64,'base64'));return;
 }
 if(route==='/'&&method==='GET'){
  const status=url.searchParams.get('status')||'aberto';if(!['aberto','em_atendimento','atendido','todos'].includes(status))fail('Situação inválida.');
  return query(select+" WHERE (?='todos' OR t.status=?) AND (?<>'vendedor' OR t.seller_id=?) ORDER BY t.created_at DESC,t.id DESC",status,status,u.role,u.id);
 }
 if(route==='/'&&method==='POST'){
  if(!['vendedor','programador','gerente_concresuper'].includes(u.role))fail('Somente o vendedor ou Programador pode abrir chamados.',403);
  const b=await body(),sellerId=u.role==='vendedor'?u.id:Number(b.seller_id);if(!await one("SELECT id FROM users WHERE id=? AND role='vendedor' AND active=1 AND status='aprovado'",sellerId))fail('Selecione um vendedor aprovado.');
  const fields={customer:text(b.customer,'o nome do cliente').toLocaleUpperCase('pt-BR'),customer_code:text(b.customer_code,'o código do cliente',60),order_code:text(b.order_code,'o número do pedido',60),mix_code:text(b.mix_code,'o traço',100,true),order_item:text(b.order_item,'o item',60,true),concreting_date:day(b.concreting_date),type:b.type,description:text(b.description,'a descrição do chamado',10000)};if(!['tecnico','comercial'].includes(fields.type))fail('Selecione o tipo do chamado.');const files=attachments(b.attachments,u);if(files.some(f=>f.mime==='application/pdf'))fail('Na abertura do chamado, envie somente imagens.');
  return transaction(async()=>{const stamp=new Date().toISOString(),id=Number((await run('INSERT INTO technical_tickets(seller_id,created_by,customer,customer_code,order_code,mix_code,order_item,concreting_date,type,created_at,created_date) VALUES(?,?,?,?,?,?,?,?,?,?,?)',sellerId,u.id,fields.customer,fields.customer_code,fields.order_code,fields.mix_code,fields.order_item,fields.concreting_date,fields.type,stamp,localDay())).lastInsertRowid),messageId=Number((await run("INSERT INTO technical_ticket_messages(ticket_id,author_id,body,kind,created_at) VALUES(?,?,?,'abertura',?)",id,u.id,fields.description,stamp)).lastInsertRowid);await saveAttachments(id,messageId,files,u);await audit(u,'abrir chamado',id,{...fields,attachments:files.map(({name,mime,size})=>({name,mime,size}))});return ticket(id,u);});
 }
 const match=route.match(/^\/(\d+)(?:\/(messages|accept))?$/);if(!match)fail('Recurso não encontrado.',404);const id=Number(match[1]),action=match[2];
 if(method==='GET'&&!action){const row=await ticket(id,u),messages=await query('SELECT m.id,m.author_id,u.name author_name,u.role author_role,p.version photo_version,m.body,m.kind,m.created_at FROM technical_ticket_messages m JOIN users u ON u.id=m.author_id LEFT JOIN user_photos p ON p.user_id=u.id WHERE ticket_id=? ORDER BY m.id',id),files=await query('SELECT id,message_id,name,mime,size FROM technical_ticket_attachments WHERE ticket_id=? ORDER BY id',id);return {...row,messages:messages.map(m=>({...m,attachments:files.filter(f=>f.message_id===m.id)}))};}
 if(method==='POST'&&action==='accept'){
  if(!engineer(u))fail('Somente a Engenharia pode assumir o atendimento.',403);const b=await body();return transaction(async()=>{const row=await ticket(id,u);if(row.status!=='aberto'||row.assigned_by)fail('Este chamado já foi assumido ou atendido. Atualize a página para ver o responsável.',409);if(Number(b.expected_revision)!==row.revision)fail('O chamado mudou. Abra novamente antes de assumir.',409);await run("UPDATE technical_tickets SET status='em_atendimento',assigned_by=?,assigned_at=?,revision=revision+1 WHERE id=?",u.id,new Date().toISOString(),id);await audit(u,'assumir atendimento',id,{});return ticket(id,u);});
 }
 if(method==='POST'&&action==='messages'){
  const b=await body(),files=attachments(b.attachments,u),message=text(b.message,'a resposta',10000,true),resolve=b.resolve===true;if(!message&&!files.length)fail('Escreva uma mensagem ou adicione um anexo.');if(b.resolve!==undefined&&typeof b.resolve!=='boolean')fail('Situação de atendimento inválida.');if(resolve&&!engineer(u))fail('Somente a Engenharia pode marcar o chamado como atendido.',403);
  return transaction(async()=>{const row=await ticket(id,u);if(engineer(u)&&row.assigned_by!==u.id)fail(row.assigned_by?'Este chamado está sob atendimento de '+row.assigned_name+'.':'Assuma o atendimento antes de responder.',409);if(Number(b.expected_revision)!==row.revision)fail('O chamado recebeu uma atualização. Abra novamente antes de responder.',409);if(u.role==='vendedor'&&row.status==='atendido')fail('Este chamado já foi atendido.',409);const stamp=new Date().toISOString(),messageId=Number((await run('INSERT INTO technical_ticket_messages(ticket_id,author_id,body,kind,created_at) VALUES(?,?,?,?,?)',id,u.id,message,engineer(u)?'resposta':'complemento',stamp)).lastInsertRowid);await saveAttachments(id,messageId,files,u);await run("UPDATE technical_tickets SET revision=revision+1,status=CASE WHEN ?=1 THEN 'atendido' ELSE status END,attended_at=CASE WHEN ?=1 AND attended_at IS NULL THEN ? ELSE attended_at END,attended_date=CASE WHEN ?=1 AND attended_date IS NULL THEN ? ELSE attended_date END,attended_by=CASE WHEN ?=1 AND attended_by IS NULL THEN ? ELSE attended_by END WHERE id=?",resolve?1:0,resolve?1:0,stamp,resolve?1:0,localDay(),resolve?1:0,u.id,id);await audit(u,resolve?'atender chamado':'responder chamado',id,{message,attachments:files.map(({name,mime,size})=>({name,mime,size}))});return ticket(id,u);});
 }
 fail('Operação inválida.',405);
}
