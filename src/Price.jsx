import React, { useEffect, useState } from 'react';
import { ArrowRight, Calculator, Info, Scale } from 'lucide-react';
import { api, currency } from './api.js';
import { useApp } from './context.jsx';
import { translateUi } from './i18n.js';
import { Button, Field, Localize, PageTitle, Panel } from './ui.jsx';

const initial = { material: 1400, labourHours: 20, labourRate: 60, packaging: 150, logistics: 250, overhead: 0, marginPercent: 20, marketReference: '' };
export function PricePage() {
  const { language } = useApp();
  const [form, setForm] = useState(initial), [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const calculate = async (value = form) => {
    setBusy(true); setError('');
    try { const data = await api('/price', { method: 'POST', body: value }); setResult(data.price); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  useEffect(() => { calculate(initial); }, []);
  const update = (key, value) => setForm({ ...form, [key]: value });
  const costs = result && [
    ['Materials', result.material, 'cost-material'], ['Labour', result.labour, 'cost-labour'],
    ['Packaging', result.packaging, 'cost-packaging'], ['Logistics', result.logistics, 'cost-logistics'],
    ['Overhead', result.overhead, 'cost-overhead'], ['Artisan margin', result.margin, 'cost-margin'],
  ];
  const tr = (english) => translateUi(language, english);
  const explanation = result && (language === 'hi'
    ? `${currency(result.base)} दर्ज लागत को पूरा करते हैं। ${currency(result.margin)} कारीगर का ${result.marginPercent}% लाभ है। सुझाया बिक्री मूल्य अगले ₹10 तक पूर्णांकित है।`
    : language === 'mr'
      ? `${currency(result.base)} नोंदवलेला खर्च भरून काढतात. ${currency(result.margin)} हा कारागिराचा ${result.marginPercent}% नफा आहे. सुचवलेली विक्री किंमत पुढील ₹10 पर्यंत पूर्णांकित केली आहे.`
      : result.explanation);
  return <Localize><div className="container public-page price-page"><PageTitle title="A price that shows its work." intro="Enter your real costs. See the cost-based price, margin and a rounded selling suggestion."/>
    <div className="price-layout"><Panel className="price-form"><div className="panel-title"><span className="panel-icon"><Calculator size={22}/></span><div><h2>Your cost inputs</h2><p>Amounts are per piece in Indian rupees.</p></div></div><form onSubmit={(event) => { event.preventDefault(); calculate(); }}><div className="two-fields"><Field label="Raw materials"><input type="number" min="0" value={form.material} onChange={(event) => update('material', event.target.value)}/></Field><Field label="Labour hours"><input type="number" min="0" step="0.5" value={form.labourHours} onChange={(event) => update('labourHours', event.target.value)}/></Field></div><div className="two-fields"><Field label="Labour rate / hour"><input type="number" min="0" value={form.labourRate} onChange={(event) => update('labourRate', event.target.value)}/></Field><Field label="Packaging"><input type="number" min="0" value={form.packaging} onChange={(event) => update('packaging', event.target.value)}/></Field></div><div className="two-fields"><Field label="Logistics and platform"><input type="number" min="0" value={form.logistics} onChange={(event) => update('logistics', event.target.value)}/></Field><Field label="Overhead"><input type="number" min="0" value={form.overhead} onChange={(event) => update('overhead', event.target.value)}/></Field></div><div className="two-fields"><Field label="Artisan margin %"><input type="number" min="0" max="100" value={form.marginPercent} onChange={(event) => update('marginPercent', event.target.value)}/></Field><Field label="Market reference (optional)" hint="Your own comparable price; not scraped market data"><input type="number" min="0" value={form.marketReference} onChange={(event) => update('marketReference', event.target.value)}/></Field></div>{error && <div className="form-error" role="alert">{error}</div>}<Button type="submit" loading={busy} className="full">Calculate fair price <ArrowRight size={17}/></Button></form></Panel>
      <div className="price-result">{result ? <><div className="price-hero"><span>Suggested selling price</span><strong>{currency(result.suggested)}</strong><small>Per piece, rounded to the next ₹10</small></div><Panel className="price-breakdown"><div className="panel-title"><span className="panel-icon"><Scale size={21}/></span><div><h2>How it adds up</h2><p>Every rupee has a reason.</p></div></div><div className="cost-bar" aria-label="Cost breakdown">{costs.filter((item) => item[1] > 0).map(([name, value, cls]) => <div key={name} className={cls} style={{ width: `${value / result.costBased * 100}%` }} title={`${tr(name)}: ${currency(value)}`}/>)}</div><div className="cost-list">{costs.map(([name, value, cls]) => <div key={name}><span><i className={cls}/>{tr(name)}</span><strong>{currency(value)}</strong></div>)}</div><div className="cost-total"><span>Cost-based price</span><strong>{currency(result.costBased)}</strong></div>{result.marketReference !== null && <div className="market-reference"><span>Your market reference</span><strong>{currency(result.marketReference)}</strong></div>}</Panel><div className="explain-note"><Info size={18}/><p>{explanation} The market reference is user supplied and does not change the calculation.</p></div></> : <Panel>Enter your costs to see a recommendation.</Panel>}</div></div></div></Localize>;
}
