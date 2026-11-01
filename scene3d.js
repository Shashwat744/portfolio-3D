// 3D version of the homepage scene. Loads assets/scene.glb with Three.js.
// Press T on the page to open the tuning panel (lights, glow, shadows, parallax).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sound } from './audio.js';

const HOME = 'assets/home pg';                                       // every home-screen file lives in this folder
const GLB = `${HOME}/scene.glb`;
const FLY_FRAMES = [1, 2, 3, 4].map(n => `${HOME}/fly/${n}_1.png`);  // wing pictures
const TUNING_PANEL = true;   // true = press T to open the tuning panel. Set to false before publishing: the panel and the T key are then never created.
const FLY_SEQ = [0, 1, 2, 3];                                        // 1_1 -> 2_1 -> 3_1 -> 4_1, then straight back to 1_1 (a plain 4-frame loop)
const FLY_FPS = 16;
const FLY_SIZE = 3;                                                  // fly size multiplier (1 = the size placed in Blender)
const FLY_REF = 140;                                                 // width of 1_1.png: keeps every frame at the same pixel scale
const SOFT_FALLOFF = 0.04;                                           // Blender's "soft falloff" (radius squared, in metres): smooths the hot spot next to a bulb

// Light levels were matched to the Blender render. Units: three.js lights are not Blender watts, so these are plain tuning numbers.
const CFG = { exposure: 0.7, ambient: 0.95, lamp: 0.8, flyLight: 0.8, glow: 0.1, shadowSoft: 70, sunPatch: 0.85,
              parallaxX: 1, parallaxY: 0.35, bulb: 0.45, bulbOpacity: 0.5, music: 0.5, sfx: 0.6, shadows: true };
const SLIDERS = [['exposure', .3, 3, .05], ['ambient', 0, 3, .05], ['lamp', 0, 15, .1], ['flyLight', 0, 10, .1], ['glow', 0, 2, .05],
                 ['shadowSoft', 1, 100, 1], ['sunPatch', 0, 3, .05], ['bulb', 0, 2, .05], ['bulbOpacity', 0, 1, .05], ['music', 0, 1, .05], ['sfx', 0, 1, .05], ['parallaxX', 0, 1.5, .05], ['parallaxY', 0, 1, .05]];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Soft falloff: three.js uses pure 1/d^2, which makes a harsh hot spot right next to a bulb. This changes it to 1/(d^2 + r^2),
// like Blender's soft falloff, for every light. (Must run before any material is compiled.)
{
    const rx = /1\.0\s*\/\s*max\(\s*pow\(\s*lightDistance,\s*decayExponent\s*\),\s*0\.01\s*\)/;
    if (rx.test(THREE.ShaderChunk.lights_pars_begin))
        THREE.ShaderChunk.lights_pars_begin = THREE.ShaderChunk.lights_pars_begin.replace(rx, `1.0 / ( pow( lightDistance, decayExponent ) + ${SOFT_FALLOFF.toFixed(4)} )`);
    else console.warn('Soft falloff patch not applied (Three.js shader changed).');
}

const stage = document.querySelector('.artwork-stage');
const canvas = document.getElementById('scene');
const loading = document.getElementById('sceneLoading');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = CFG.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;      // PCF (not PCFSoft) so the shadow blur can be adjusted

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06070a);
// Same camera as the Blender scene (vertical FOV 22.9 deg, 16:9). Near/far are tight to avoid flicker on the flat stickers.
const camera = new THREE.PerspectiveCamera(22.9, 16 / 9, 2, 60);
const CAM = new THREE.Vector3(0.05, 1.97, 8.93), FOCUS = new THREE.Vector3(0.05, 1.97, 0);
camera.position.copy(CAM); camera.lookAt(FOCUS);

function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage); resize();

// Cool night ambient (measured from the Blender render: dim blue-grey wall)
const hemi = new THREE.HemisphereLight(
    new THREE.Color().setRGB(0.46, 0.54, 0.78, THREE.LinearSRGBColorSpace),
    new THREE.Color().setRGB(0.30, 0.33, 0.45, THREE.LinearSRGBColorSpace), 1);
scene.add(hemi);

// If the graphics card drops the 3D context, go back to the flat picture
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); renderer.setAnimationLoop(null); stage.classList.remove('is-3d'); });

const state = { globes: [], hover: null, lights: [], rigs: [], flies: [], sprites: [], glows: {}, peek: null, mixer: null };

