import { normalizeImport } from '../core/storage.js';
import { digestData } from '../core/sync-plan.js';

const ANCHOR_PREFIX = 'marge:identity:anchor:v1:';
const storageKey = (appId, userId) => `${ANCHOR_PREFIX}${appId}:${userId}`;

function readAnchor(storage, appId, userId) {
  try { return JSON.parse(storage.getItem(storageKey(appId, userId)) || 'null'); }
  catch { return null; }
}

function writeAnchor(storage, appId, userId, version, digest) {
  storage.setItem(storageKey(appId, userId), JSON.stringify({
    version, digest, updatedAt: new Date().toISOString(),
  }));
}

export function getIdentitySyncInfo({ storage, appId, userId }) {
  if (!userId) return null;
  return readAnchor(storage, appId, userId);
}

/**
 * Ne jamais écraser des modifications concurrentes sans confirmation.
 * Le numéro de version serveur est toujours réutilisé sur PUT (CAS / 409).
 */
export function decideIdentitySync({ anchor, remoteVersion, localDigest, remoteDigest, mode = 'auto' }) {
  if (localDigest === remoteDigest) return 'identical';
  if (mode !== 'auto') return 'conflict';
  if (!anchor || !Number.isInteger(anchor.version) || typeof anchor.digest !== 'string') return 'conflict';
  const localChanged = localDigest !== anchor.digest;
  const remoteChanged = remoteVersion !== anchor.version || remoteDigest !== anchor.digest;
  if (localChanged && remoteChanged) return 'conflict';
  if (remoteChanged) return 'remote';
  if (localChanged) return 'local';
  return 'conflict';
}

/**
 * Appelle la même API que les autres applications nicolabz (namespace « budget »).
 * Les fichiers Drive restent gérés par nodjs-google-auth, pas par Marge.
 */
export async function synchronizeIdentity({ api, userId, getData, setData, choose, storage, mode = 'auto' }) {
  if (!userId) throw new Error('Une session Google valide est nécessaire.');
  const localData = normalizeImport(getData());
  const localDigest = await digestData(localData);
  const remote = await api.readBudget();
  if (!Number.isInteger(remote.version) || remote.version < 0) throw new Error('Version Drive invalide.');

  if (remote.data === null) {
    if (remote.version !== 0) throw new Error('Réponse Drive incohérente.');
    const choice = await choose({ type: 'empty', message: 'Aucune sauvegarde Marge sur Google Drive. Envoyer les données de ce navigateur ?' });
    if (choice !== 'local') return 'cancel';
    const saved = await api.saveBudget(0, localData);
    writeAnchor(storage, api.appId, userId, saved.version, localDigest);
    return 'created';
  }

  const remoteData = normalizeImport(remote.data);
  const remoteDigest = await digestData(remoteData);
  const anchor = readAnchor(storage, api.appId, userId);
  let decision = decideIdentitySync({ anchor, remoteVersion: remote.version, localDigest, remoteDigest, mode });

  if (decision === 'conflict') {
    const message = mode === 'pull'
      ? 'Remplacer le budget enregistré dans ce navigateur par celui de Google Drive ?'
      : mode === 'push'
        ? 'Remplacer le budget Google Drive par les données de ce navigateur ?'
        : 'Les deux budgets diffèrent. Choisis la version à conserver (aucune fusion automatique).';
    decision = await choose({ type: 'conflict', message });
  }

  if (decision === 'cancel') return 'cancel';
  if (decision === 'identical') {
    writeAnchor(storage, api.appId, userId, remote.version, remoteDigest);
    return 'identical';
  }
  if (decision === 'remote') {
    // setData doit terminer la sauvegarde locale avant d'acter la synchronisation.
    await setData(remoteData);
    writeAnchor(storage, api.appId, userId, remote.version, remoteDigest);
    return 'downloaded';
  }
  if (decision === 'local') {
    const saved = await api.saveBudget(remote.version, localData);
    writeAnchor(storage, api.appId, userId, saved.version, localDigest);
    return 'uploaded';
  }
  throw new Error('Choix de synchronisation non reconnu.');
}

/** Référence la nouvelle version distante après une remise à zéro volontaire. */
export async function markIdentitySynced({ storage, appId, userId, version, data }) {
  if (!userId || !Number.isSafeInteger(version) || version < 0) throw new Error('Référence Drive invalide.');
  writeAnchor(storage, appId, userId, version, await digestData(normalizeImport(data)));
}
