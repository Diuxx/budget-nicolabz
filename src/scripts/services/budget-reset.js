import { createEmptyBudget } from '../core/period-model.js';
import { resetLocalData } from '../core/storage.js';
import { markIdentitySynced } from './identity-sync.js';

/** Réinitialise les données utilisateur en conservant les références par défaut.
 * En mode Drive, l'écriture versionnée est tentée avant la remise à zéro locale :
 * un échec/409 laisse ainsi le budget du navigateur intact.
 */
export async function resetBudget({ storage, api, userId, resetDrive = false }) {
  const blank = createEmptyBudget();
  if (!resetDrive) return { data: resetLocalData(storage, blank), driveReset: false };
  if (!userId || !api) throw new Error('Connectez votre compte Google et autorisez Drive pour effacer aussi la sauvegarde distante.');
  const remote = await api.readBudget();
  if (!Number.isSafeInteger(remote.version) || remote.version < 0) throw new Error('Version de sauvegarde Drive invalide.');
  const saved = await api.saveBudget(remote.version, blank);
  if (!Number.isSafeInteger(saved.version) || saved.version <= remote.version) throw new Error('Google Drive n’a pas confirmé la nouvelle version.');
  const data = resetLocalData(storage, blank);
  await markIdentitySynced({ storage, appId: api.appId, userId, version: saved.version, data });
  return { data, driveReset: true };
}