new GLTFLoader().load(GLB, gltf => { setup(gltf); loading.remove(); renderer.setAnimationLoop(frame); stage.classList.add('is-3d'); },
    ev => { if (ev.total) loading.textContent = `Loading 3D scene… ${Math.round(ev.loaded / ev.total * 100)}%`; },
    err => { console.error(`Could not load ${GLB}: showing the flat version instead.`, err); loading.remove(); });   // the 2D picture simply stays

const HOT = {
    name:   { names: ['name'], tip: 'Click to view About card', btn: 'nameGraffiti', alpha: true },
    gengar: { names: ['gengar'], tip: 'Click to view Pokédex entry', btn: 'gengarGraffiti', alpha: true },
    book:   { names: ['book'], tip: 'Open the stamp book', btn: 'bookHot' },
    cap:    { names: ['Bottle Cap'], tip: 'Made with questionable amounts of Sprite.', btn: null, action: () => kickCap() },
    // Hover-only tooltips on the painted art (same texts as the flat version)
    decepticon: { names: ['deceptiicon'], tip: 'Soundwave, superior. Autobots, inferior.', btn: null, alpha: true },
    killroy:    { names: ['kilroy'], tip: '1st ever meme... well sorta.', btn: null, alpha: true },
    numberOne:  { names: ['arancar'], tip: 'Espada #1, enthusiasm #0.', btn: null, alpha: true },
    zoro:       { names: ['zoro'], tip: 'Wrong turn. Right website.', btn: null, alpha: true },
    hope:       { names: ['kamina'], tip: '\u201cI take impossible odds personally.\u201d', btn: null, alpha: true },
};
const owner = new Map();

function setup(gltf) {
    const root = gltf.scene; scene.add(root); root.updateMatrixWorld(true);
    const NAME = n => THREE.PropertyBinding.sanitizeNodeName(n);
    const N = n => root.children.find(c => c.name === NAME(n)) || root.getObjectByName(NAME(n)) || null;   // null if not in the file
    const aniso = renderer.capabilities.getMaxAnisotropy();

    root.traverse(o => {
        if (!o.isMesh) return;
        o.receiveShadow = true;
        const m = o.material;
        for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (m[k]) m[k].anisotropy = aniso;
    });
    ['Street Light', 'Bench', 'Traffic Cone', 'book', 'Bottle Cap']
        .forEach(n => N(n)?.traverse(m => { if (m.isMesh) m.castShadow = true; }));

    // Stickers on the wall: flat, no depth writes, drawn in a fixed order (HOPE poster over Gengar)
    ['arancar', 'deceptiicon', 'kilroy', 'name', 'portfolio', 'zoro', 'gengar', 'kamina'].forEach((n, i) =>
        N(n)?.traverse(m => { if (m.isMesh) { m.material.metalness = 0; m.material.roughness = 1; m.material.depthWrite = false; m.renderOrder = i; } }));

    // Lamp globes: the glass did not survive export, so rebuild it as soft, see-through glass. It is unlit (not affected by the
    // lamp light right next to it), so its brightness is just the "bulb" and "bulbOpacity" sliders and the fly stays easy to see.
    ['Lamp left', 'Lamp right'].forEach(n => N(n)?.traverse(m => {
        if (!m.isMesh) return;
        m.material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
        state.globes.push(m.material);
        m.renderOrder = 10; m.castShadow = false; m.receiveShadow = false;
    }));

    // Lights come from the file: a white lamp light and a yellow fly-glow light per lamp (both follow the fly's path).
    // Their strengths are replaced by the sliders; the white ones cast shadows.
    root.traverse(o => {
        if (!o.isPointLight) return;
        const yellow = o.color.b < 0.2;
        o.userData.kind = yellow ? 'glow' : 'lamp';
        o.castShadow = !yellow;
        if (!yellow) { o.shadow.mapSize.set(1024, 1024); o.shadow.bias = -0.0008; o.shadow.normalBias = 0.02; o.shadow.camera.near = 0.05; o.shadow.camera.far = 14; }
        state.lights.push(o);
    });

    // The fly paths baked in the file ("left fly" / "right fly"): play them in a loop, the lights and the fly picture ride along.
    state.mixer = new THREE.AnimationMixer(root);
    gltf.animations.filter(c => c.tracks.some(t => /^(left_fly|right_fly)\./.test(t.name)))
        .forEach(c => state.mixer.clipAction(c).play());

    // Fly pictures: the wing plane under each fly rig gets the four wing frames, and a soft glow around it
    const loader = new THREE.TextureLoader();
    const frames = FLY_FRAMES.map(f => {
        const t = loader.load(f, undefined, undefined, () => console.warn('Fly frame not found:', f));
        t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    });
    ['left fly', 'right fly'].forEach((n, i) => {
        const rig = N(n); if (!rig) { console.warn(`${n} not found in the .glb`); return; }
        const plane = rig.children.find(c => c.isMesh);
        if (plane) {
            plane.material = plane.material.clone(); plane.material.depthWrite = false; plane.renderOrder = 30; plane.castShadow = false; plane.receiveShadow = false;
            state.flies.push({ plane, frames, base: plane.scale.clone().multiplyScalar(FLY_SIZE), ph: i * 2.3 });
        }
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        sp.scale.setScalar(0.55); sp.position.set(0, 0.03, 0.09); sp.renderOrder = 25; rig.add(sp); state.sprites.push(sp);
    });

    // Hover glow: the name and Gengar light up through their own texture; the book gets a soft blue glow
    const glowDef = { name: ['name', 0xffffff, 2.2, true], gengar: ['gengar', 0xffffff, 2.0, true], book: ['book', 0x4a86ff, 0.5, false] };
    for (const [key, [n, color, max, useMap]] of Object.entries(glowDef)) {
        const mats = []; N(n)?.traverse(m => { if (m.isMesh) { if (useMap) m.material.emissiveMap = m.material.map; m.material.emissive.set(color); m.material.emissiveIntensity = 0; mats.push(m.material); } });
        state.glows[key] = { mats, max, cur: 0 };
    }
    const g = N('gengar');   // Gengar slides out a little from behind the poster on hover
    if (g) state.peek = { obj: g, p: g.position.clone(), q: g.quaternion.clone() };

    // Click / hover targets
    for (const [key, h] of Object.entries(HOT)) { h.objs = [...new Set(h.names.map(N).filter(Boolean))]; h.objs.forEach(o => o.traverse(m => owner.set(m, key))); }

    addSunPatch(N('floor'));

    // Bottle cap: it stands on its rim, so it can roll. Its axle (the cap's own up-axis) is found once here.
    const cap = N('Bottle Cap');
    if (cap) { capRoll.obj = cap; capRoll.axle.set(0, 1, 0).applyQuaternion(cap.quaternion).normalize(); }
}

