import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { flushQueue, pendingItems } from './offline.js';
import { t, translateUi } from './i18n.js';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [ready, setReady] = useState(false);
  const [language, setLanguageState] = useState(localStorage.getItem('tantu-language') || 'en');
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [notice, setNotice] = useState('');
  const userIdRef = useRef(null);
  const setUser = (value) => {
    userIdRef.current = value?.id || null;
    setUserState(value);
    if (value) { localStorage.setItem('tantu-user', JSON.stringify(value)); localStorage.removeItem('tantu-logout-pending'); }
    else localStorage.removeItem('tantu-user');
  };
  const setLanguage = (value) => { setLanguageState(value); localStorage.setItem('tantu-language', value); };
  const refreshPending = () => pendingItems(userIdRef.current).then((items) => setPending(items.length)).catch(() => setPending(0));
  const sync = () => {
    const userId = userIdRef.current;
    return flushQueue(userId, refreshPending, () => userIdRef.current === userId).then(refreshPending).catch(() => {});
  };
  const notify = (message) => { setNotice(translateUi(language, message)); window.setTimeout(() => setNotice(''), 4800); };

  useEffect(() => { document.documentElement.lang = language; }, [language]);

  useEffect(() => {
    const restoreSession = async () => {
      if (localStorage.getItem('tantu-logout-pending')) {
        try { await api('/auth/logout', { method: 'POST', body: {} }); localStorage.removeItem('tantu-logout-pending'); }
        catch { setUser(null); setReady(true); return; }
      }
      try { const { user: active } = await api('/session'); setUser(active); }
      catch { if (!navigator.onLine) { try { setUser(JSON.parse(localStorage.getItem('tantu-user'))); } catch { /* no cached user */ } } }
      finally { setReady(true); }
    };
    restoreSession();
    refreshPending();
    const onOnline = () => {
      setOnline(true);
      if (localStorage.getItem('tantu-logout-pending')) api('/auth/logout', { method: 'POST', body: {} }).then(() => localStorage.removeItem('tantu-logout-pending')).catch(() => {});
      else sync();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  useEffect(() => { if (user && online) sync(); }, [user?.id, online]);
  return <AppContext.Provider value={{ user, setUser, ready, language, setLanguage, t: (key) => t(language, key), online, pending, refreshPending, sync, notify }}>
    {children}{notice && <div className="toast" role="status">{notice}</div>}
  </AppContext.Provider>;
}
