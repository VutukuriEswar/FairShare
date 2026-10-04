import React, { createContext, useState, useEffect } from 'react';
import { api } from '../services/api';
export const AuthContext = createContext(null);
export function AuthProvider({children}){
  const [token,setToken]=useState(localStorage.getItem('fs-token')||'');
  const [user,setUser]=useState(null);
  useEffect(()=>{
    if(token){localStorage.setItem('fs-token',token);api('/users/me').then(setUser).catch(()=>{setUser(null);});}
    else{localStorage.removeItem('fs-token');setUser(null);}
  },[token]);
  return <AuthContext.Provider value={{token,setToken,user,setUser}}>{children}</AuthContext.Provider>;
}