// ---------------------------------------------------------------------------
// Sprite cap: each click gives it a push to the right; it keeps rolling and slows down by friction.
// Spam-clicking builds up speed until it rolls right out of the scene.
// ---------------------------------------------------------------------------
const CAP = { push: 1.1, maxSpeed: 4.5, friction: 1.6, radius: 0.23, exitX: 3.9 };   // push/speed in metres per second
const capRoll = { obj: null, v: 0, gone: false, axle: new THREE.Vector3(0, 0, 1) };
const qRoll = new THREE.Quaternion();
function kickCap() { if (!capRoll.gone) { capRoll.v = Math.min(CAP.maxSpeed, capRoll.v + CAP.push); sound.capKick(); } }
function updateCap(dt) {
    const c = capRoll;
    sound.capRoll(c.obj && !c.gone ? c.v : 0, dt);          // rolling sound follows the cap's speed if (!c.obj || c.gone || c.v < 0.01) { if (c.v < 0.01) c.v = 0; return; }
    const dx = c.v * dt;
    c.obj.position.x += dx;
    c.obj.quaternion.premultiply(qRoll.setFromAxisAngle(c.axle, -Math.sign(c.axle.z || 1) * dx / CAP.radius));   // spins as it rolls
    c.v *= Math.exp(-dt * CAP.friction);
    if (c.obj.position.x > CAP.exitX) {                                  // rolled off the scene: remove it for good
        c.gone = true; c.obj.visible = false; HOT.cap.objs = []; state.hover = null; canvas.style.cursor = '';
        if (window.siteTip) window.siteTip.hide();
    }
}

