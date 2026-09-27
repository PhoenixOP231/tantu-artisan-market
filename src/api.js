export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const currency = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
export const shortDate = (value, language = 'en') => value ? new Date(value).toLocaleDateString(`${language}-IN`, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
