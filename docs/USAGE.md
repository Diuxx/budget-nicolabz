# Usage guide

## Requirements and development

Install Node.js 20 or newer and npm, then run:

```bash
npm install
npm run dev
```

Open `http://localhost:8081`. The application works locally without Google.

```bash
npm test
npm run build
```

Tests use Node.js's test runner. The build generates the static site in
`dist/`. Both commands regenerate the public JSON schema and import template
in `src/assets/schemas/` from the budget model.

## Budgeting

Each month has independent income and expense entries with planned and actual
amounts and dates. Browsing an absent month does not create data. Preparing a
month copies the previous month's plans without actual amounts; copying a
budget to an existing next month requires confirmation.

Entries belong to accounts and can be linked to funding income. Internal
transfers are excluded from external income totals. Annual savings by income
type do not count savings expenses a second time. Actual balances are estimates
from recorded entries, not bank balances.

## Backups, import, and reset

Use **Paramètres → Données et sauvegardes** to export or import a JSON budget
and download the template or validation schema. JSON is the complete,
reimportable backup; the current format is Pécule v1, using monthly `YYYY-MM`
periods. The template and schema are `pecule-modele-import-v1.json` and
`pecule-budget-v1.schema.json`. Imports accept `.json` files up to 5 MiB and
validate the schema and business relationships before asking to replace local
data.

Historical v1–v4 backups are converted to the current format. Older local data
is preserved during migration, and a recovery copy is made before a successful
import when the existing budget can be read. An invalid local backup is not
silently replaced with example data.

The user menu also exports an Excel workbook with one sheet per year. It is
for consultation, not a complete backup: Excel import is not implemented.

**Réinitialiser toutes mes données** requires entering `EFFACER`. By default
it resets only this browser and removes old local recovery copies to prevent
automatic restoration. The optional Drive reset replaces the remote document
with an empty budget using a version-checked write; a failed write or conflict
leaves the local budget intact. It does not delete the Drive file or revoke
Google access. Export a backup before resetting.

## Google sign-in and Drive

Pécule uses a separate Nicolabz Identity server. Configure its public API URL
in `src/scripts/config/identity.js` if necessary: localhost uses
`http://localhost:3000`, while other hosts use `https://auth.nicolabz.dev`.
The app ID is `pecule`. Google credentials and encryption keys remain on the
server, never in the browser app.

For local development, configure the Identity server's `PUBLIC_BASE_URL` and
allow the exact Pécule origin in `CLIENT_APPS_JSON`, preserving other registered
applications:

```dotenv
PUBLIC_BASE_URL=http://localhost:3000
CLIENT_APPS_JSON=[{"id":"pecule","origins":["http://localhost:8081"]}]
```

Configure Google OAuth callbacks on the Identity server's origin, and restart
the server after configuration changes. Use `localhost` consistently rather
than mixing it with `127.0.0.1`. In production, use HTTPS and register the exact
deployed Pécule origin.

In the profile menu, choose **Connexion Google**, then **Autoriser Google
Drive**, and finally **Synchroniser**. Drive consent is separate from login.
The first upload requires confirmation. When local and remote budgets differ
without a usable synchronization anchor, choose which version to keep; there
is no automatic merge. A concurrent write can produce a conflict, requiring
another synchronization. Signing out does not erase the local or Drive budget.

`INVALID_RETURN_URL` and `ORIGIN_FORBIDDEN` generally indicate an unregistered
or mismatched origin. For connection failures, check the Identity URL, server
availability, and browser cookies; for Drive errors, repeat Drive consent.
The server stores the budget in Drive's private application data folder, not
visible in My Drive. Its document size limit is 1 MiB.

Local storage belongs to the browser, not the signed-in Google account. Avoid
sharing a browser with others when budget data must remain private. Keep secure
JSON backups and never commit financial data or credentials.

## Deployment

`deploy.sh` installs dependencies, tests, builds, and publishes the static site
under `/var/www/pecule`. It requires npm, rsync, Nginx, and, for HTTPS setup,
certbot with its Nginx plugin. Point DNS to the server and open ports 80 and 443.

```bash
bash deploy.sh --domain=pecule.example.com --email=admin@example.com --ssl
bash deploy.sh
bash deploy.sh --release
```

The first command configures Nginx and requests a certificate. Without
`--release`, the script updates the current release; `--release` creates a new
one and switches the `current` link. `--nginx` configures Nginx without
requesting a certificate. `DOMAIN` and `CERTBOT_EMAIL` can also supply the
domain and email. An existing HTTPS configuration for the domain is preserved.
Register the deployed origin with the Identity server as described above.
