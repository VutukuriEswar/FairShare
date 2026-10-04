import { useEffect, useState } from 'react';
import { api } from '../services/api';
export function useFetch(path){
  const [data,setData]=useState(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  useEffect(()=>{let on=true;setLoading(true);api(path).then(d=>{if(on){setData(d);setError('');}}).catch(e=>{if(on) setError(e.message);}).finally(()=>{if(on) setLoading(false);});return ()=>{on=false;};},[path]);
  return {data,loading,error};
}
