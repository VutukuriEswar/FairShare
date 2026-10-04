import React from 'react';
import { Link } from 'react-router-dom';
export default function NotFound(){return (<div className="card" style={{textAlign:'center',padding:40}}><div style={{fontSize:'3rem'}}>🗺️</div><h2>404 — lost in the library? 📚</h2><p className="muted">That page does not exist. Even the card catalogue is confused. 🗃️</p><p><Link className="btn" to="/">🏠 Go home</Link></p></div>);}
