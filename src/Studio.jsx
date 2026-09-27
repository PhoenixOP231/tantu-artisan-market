import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Camera, Check, Cloud, CloudOff, ImagePlus, Info, Mic, ScanLine, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import { api, currency } from './api.js';
import { useApp } from './context.jsx';
import { languages } from './i18n.js';
import { pendingItems, queueItem } from './offline.js';
import { Badge, Button, Field, Loading, Localize, PageTitle, Panel } from './ui.jsx';

const initial = () => ({ client_id: crypto.randomUUID(), title: '', description: '', category: '', craft: '', material: '', colors: '', technique: '', region: '', care: '', story: '', image: '', price: 0, stock: 1, capacity: 20, lead_days: 14, status: 'draft', price_breakdown: {} });
const initialCosts = { material: 1400, labourHours: 20, labourRate: 60, packaging: 150, logistics: 250, overhead: 0, marginPercent: 20 };

function canvasPhoto(source, enhance) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.filter = enhance ? 'brightness(1.045) contrast(1.055) saturate(1.025)' : 'none';
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.84));
    };
    image.onerror = () => reject(new Error('Could not open that photo.'));
    image.src = source;
  });
}

function offlineSuggestion(notes) {
  const pair = /पैठणी|paithani|saree|साडी/i.test(notes) ? ['Paithani Saree', 'Textiles', 'Paithani weaving', 'Silk and zari']
    : /bag|jute|पिशवी|थैली/i.test(notes) ? ['Handmade Jute Bag', 'Bags & Accessories', 'Jute craft', 'Jute']
    : /diya|terracotta|माती|मिट्टी/i.test(notes) ? ['Terracotta Diyas', 'Home & Decor', 'Terracotta', 'Terracotta clay']
    : ['Handmade Product', 'Other Crafts', 'Artisan craft', ''];
  return { title: pair[0], category: pair[1], craft: pair[2], material: pair[3], description: notes, story: notes };
}

