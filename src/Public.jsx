import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, Camera, Check, Compass, Handshake, HeartHandshake, MapPin, Package, Search, ShieldCheck, Sparkles, UserRound, WandSparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api, currency, shortDate } from './api.js';
import { useApp } from './context.jsx';
import { translateUi } from './i18n.js';
import { Badge, Button, ButtonLink, Empty, ErrorBox, Field, Loading, Localize, PageTitle, Panel, useLoad } from './ui.jsx';

export function ProductCard({ product }) {
  return <Localize><Link className="product-card" to={`/product/${product.id}`}><div className="product-image"><img src={product.image} alt={product.title} loading="lazy"/><span className="product-card-passport"><ShieldCheck size={13}/> Craft passport</span></div>
    <div className="product-info"><div className="product-category">{product.category}</div><h3>{product.title}</h3><p>{product.artisan_name || product.craft} · {product.region}</p><div className="product-bottom"><strong>{currency(product.price)}</strong><ArrowRight size={18}/></div></div></Link></Localize>;
}

export function Home() {
  const { data, loading } = useLoad('/products');
  return <Localize><>
    <section className="hero"><div className="hero-image"/><div className="hero-shade"/><div className="container hero-content"><div className="hero-copy"><span className="hero-kicker"><span className="small-star">✳</span> A new path from maker to market</span><h1>Every handmade thing deserves to be <em>seen.</em></h1><p>Tantu helps artisans tell the story behind their craft, price it with confidence, and meet buyers who value the work.</p><div className="hero-actions"><ButtonLink to="/marketplace">Explore the collection <ArrowRight size={18}/></ButtonLink><ButtonLink to="/join" variant="ghost-light">Join as an artisan</ButtonLink></div></div><div className="hero-caption"><span className="caption-rule"/>From the loom in Yeola<br/>to a wider world.</div></div></section>
    <div className="trust-strip"><div className="container"><span><ShieldCheck size={19}/> Transparent craft passports</span><span><Compass size={19}/> Explainable fair pricing</span><span><Handshake size={19}/> Better buyer matches</span></div></div>
    <section className="section container"><div className="section-head"><div><span className="eyebrow">Discover the collection</span><h2>Made by hands, held by stories.</h2><p>Each piece comes with its maker, place, and process.</p></div><Link className="text-link" to="/marketplace">View all crafts <ArrowRight size={18}/></Link></div>
      {loading ? <Loading/> : <div className="product-grid">{['prod-paithani','prod-diya','prod-jute','prod-pottery'].map((id) => data?.products?.find((product) => product.id === id)).filter(Boolean).map((product) => <ProductCard key={product.id} product={product}/>)}</div>}</section>
    <section className="maker-band"><div className="container maker-grid"><div className="maker-photo"><img src="/images/loom.png" alt="Artisan weaving Paithani silk on a handloom" loading="lazy"/></div><div className="maker-copy"><span className="eyebrow">For the maker</span><h2>A tool shaped around your working day.</h2><p>Take a photo. Speak about your craft. Review a suggested listing and a price grounded in your real costs. Save it even when your connection drops.</p><div className="maker-features"><div><Camera size={22}/><span>Photo and voice listing</span></div><div><BadgeCheck size={22}/><span>Story and origin passport</span></div><div><HeartHandshake size={22}/><span>Direct bulk enquiries</span></div></div><ButtonLink to="/join" variant="secondary">Create an artisan account <ArrowRight size={18}/></ButtonLink></div></div></section>
    <section className="section container buyer-section"><div><span className="eyebrow">For the buyer</span><h2>Find the right hands for a bigger idea.</h2><p>Describe what you need. Compare makers by craft, capacity, price and lead time, then send a direct enquiry.</p><ButtonLink to="/matching">Find a maker <ArrowRight size={18}/></ButtonLink></div><div className="match-preview"><div className="preview-top">Buyer brief <span>Live matching demo</span></div><p>“100 reusable handmade bags for our team event”</p><div className="preview-result"><span className="preview-score">✓</span><div><strong>Asha Patil · Pune</strong><small>Jute craft · Capacity 180 units/month</small></div><Badge tone="green">Strong fit</Badge></div><div className="preview-lines"><span/><span/><span/></div></div></section>
  </></Localize>;
}

