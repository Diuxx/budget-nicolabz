# Architecture summary

- Pécule is an Eleventy/Nunjucks static budgeting app using native JavaScript,
  Web Awesome, and the Nicolabz design system.
- `index.html`, `_includes/`, and `_data/` define the page and templates.
  `src/scripts/ui/app.js` assembles the UI; `core/` holds budget logic and
  storage, while `services/` integrates the separate Nicolabz Identity API.
- Budget data is stored in browser `localStorage` as Pécule v1. The schema and
  import template are generated from the model during tests and builds; legacy
  backups are migrated and validated.
- Google sign-in and optional manual Drive synchronization use the Identity
  service. Versioned writes detect conflicts; local data remains available.
- `npm test` runs Node.js tests; `npm run build` generates the static `dist/`
  site. See [USAGE.md](USAGE.md) for operational details.
