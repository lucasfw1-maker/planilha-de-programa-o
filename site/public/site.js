'use strict';
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const config=window.CONCRETLOG_SITE||{},dialog=$('#info-dialog'),dialogContent=$('#dialog-content');
const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const channels={whatsapp:null,instagram:null,email:null};
const phone=String(config.whatsapp||'').replace(/\D/g,'');
if(/^55\d{10,11}$/.test(phone))channels.whatsapp='https://wa.me/'+phone+'?text='+encodeURIComponent('Olá! Tenho interesse em conhecer o ConcretLog para minha concreteira. Podemos conversar sobre uma demonstração?');
if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email||''))channels.email='mailto:'+encodeURIComponent(config.email)+'?subject='+encodeURIComponent('Demonstração do ConcretLog');
try{const profile=new URL(config.instagram);if(profile.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(profile.hostname)&&profile.pathname!=='/')channels.instagram=profile.href;}catch{}
for(const [name,url] of Object.entries(channels))if(url){
 const original=$(`[data-channel="${name}"]`),link=document.createElement('a');link.className=original.className;link.dataset.channel=name;link.href=url;link.innerHTML=original.innerHTML;link.querySelector('small').textContent=name==='instagram'?'Acompanhe':name==='email'?'Escreva para nós':'Vamos conversar';
 if(name!=='email'){link.target='_blank';link.rel='noopener noreferrer';}original.replaceWith(link);
}
function closeMenu(){const menu=$('#site-nav'),toggle=$('.menu-toggle');menu.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Abrir menu');$('use',toggle).setAttribute('href','#i-menu');}
$('.menu-toggle').addEventListener('click',()=>{const open=$('.menu-toggle').getAttribute('aria-expanded')!=='true';$('#site-nav').classList.toggle('open',open);$('.menu-toggle').setAttribute('aria-expanded',String(open));$('.menu-toggle').setAttribute('aria-label',open?'Fechar menu':'Abrir menu');$('use',$('.menu-toggle')).setAttribute('href',open?'#i-close':'#i-menu');});
$$('#site-nav a,.site-header .brand').forEach(link=>link.addEventListener('click',closeMenu));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('#site-nav').classList.contains('open')){closeMenu();$('.menu-toggle').focus();}});
document.addEventListener('click',event=>{if(!event.target.closest('.site-header'))closeMenu();});
window.matchMedia('(min-width:851px)').addEventListener('change',event=>{if(event.matches)closeMenu();});
const tabs=$$('[data-preview]');
function activatePreview(tab,focus=false){for(const item of tabs){const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;const panel=$('#'+item.getAttribute('aria-controls'));panel.hidden=!selected;panel.tabIndex=selected?0:-1;}if(focus)tab.focus();}
for(const tab of tabs){tab.addEventListener('click',()=>activatePreview(tab));tab.addEventListener('keydown',event=>{let index=tabs.indexOf(tab);if(event.key==='ArrowRight')index=(index+1)%tabs.length;else if(event.key==='ArrowLeft')index=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')index=0;else if(event.key==='End')index=tabs.length-1;else return;event.preventDefault();activatePreview(tabs[index],true);});}
function showDialog(html){closeMenu();dialogContent.innerHTML=html;if(!dialog.open)dialog.showModal();document.body.classList.add('modal-open');}
function closeDialog(){dialog.close();}
$('.dialog-close').addEventListener('click',closeDialog);
dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();});
dialog.addEventListener('close',()=>{if(!dialog.open)document.body.classList.remove('modal-open');});
$$('[data-demo]').forEach(button=>button.addEventListener('click',()=>{
 const available=Object.values(channels).some(Boolean);
 showDialog(`<div class="dialog-icon">${icon('mixer')}</div><p class="eyebrow">VAMOS MOVIMENTAR SUA OPERAÇÃO</p><h2 id="dialog-title">${available?'Conheça o ConcretLog.':'Demonstrações em breve.'}</h2><p>${available?'Escolha um canal para conversar sobre a sua concreteira e solicitar uma demonstração.':'Estamos preparando nossos canais para apresentar o ConcretLog de perto. Em breve, você poderá agendar uma demonstração por aqui.'}</p><div class="dialog-channels">${$('.contact-channels').innerHTML}</div><a class="button button-primary" href="#modulos" id="dialog-modules">Enquanto isso, conheça os módulos ${icon('arrow')}</a>`);
 $('#dialog-modules').addEventListener('click',closeDialog);
}));
const features={
 logistics:{icon:'mixer',title:'Cada concretagem, no seu lugar.',intro:'Uma programação compartilhada entre as áreas, com as informações que acompanham cada atendimento.',items:['Consulte a agenda por dia, semana ou mês.','Verifique bombas disponíveis e períodos de manutenção.','Registre solicitações e acompanhe as aprovações.','Gere a programação de carregamentos da data desejada.']},
 commercial:{icon:'users',title:'O relacionamento não termina na entrega.',intro:'Organize as informações do cliente e acompanhe as próximas oportunidades de concretagem.',items:['Salve clientes, contatos e várias obras por cliente.','Acompanhe contratos ativos e datas de retorno.','Registre o que foi conversado e programe o próximo contato.','Consulte o histórico de agendamentos, remarcações e cancelamentos.']},
 results:{icon:'chart',title:'Mais contexto para a gestão.',intro:'Acompanhe as informações registradas pela equipe e enxergue melhor a evolução da sua operação.',items:['Compare volumes programados e entregues por vendedor.','Consulte metas anteriores e futuras e seus percentuais.','Acompanhe o volume previsto e entregue por caminhão betoneira.','Gere relatórios em PDF e exporte os dados em CSV.']},
 laboratory:{icon:'lab',title:'Laboratório de concreto.',intro:'Estamos planejando uma nova frente para conectar o controle tecnológico à rotina da concreteira.',items:['Cadastro de amostras e corpos de prova.','Acompanhamento de ensaios, prazos e resultados.','Histórico vinculado à obra e à concretagem.','Indicadores e relatórios para o laboratório.'],upcoming:true}
};
$$('[data-feature]').forEach(button=>button.addEventListener('click',()=>{const feature=features[button.dataset.feature];showDialog(`<div class="dialog-icon">${icon(feature.icon)}</div>${feature.upcoming?'<span class="feature-status">Em desenvolvimento</span>':''}<h2 id="dialog-title">${feature.title}</h2><p>${feature.intro}</p><ul>${feature.items.map(item=>'<li>'+item+'</li>').join('')}</ul>${feature.upcoming?'<p>Recursos previstos. Este módulo ainda não está disponível no sistema.</p>':''}<button class="button button-primary" id="feature-contact">${feature.upcoming?'Conhecer as outras soluções':'Solicitar demonstração'} ${icon('arrow')}</button>`);$('#feature-contact').addEventListener('click',()=>{closeDialog();if(feature.upcoming)document.getElementById('modulos').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});else $('[data-demo]').click();});}));
$('#privacy-open').addEventListener('click',()=>showDialog(`<p class="eyebrow">TRANSPARÊNCIA</p><h2 id="dialog-title">Sua privacidade.</h2><p>Esta versão do site não tem formulário de cadastro, ferramentas de análise ou cookies de publicidade. A navegação não solicita seus dados pessoais.</p><p>Quando os canais de contato estiverem ativos, você escolherá se deseja enviar uma mensagem pelo serviço correspondente, como WhatsApp, Instagram ou e-mail. Os dados da conversa serão enviados diretamente ao canal escolhido.</p><p>A hospedagem pode manter registros técnicos necessários para o funcionamento e a segurança do site.</p>`));
$('#year').textContent=new Date().getFullYear();
const sectionLinks=$$('#site-nav a');
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!visible)return;for(const link of sectionLinks){if(link.hash==='#'+visible.target.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}},{rootMargin:'-15% 0px -40% 0px',threshold:[0,.2,.5]});sectionLinks.forEach(link=>{const section=$(link.hash);if(section)observer.observe(section);});}
