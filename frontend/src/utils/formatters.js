export function fmtDate(s){ try{return new Date(s).toLocaleString();}catch{return s||'';} }
export function countdown(deadline){ if(!deadline) return 'No deadline'; const d=new Date(deadline)-new Date(); if(d<=0) return 'Past due'; const h=Math.floor(d/36e5),dd=Math.floor(h/24); return dd>0? dd+'d '+ (h%24)+'h left' : h+'h left'; }
export function isValidEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e||''); }