function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,240,190,1)'); gr.addColorStop(.25, 'rgba(255,225,150,.45)'); gr.addColorStop(1, 'rgba(255,220,140,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------------------
// Warm evening light on the lower right of the pavement. In the Blender render it is a low sun with a hard diagonal
// shadow edge; here it is a flat additive patch on the floor, with the edge measured from the render
// (floor line z = -0.5219 x + 1.9809), fading slowly towards the camera.
// ---------------------------------------------------------------------------
let sunPatch = null;
function addSunPatch(floor) {
    const FLOOR_Y = floor ? floor.getWorldPosition(new THREE.Vector3()).y : 0.7137;
    const W = 7.4, D = 3.44, PW = 512, PH = 256, M = -0.5219, C = 1.9809, norm = Math.hypot(M, 1);
    const cv = document.createElement('canvas'); cv.width = PW; cv.height = PH;
    const x = cv.getContext('2d'), img = x.createImageData(PW, PH);
    for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) {
        const wx = -W / 2 + (px + .5) / PW * W, wz = (py + .5) / PH * D;
        const d = (wz - (M * wx + C)) / norm;                              // metres past the shadow edge (+ = lit)
        const a = Math.min(1, Math.max(0, d / 0.05 + 0.5)) * (1 - 0.55 * Math.min(1, Math.max(0, d) / 2.2));
        const i = (py * PW + px) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
    }
    x.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    mat.color.setRGB(0.09, 0.012, 0.012, THREE.LinearSRGBColorSpace);
    mat.userData.base = mat.color.clone();
    sunPatch = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat);
    sunPatch.rotation.x = -Math.PI / 2; sunPatch.position.set(0, FLOOR_Y + 0.002, D / 2); sunPatch.renderOrder = 5;
    scene.add(sunPatch);
}

// ---------------------------------------------------------------------------
// Pointer: hover, click, tooltip, parallax
// ---------------------------------------------------------------------------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), alphaCache = new Map();

function opaqueAt(mesh, uv) {
    const tex = mesh.material.map; if (!tex || !tex.image || !uv) return true;
    let a = alphaCache.get(tex);
    if (!a) {
        const im = tex.image, w = Math.min(512, im.width), h = Math.max(1, Math.round(w * im.height / im.width));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
        a = { w, h, d: x.getImageData(0, 0, w, h).data }; alphaCache.set(tex, a);
    }
    const cx = Math.floor(uv.x * a.w), cy = Math.floor(uv.y * a.h);    // glTF UV origin is the top-left
    for (let dy = -4; dy <= 4; dy += 2) for (let dx = -4; dx <= 4; dx += 2) {
        const x = Math.min(a.w - 1, Math.max(0, cx + dx)), y = Math.min(a.h - 1, Math.max(0, cy + dy));
        if (a.d[(y * a.w + x) * 4 + 3] > 30) return true;
    }
    return false;
}

function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const targets = Object.values(HOT).flatMap(h => h.objs || []);
    for (const hit of ray.intersectObjects(targets, true)) {
        const key = owner.get(hit.object);
        if (key && (!HOT[key].alpha || opaqueAt(hit.object, hit.uv))) return key;
    }
    return null;
}

const par = { x: 0, y: 0, tx: 0, ty: 0 };
canvas.addEventListener('mousemove', e => {
    state.hover = pick(e);
    canvas.style.cursor = state.hover ? ((HOT[state.hover].btn || HOT[state.hover].action) ? 'pointer' : 'default') : '';
    if (window.siteTip) state.hover ? window.siteTip.show(HOT[state.hover].tip, e.clientX, e.clientY) : window.siteTip.hide();
});
canvas.addEventListener('mouseleave', () => { state.hover = null; if (window.siteTip) window.siteTip.hide(); });
canvas.addEventListener('click', () => {   // the real buttons live in index-style markup so script.js opens the cards
    const h = state.hover && HOT[state.hover]; if (!h) return;
    if (h.btn) document.getElementById(h.btn).click(); else if (h.action) h.action();
});
if (!reduceMotion) addEventListener('pointermove', e => { par.tx = (e.clientX / innerWidth - .5) * 2; par.ty = (e.clientY / innerHeight - .5) * 2; });

const Z = new THREE.Vector3(0, 0, 1), qz = new THREE.Quaternion(), PEEK = new THREE.Vector3(-0.05, 0.05, 0);
let last = performance.now(), shadowsOn = CFG.shadows;

