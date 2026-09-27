import React, { useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Boxes, ChevronDown, CircleHelp, ClipboardList, Compass, Globe2, LayoutDashboard, LogOut, Menu, Mic, Package, Plus, ScrollText, Search, ShieldCheck, ShoppingBag, Wifi, WifiOff, X } from 'lucide-react';
import { AppProvider, useApp } from './context.jsx';
import { api } from './api.js';
import { languages, translateUi } from './i18n.js';
import { Button, ButtonLink, Localize } from './ui.jsx';
import { Home, Marketplace, ProductPage, ArtisanPage, PassportPage, LoginPage, JoinPage, NotFound } from './Public.jsx';
import { ArtisanDashboard, OrdersPage, EnquiriesPage, DemandPage, BuyerDashboard, AdminDashboard, OfflinePage } from './Workspace.jsx';
import { StudioPage } from './Studio.jsx';
import { MatchPage } from './Match.jsx';
import { PricePage } from './Price.jsx';

function Require({ role, children }) {
  const { ready, user } = useApp();
  if (!ready) return <Localize><div className="page-loading">Opening Tantu…</div></Localize>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function Brand() { return <Localize><Link to="/" className="brand" aria-label="Tantu home"><span className="brand-mark" aria-hidden="true"><i/><i/><i/></span><span>tantu<small>Craft with a future</small></span></Link></Localize>; }

function VoiceDock() {
  const { language, notify } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [command, setCommand] = useState('');
  const [listening, setListening] = useState(false);
  const [response, setResponse] = useState('');
  const speak = (text) => {
    const response = translateUi(language, text);
    setResponse(response);
    if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(response); utterance.lang = languages.find((item) => item.code === language)?.speech || 'en-IN'; window.speechSynthesis.speak(utterance); }
  };
  const act = async (value) => {
    const text = value.toLowerCase().trim();
    setCommand(value);
    if (/new product|create|नवीन|नया|उत्पादन जोडा/.test(text)) { navigate('/studio/new'); speak('Opening product studio.'); }
    else if (/order|ऑर्डर/.test(text)) {
      navigate('/orders');
      try { const data = await api('/orders'); speak(language === 'hi' ? `आपके ${data.orders.length} ऑर्डर हैं।` : language === 'mr' ? `तुमच्या ${data.orders.length} ऑर्डर्स आहेत.` : `You have ${data.orders.length} orders.`); } catch { speak('Opening orders.'); }
    }
    else if (/enquir|चौकशी|पूछताछ/.test(text)) { navigate('/enquiries'); speak('Opening enquiries.'); }
    else if (/demand|मागणी|मांग/.test(text)) { navigate('/demand'); speak('Opening demand insights.'); }
    else if (/buyer|खरेदीदार|खरीदार/.test(text)) { navigate('/matching'); speak('Opening buyer matching.'); }
    else if (/price|किंमत|कीमत/.test(text)) {
      const amount = Number(text.match(/\b\d{2,7}\b/)?.[0]);
      if (amount && location.pathname.startsWith('/studio/')) { window.dispatchEvent(new CustomEvent('tantu:voice-price', { detail: { amount } })); speak(language === 'hi' ? `स्टूडियो में ${amount} रुपये के मूल्य की पुष्टि करें।` : language === 'mr' ? `स्टुडिओमध्ये ${amount} रुपयांच्या किंमतीची पुष्टी करा.` : `Confirm the price change to ${amount} rupees in the studio.`); }
      else if (amount) speak('Open a product in the studio before changing its price.');
      else { navigate('/price'); speak('Opening fair pricing.'); }
    }
    else if (/publish|प्रकाशित/.test(text)) { if (location.pathname.startsWith('/studio/')) { window.dispatchEvent(new Event('tantu:voice-publish')); speak('Confirm publication in the studio.'); } else speak('Open a product in the studio before publishing.'); }
    else if (/product|उत्पादन|उत्पाद/.test(text)) { navigate('/dashboard'); speak('Opening your products.'); }
    else { notify('Command not recognised. Try “show orders” or “create product”.'); setResponse(translateUi(language, 'Try “show orders” or “create product”.')); }
  };
  const listen = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { notify('Speech input is unavailable in this browser. Type a command below.'); return; }
    const recognition = new Recognition();
    recognition.lang = languages.find((item) => item.code === language)?.speech || 'en-IN';
    recognition.onresult = (event) => act(event.results[0][0].transcript);
    recognition.onerror = () => { setListening(false); notify('Speech input failed. Type a command instead.'); };
    recognition.onend = () => setListening(false);
    recognition.start(); setListening(true);
  };
  return <Localize><div className={`voice-dock ${open ? 'voice-open' : ''}`}>
    {open && <div className="voice-panel"><div className="voice-panel-head"><strong>Voice actions</strong><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close voice actions"><X size={18}/></button></div>
      <p>Say “show orders”, “create product”, or “check demand”. Hindi and Marathi commands are supported for key actions.</p>
      <div className="voice-controls"><Button onClick={listen} variant="secondary"><Mic size={17}/>{listening ? 'Listening…' : 'Start speaking'}</Button></div>
      <form onSubmit={(event) => { event.preventDefault(); if (command.trim()) act(command); }}><input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Or type a command" aria-label="Voice command text"/><button type="submit" aria-label="Run command"><ArrowRight size={18}/></button></form>
      {response && <small role="status">{response}</small>}
    </div>}
    <button className="voice-trigger" onClick={() => setOpen(!open)} aria-label="Open voice actions"><Mic size={21}/></button>
  </div></Localize>;
}

