import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import nodemailer from 'nodemailer';

export const CONTACT_RECIPIENT='comercial@concretlog.com.br';
export const CONTACT_SUBJECT='Solicitar demonstração';
const WINDOW=15*60*1000,MAX_BODY=32768;
const emailPattern=/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
function configuration(env){
 const host=(env.CONTACT_SMTP_HOST||'').trim(),user=(env.CONTACT_SMTP_USER||'').trim(),pass=env.CONTACT_SMTP_PASSWORD||'',port=Number(env.CONTACT_SMTP_PORT||465);
 if(!host||!emailPattern.test(user)||!pass||![465,587].includes(port))return null;
 return {host,port,user,pass};
}
export function validateContact(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Confira os campos da mensagem.');
 const field=(key,max)=>{const value=input[key];if(typeof value!=='string'||value.length>max||!value.trim())fail('Preencha e-mail, telefone, assunto e mensagem.');return value.trim();};
 if(input.website)fail('Não foi possível enviar esta mensagem.');
 const email=field('email',254),phone=field('phone',35),subject=field('subject',150),message=field('message',5000);
 if(!emailPattern.test(email))fail('Informe um e-mail válido.');
 if(/[\r\n]/.test(subject)||/[\r\n]/.test(phone))fail('Confira o assunto e o telefone.');
 if(!/^[+()\d\s.\-]+$/.test(phone)||!/^\d{10,15}$/.test(phone.replace(/\D/g,'')))fail('Informe o telefone com DDD.');
 return {email,phone,subject,message};
}
function allowedOrigin(req,env){
 const origin=req.headers.origin;if(!origin)return false;
 const allowed=new Set([env.CONTACT_SITE_ORIGIN||'https://concretlog.com.br','https://www.concretlog.com.br']);
 if(env.VERCEL_URL)allowed.add('https://'+env.VERCEL_URL);
 if(env.NODE_ENV!=='production'&&/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host||''))allowed.add('http://'+req.headers.host);
 return allowed.has(origin);
}
async function jsonBody(req){
 if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))fail('Formato de mensagem inválido.',415);
 if(req.body!==undefined){const value=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(value)>MAX_BODY)fail('A mensagem é muito grande.',413);try{return typeof req.body==='string'?JSON.parse(value):req.body;}catch{fail('Mensagem inválida.');}}
 const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>MAX_BODY)fail('A mensagem é muito grande.',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('Mensagem inválida.');}
}
function signature(payload,secret){return createHmac('sha256',secret).update(payload).digest('base64url');}
function issueToken(secret,now){const payload=now+'.'+randomBytes(18).toString('base64url');return payload+'.'+signature(payload,secret);}
function verifyToken(token,secret,now){
 if(typeof token!=='string'||token.length>180)return false;const parts=token.split('.');if(parts.length!==3||!/^\d+$/.test(parts[0]))return false;const age=now-Number(parts[0]);if(age<0||age>60*60*1000)return false;const expected=Buffer.from(signature(parts[0]+'.'+parts[1],secret)),provided=Buffer.from(parts[2]);return provided.length===expected.length&&timingSafeEqual(provided,expected);
}
export function createContactHandler({env=process.env,sendMail,now=Date.now}={}){
 const clients=new Map(),deliveries=new Map();let transport,transportKey;
 function reply(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(body));}
 function limit(req){const at=now(),key=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,100);for(const [id,item] of clients)if(item.until<=at)clients.delete(id);for(const [id,item] of deliveries)if(item.until<=at)deliveries.delete(id);let item=clients.get(key);if(!item){if(clients.size>=2000)fail('Tente novamente em alguns minutos.',429);item={until:at+WINDOW,count:0};clients.set(key,item);}if(item.count>=5)fail('Você enviou várias mensagens. Aguarde alguns minutos e tente novamente.',429);item.count++;}
 return async function contactHandler(req,res){try{
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return reply(res,405,{error:'Método não permitido.'});}
  const config=configuration(env);
  if(req.method==='GET'){if(!config)return reply(res,200,{available:false});return reply(res,200,{available:true,token:issueToken(config.pass,now())});}
  if(!allowedOrigin(req,env))return reply(res,403,{error:'Abra o formulário pelo site ConcretLog.'});
  if(!config)return reply(res,503,{error:'O envio está temporariamente indisponível. Tente novamente mais tarde ou escreva para '+CONTACT_RECIPIENT+'.'});
  const input=await jsonBody(req),data=validateContact(input);
  if(!verifyToken(input.token,config.pass,now()))return reply(res,400,{error:'O formulário expirou. Feche e abra novamente para enviar.'});
  const digest=createHmac('sha256',config.pass).update(JSON.stringify(data)).digest('hex'),previous=deliveries.get(input.token);
  if(previous){if(previous.digest!==digest)return reply(res,409,{error:'Abra uma nova mensagem para alterar os dados após o envio.'});await previous.promise;return reply(res,200,{sent:true});}
  limit(req);
  const mail={from:{name:'ConcretLog — Site',address:config.user},to:CONTACT_RECIPIENT,replyTo:data.email,subject:data.subject,text:'Mensagem recebida pelo site ConcretLog\n\nE-mail para resposta: '+data.email+'\nTelefone: '+data.phone+'\nAssunto: '+data.subject+'\n\nMensagem:\n'+data.message+'\n'};
  const delivery={digest,until:now()+WINDOW,promise:null};
  delivery.promise=(async()=>{try{
   let result;if(sendMail)result=await sendMail(mail);else{const key=JSON.stringify(config);if(!transport||transportKey!==key){transport=nodemailer.createTransport({host:config.host,port:config.port,secure:config.port===465,requireTLS:true,auth:{user:config.user,pass:config.pass},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false});transportKey=key;}result=await transport.sendMail(mail);}
   if(!result?.accepted?.some(value=>String(value).toLowerCase()===CONTACT_RECIPIENT))throw Error('SMTP não aceitou o destinatário.');
  }catch{deliveries.delete(input.token);fail('Não foi possível enviar agora. Sua mensagem foi mantida; tente novamente ou escreva para '+CONTACT_RECIPIENT+'.',502);}})();
  deliveries.set(input.token,delivery);try{await delivery.promise;}catch(error){if(deliveries.get(input.token)===delivery)deliveries.delete(input.token);throw error;}return reply(res,200,{sent:true});
 }catch(error){return reply(res,error.status||500,{error:error.status?error.message:'Não foi possível enviar agora. Tente novamente mais tarde.'});}};
}
export default createContactHandler();
