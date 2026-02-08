'use strict';

const fetch = require('node-fetch');

class HjmClient {
  constructor({ baseUrl, tokenPath, clientId, clientSecret, username, password }) {
    this.baseUrl = (baseUrl || '').replace(/\/+$/, '');
    this.tokenUrl = this.baseUrl + tokenPath;

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.username = username;
    this.password = password;

    this._token = null;
    this._tokenExp = 0;
  }

  _assertConfigured() {
    if (!this.clientId || !this.clientSecret || !this.username || !this.password) {
      throw new Error('Missing app settings: clientId/clientSecret/username/password. Open Homey > Apps > HJM API > Configure App.');
    }
  }

  async _fetchToken() {
    this._assertConfigured();

    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'password',
      username: this.username,
      password: this.password,
    });

    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${basic}`,
      },
      body,
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Token error ${res.status}: ${txt}`);
    }

    const json = await res.json();
    this._token = json.access_token;
    const expiresIn = Number(json.expires_in || 3600);
    this._tokenExp = Date.now() + expiresIn * 1000;
    return this._token;
  }

  async getToken() {
    // Reuse token until 30 seconds before expiration
    if (this._token && Date.now() < (this._tokenExp - 30000)) return this._token;
    return this._fetchToken();
  }

  async request(path, { method = 'GET', jsonBody = null, auth = true } = {}) {
    const url = this.baseUrl + (path.startsWith('/') ? path : `/${path}`);

    const headers = { accept: 'application/json' };
    if (jsonBody) headers['content-type'] = 'application/json';

    if (auth) {
      const token = await this.getToken();
      headers.authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: jsonBody ? JSON.stringify(jsonBody) : undefined,
    });

    if (!res.ok) {
      const txt = await res.text();
      const err = new Error(`HTTP ${res.status} ${method} ${path}: ${txt}`);
      err.status = res.status;
      throw err;
    }

    return res.json();
  }

  // API convenience methods
  async getGroupedDevs() {
    return this.request('/api/v2/grouped_devs', { method: 'GET', auth: true });
  }

  async getHtr2Status(devId) {
    return this.request(`/api/v2/devs/${devId}/htr/2/status`, { method: 'GET', auth: true });
  }

  async setHtr2Status(devId, payload) {
    return this.request(`/api/v2/devs/${devId}/htr/2/status`, { method: 'POST', jsonBody: payload, auth: true });
  }
}

module.exports = HjmClient;
