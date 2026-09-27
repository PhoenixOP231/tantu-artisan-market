import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { api } from './api.js';
import { useApp } from './context.jsx';
import { translateUi } from './i18n.js';

function localizedChildren(children, language) {
  return React.Children.map(children, (child) => {
    if (typeof child !== 'string') return child;
    const value = child.trim();
    return value ? child.replace(value, translateUi(language, value)) : child;
  });
}
function localizeTree(node, language) {
  if (typeof node === 'string') return localizedChildren(node, language);
  if (!React.isValidElement(node)) return node;
  const props = {};
  for (const name of ['placeholder', 'aria-label', 'title', 'alt']) {
    if (typeof node.props[name] === 'string') props[name] = translateUi(language, node.props[name]);
  }
  if (node.type === 'option' && typeof node.props.children === 'string') props.value = node.props.value ?? node.props.children;
  if (node.props.children !== undefined) props.children = React.Children.map(node.props.children, (child) => localizeTree(child, language));
  return React.cloneElement(node, props);
}

export function Localize({ children }) {
  const { language } = useApp();
  return React.Children.map(children, (child) => localizeTree(child, language));
}

export function useLoad(path, enabled = true) {
  const [state, setState] = useState({ data: null, loading: Boolean(enabled), error: '' });
  const refresh = useCallback(async () => {
    if (!enabled) return;
    setState((old) => ({ ...old, loading: true, error: '' }));
    try { const data = await api(path); setState({ data, loading: false, error: '' }); }
    catch (error) { setState({ data: null, loading: false, error: error.message }); }
  }, [path, enabled]);
  useEffect(() => { refresh(); }, [refresh]);
  return { ...state, refresh };
}

export function Button({ children, variant = 'primary', loading, className = '', ...props }) {
  const { language } = useApp();
  return <button className={`button button-${variant} ${className}`} disabled={loading || props.disabled} {...props}>
    {loading && <LoaderCircle size={16} className="spin" aria-hidden="true" />}{localizedChildren(children, language)}
  </button>;
}
export function ButtonLink({ children, to, variant = 'primary', className = '' }) {
  const { language } = useApp();
  return <Link className={`button button-${variant} ${className}`} to={to}>{localizedChildren(children, language)}</Link>;
}
export function Badge({ children, tone = 'default' }) { const { language } = useApp(); return <span className={`badge badge-${tone}`}>{localizedChildren(children, language)}</span>; }
export function Panel({ children, className = '' }) { const { language } = useApp(); return <section className={`panel ${className}`}>{React.Children.map(children, (child) => localizeTree(child, language))}</section>; }
export function PageTitle({ title, intro, action }) {
  const { language } = useApp();
  return <div className="page-heading"><div><h1>{translateUi(language, title)}</h1>{intro && <p>{translateUi(language, intro)}</p>}</div>{action}</div>;
}
export function Loading() { return <Localize><div className="skeleton-grid" aria-label="Loading"><div/><div/><div/></div></Localize>; }
export function Empty({ title, text, to, action }) {
  const { language } = useApp();
  return <div className="empty"><div className="empty-mark">✳</div><h3>{translateUi(language, title)}</h3><p>{translateUi(language, text)}</p>{to && <Link className="text-link" to={to}>{translateUi(language, action)} <ArrowRight size={16}/></Link>}</div>;
}
export function ErrorBox({ message, retry }) { const { language } = useApp(); return <div className="error-box" role="alert">{translateUi(language, message)}{retry && <Button variant="quiet" onClick={retry}>Try again</Button>}</div>; }
export function Field({ label, hint, children }) { const { language } = useApp(); return <label className="field"><span>{translateUi(language, label)}</span>{children}{hint && <small>{translateUi(language, hint)}</small>}</label>; }
