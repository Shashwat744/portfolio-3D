// home.js: starts the home screen. The flat 2D picture is always there first (it is plain HTML and images).
// This file then tries to upgrade it to the 3D scene, and leaves the 2D picture in place if that is not possible
// (no WebGL, the 3D files fail to load, the CDN is unreachable...). Sound starts separately, so it works in 2D too.

const FORCE_2D = false;          // true = never use the 3D scene, always show the flat picture
const PHONES_USE_2D = false;     // true = phones and small touch screens get the flat picture (lighter, no 22 MB download)

// Testing: add ?view=2d or ?view=3d to the address to force one of them
const view = new URLSearchParams(location.search).get('view');
const isPhone = matchMedia('(max-width: 700px) and (pointer: coarse)').matches;
const want3d = view === '3d' ? true : view === '2d' ? false : !(FORCE_2D || (PHONES_USE_2D && isPhone));

function webglOK() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
    catch (e) { return false; }
}

import('./audio.js').catch(e => console.warn('Sound unavailable:', e));

(async () => {
    const loading = document.getElementById('sceneLoading');
    if (!want3d || !webglOK()) { if (loading) loading.remove(); return; }
    try { await import('./scene3d.js'); }
    catch (e) { console.warn('The 3D scene could not start, so the flat version is shown.', e); if (loading) loading.remove(); }
})();
