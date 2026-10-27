function normalizeSlump(value){
 return String(value??'').trim()
  .replace(/^slump\s*:?\s*/i,'')
  .replace(/\s*c\.?m\.?\s*$/i,'')
  .replace(/\s*(?:\+\s*\/?\s*[-−]|±)\s*/g,' ± ')
  .replace(/\s+/g,' ').trim();
}
if(typeof module!=='undefined'&&module.exports)module.exports={normalizeSlump};
