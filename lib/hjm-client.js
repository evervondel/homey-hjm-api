'use strict';

const fetch = require('node-fetch');

class HjmClient {
  constructor({ baseUrl, tokenPath, clientId, clientSecret, username, password, debug = false, logger = null }) {
    this.baseUrl = (baseUrl || '').replace(/\/+$/, '');
    this.tokenUrl = this.baseUrl + tokenPath;

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.username = username;
    this.password = password;

    this._token = null;
    this._tokenExp = 0;

    this.debug = !!debug;
    this.logger = logger || null;
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

    const headers = {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${basic}`,
    };

    if (this.debug) this._log('TOKEN REQUEST', { url: this.tokenUrl, method: 'POST', headers: this._maskAuth(headers) });

    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers,
      body,
    });

    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = text; }

    if (this.debug) this._log('TOKEN RESPONSE', { status: res.status, body: json });

    if (!res.ok) {
      throw new Error(`Token error ${res.status}: ${text}`);
    }

    this._token = json && json.access_token;
    const expiresIn = Number((json && json.expires_in) || 3600);
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

    const headers = {
      "Accept": 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    if (jsonBody) headers['Content-Type'] = 'application/json';


    if (auth) {
      const token = await this.getToken();
      headers.authorization = `Bearer ${token}`;
    }

    if (this.debug) this._log('HTTP REQUEST', { method, url, headers: this._maskAuth(headers), body: jsonBody });

    const res = await fetch(url, {
      method,
      headers,
      body: jsonBody ? JSON.stringify(jsonBody) : undefined,
    });

    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch (e) { parsed = text; }

    if (this.debug) this._log('HTTP RESPONSE', { method, url, status: res.status, body: parsed });

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${method} ${path}: ${text}`);
      err.status = res.status;
      throw err;
    }

    return parsed;
  }

  _log(prefix, obj) {
    try {
      const msg = typeof obj === 'string' ? obj : JSON.stringify(obj);
      if (this.logger && typeof this.logger === 'function') {
        this.logger(`${prefix}: ${msg}`);
      } else if (this.logger && this.logger.log) {
        this.logger.log(`${prefix}:`, obj);
      } else {
        // Fallback to console
        console.debug(`${prefix}:`, obj);
      }
    } catch (e) {
      // Ignore logging failures
    }
  }

  _maskAuth(headers) {
    const copy = Object.assign({}, headers);
    if (copy.authorization) {
      copy.authorization = copy.authorization.replace(/Bearer\s+.+/i, 'Bearer *****').replace(/Basic\s+.+/i, 'Basic *****');
    }
    return copy;
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
