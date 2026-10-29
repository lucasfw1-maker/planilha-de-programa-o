import http from 'node:http';
import contactHandler from './lib/contact.mjs';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('./public/',import.meta.url))),mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'");
 if(new URL(req.url,'http://localhost').pathname==='/api/contact')return contactHandler(req,res);
 try{if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(root+sep)&&file!==resolve(root,'index.html')){res.writeHead(403);res.end();return;}
  if(!(await stat(file)).isFile())throw Error('Not found');res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');const data=await readFile(file);res.writeHead(200);res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Página não encontrada.');}
});server.listen(Number(process.env.PORT||4173),'0.0.0.0',()=>console.log('ConcretLog site na porta '+server.address().port));
