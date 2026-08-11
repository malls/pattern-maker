# PM-16: Publish: GitHub repo + Pages deploy + README + GPL-3.0 LICENSE

Human decisions (interview): license GPL-3.0; repo `malls/pattern-maker`, public;
app served at https://malls.github.io/pattern-maker/. Desktop (Tauri) is PM-17.

## Changes

1. `LICENSE` — canonical GPL-3.0 text (fetched from gnu.org, verbatim).
   `package.json`: add `"license": "GPL-3.0-only"` (keep `"private": true` — it's an
   app, not an npm package).
2. `vite.config.ts` (new) — `base: "./"` unconditionally. Relative base works for the
   Pages subpath, local preview, AND the future Tauri wrap; the bundle has no dynamic
   imports or workers, so the relative-base caveats don't apply. Vite rewrites the
   absolute `/favicon*` links in index.html against base at build time.
3. `README.md` — brand-voiced but informative: what it is (two modes), the live URL,
   feature list, keyboard map, dev quickstart (npm install / dev / build), the desktop
   paragraph (links to Releases — lands fully in PM-17), license note, pointer to
   BRANDING.md. Include the favicon/mark as the title image (public/favicon.svg).
4. `.github/workflows/pages.yml` — on push to master: checkout, setup-node 22 + npm ci,
   npm run build, actions/configure-pages + upload-pages-artifact (dist) + deploy-pages.
   Permissions: pages:write, id-token:write, contents:read.
5. Repo creation + push (orchestrator, gh CLI as malls): `gh repo create malls/pattern-maker
   --public --source . --remote origin --push`; enable Pages with build_type=workflow via
   `gh api`; verify the workflow run goes green and the site serves.

## Acceptance criteria

- Repo exists, public, all history pushed; Pages workflow green; site loads at
  https://malls.github.io/pattern-maker/ with assets + favicon resolving under the subpath.
- LICENSE is verbatim GPL-3.0; README renders correctly on GitHub; `npm run build` clean.
- Local `npm run dev` and `vite preview` still work with the relative base.

Complexity: low-medium (mostly infra). Out of scope: Tauri, releases, code signing.
