import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, CircleHelp, Clock3, MapPin, PackageCheck, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api, currency } from './api.js';
import { useApp } from './context.jsx';
import { translateMatchReason, translateUi } from './i18n.js';
import { Badge, Button, Empty, Field, Localize, PageTitle, Panel } from './ui.jsx';

const initial = { text: 'Need 100 handmade eco-friendly gift bags for a corporate event', category: '', material: '', quantity: '', budget: 350, location: 'Pune', deadline: '', customisation: true };
export function MatchPage() {
  const { user, language, notify } = useApp(); const navigate = useNavigate();
  const [form, setForm] = useState(() => ({ ...initial, text: translateUi(language, initial.text) })), [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [savedId, setSavedId] = useState(''), [selected, setSelected] = useState(''), [message, setMessage] = useState('');
  useEffect(() => {
    setForm((old) => ['en', 'hi', 'mr'].some((code) => old.text === translateUi(code, initial.text))
      ? { ...old, text: translateUi(language, initial.text) } : old);
  }, [language]);
  const update = (key, value) => setForm({ ...form, [key]: value });
  const search = async (event) => { event.preventDefault(); setBusy(true); setError(''); setSavedId(''); setSelected('');
    try { setResult(await api('/match', { method: 'POST', body: form })); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const saveBrief = async () => {
    if (!user) return navigate('/login'); if (user.role !== 'buyer') return notify('Sign in as a buyer to save a brief.');
    setBusy(true); try { const data = await api('/requirements', { method: 'POST', body: result.requirement }); setSavedId(data.requirement.id); notify('Buyer brief saved.'); }
    catch (err) { notify(err.message); } finally { setBusy(false); }
  };
  const enquire = async (event, product) => { event.preventDefault();
    if (!user) return navigate('/login'); if (user.role !== 'buyer') return notify('Sign in as a buyer to send an enquiry.');
    setBusy(true); try { await api('/enquiries', { method: 'POST', body: { product_id: product.id, requirement_id: savedId || undefined, message } }); setSelected(''); setMessage(''); notify(`${translateUi(language, 'Enquiry sent to')} ${product.artisan_name}.`); }
    catch (err) { notify(err.message); } finally { setBusy(false); }
  };
  return <Localize><div className="container public-page match-page"><PageTitle title="Find makers who fit your brief." intro="Match by craft, quantity, unit budget, lead time and material. Every result explains its score."/>
    <div className="match-layout"><Panel className="match-form"><div className="panel-title"><span className="panel-icon"><SlidersHorizontal size={21}/></span><div><h2>Your requirement</h2><p>Start with a sentence. Add constraints you know.</p></div></div><form onSubmit={search}><Field label="What do you need?"><textarea value={form.text} onChange={(event) => update('text', event.target.value)} minLength="10" required/></Field><div className="two-fields"><Field label="Category"><select value={form.category} onChange={(event) => update('category', event.target.value)}><option value="">Find from description</option><option>Textiles</option><option>Home & Decor</option><option>Bags & Accessories</option><option>Art & Paintings</option></select></Field><Field label="Quantity"><input type="number" min="1" placeholder="Found from description" value={form.quantity} onChange={(event) => update('quantity', event.target.value)}/></Field></div><div className="two-fields"><Field label="Unit budget (₹)"><input type="number" min="0" value={form.budget} onChange={(event) => update('budget', event.target.value)}/></Field><Field label="Preferred location"><input value={form.location} onChange={(event) => update('location', event.target.value)}/></Field></div><div className="two-fields"><Field label="Material"><input value={form.material} onChange={(event) => update('material', event.target.value)} placeholder="For example, jute"/></Field><Field label="Delivery deadline"><input type="date" value={form.deadline} onChange={(event) => update('deadline', event.target.value)}/></Field></div><label className="check-row"><input type="checkbox" checked={form.customisation} onChange={(event) => update('customisation', event.target.checked)}/> Need customisation or event branding</label>{error && <div className="form-error" role="alert">{error}</div>}<Button type="submit" loading={busy} className="full">Find matching makers <Search size={17}/></Button></form><div className="match-method"><CircleHelp size={17}/><span>Scores use transparent business rules, not a trained model. Confirm details with the maker.</span></div></Panel>
      <div className="match-results">{result ? <><div className="result-heading"><div><h2>{result.matches.length} maker options</h2><p>For {result.requirement.quantity} units · {result.requirement.category || 'all crafts'}</p></div>{!savedId && <Button variant="secondary" onClick={saveBrief} disabled={busy}>Save brief</Button>}{savedId && <Badge tone="green">Brief saved</Badge>}</div>
        {result.matches.length ? result.matches.map((item) => <Panel key={item.id} className={`match-card ${!item.eligible ? 'match-caution' : ''}`}><div className="match-card-main"><img src={item.image} alt={item.title}/><div><Link to={`/product/${item.id}`}><h3>{item.title}</h3></Link><p>{item.artisan_name} · {item.region}</p><div className="match-meta"><span><PackageCheck size={15}/>{item.capacity} units / month</span><span><Clock3 size={15}/>{item.lead_days} day lead time</span></div></div><div className="match-score"><strong>{item.score}%</strong><span>{item.eligible ? 'Fit score' : 'Review constraints'}</span></div></div><div className="match-reasons">{item.reasons.slice(0, 4).map((reason) => <span key={reason}><Check size={14}/>{translateMatchReason(language, reason)}</span>)}</div>{item.gaps.length > 0 && <p className="match-gap">Review: {item.gaps.map((gap) => translateMatchReason(language, gap)).join(' · ')}</p>}<div className="match-footer"><span>From {currency(item.price)} / unit</span><Button variant="quiet" onClick={() => setSelected(selected === item.id ? '' : item.id)}>Send enquiry <ArrowRight size={16}/></Button></div>{selected === item.id && <form className="inline-enquiry" onSubmit={(event) => enquire(event, item)}><textarea required minLength="10" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell the artisan about quantity, deadline and any custom details"/><Button type="submit" loading={busy}>Send to {item.artisan_name.split(' ')[0]}</Button></form>}</Panel>) : <Empty title="No makers yet" text="Try a broader category or remove a constraint."/>}</> : <div className="result-placeholder"><div className="result-placeholder-icon"><Sparkles size={34}/></div><h2>Better matches begin with a clear brief.</h2><p>Describe your order to see artisans ranked by real production constraints.</p><div><span>Craft</span><span>Capacity</span><span>Budget</span><span>Timing</span></div></div>}</div></div></div></Localize>;
}
