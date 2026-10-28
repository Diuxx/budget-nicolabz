/** Client HTTP pour nodjs-google-auth, sans Google SDK côté navigateur. */
export class IdentityApiError extends Error {
  constructor(message, code, status, options = {}) {
    super(message, options);
    this.name = 'IdentityApiError';
    this.code = code;
    this.status = status;
  }
}

export class IdentityApi {
  constructor({ baseUrl, appId, fetchFunction = fetch }) {
    const parsed = new URL(baseUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Adresse du service d’identité invalide.');
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
      throw new Error('HTTPS requis pour le service d’identité hors localhost.');
    }
    if (!/^[a-z0-9_-]{1,48}$/i.test(appId)) throw new Error('Identifiant d’application invalide.');
    this.baseUrl = parsed.origin;
    this.appId = appId;
    // window.fetch est une API Web IDL : Chromium rejette un appel avec un
    // `this` différent de Window (TypeError: Illegal invocation).
    // Lier aussi les fonctions injectées permet de reproduire ce cas en test.
    this.fetchFunction = fetchFunction.bind(globalThis);
  }

  redirectUrl(path, returnTo) {
    const url = new URL(path, this.baseUrl);
    url.searchParams.set('app', this.appId);
    url.searchParams.set('return_to', returnTo);
    return url.href;
  }

  loginUrl(returnTo) { return this.redirectUrl('/auth/google/start', returnTo); }
  driveConsentUrl(returnTo) { return this.redirectUrl('/auth/drive/start', returnTo); }

  async request(path, options = {}) {
    let response;
    try {
      response = await this.fetchFunction(new URL(path, this.baseUrl), {
        credentials: 'include',
        cache: 'no-store',
        ...options,
        headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      });
    } catch (error) {
      throw new IdentityApiError('API d’authentification inaccessible. Vérifie son adresse, HTTPS et CORS.', 'NETWORK_ERROR', 0, { cause: error });
    }
    let body;
    try { body = await response.json(); }
    catch { throw new IdentityApiError('Réponse non JSON du serveur.', 'INVALID_RESPONSE', response.status); }
    if (!response.ok) {
      throw new IdentityApiError(body.error?.message || `Erreur HTTP ${response.status}`, body.error?.code || 'API_ERROR', response.status);
    }
    return body;
  }

  getSession() { return this.request('/api/session'); }
  logout() { return this.request('/api/logout', { method: 'POST' }); }
  disconnectDrive() { return this.request('/api/drive/disconnect', { method: 'POST' }); }
  readBudget() { return this.request(`/api/sync/${this.appId}`); }
  saveBudget(version, data) {
    return this.request(`/api/sync/${this.appId}`, {
      method: 'PUT',
      body: JSON.stringify({ version, data }),
    });
  }
}
