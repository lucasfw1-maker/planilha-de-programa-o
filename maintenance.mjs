export function slotWindow(date,start,duration){
  const end=new Date(Date.parse(date+'T'+start+':00Z')+Number(duration)*60000).toISOString().slice(0,16);
  return {start:date+'T'+start,end};
}
export function overlaps(a,b){return a.start<b.end&&a.end>b.start;}
