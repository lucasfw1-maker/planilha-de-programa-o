export function contactFields(input,fallback={}){
 const result={};
 for(const [field,label,limit] of [['contact_name','Nome do contato',120],['contact_phone','Telefone do contato',40]]){
  const value=input[field]===undefined?(fallback[field]||''):input[field];
  if(typeof value!=='string'||value.length>limit)throw Object.assign(new Error(`${label}: informe até ${limit} caracteres.`),{status:400});
  result[field]=value.trim();
 }
 if(result.contact_phone){
  if(!/^[0-9+().\s-]+$/.test(result.contact_phone))throw Object.assign(new Error('Informe um telefone válido, incluindo o DDD.'),{status:400});
  let digits=result.contact_phone.replace(/\D/g,'');
  if([12,13].includes(digits.length)&&digits.startsWith('55'))digits=digits.slice(2);
  if(![10,11].includes(digits.length))throw Object.assign(new Error('Informe o DDD e um telefone com 10 ou 11 dígitos.'),{status:400});
  result.contact_phone=digits.length===11?`(${digits.slice(0,2)}) ${digits[2]} ${digits.slice(3,7)}-${digits.slice(7)}`:`(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
 }
 return result;
}
