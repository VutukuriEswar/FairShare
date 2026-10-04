const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
export async function api(path, opts={}){
  const token = localStorage.getItem('fs-token');
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type':'application/json', ...(token?{Authorization:'Bearer '+token}:{}), ...(opts.headers||{}) },
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok){
    const d = data.detail;
    const err = new Error(typeof d === 'string' ? d : (d?.message || ('Request failed '+res.status)));
    if(d && typeof d === 'object') Object.assign(err, d);
    err.status = res.status;
    throw err;
  }
  return data;
}
export const API_BASE = BASE;
