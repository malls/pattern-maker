# PM-19: Web version links to the GitHub repo from the masthead

Human-requested mid-flight. One change: in the masthead (src/main.ts ~line 610),
add a second small mono anchor — text `source`, href https://github.com/malls/pattern-maker,
target _blank rel noopener, reusing the existing .download class — placed before the
`desktop ↓` link. Unlike the download link it shows in the Tauri build too (a source
link is honest everywhere; only self-advertising the desktop download is hidden).

Acceptance: link present on the web page and inside Tauri; desktop link still web-only;
brand styling unchanged (label gray, hover ink, orange focus ring); tsc+build clean;
only src/main.ts touched. Complexity: trivial.
