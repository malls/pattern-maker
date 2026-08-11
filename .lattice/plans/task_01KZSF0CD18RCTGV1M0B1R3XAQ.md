# PM-17: Desktop: Tauri wrap + Actions release pipeline + download links

Human decisions: Tauri v2 native installers (mac dmg, win msi/nsis, linux AppImage+deb),
built by GitHub Actions on tag push, published to GitHub Releases, downloadable from the
published page. Unsigned for now (documented in README already). Repo: malls/pattern-maker.

## Changes

1. **Tauri scaffold** (`src-tauri/`): Cargo.toml (tauri v2, minimal features — no shell/fs
   plugins; the app needs nothing from the host beyond a webview window), tauri.conf.json
   (productName "pattern maker PM–1"? — CHECK: productName feeds bundle/file names; use
   "pattern-maker" for the artifact-safe name and set the window title separately to
   "pattern maker PM–1"; identifier `com.forrestalmasi.pattern-maker`; `frontendDist:
   "../dist"`, `devUrl: "http://localhost:5173"`, `beforeBuildCommand: "npm run build"`;
   window 1440×900 min 900×640; bundle targets dmg/msi/nsis/appimage/deb), src/main.rs
   (default template), build.rs, capabilities file (default window capability only).
2. **Icons**: generate a 1024×1024 PNG of the PM–1 mark (same geometry as
   public/apple-touch-icon.png but with transparent rounded corners at radius 224 —
   the desktop icon is the badge itself) using the same zero-dep PNG-encoder approach
   (scratchpad script, committed outputs only), then `npx @tauri-apps/cli icon <png>`
   to emit src-tauri/icons/* (icns, ico, pngs). Add `@tauri-apps/cli` as a devDependency.
3. **Release workflow** (`.github/workflows/release.yml`): on push of tag `v*` —
   matrix {macos-latest (aarch64+x86_64 via universal or two jobs), ubuntu-22.04,
   windows-latest}, uses `tauri-apps/tauri-action@v0` with `tagName`/`releaseName`
   "pattern maker \_\_VERSION\_\_", draft false, generates the Release with installer
   assets. Needs `contents: write` permission. Rust cache via `swatinem/rust-cache`.
4. **Download link in the app**: a small mono link in the masthead area — `desktop ↓` —
   pointing to https://github.com/malls/pattern-maker/releases/latest, styled per brand
   (label gray, lowercase, no new colors; hover ink). Hidden when running inside Tauri
   (`"__TAURI_INTERNALS__" in window` guard) so the desktop app doesn't advertise itself.
   Touches src/ui (masthead build) + app.css only.
5. **Versioning**: keep package.json 0.1.0 as the source; tauri.conf.json `version` reads
   from it (or set 0.1.0 identically). Tag `v0.1.0` after everything is green to cut the
   first release.
6. **Local verification**: `cargo check` inside src-tauri (Rust toolchain exists at
   /opt/homebrew). Full `tauri build` locally is optional (slow); CI is the real build.
   Verify `npx tauri dev` config parses (`npx tauri info` at minimum). Web build must
   remain unaffected: `npm run build` clean, no runtime deps added.

## Acceptance criteria

- `cargo check` passes in src-tauri; `npx tauri info`/config validation clean; web
  `npm run build` unchanged and clean; no new runtime npm deps (cli is devDependency).
- Release workflow YAML is valid; on tag v0.1.0 CI produces a GitHub Release with mac
  dmg, windows installer, linux AppImage+deb (verified after tagging).
- The published web page shows the `desktop ↓` link per brand; it's absent inside Tauri.
- Icons: all emitted sizes present; the mark reads correctly (badge, grid, orange center).
- README's desktop section already points at releases (done in PM-16) — verify link works
  once the first release exists.

Complexity: medium. Out of scope: code signing, auto-update, arm linux.
