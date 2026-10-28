const API = {
  getToken() { return localStorage.getItem('ag_token'); },
  setToken(t) { localStorage.setItem('ag_token', t); },
  clearToken() { localStorage.removeItem('ag_token'); },
  async request(endpoint, options = {}) {
    const url = CONFIG.API_BASE + endpoint;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = this.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const config = { ...options, headers };
    if (options.body && typeof options.body === 'object') config.body = JSON.stringify(options.body);
    const res = await fetch(url, config);
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  },
  get(e) { return this.request(e); },
  post(e, b) { return this.request(e, { method: 'POST', body: b }); },
  put(e, b) { return this.request(e, { method: 'PUT', body: b }); },
  del(e) { return this.request(e, { method: 'DELETE' }); }
};
