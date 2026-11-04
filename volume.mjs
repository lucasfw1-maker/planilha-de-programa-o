export function volumeValue(value,label='Volume',min=0,max=100000){
 const amount=typeof value==='number'||typeof value==='string'&&value.trim()!==''?Number(value):NaN;
 if(!Number.isFinite(amount)||amount<min||amount>max)throw Object.assign(new Error(`${label}: informe um volume válido${min>0?' a partir de '+min.toLocaleString('pt-BR')+' m³':''}.`),{status:400});
 if(!Number.isInteger(amount*2))throw Object.assign(new Error(`${label}: use múltiplos de 0,5 m³. Exemplos: 3; 3,5; 4; 4,5.`),{status:400});
 return amount;
}