function Layout({ children }) {
  const { user, setUser, language, setLanguage, t, online, pending, notify } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const workspace = user && ['/dashboard','/studio','/orders','/enquiries','/demand','/buyer','/admin','/offline'].some((prefix) => location.pathname.startsWith(prefix));
  const logout = async () => {
    let serverSignedOut = false;
    try { await api('/auth/logout', { method: 'POST', body: {} }); serverSignedOut = true; localStorage.removeItem('tantu-logout-pending'); }
    catch { localStorage.setItem('tantu-logout-pending', '1'); }
    setUser(null); navigate('/');
    notify(serverSignedOut ? 'Signed out.' : 'Signed out on this device. Server sign-out will finish when connected.');
  };
  const side = user?.role === 'artisan' ? [
    ['/dashboard', LayoutDashboard, t('dashboard')], ['/studio/new', Plus, t('create')], ['/orders', ShoppingBag, t('orders')], ['/enquiries', ClipboardList, t('enquiries')], ['/demand', BarChart3, t('insights')], ['/price', Compass, t('price')], ['/offline', Boxes, `${t('offline')}${pending ? ` (${pending})` : ''}`],
  ] : user?.role === 'buyer' ? [
    ['/buyer', LayoutDashboard, t('dashboard')], ['/matching', Search, t('match')], ['/orders', ShoppingBag, t('orders')], ['/enquiries', ClipboardList, t('enquiries')], ['/marketplace', Package, t('browse')],
  ] : [
    ['/admin', ShieldCheck, 'Overview'], ['/marketplace', Package, t('browse')], ['/demand', BarChart3, t('insights')],
  ];
  return <Localize><div className="app-shell">
    <header className="topbar"><div className="topbar-inner"><Brand/><nav className={`top-links ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
      <NavLink to="/marketplace" onClick={() => setMenuOpen(false)}>{t('browse')}</NavLink>
      <NavLink to="/matching" onClick={() => setMenuOpen(false)}>{t('match')}</NavLink>
      <NavLink to="/price" onClick={() => setMenuOpen(false)}>{t('price')}</NavLink>
      {user && <NavLink to={user.role === 'artisan' ? '/dashboard' : user.role === 'buyer' ? '/buyer' : '/admin'} onClick={() => setMenuOpen(false)}>{t('dashboard')}</NavLink>}
      {!user && <NavLink to="/login" className="mobile-only" onClick={() => setMenuOpen(false)}>{t('signIn')}</NavLink>}
    </nav><div className="top-actions"><span className={`connection ${online ? 'is-online' : 'is-offline'}`} title={online ? 'Online' : 'Offline'}>{online ? <Wifi size={16}/> : <WifiOff size={16}/>}<span>{online ? 'Online' : 'Offline'}</span></span>
      <label className="language-select"><Globe2 size={17}/><select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Language">{languages.map((item) => <option value={item.code} key={item.code}>{item.label}</option>)}</select><ChevronDown size={13}/></label>
      {user ? <button className="account-button" onClick={logout} title="Sign out"><span className="avatar">{user.name?.charAt(0)}</span><span>{user.name?.split(' ')[0]}</span><LogOut size={16}/></button> : <ButtonLink to="/login" variant="secondary" className="login-top">{t('signIn')}</ButtonLink>}
      <button className="icon-button mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X/> : <Menu/>}</button>
    </div></div></header>
    {workspace ? <div className="workspace-layout"><aside className="sidebar"><div className="sidebar-label">Workspace</div><nav aria-label="Workspace navigation">{side.map(([to, Icon, label]) => <NavLink key={to} to={to} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}><Icon size={19}/>{label}</NavLink>)}</nav><div className="sidebar-foot"><span className="sidebar-orbit">✳</span><strong>Every craft has a story.</strong><p>Give yours room to travel.</p></div></aside><main className="workspace-main">{children}</main></div> : <main>{children}</main>}
    <footer className="footer"><div className="container footer-inner"><Brand/><p>Made for the hands behind the craft.</p><div><Link to="/marketplace">Explore</Link><Link to="/matching">Buyer matching</Link><Link to="/price">Fair pricing</Link></div><small>SIH 26090 demo · Tantu</small></div></footer>
    {user?.role === 'artisan' && <VoiceDock/>}
  </div></Localize>;
}

function RoutedApp() {
  return <Layout><Routes>
    <Route path="/" element={<Home/>}/>
    <Route path="/marketplace" element={<Marketplace/>}/>
    <Route path="/product/:id" element={<ProductPage/>}/>
    <Route path="/artisan/:id" element={<ArtisanPage/>}/>
    <Route path="/passport/:id" element={<PassportPage/>}/>
    <Route path="/price" element={<PricePage/>}/>
    <Route path="/matching" element={<MatchPage/>}/>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/join" element={<JoinPage/>}/>
    <Route path="/dashboard" element={<Require role="artisan"><ArtisanDashboard/></Require>}/>
    <Route path="/studio/new" element={<Require role="artisan"><StudioPage/></Require>}/>
    <Route path="/studio/:id/edit" element={<Require role="artisan"><StudioPage/></Require>}/>
    <Route path="/orders" element={<Require><OrdersPage/></Require>}/>
    <Route path="/enquiries" element={<Require><EnquiriesPage/></Require>}/>
    <Route path="/demand" element={<Require><DemandPage/></Require>}/>
    <Route path="/offline" element={<Require role="artisan"><OfflinePage/></Require>}/>
    <Route path="/buyer" element={<Require role="buyer"><BuyerDashboard/></Require>}/>
    <Route path="/admin" element={<Require role="admin"><AdminDashboard/></Require>}/>
    <Route path="*" element={<NotFound/>}/>
  </Routes></Layout>;
}

export default function App() { return <AppProvider><RoutedApp/></AppProvider>; }
