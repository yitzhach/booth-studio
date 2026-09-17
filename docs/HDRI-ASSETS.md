# HDRI assets for environment presets

The app ships with no HDRIs. Every environment preset falls back to the
procedural sky and ground when its files are absent, so this is optional work
that improves realism rather than something the app needs to run.

## What each preset needs

```
public/assets/hdri/<preset>/light.hdr    1K equirectangular .hdr   ~1–3 MB
public/assets/hdri/<preset>/bg.jpg       2K or 4K .jpg             ~0.5–2 MB
public/assets/hdri/<preset>/meta.json    written by the tool       <1 KB
```

`<preset>` is the preset's `hdri` name in `src/lighting.js`: `tradeshow`,
`artfair`, `home`. The `studio` preset deliberately has none — it is the
zero-asset default.

Two files, not one. `light.hdr` is only ever filtered into a reflection probe
(PMREM); nobody sees its pixels, so 1K is plenty. `bg.jpg` is what the camera
actually looks at and wants resolution. A single 4K `.hdr` doing both jobs
costs roughly ten times the bytes for no visible gain.

Only `light.hdr` and `bg.jpg` are required. A preset with just `light.hdr`
lights the booth and keeps the procedural sky behind it.

## Where to get them

[Poly Haven](https://polyhaven.com/hdris) publishes CC0 HDRIs and offers both
files on the same download page. Suggested starting points:

| Preset | Look to search for |
| - | - |
| `tradeshow` | warehouse, exhibition hall, large interior |
| `artfair` | park, urban plaza, open sky |
| `home` | living room, interior with windows |

Download the **1K HDR** for `light.hdr` and the **2K or 4K JPG** for `bg.jpg`,
rename them, and commit them at the paths above. That is the shortest route and
needs no tooling.

Downloads have to happen on your machine: the sandbox agent sessions run in
blocks `polyhaven.com` and `ambientcg.com` outright.

### The brightness caveat

three.js tone-maps `scene.background` with the same ACES curve it applies to the
booth. A JPG downloaded from Poly Haven has already been tone-mapped once, so it
goes through the curve twice and looks flatter and dimmer than the HDRI it came
from. It still looks like the place; it just loses highlight punch.

`tools/hdri-prep.mjs` avoids that by writing linear radiance divided by a
measured headroom factor and recording the factor in `meta.json`. The app
multiplies it back in through `scene.backgroundIntensity`, inside the shader and
before tone mapping, so the renderer's single ACES pass lands where it should.
A hand-dropped JPG has no `meta.json`, the factor is 1, and you get the
ordinary tone-mapped-twice backdrop.

## Converting your own HDRI

```sh
node tools/hdri-prep.mjs ~/Downloads/warehouse_4k.exr tradeshow
```

Writes all three files into `public/assets/hdri/tradeshow/`. Options:

```
--light <px>      width of light.hdr           (default 1024)
--bg <px>         width of bg.jpg              (default 2048)
--quality <1-100> JPEG quality                 (default 88)
--headroom <n>    override the measured backdrop headroom
--credit <text>   asset name and author, recorded in meta.json
--license <text>  asset licence                (default CC0)
--out <dir>       output directory
```

It reads `.hdr` and `.exr`, requires a 2:1 equirectangular source, and will not
stretch a backdrop past the source's own width. A 4096x2048 source takes about
three seconds and peaks near 450 MB of memory — the price of resampling in plain
JavaScript rather than depending on native image tooling. Typical output from a
4K source: `light.hdr` about 1.6 MB at 1K, `bg.jpg` about 1.2 MB at 4K.

## Budget

- Cloudflare Workers caps a single asset at 25 MiB. Nothing here comes close.
- Keep the whole of `public/assets` under about 50 MB. Past that, move the
  files to R2 and load them by URL instead of committing them.
- Mention any asset over ~4 MB in its commit message.
- Both Poly Haven and ambientCG are CC0 and need no attribution, but record
  what you used: pass `--credit` so `meta.json` carries it.