function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (document.querySelector('.ov.on')) { sound.capRoll(0, 0); return; }   // pause while a card or the stamp book is open (the rolling sound hushes too)
    const t = now / 1000, k = 1 - Math.exp(-dt * 10);

    sound.setVolumes(CFG.music, CFG.sfx);
    hemi.intensity = CFG.ambient;
    renderer.toneMappingExposure = CFG.exposure;
    if (sunPatch) { sunPatch.material.color.copy(sunPatch.material.userData.base).multiplyScalar(CFG.sunPatch); }

    if (state.mixer && !reduceMotion) state.mixer.update(dt);
    updateCap(dt);
    state.lights.forEach(l => {
        l.intensity = l.userData.kind === 'glow' ? CFG.flyLight : CFG.lamp;
        if (l.castShadow) l.shadow.radius = CFG.shadowSoft;
    });
    state.sprites.forEach(s => { s.material.opacity = CFG.glow; });
    state.globes.forEach(m => { m.color.setRGB(0.85, 0.78, 0.6, THREE.LinearSRGBColorSpace).multiplyScalar(CFG.bulb); m.opacity = CFG.bulbOpacity; });

    // Fly wings: flip through the four pictures, keeping each at the same pixel scale.
    // If the pictures could not be loaded, the fly still flaps (its single picture squashes in and out) so it never looks frozen.
    for (const f of state.flies) {
        const step = Math.floor(t * FLY_FPS + f.ph);
        const tex = f.frames[FLY_SEQ[step % FLY_SEQ.length]];
        if (tex.image) {
            if (f.plane.material.map !== tex) {
                const hadMap = !!f.plane.material.map;
                f.plane.material.map = tex; if (!hadMap) f.plane.material.needsUpdate = true;
                f.plane.scale.set(f.base.x * tex.image.width / FLY_REF, f.base.y, f.base.z * tex.image.height / FLY_REF);
            }
        } else if (!f.frames.some(x => x.image)) {
            f.plane.scale.set(f.base.x * (0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI * 5 + f.ph))), f.base.y, f.base.z);
        }
    }

    for (const [key, g] of Object.entries(state.glows)) {
        g.cur += ((state.hover === key ? 1 : 0) - g.cur) * k;
        g.mats.forEach(m => { m.emissiveIntensity = g.cur * g.max; });
    }
    if (state.peek) {
        const g = state.glows.gengar.cur, p = state.peek;
        p.obj.position.copy(p.p).addScaledVector(PEEK, g);
        p.obj.quaternion.copy(p.q).premultiply(qz.setFromAxisAngle(Z, g * 0.07));
    }

    par.x += (par.tx - par.x) * (1 - Math.exp(-dt * 4)); par.y += (par.ty - par.y) * (1 - Math.exp(-dt * 4));
    camera.position.set(CAM.x + par.x * CFG.parallaxX, CAM.y - par.y * CFG.parallaxY, CAM.z);
    camera.lookAt(FOCUS);
    renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// Tuning panel (press T)
// ---------------------------------------------------------------------------
if (TUNING_PANEL) {
    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:300;background:#000c;color:#fff;font:12px monospace;padding:10px 12px;border-radius:8px;display:none;max-height:90vh;overflow:auto';
    panel.innerHTML = '<b>Scene tuning (T = hide)</b>';
    SLIDERS.forEach(([k, min, max, step]) => {
        const row = document.createElement('label'); row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:6px';
        row.innerHTML = `<span style="width:80px">${k}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${CFG[k]}"><output>${CFG[k]}</output>`;
        const inp = row.querySelector('input'), out = row.querySelector('output');
        inp.oninput = () => { CFG[k] = +inp.value; out.textContent = inp.value; };
        panel.append(row);
    });
    const sh = document.createElement('label'); sh.style.cssText = 'display:block;margin-top:8px';
    sh.innerHTML = '<input type="checkbox" checked> shadows';
    sh.firstChild.onchange = e => { CFG.shadows = e.target.checked; renderer.shadowMap.enabled = CFG.shadows; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); };
    const copy = document.createElement('button'); copy.textContent = 'Copy values'; copy.style.cssText = 'display:block;margin-top:8px';
    copy.onclick = () => { navigator.clipboard.writeText(JSON.stringify(CFG)); copy.textContent = 'Copied'; setTimeout(() => copy.textContent = 'Copy values', 1200); };
    panel.append(sh, copy); document.body.append(panel);
    addEventListener('keydown', e => { if (e.key === 't' || e.key === 'T') panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; });
}
