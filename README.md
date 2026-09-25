# Geometry Dash WASM — chunked build

This copy loads the original 69,828,965-byte WASM and 314,500,859-byte data
package from numbered parts. Every part is at most **3,000,000 bytes**:

- WASM: `gd_web.wasm.part000` through `gd_web.wasm.part023`
- Data: `gd_web.data.part000` through `gd_web.data.part104`

Keep each part beside `index.html`, `gd_chunks.js`, `gd_scramjet.js`, and
`gd_web.js`. `asset-manifest.json` lists every part's exact size and SHA-256.
`gd_chunks.js` fetches four parts at a time, validates each part's expected
length, then streams the original asset back to the game's existing loader. A
missing, truncated, or incorrectly named part produces a visible load error
instead of a silently corrupted game.

Serve the directory over HTTP(S); opening `index.html` directly as a `file://`
URL will not work. No build step or server-side reassembly is required.

The downloadable handoff is split into one **core archive** and four
**data-pack archives** to fit file-transfer limits. Download all five, then
extract each into the same destination so their `geometry-dash-twojet/`
contents merge. Do not omit any of the four data packs.

## Two-Jet additions

The game retains its original screen and proxy bridge. The WISP button opens a
server chooser with the local Wisp and the three server choices from the
provided Two-Jet source. “Auto-pick” tests the local server first, then tries
the public choices in order, matching Two-Jet's first-reachable behavior.
Public servers are third-party services; credential-bearing requests are
blocked while one is selected. The choice is remembered in local storage.

The included `TWO-JET-LICENSE` preserves the MIT notice for the adapted
server-selection behavior and server list.