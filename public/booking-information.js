(function(root){'use strict';
 const fields={customer_code:'Código do cliente',order_code:'Código do pedido',order_item:'Item do pedido',contact_name:'Nome do contato',contact_phone:'Telefone do contato',slump:'Slump'};
 function missing(a){return Object.entries(fields).filter(([key])=>!String(a?.[key]??'').trim()).map(([,label])=>label);}
 function complete(a){return missing(a).length===0;}
 function clock(now=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
  const minute=Number(parts.hour)*60+Number(parts.minute);return {date:`${parts.year}-${parts.month}-${parts.day}`,slot:minute>=960&&minute<1020?Math.floor((minute-960)/15):null};
 }
 function nextDate(date){const day=new Date(date+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+1);return day.toISOString().slice(0,10);}
 const api={missing,complete,clock,nextDate};if(typeof module==='object'&&module.exports)module.exports=api;else root.BookingInformation=api;
})(typeof globalThis==='object'?globalThis:this);
