/** Fonction pure : détermine la direction sans modifier les données. */
export function decideSync({ anchor, fileId, localDigest, remoteDigest }) {
  if (localDigest === remoteDigest) return 'identical';
  if (!anchor || anchor.fileId !== fileId) return 'conflict';
  const localChanged = localDigest !== anchor.digest;
  const remoteChanged = remoteDigest !== anchor.digest;
  if (localChanged && remoteChanged) return 'conflict';
  if (remoteChanged) return 'pull';
  if (localChanged) return 'push';
  // L'ancre est cohérente mais les données sont différentes : ne pas écraser silencieusement.
  return 'conflict';
}

export async function digestData(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
