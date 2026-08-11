# PM-20: SEO: meta/OG/Twitter tags, social card image, canonical, JSON-LD (web only)

Human-requested: "appropriate meta tags and such for SEO. just for web, not desktop."
The tags live in the shared index.html — they are inert inside the Tauri webview, so no
conditional build is needed; "web only" is satisfied by absolute URLs pointing at the
live site.

Canonical URL: https://www.forrestalmasi.com/pattern-maker/

## Changes

1. **Social card** `public/og-card.png` — 1200×630, generated with the established
   zero-dep PNG-encoder approach (scratchpad script, only the output committed):
   plastic `#E7E6E1` ground with the 22px ink dot grid (`rgba(35,35,32,.13)` ≈ blend),
   the PM–1 mark centered at ~360px (charcoal badge r≈79, paper cells, orange center),
   flat, no text (the encoder has no font; the mark alone is the card).
2. **index.html head** (after the existing description/theme-color):
   - sharpen `meta description` for search while keeping brand voice:
     "free browser pixel editor for css border-images and seamless repeating tiles.
     draw on a 3×3 grid, preview live, export png or copy ready-to-paste css.
     pixels in, patterns out."
   - `<link rel="canonical" href="https://www.forrestalmasi.com/pattern-maker/">`
   - Open Graph: og:type website, og:site_name "pattern maker", og:title
     "pattern maker PM–1", og:description (same as meta), og:url (canonical),
     og:image (absolute .../og-card.png), og:image:width 1200, og:image:height 630,
     og:image:alt "the PM–1 mark".
   - Twitter: twitter:card summary_large_image, twitter:title, twitter:description,
     twitter:image.
   - JSON-LD `<script type="application/ld+json">`: @type WebApplication — name,
     alternateName "PM–1", url, description, applicationCategory "DesignApplication",
     operatingSystem "Any (browser)", offers price 0 USD, downloadUrl → releases page.
3. **`public/sitemap.xml`** — single-URL sitemap (canonical). Note recorded, not built:
   robots.txt is only honored at the domain root, which belongs to the user's main site,
   so none is added here; the sitemap is submittable via Search Console.

## Acceptance criteria

- og-card.png is valid 1200×630, reads as the mark on plastic ground.
- All tags present with ABSOLUTE urls; og/twitter description == meta description;
  JSON-LD parses as valid JSON; canonical exact with trailing slash.
- `npm run build` clean; dist/ contains og-card.png + sitemap.xml; live site serves all
  of it 200 after deploy (verified post-push).
- No behavior change to the app; Tauri unaffected (tags inert).

Complexity: low.
