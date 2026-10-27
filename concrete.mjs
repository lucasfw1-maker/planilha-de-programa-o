import slumpFormat from './public/slump-format.js';
const {normalizeSlump}=slumpFormat;
export const GRAVEL_OPTIONS=['1+0','0','2','Massa Preta'];
export function gravelValue(value,{legacy=false}={}){
 if(typeof value!=='string'||!value.trim()||value.length>200)throw Object.assign(new Error('Selecione a brita.'),{status:400});
 const raw=value.trim(),clean=raw.replace(/^brita\s*/i,''),found=GRAVEL_OPTIONS.find(option=>option.toLocaleLowerCase('pt-BR')===clean.toLocaleLowerCase('pt-BR'));
 if(found)return found;
 if(legacy)return raw;
 throw Object.assign(new Error('Escolha a brita: 1+0, 0, 2 ou Massa Preta.'),{status:400});
}
export function slumpValue(value){
 if(value===undefined||value===null)return '';
 if(typeof value!=='string'&&(typeof value!=='number'||!Number.isFinite(value)))throw Object.assign(new Error('Informe o slump corretamente.'),{status:400});
 const raw=String(value).trim(),result=normalizeSlump(raw);
 if(raw.length>60||result.length>60)throw Object.assign(new Error('Informe até 60 caracteres para o slump.'),{status:400});
 return result;
}