export function Marketplace() {
  const { t } = useApp();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const { data, loading, error, refresh } = useLoad('/products');
  const categories = ['All', ...new Set(data?.products?.map((product) => product.category) || [])];
  const products = (data?.products || []).filter((product) => (category === 'All' || product.category === category) && `${product.title} ${product.craft} ${product.artisan_name} ${product.region}`.toLowerCase().includes(search.toLowerCase()));
  return <Localize><div className="container public-page"><PageTitle title="Explore handmade India" intro="Meet the makers, materials and places behind each piece."/>
    <div className="market-tools"><label className="search-box"><Search size={20}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('search')} aria-label="Search products"/></label><div className="category-pills" role="group" aria-label="Filter by category">{categories.map((item) => <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
    {loading ? <Loading/> : error ? <ErrorBox message={error} retry={refresh}/> : products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product}/>)}</div> : <Empty title="No crafts found" text="Try another search or category."/>}
  </div></Localize>;
}

export function ProductPage() {
  const { id } = useParams(); const { user, language, notify } = useApp(); const navigate = useNavigate();
  const { data, loading, error } = useLoad(`/products/${id}`);
  const [quantity, setQuantity] = useState(1), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const product = data?.product;
  const order = async () => {
    if (!user) return navigate('/login');
    if (user.role !== 'buyer') return notify('Use a buyer account to place an order.');
    if (!window.confirm(language === 'hi' ? `${quantity} × ${product.title} का ऑर्डर दें?` : language === 'mr' ? `${quantity} × ${product.title} ची ऑर्डर द्यायची?` : `Place an order for ${quantity} × ${product.title}?`)) return;
    setBusy(true); try { await api('/orders', { method: 'POST', body: { product_id: id, quantity: Number(quantity) } }); notify('Order placed. The artisan can now review it.'); navigate('/orders'); }
    catch (err) { notify(err.message); } finally { setBusy(false); }
  };
  const enquire = async (event) => {
    event.preventDefault(); if (!user) return navigate('/login');
    if (user.role !== 'buyer') return notify('Use a buyer account to send an enquiry.');
    setBusy(true); try { await api('/enquiries', { method: 'POST', body: { product_id: id, message } }); setMessage(''); notify('Enquiry sent to the artisan.'); }
    catch (err) { notify(err.message); } finally { setBusy(false); }
  };
  if (loading) return <div className="container public-page"><Loading/></div>;
  if (error) return <div className="container public-page"><ErrorBox message={error}/></div>;
  return <Localize><div className="container public-page"><Link className="back-link" to="/marketplace"><ArrowLeft size={17}/> Explore crafts</Link><div className="detail-grid"><div><div className="detail-image"><img src={product.image} alt={product.title}/></div><div className="detail-note"><ShieldCheck size={23}/><div><strong>Know the story behind this piece</strong><p>The passport records details supplied by its artisan and review status.</p></div></div></div>
    <div className="detail-content"><Badge tone="blue">{product.category}</Badge><h1>{product.title}</h1><Link className="maker-link" to={`/artisan/${product.artisan_id}`}><UserRound size={18}/> By {product.artisan_name} <ArrowRight size={16}/></Link><p className="detail-lead">{product.description}</p><div className="detail-price">{currency(product.price)}<small>per piece · {product.stock} in stock</small></div>
      <div className="detail-actions"><label>Quantity <input type="number" min="1" max={product.stock} value={quantity} onChange={(event) => setQuantity(event.target.value)}/></label><Button onClick={order} loading={busy} disabled={!product.stock}>Place order <ArrowRight size={17}/></Button></div>
      <div className="detail-facts"><div><span>Craft</span><strong>{product.craft}</strong></div><div><span>Materials</span><strong>{product.material || 'Artisan supplied'}</strong></div><div><span>Made in</span><strong>{product.region || 'India'}</strong></div><div><span>Lead time</span><strong>{product.lead_days} days</strong></div></div>
      {product.certificate_id && <Link className="passport-link" to={`/passport/${encodeURIComponent(product.certificate_id)}`}><QRCodeSVG value={`${window.location.origin}/passport/${encodeURIComponent(product.certificate_id)}`} size={62}/><span><strong>View craft passport</strong><small>Origin, technique and artisan story</small></span><ArrowRight size={19}/></Link>}
      <form className="enquiry-form" onSubmit={enquire}><h3>Ask the maker</h3><p>Need custom work or a larger quantity?</p><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell the artisan what you have in mind" minLength="10" required/><Button type="submit" variant="secondary" loading={busy}>Send enquiry <ArrowRight size={16}/></Button></form>
    </div></div><section className="story-section"><span className="eyebrow">The process</span><h2>A little more about this craft</h2><p>{product.story || product.description}</p><div><span>Technique: {product.technique || product.craft}</span><span>Care: {product.care || 'Ask the artisan'}</span></div></section></div></Localize>;
}

