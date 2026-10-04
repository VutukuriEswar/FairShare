import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateTeam from './pages/CreateTeam';
import TeamDetail from './pages/TeamDetail';
import AcceptInvite from './pages/AcceptInvite';
import Report from './pages/Report';
import MyActivity from './pages/MyActivity';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Analyze from './pages/Analyze';
import Privacy from './pages/Privacy';
import Ethics from './pages/Ethics';
import GithubCallback from './pages/GithubCallback';
import NotFound from './pages/NotFound';
import './App.css';

export default function App(){
  const [theme,setTheme]=useState(localStorage.getItem('fs-theme')||'light');
  useEffect(()=>{document.documentElement.setAttribute('data-theme',theme);localStorage.setItem('fs-theme',theme);},[theme]);
  return (
    <BrowserRouter>
      <a className="skip" href="#main">Skip to content</a>
      <Navbar theme={theme} onTheme={()=>setTheme(theme==='light'?'dark':'light')} />
      <main id="main" className="container">
        <Routes>
          <Route path="/" element={<Landing/>} />
          <Route path="/login" element={<Login/>} />
          <Route path="/register" element={<Register/>} />
          <Route path="/auth/callback" element={<GithubCallback/>} />
          <Route path="/invite/:token" element={<AcceptInvite/>} />
          <Route path="/analyze" element={<Analyze/>} />
          <Route path="/privacy" element={<Privacy/>} />
          <Route path="/ethics" element={<Ethics/>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard/></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><CreateTeam/></ProtectedRoute>} />
          <Route path="/teams/:id" element={<ProtectedRoute><TeamDetail/></ProtectedRoute>} />
          <Route path="/teams/:id/report" element={<ProtectedRoute><Report/></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute><MyActivity/></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile/></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings/></ProtectedRoute>} />
          <Route path="*" element={<NotFound/>} />
        </Routes>
      </main>
      <Footer/>
    </BrowserRouter>
  );
}
