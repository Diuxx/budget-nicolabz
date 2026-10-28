/**
 * Configuration publique du client statique Marge.
 * Le Client ID/secret Google, les jetons et le chiffrement restent sur l'API Node.
 * En local, utiliser localhost pour les deux services (jamais 127.0.0.1).
 */
export const IDENTITY_APP_ID = 'budget';
export const IDENTITY_BASE_URL = location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://auth.nicolabz.dev';
