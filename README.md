# Shashwat Jadhav — Portfolio Homepage (3D)

A night-street portfolio scene drawn live in 3D (Three.js): a clickable graffiti name, a stamp book of projects, an About card, a Gengar Pokédex easter egg, flies in the lamps, a bottle cap you can roll out of the scene, and ambient sound.

## How to view
The page must be opened through a web server, not by double-clicking the file (browsers block the 3D model and scripts on `file://`).
- **VS Code:** install the Live Server extension, right-click `scene3d.html` > Open with Live Server, and open that address in any browser.
- **No Live Server:** in the project folder run `python -m http.server 8000`, then open `http://localhost:8000/scene3d.html`.
- **Publishing:** upload the whole folder to a static host (GitHub Pages, Netlify, Cloudflare Pages). Rename `scene3d.html` to `index.html` if you want it to be the home page.

Three.js is loaded from a CDN, so the page needs an internet connection.

## Files
```
scene3d.html   page structure + your stamp data (rename to index.html when you publish)
home.js        decides 3D or flat picture, starts the sound
scene3d.js     the 3D scene (lights, flies, hover, parallax, cap, tuning panel)
audio.js       sound (cap rolling, ambient music, sound on/off button)
script.js      stamp book, cards and tooltips (reads stamps from scene3d.html)
style.css      all styling
assets/
  home pg/     everything for the home screen (not the projects):
    scene.glb                      the 3D scene
    fly/1_1.png ... 4_1.png        fly wing frames
    2d/                            flat fallback picture: bg.webp, name-graffiti.webp, gengar.png, kamina.webp, lamp-bench.webp (match the names in scene3d.html)
    cards/                         about-card.webp, gengar-card.png
    audio/                         gengar-cry.mp3, ambient.mp3 (optional)
  editorial/, branding/, posters/, illustrations/, packaging/   the project folders
```
The folder name `home pg` has a space. It works, but if you ever rename it, change `HOME` in `scene3d.js`, `MUSIC_FILE` in `audio.js`, the paths in `scene3d.html`, and the `.ambient-backdrop` line in `style.css`.

## The flat (2D) fallback
The flat picture is always in the page and shows first. The 3D scene fades in over it when it is ready. If 3D cannot start (no WebGL, no internet for Three.js, `scene.glb` missing, graphics card problems) the visitor keeps the flat version, which has the same clickable name, Gengar, stamp book and tooltips. Sound works in both.
- Add `?view=2d` to the address to preview the flat version, or `?view=3d` to force 3D.
- `home.js` has two switches at the top: `FORCE_2D` (always flat) and `PHONES_USE_2D` (phones get the flat picture and skip the big download).

## Adding and editing stamps (no JavaScript needed)
Open `scene3d.html` and find the `<div id="stampData">` block. It has a comment explaining everything.

- **Add a stamp:** copy an `<article class="project" ...>` block into the section you want and change its `data-` values.
- **Add a tab:** copy a whole `<section data-id=...>` block and give it a new unique `data-id`.
- **Stamp picture:** `data-image` is a full path (`assets/my-poster/stamp.png`) or just a file name that lives in `data-folder`. The stamp is sized automatically to the shape of the picture. If it is blank, press F12 and look for "Stamp image not found".
- **Case study:** list the images in an `<ol class="images">` inside the article, top to bottom. Without images the project page says "Case study coming soon."
- **Poster layout:** a section with `data-layout="poster"` opens each project as a big poster on the left with a line of text on the right. Use `data-layout="scroll"` on one `<article>` to make it scroll like a case study instead.
- Always close every `<ol>` with `</ol>`.

### Related stamps (a project that points to another stamp)
Give each project that should be linkable a unique `data-id`, then list those ids in `data-related` on the project that should show them (separate several with spaces):
```html
<article class="project" data-id="patchup-branding" data-related="patchup-packaging" ...>
<article class="project" data-id="patchup-packaging" data-related="patchup-branding" ...>
```
The project page then shows a "Related stamps" panel with each related stamp in its own design (its own picture, year and title); clicking one opens that project. When there is room to the left of the page it sits on the dark backdrop beside it, otherwise it appears inside the page under the description. A link only works one way, so set `data-related` on both projects if you want both to show each other. If an id is misspelled, the Console (F12) says so.

Tip: export images about 2800px wide as WebP or JPG. Avoid spaces and capital letters in file names: some hosts treat `Stamp.PNG` and `stamp.png` as different files.

## Controls
- Click the stamp book on the pavement: open the stamp book, then click a stamp to open the project
- Click the graffiti name: About card
- Hover Gengar: it slides out from behind the HOPE poster. Click it for the Pokédex card (the cry plays once per visit)
- Click the Sprite cap: it rolls right. Spam-click to build speed and roll it out of the scene (refresh to bring it back)
- Hover the painted art: small joke tooltips
- Move the mouse: slight camera parallax
- `Esc`, `✕` or click outside: close / go back
- `F`: fullscreen
- `T`: open the tuning panel (see below). Turn this off with `TUNING_PANEL = false` near the top of `scene3d.js`
- Bottom-left button: sound on / off (remembered). Sound starts after the first click, because browsers require it.

## Tuning the scene (press T)
The panel only exists when `TUNING_PANEL` is `true` (top of `scene3d.js`). Set it to `false` before publishing and the panel and the T key are never created.

The panel has sliders for exposure, ambient light, lamp and fly light, glow, shadow softness, the orange pavement patch, bulb brightness, parallax, music and effects volume. "Copy values" puts the current numbers on your clipboard. To keep them, paste them over the `CFG` line near the top of `scene3d.js`.

Other settings at the top of `scene3d.js`:
- `FLY_SIZE`, `FLY_FPS`, `FLY_SEQ`: fly size, flap speed and frame order
- `SOFT_FALLOFF`: how soft the light is right next to a bulb
- `CAP`: push strength, friction and exit point of the rolling cap

## Sound (audio.js)
No audio files are required: the cap's rolling sound and the ambient music are generated live. To use your own music, put a looping royalty-free mp3 at `assets/home pg/audio/ambient.mp3`. If it needs credit, add the credit line to your site. The `music` and `sfx` sliders set the volumes.

## Updating the 3D scene
Re-export from Blender as `scene.glb` (glTF Binary) into `assets/home pg/`. The code looks things up by object name (`name`, `gengar`, `kamina`, `kilroy`, `zoro`, `arancar`, `deceptiicon`, `Bottle Cap`, `book`, `left fly`, `right fly`, `Lamp left`, `Lamp right`, `Street Light`, `Bench`, `Traffic Cone`, `floor`), so keep those names.