export function ArtisanPage() {
  const { id } = useParams(); const { data, loading, error } = useLoad(`/artisans/${id}`);
  if (loading) return <div className="container public-page"><Loading/></div>;
  if (error) return <div className="container public-page"><ErrorBox message={error}/></div>;
  const { artisan, products } = data;
  return <Localize><div className="container public-page"><Link className="back-link" to="/marketplace"><ArrowLeft size={17}/> Explore crafts</Link><div className="artisan-hero"><div className="artisan-monogram">{artisan.name.charAt(0)}</div><div><Badge tone="blue">Meet the maker</Badge><h1>{artisan.name}</h1><p><MapPin size={18}/> {artisan.region} · {artisan.craft}</p></div></div><div className="artisan-about"><div><span className="eyebrow">The person behind the work</span><h2>Craft built by experience.</h2><p>{artisan.story}</p></div><div className="artisan-attributes"><div><strong>{artisan.experience_years} years</strong><span>Working in this craft</span></div><div><strong>{artisan.capacity} units</strong><span>Monthly capacity</span></div><div><strong>{artisan.lead_days} days</strong><span>Typical lead time</span></div></div></div><section className="section compact"><div className="section-head"><h2>From this workshop</h2></div><div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={{ ...product, artisan_name: artisan.name, region: artisan.region }}/>)}</div></section></div></Localize>;
}

export function PassportPage() {
  const { id } = useParams(); const { language } = useApp(); const { data, loading, error } = useLoad(`/passports/${encodeURIComponent(id)}`);
  if (loading) return <div className="container public-page"><Loading/></div>;
  if (error) return <div className="container public-page"><ErrorBox message={error}/></div>;
  const p = data.passport;
  return <Localize><div className="passport-page"><div className="container"><Link className="back-link" to={`/product/${p.product_id}`}><ArrowLeft size={17}/> Back to product</Link><div className="passport-header"><span className="passport-symbol">✳</span><div><span className="eyebrow">Digital craft passport</span><h1>{p.title}</h1><p>One public record for the maker, material and place behind this work.</p></div><Badge tone={p.review_status === 'reviewed' ? 'green' : 'gold'}>{p.review_status === 'reviewed' ? 'Platform record reviewed' : 'Artisan-declared'}</Badge></div>
    <div className="passport-grid"><div className="passport-photo"><img src={p.image} alt={p.title}/></div><div className="passport-document"><div className="passport-document-top"><span>TANTU / PASSPORT</span><ShieldCheck size={24}/></div><div className="passport-record"><span>Record ID</span><strong>{p.certificate_id}</strong></div><div className="passport-record"><span>Artisan</span><Link to={`/artisan/${p.artisan_id}`}>{p.artisan_name} <ArrowRight size={15}/></Link></div><div className="passport-record"><span>Place of craft</span><strong>{p.region}</strong></div><div className="passport-record"><span>Craft and technique</span><strong>{p.craft} · {p.technique || 'Artisan supplied'}</strong></div><div className="passport-record"><span>Materials</span><strong>{p.material || 'Artisan supplied'}</strong></div><div className="passport-record"><span>Recorded on</span><strong>{shortDate(p.issued_at, language)}</strong></div><div className="passport-qr"><QRCodeSVG value={`${window.location.origin}/passport/${encodeURIComponent(p.certificate_id)}`} size={112}/><p>Scan to open this public record.</p></div></div></div>
    <div className="passport-disclaimer"><ShieldCheck size={21}/><p><strong>What this record means.</strong> Details are supplied by the artisan. “Platform record reviewed” means an admin reviewed the entry; it does not certify independent origin or material testing.</p></div><section className="story-section"><span className="eyebrow">From the workshop</span><h2>The story of this piece</h2><p>{p.story || p.description}</p><p className="muted">{p.artisan_story}</p></section></div></div></Localize>;
}