export function StudioPage() {
  const { id } = useParams(); const [params] = useSearchParams(); const navigate = useNavigate();
  const { user, language, online, refreshPending, notify } = useApp();
  const [form, setForm] = useState(initial), [notes, setNotes] = useState(''), [original, setOriginal] = useState('');
  const [costs, setCosts] = useState(initialCosts), [busy, setBusy] = useState(false), [loading, setLoading] = useState(Boolean(id)), [voiceProposal, setVoiceProposal] = useState(null), [confirmPublish, setConfirmPublish] = useState(false);
  const [photoMode, setPhotoMode] = useState('enhanced'), [listening, setListening] = useState(false);
  const fileInput = useRef(null);
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  useEffect(() => {
    if (id) api(`/products/${id}`).then(({ product }) => setForm(product)).catch((error) => notify(error.message)).finally(() => setLoading(false));
    const offlineKey = params.get('offlineKey');
    if (offlineKey) pendingItems(user?.id).then((items) => { const item = items.find((entry) => entry.key === offlineKey); if (item) setForm(item.payload); });
  }, [id]);
  useEffect(() => {
    const onPrice = (event) => setVoiceProposal(event.detail.amount);
    const onPublish = () => setConfirmPublish(true);
    window.addEventListener('tantu:voice-price', onPrice); window.addEventListener('tantu:voice-publish', onPublish);
    return () => { window.removeEventListener('tantu:voice-price', onPrice); window.removeEventListener('tantu:voice-publish', onPublish); };
  }, []);

  const upload = (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10_000_000) return notify('Choose a PNG, JPEG or WebP photo smaller than 10 MB.');
    const reader = new FileReader();
    reader.onload = async () => { try { const source = String(reader.result); setOriginal(source); update('image', await canvasPhoto(source, true)); setPhotoMode('enhanced'); notify('Photo added and gently enhanced.'); } catch (error) { notify(error.message); } };
    reader.readAsDataURL(file);
  };
  const switchPhoto = async (enhance) => { if (!original) return; update('image', await canvasPhoto(original, enhance)); setPhotoMode(enhance ? 'enhanced' : 'original'); };
  const dictate = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return notify('Speech input is unavailable in this browser. Type the story below.');
    const recognition = new Recognition();
    recognition.lang = languages.find((item) => item.code === language)?.speech || 'en-IN';
    recognition.onresult = (event) => setNotes((old) => `${old} ${event.results[0][0].transcript}`.trim());
    recognition.onerror = () => { setListening(false); notify('Speech input failed. Type the story instead.'); };
    recognition.onend = () => setListening(false);
    recognition.start(); setListening(true);
  };
  const suggest = async () => {
    if (!notes.trim()) return notify('Describe your product first.');
    setBusy(true);
    try { const data = online ? (await api('/catalog/suggest', { method: 'POST', body: { notes, image: form.image?.startsWith('data:') ? form.image : undefined } })).suggestion : offlineSuggestion(notes);
      setForm((old) => ({ ...old, ...data, client_id: old.client_id, image: old.image, status: old.status, price: old.price, stock: old.stock, capacity: old.capacity, lead_days: old.lead_days, version: old.version, price_breakdown: old.price_breakdown }));
      notify(data.source === 'openai_vision_text' ? 'AI suggested fields from your words and photo. Please review.' : 'Local rules suggested fields. Please review.');
    } catch (error) { notify(error.message); } finally { setBusy(false); }
  };
  const calculate = async () => { setBusy(true); try { const { price } = await api('/price', { method: 'POST', body: costs }); setForm((old) => ({ ...old, price: price.suggested, price_breakdown: price })); notify('Price calculated from your costs.'); } catch (error) { notify(error.message); } finally { setBusy(false); } };
  const save = async (status) => {
    if (!form.title.trim() || !form.category || !form.craft.trim()) return notify('Add a title, category and craft.');
    if (status === 'published' && (!form.image || Number(form.price) <= 0)) return notify('Add a photo and price before publishing.');
    const payload = { ...form, status, price: Number(form.price), stock: Number(form.stock), capacity: Number(form.capacity), lead_days: Number(form.lead_days) };
    const path = id ? `/products/${id}` : '/products'; const method = id ? 'PUT' : 'POST';
    const key = id ? `product:${id}` : `new:${form.client_id}`;
    setBusy(true); setConfirmPublish(false);
    if (!online) { await queueItem({ key, path, method, payload, userId: user.id }); await refreshPending(); notify(status === 'published' ? 'Publishing queued. It will sync when online.' : 'Draft saved offline.'); setBusy(false); return; }
    try { const { product } = await api(path, { method, body: payload }); notify(status === 'published' ? 'Published with a craft passport.' : 'Draft saved.'); navigate(status === 'published' ? `/product/${product.id}` : '/dashboard'); }
    catch (error) {
      if (!error.status) { await queueItem({ key, path, method, payload, userId: user.id }); await refreshPending(); notify('Connection dropped. Saved to offline queue.'); }
      else notify(error.message);
    } finally { setBusy(false); }
  };
  if (loading) return <div className="workspace-page"><Loading/></div>;
  return <Localize><div className="workspace-page studio-page"><Link className="back-link" to="/dashboard"><ArrowLeft size={17}/> Back to dashboard</Link><PageTitle title={id ? 'Edit your listing' : 'Create a product listing'} intro="A photo and your own words are enough to begin. Review every suggestion before it goes live."/>
    <div className="studio-grid"><div className="studio-form">
      <Panel className="studio-section"><div className="step-heading"><span className="step-number">1</span><div><h2>Show the craft</h2><p>Use a clear photo. Gentle enhancement keeps real texture and colour.</p></div></div><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" hidden onChange={upload}/><div className={`photo-drop ${form.image ? 'has-photo' : ''}`}>
        {form.image ? <img src={form.image} alt="Product preview"/> : <div className="photo-empty"><ImagePlus size={34}/><strong>Add a product photo</strong><span>PNG, JPEG or WebP · up to 10 MB</span></div>}
        <button type="button" className="photo-add" onClick={() => fileInput.current?.click()}><Camera size={17}/>{form.image ? 'Change photo' : 'Take or upload photo'}</button></div>{original && <div className="photo-switch"><span><WandSparkles size={16}/> Gentle photo studio</span><div><button className={photoMode === 'original' ? 'active' : ''} onClick={() => switchPhoto(false)}>Original</button><button className={photoMode === 'enhanced' ? 'active' : ''} onClick={() => switchPhoto(true)}>Enhanced</button></div></div>}<p className="field-note"><Info size={15}/> Exposure and contrast only. No background invention or texture replacement.</p></Panel>
      <Panel className="studio-section"><div className="step-heading"><span className="step-number">2</span><div><h2>Tell its story</h2><p>Speak in Marathi, Hindi or English, or type a few words.</p></div></div><div className="story-input"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="For example: ही पैठणी साडी हाताने विणलेली आहे"/><div><Button variant="secondary" onClick={dictate}><Mic size={17}/>{listening ? 'Listening…' : 'Speak about it'}</Button><Button onClick={suggest} loading={busy}><Sparkles size={17}/>Suggest fields</Button></div></div><p className="field-note">Suggestions use the configured AI provider or local craft rules. Browser speech input may require connectivity. All fields stay editable.</p><div className="two-fields"><Field label="Product name"><input required value={form.title} onChange={(event) => update('title', event.target.value)}/></Field><Field label="Category"><select value={form.category} onChange={(event) => update('category', event.target.value)}><option value="">Choose category</option><option>Textiles</option><option>Home & Decor</option><option>Bags & Accessories</option><option>Art & Paintings</option><option>Other Crafts</option></select></Field></div><Field label="Description"><textarea value={form.description} onChange={(event) => update('description', event.target.value)}/></Field><div className="two-fields"><Field label="Craft"><input value={form.craft} onChange={(event) => update('craft', event.target.value)}/></Field><Field label="Materials"><input value={form.material} onChange={(event) => update('material', event.target.value)}/></Field></div><div className="two-fields"><Field label="Colours"><input value={form.colors} onChange={(event) => update('colors', event.target.value)}/></Field><Field label="Technique"><input value={form.technique} onChange={(event) => update('technique', event.target.value)}/></Field></div><div className="two-fields"><Field label="Region"><input value={form.region} onChange={(event) => update('region', event.target.value)} placeholder={user?.region || 'Town, state'}/></Field><Field label="Care instructions"><input value={form.care} onChange={(event) => update('care', event.target.value)}/></Field></div><Field label="Story behind the piece"><textarea value={form.story} onChange={(event) => update('story', event.target.value)}/></Field></Panel>
      <Panel className="studio-section"><div className="step-heading"><span className="step-number">3</span><div><h2>Price and availability</h2><p>Set a fair price based on real costs, then decide when to publish.</p></div></div><div className="cost-mini"><div className="three-fields"><Field label="Materials ₹"><input type="number" min="0" value={costs.material} onChange={(event) => setCosts({ ...costs, material: event.target.value })}/></Field><Field label="Labour hours"><input type="number" min="0" value={costs.labourHours} onChange={(event) => setCosts({ ...costs, labourHours: event.target.value })}/></Field><Field label="Rate / hour ₹"><input type="number" min="0" value={costs.labourRate} onChange={(event) => setCosts({ ...costs, labourRate: event.target.value })}/></Field></div><div className="three-fields"><Field label="Packaging ₹"><input type="number" min="0" value={costs.packaging} onChange={(event) => setCosts({ ...costs, packaging: event.target.value })}/></Field><Field label="Logistics ₹"><input type="number" min="0" value={costs.logistics} onChange={(event) => setCosts({ ...costs, logistics: event.target.value })}/></Field><Field label="Margin %"><input type="number" min="0" max="100" value={costs.marginPercent} onChange={(event) => setCosts({ ...costs, marginPercent: event.target.value })}/></Field></div><Button variant="secondary" onClick={calculate} loading={busy}>Calculate suggested price <ArrowRight size={16}/></Button></div>{form.price_breakdown?.suggested && <div className="studio-price-note"><strong>Cost-based: {currency(form.price_breakdown.costBased)}</strong><span>Artisan margin: {currency(form.price_breakdown.margin)} · Rounded suggestion: {currency(form.price_breakdown.suggested)}</span></div>}<div className="three-fields"><Field label="Selling price ₹"><input type="number" min="0" value={form.price} onChange={(event) => update('price', event.target.value)}/></Field><Field label="Available stock"><input type="number" min="0" value={form.stock} onChange={(event) => update('stock', event.target.value)}/></Field><Field label="Monthly capacity"><input type="number" min="1" value={form.capacity} onChange={(event) => update('capacity', event.target.value)}/></Field></div><Field label="Production lead time (days)"><input type="number" min="1" value={form.lead_days} onChange={(event) => update('lead_days', event.target.value)}/></Field></Panel>
      <div className="studio-submit"><div className="sync-hint">{online ? <Cloud size={18}/> : <CloudOff size={18}/>} {online ? 'Changes save to your workspace' : 'Offline: changes will queue on this device'}</div><div><Button variant="secondary" onClick={() => save('draft')} loading={busy}>Save draft</Button><Button onClick={() => setConfirmPublish(true)} disabled={busy}>Publish listing <ArrowRight size={17}/></Button></div></div>
    </div><aside className="studio-preview"><div className="preview-label">Live preview</div><div className="studio-preview-card"><div className="studio-preview-image">{form.image ? <img src={form.image} alt="Preview"/> : <span><Camera size={36}/> Your photo appears here</span>}</div><div><Badge tone="blue">{form.category || 'Craft category'}</Badge><h3>{form.title || 'Your product name'}</h3><p>By {user?.name}</p><strong>{currency(form.price)}</strong></div></div><div className="preview-passport"><ShieldCheck size={22}/><div><strong>Craft passport on publish</strong><p>Every published listing gets a QR-linked public story. It begins as artisan-declared.</p></div></div></aside></div>
    {voiceProposal !== null && <div className="modal-backdrop"><div className="confirm-modal" role="dialog" aria-modal="true" aria-label="Confirm price change"><span className="modal-symbol">₹</span><h2>Change price to {currency(voiceProposal)}?</h2><p>The new value will stay in this form until you save or publish.</p><div><Button variant="secondary" onClick={() => setVoiceProposal(null)}>Cancel</Button><Button onClick={() => { update('price', voiceProposal); setVoiceProposal(null); }}>Confirm price</Button></div></div></div>}
    {confirmPublish && <div className="modal-backdrop"><div className="confirm-modal" role="dialog" aria-modal="true" aria-label="Confirm publication"><span className="modal-symbol">✳</span><h2>Publish this listing?</h2><p>Its product details and artisan-declared craft passport will be public. You can edit the listing later.</p><div><Button variant="secondary" onClick={() => setConfirmPublish(false)}>Keep editing</Button><Button onClick={() => save('published')} loading={busy}>Publish now</Button></div></div></div>}
  </div></Localize>;
}
