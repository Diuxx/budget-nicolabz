# Project reference

## Purpose and technology

Pécule is a static personal budgeting application built with Eleventy,
Nunjucks, native JavaScript, and Web Awesome. Budget data is stored in the
browser; the separate Nicolabz Identity service provides Google authentication
and optional Google Drive synchronization. There is no Pécule backend.

## Architecture and conventions

- `index.html`, `_includes/`, and `_data/` provide the Eleventy entry point,
  templates, and site data.
- `src/scripts/core/` contains budget models, calculations, schema validation,
  migrations, and persistence. Keep business logic independent of the UI.
- `src/scripts/services/` handles Identity API calls and synchronization;
  `src/scripts/ui/` assembles views, forms, and interactions.
- `src/scripts/config/identity.js` contains public Identity configuration;
  Google credentials, tokens, and encryption keys belong on the server.
- `src/styles/` contains application styles. The copied design-system assets in
  `src/nicolabz-design-system/` come from the separate Nicolabz design-system
  project; update them there rather than editing them directly in Pécule.
- `scripts/` contains Node.js tests and the schema generation script.
  Eleventy outputs the static site to `dist/`.

The current budget format is Pécule v1. `src/scripts/core/budget-schema.js`
defines its public schema, while `storage.js` enforces additional business
rules and migrates older data. The build and test commands regenerate the schema
and import template in `src/assets/schemas/`; do not edit those generated files
directly. Preserve compatible data and migration paths when changing the model.
Never use `localStorage.clear()`: other applications may share the origin.

Drive synchronization compares local and remote data and uses remote versions
to detect concurrent writes. Do not silently overwrite conflicts. Escape user
data when rendering HTML.

See [USAGE.md](USAGE.md) for commands, deployment, and data management.