export function LoginPage() {
  const { setUser, setLanguage, notify } = useApp(); const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' }), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const login = async (email = form.email, password = form.password) => {
    setBusy(true); setError('');
    try { const { user } = await api('/auth/login', { method: 'POST', body: { email, password } }); setUser(user); setLanguage(user.language || 'en'); navigate(user.role === 'artisan' ? '/dashboard' : user.role === 'buyer' ? '/buyer' : '/admin'); notify(`${translateUi(user.language || 'en', 'Welcome,')} ${user.name.split(' ')[0]}.`); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <Localize><div className="auth-page"><div className="auth-image"><img src="/images/loom.png" alt="Paithani weaving on a handloom"/><div><span>✳</span><h2>Craft deserves more than a listing.</h2></div></div><div className="auth-main"><div className="auth-card"><span className="eyebrow">Welcome back</span><h1>Sign in to Tantu</h1><p>Step into your workshop or buyer space.</p><form onSubmit={(event) => { event.preventDefault(); login(); }}><Field label="Email address"><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></Field><Field label="Password"><input type="password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })}/></Field>{error && <div className="form-error" role="alert">{error}</div>}<Button type="submit" loading={busy} className="full">Sign in <ArrowRight size={17}/></Button></form><div className="auth-divider">Or try the demo</div><div className="demo-buttons"><button onClick={() => login('savita@tantu.demo', 'Demo@26090')} disabled={busy}><span className="demo-icon">S</span><span><strong>Artisan</strong><small>Savita’s workshop</small></span><ArrowRight size={17}/></button><button onClick={() => login('buyer@tantu.demo', 'Demo@26090')} disabled={busy}><span className="demo-icon">R</span><span><strong>Buyer</strong><small>Explore and enquire</small></span><ArrowRight size={17}/></button><button onClick={() => login('admin@tantu.demo', 'Demo@26090')} disabled={busy}><span className="demo-icon">A</span><span><strong>Admin</strong><small>Review records</small></span><ArrowRight size={17}/></button></div><p className="auth-bottom">New here? <Link to="/join">Create an account</Link></p></div></div></div></Localize>;
}

export function JoinPage() {
  const { setUser, setLanguage, notify } = useApp(); const navigate = useNavigate();
  const [form, setForm] = useState({ role: 'artisan', language: 'en', name: '', email: '', password: '', craft: '', region: '', story: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const update = (key, value) => setForm({ ...form, [key]: value });
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError('');
    try { await api('/auth/register', { method: 'POST', body: form }); const { user } = await api('/session'); setUser(user); setLanguage(form.language); notify(translateUi(form.language, 'Account ready.')); navigate(form.role === 'artisan' ? '/dashboard' : '/buyer'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <Localize><div className="container join-page"><div className="join-intro"><span className="eyebrow">Join the craft network</span><h1>A better market starts with your story.</h1><p>Create your space in a few steps. You can add details later.</p><div className="join-art"><span>✳</span><span>✳</span><span>✳</span></div></div><Panel className="join-card"><h2>Create an account</h2><form onSubmit={submit}><div className="role-toggle" role="group" aria-label="Account type"><button type="button" className={form.role === 'artisan' ? 'active' : ''} onClick={() => update('role', 'artisan')}>I make crafts</button><button type="button" className={form.role === 'buyer' ? 'active' : ''} onClick={() => update('role', 'buyer')}>I buy crafts</button></div><div className="two-fields"><Field label="Your name"><input required value={form.name} onChange={(event) => update('name', event.target.value)}/></Field><Field label="Preferred language"><select value={form.language} onChange={(event) => update('language', event.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option><option value="mr">मराठी</option></select></Field></div><Field label="Email address"><input type="email" required value={form.email} onChange={(event) => update('email', event.target.value)}/></Field><Field label="Password" hint="At least 10 characters"><input type="password" minLength="10" required value={form.password} onChange={(event) => update('password', event.target.value)}/></Field>{form.role === 'artisan' && <div className="two-fields"><Field label="Your craft"><input required value={form.craft} onChange={(event) => update('craft', event.target.value)} placeholder="For example, pottery"/></Field><Field label="Your location"><input required value={form.region} onChange={(event) => update('region', event.target.value)} placeholder="Town, state"/></Field></div>}{error && <div className="form-error" role="alert">{error}</div>}<Button type="submit" loading={busy} className="full">Create account <ArrowRight size={17}/></Button><p className="auth-bottom">Already a member? <Link to="/login">Sign in</Link></p></form></Panel></div></Localize>;
}

export function NotFound() { return <Localize><div className="container not-found"><span>✳</span><h1>This page has wandered off the loom.</h1><p>Find your way back to the collection.</p><ButtonLink to="/marketplace">Explore crafts <ArrowRight size={17}/></ButtonLink></div></Localize>; }
