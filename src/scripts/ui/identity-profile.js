/** Présentation de la session Nicolabz Identity (aucun accès réseau ici). */
function setText(root, selector, value) {
  const node = root.querySelector(selector);
  if (node) node.textContent = value;
}

function showItem(root, selector, visible) {
  const node = root.querySelector(selector);
  if (node) node.hidden = !visible;
}

function initialLetters(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase('fr') : '?';
}

function allowedPicture(url) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch { return null; }
}

/**
 * Les attributs sont utilisés plutôt que les propriétés JS : si le Web Component
 * n'est pas encore défini au moment du retour OAuth, sa mise à niveau reste sûre.
 */
export function renderIdentityProfile(root, { session, checking = false, error = null, locallyModified = false }) {
  const user = session.authenticated && session.user ? session.user : null;
  const authenticated = Boolean(user);
  const driveConnected = authenticated && session.driveConnected === true;
  const avatar = root.querySelector('#profileAvatar');
  if (avatar) {
    const name = user?.name || user?.email || '';
    avatar.setAttribute('initials', initialLetters(name));
    avatar.setAttribute('label', authenticated ? `Compte Google de ${name}` : 'Compte Google non connecté');
    const picture = allowedPicture(user?.picture);
    if (picture) avatar.setAttribute('image', picture);
    else avatar.removeAttribute('image');
  }

  const state = checking && !authenticated ? 'loading' : error ? 'error' : authenticated ? 'connected' : 'local';
  const headline = state === 'loading' ? 'Vérification…'
    : state === 'error' ? 'Service indisponible'
    : !authenticated ? 'Mode local'
    : !driveConnected ? 'Google connecté'
    : locallyModified ? 'À synchroniser' : 'Drive connecté';
  const indicator = root.querySelector('#saveIndicator');
  if (indicator) {
    indicator.dataset.state = state;
    indicator.title = state === 'error' ? `Connexion au service impossible : ${error}`
      : driveConnected ? 'Google connecté · Drive autorisé · Sauvegarde locale active'
      : authenticated ? 'Compte Google connecté · Drive à autoriser · Sauvegarde locale active'
      : 'Budget enregistré localement dans ce navigateur';
  }
  setText(root, '#connection-status', headline);
  setText(root, '#profileName', user?.name || (checking ? 'Vérification de la session…' : error ? 'Service indisponible' : 'Non connecté'));
  setText(root, '#profileEmail', user?.email || (error ? error : 'Connexion via Nicolabz Identity'));
  setText(root, '#profileDriveState', driveConnected ? (locallyModified ? 'Drive autorisé · modifications locales à envoyer' : 'Drive autorisé · synchronisation manuelle')
    : authenticated ? 'Drive non autorisé' : 'Drive non connecté');

  showItem(root, '#profileLogin', !authenticated && !checking);
  showItem(root, '#profileDriveConnect', authenticated && !driveConnected);
  showItem(root, '#profileSync', authenticated);
  showItem(root, '#profileLogoutDivider', authenticated);
  showItem(root, '#profileLogout', authenticated);
  showItem(root, '#profileRefresh', !checking);


}

/** Empêche qu'un résultat de session incomplet soit affiché comme une connexion valide. */
export function parseIdentitySession(payload) {
  const id = payload?.user?.id;
  const validId = (typeof id === 'number' && Number.isSafeInteger(id) && id > 0)
    || (typeof id === 'string' && id.length > 0);
  if (!payload || payload.authenticated !== true || !payload.user || !validId) {
    return { authenticated: false, user: null, driveConnected: false };
  }
  return {
    authenticated: true,
    user: {
      id: payload.user.id,
      name: typeof payload.user.name === 'string' ? payload.user.name : '',
      email: typeof payload.user.email === 'string' ? payload.user.email : '',
      picture: typeof payload.user.picture === 'string' ? payload.user.picture : '',
    },
    driveConnected: payload.driveConnected === true,
  };
}
