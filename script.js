/**
 * Homepage Script
 * Stamps and tabs are read from the #stampData block in index.html,
 * so you can add or change stamps there without touching this file.
 */

document.addEventListener('DOMContentLoaded', () => {
    const stage = document.querySelector('.artwork-stage');
    if (stage) stage.style.opacity = '1';

    const $ = s => document.querySelector(s);
    const $$ = s => [...document.querySelectorAll(s)];

    // Escape text before putting it into HTML strings
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    // -------------------------------------------------------------------------
    // Read sections & projects from the HTML (#stampData)
    // -------------------------------------------------------------------------
    const sections = [];
    const projects = [];

    $$('#stampData > section').forEach((sec, si) => {
        const id = sec.dataset.id || `section-${si}`;
        sections.push({ id, name: sec.dataset.name || id, note: sec.dataset.note || '' });

        sec.querySelectorAll('.project').forEach(el => {
            // Image stack: <ol class="images"><li>file</li>...</ol>, optionally prefixed by data-folder
            const folder = (el.dataset.folder || '').replace(/\/+$/, '');
            const resolve = f => (folder && !/^(https?:)?\/|^data:/.test(f)) ? `${folder}/${f}` : f;
            let images = [...el.querySelectorAll('.images li, .image li')]
                .map(li => li.textContent.trim())
                .filter(Boolean)
                .map(resolve);
            // Older single-image option still works
            if (!images.length && el.dataset.scroll) images = [el.dataset.scroll];

            // Description = article content without the image list
            const copy = el.cloneNode(true);
            copy.querySelectorAll('.images, .image').forEach(n => n.remove());

            // Stamp picture: a bare file name ("stamp.webp") is looked up inside data-folder;
            // anything with a slash ("assets/x/stamp.webp") is used exactly as written.
            const rawStamp = (el.dataset.image || '').trim();
            const stampImage = (rawStamp && folder && !rawStamp.includes('/')) ? `${folder}/${rawStamp}` : rawStamp;
            const proj = {
                id: (el.dataset.id || '').trim(),
                related: (el.dataset.related || '').split(/[\s,]+/).filter(Boolean),   // ids of related stamps
                s: id,
                t: el.dataset.title || 'Untitled',
                y: el.dataset.year || '',
                c: el.dataset.color || '#555',
                image: stampImage,
                ratio: 0,          // thumbnail width / height, filled in once the image has loaded
                broken: false,     // thumbnail file could not be loaded
                images,
                layout: (el.dataset.layout || sec.dataset.layout || '').trim().toLowerCase(),
                d: copy.innerHTML.trim()
            };
            projects.push(proj);

            if (stampImage) {
                // Load the thumbnail once to learn its shape; the stamp is then sized to match.
                // If the file can't be found, say so in the console (F12) and fall back to the colour block.
                const probe = new Image();
                probe.onload = () => {
                    if (probe.naturalWidth && probe.naturalHeight) {
                        proj.ratio = probe.naturalWidth / probe.naturalHeight;
                        refreshStamp(proj);
                    }
                };
                probe.onerror = () => {
                    proj.broken = true;
                    refreshStamp(proj);
                    console.warn(`Stamp image not found: "${stampImage}" (project "${proj.t}"). Check the folder, file name and extension.`);
                };
                probe.src = stampImage;
            }
        });
    });

    let cur = sections.length ? sections[0].id : '';
    let opener = null;
    let hasPlayedGengarAudio = false;

    function show(id) {
        const o = $('#' + id);
        if (o) o.classList.add('on');
    }

    function hide(id) {
        const o = $('#' + id);
        if (o) o.classList.remove('on');
    }

    function closeAll() {
        $$('.ov').forEach(o => o.classList.remove('on'));
        if (opener) {
            opener.focus();
            opener = null;
        }
    }

    // -------------------------------------------------------------------------
    // Stamp book
    // -------------------------------------------------------------------------
    // Stamp sizing. Every stamp is a whole number of perforation holes wide and tall (PITCH px each),
    // so the holes always line up on all four edges. The picture area is the stamp minus a one-hole
    // paper margin on every side and a bottom strip for the year and title.
    const PITCH = 14;
    const STRIP = 28;                       // height of the year / title strip (px)
    const TARGET_AREA = 154 * 196;          // every picture area is about this big, whatever its shape
    const DEFAULT_RATIO = 154 / 196;        // stamps without a usable thumbnail use the classic portrait shape

    function stampDims(p) {
        const r = (p.image && !p.broken && p.ratio) ? p.ratio : DEFAULT_RATIO;
        let best = [13, 18], bestScore = Infinity;
        for (let nw = 9; nw <= 18; nw++) {
            for (let nh = 10; nh <= 24; nh++) {
                const aw = nw * PITCH - 2 * PITCH;
                const ah = nh * PITCH - 2 * PITCH - STRIP;
                // Prefer the whole-hole size whose picture shape is closest to the image's shape,
                // with an area close to the target so no stamp towers over the others.
                const score = 3 * Math.abs(Math.log((aw / ah) / r)) + Math.abs(Math.log((aw * ah) / TARGET_AREA));
                if (score < bestScore) { bestScore = score; best = [nw, nh]; }
            }
        }
        return best;
    }

    // Size variables for one stamp. --cs / --rs are how many 7px grid cells it occupies
    // (its own size plus a 14px gap), which is what lets the grid pack the stamps tightly.
    function stampVars(p) {
        const [nw, nh] = stampDims(p);
        return `--nw:${nw};--nh:${nh};--cs:${nw * 2 + 2};--rs:${nh * 2 + 2}`;
    }

    function artHTML(p) {
        return (p.image && !p.broken)
            ? `<div class="art has-image" style="background-image:url('${esc(p.image)}')"></div>`
            : `<div class="art" style="background:${esc(p.c)}"></div>`;
    }

    // Re-shape one stamp after its thumbnail has loaded (or failed), without redrawing the whole book
    function refreshStamp(p) {
        const i = projects.indexOf(p);
        // A stamp can appear in the book and in a "Related stamps" panel, so update every copy
        document.querySelectorAll(`.stamp[data-p="${i}"]`).forEach(stampEl => {
            stampEl.setAttribute('style', stampVars(p));
            const art = stampEl.querySelector('.art');
            if (art) art.outerHTML = artHTML(p);
        });
        fitRelated();
    }

    // One stamp button (same markup in the book and in the Related stamps panel)
    function stampButton(p, i) {
        return `<button class="stamp" data-p="${i}" style="${stampVars(p)}" aria-label="Open project ${esc(p.t)}" title="${esc(p.t)}">
                    ${artHTML(p)}
                    <div class="val"><span class="yr">${esc(p.y)}</span><span class="ttl">${esc(p.t)}</span></div>
                </button>`;
    }

    // "Related stamps" block for a project: its data-related ids, each shown with its own stamp design.
    // Returns '' when the project has none, so nothing is drawn.
    const warnedRelated = new Set();
    function relatedHTML(p, cls) {
        p.related.forEach(rid => {
            if (!projects.some(q => q.id === rid) && !warnedRelated.has(p.t + rid)) {
                warnedRelated.add(p.t + rid);
                console.warn(`Related stamp "${rid}" (set on "${p.t}") was not found. Check the spelling of data-id / data-related.`);
            }
        });
        const items = p.related
            .map(rid => projects.findIndex(q => q.id === rid))
            .filter(i => i >= 0 && projects[i] !== p)
            .map(i => [projects[i], i]);
        if (!items.length) return '';
        return `<div class="related ${cls}"><h4>Related stamps</h4><div class="related-list">${items.map(([q, i]) => stampButton(q, i)).join('')}</div></div>`;
    }

    // Decides where the "Related stamps" go. If there is room on the dark backdrop to the left of the card (measured, so it works for the
    // normal card and the wider poster card), they sit there in a side panel; otherwise they appear inside the card under the description.
    // In the side panel the stamps shrink if needed so they always fit its width.
    function fitRelated() {
        const ov = $('#projOv'), panel = $('#projRelated'), card = $('#proj');
        if (!ov || !panel || !card || !ov.classList.contains('on')) return;
        const room = card.offsetLeft;                            // free space left of the card (offsetLeft ignores the open animation)
        const out = !panel.hidden && room >= 190;
        ov.classList.toggle('rel-out', out);
        if (!out) return;
        const width = Math.min(240, room - 26), top = card.offsetTop + 28;
        panel.style.cssText = `width:${width}px;top:${top}px;max-height:${Math.max(120, window.innerHeight - top - 16)}px`;
        const avail = width - 20;                                // minus the panel's side padding
        panel.querySelectorAll('.stamp').forEach(el => {
            el.style.zoom = 1;
            const w = el.offsetWidth;
            el.style.zoom = w > avail ? (avail / w).toFixed(3) : 1;
        });
    }
    window.addEventListener('resize', fitRelated);

    function renderBook() {
        const tabsEl = $('#tabs');
        if (tabsEl) {
            tabsEl.innerHTML = '<h2>stamp<br>book</h2>' + sections.map(s =>
                `<button class="tab" role="tab" aria-selected="${s.id === cur}" data-sec="${esc(s.id)}">${esc(s.name)}</button>`
            ).join('');
        }

        const sec = sections.find(s => s.id === cur);
        const pageEl = $('#page');
        if (!pageEl) return;

        if (!sec) {
            pageEl.innerHTML = '<h3>No stamps yet</h3><p class="empty-note">Add a section to the #stampData block in index.html.</p>';
            return;
        }

        const items = projects.map((p, i) => [p, i]).filter(([p]) => p.s === cur);
        const grid = items.length
            ? '<div class="grid">' + items.map(([p, i]) => stampButton(p, i)).join('') + '</div>'
            : '<p class="empty-note">No stamps in this section yet. Add an &lt;article class="project"&gt; to it in index.html.</p>';

        pageEl.innerHTML = `<h3>${esc(sec.name)}</h3><p class="sub">${esc(sec.note)}</p>${grid}`;
    }

    // -------------------------------------------------------------------------
    // Project view
    // -------------------------------------------------------------------------
    function openProj(i) {
        const p = projects[i];
        if (!p) return;
        const sec = sections.find(s => s.id === p.s);
        const secName = sec ? sec.name : '';

        const projEl = $('#proj');
        if (projEl && p.layout === 'poster') {
            // Poster layout: the whole poster on the left, a short line on the right. No scrolling stack.
            const src = p.images[0] || p.image;
            const art = src
                ? `<img src="${esc(src)}" alt="${esc(p.t)} poster" decoding="async">`
                : `<div class="poster-ph" style="background:${esc(p.c)}">${esc(p.t)}</div>`;
            projEl.className = 'card proj proj-poster';
            projEl.innerHTML = `
                <div class="proj-header">
                    <button class="back" data-back>← Back to the stamp book</button>
                    <button class="x" data-close aria-label="Close">✕</button>
                </div>
                <div class="poster-view">
                    <div class="poster-art">${art}</div>
                    <div class="poster-info">
                        <span class="proj-badge">${esc(secName)}</span>
                        <h1>${esc(p.t)}</h1>
                        ${p.y ? `<p class="meta">${esc(p.y)}</p>` : ''}
                        <p class="txt">${p.d}</p>
                        ${relatedHTML(p, 'related-in')}
                    </div>
                </div>
            `;
        } else if (projEl) {
            projEl.className = 'card proj';
            projEl.innerHTML = `
                <div class="proj-header">
                    <button class="back" data-back>← Back to the stamp book</button>
                    <button class="x" data-close aria-label="Close">✕</button>
                </div>
                <div class="proj-body">
                    <span class="proj-badge">${esc(secName)}</span>
                    <h1>${esc(p.t)}</h1>
                    ${p.y ? `<p class="meta">${esc(p.y)}</p>` : ''}
                    <p class="txt">${p.d}</p>
                    ${relatedHTML(p, 'related-in')}
                    ${p.images.length ? '' : '<p class="no-scroll">Case study coming soon.</p>'}
                </div>
                ${p.images.length ? `<div class="proj-stack">${p.images.map((src, n) =>
                    `<img src="${esc(src)}" alt="${esc(p.t)}, image ${n + 1} of ${p.images.length}" loading="lazy" decoding="async">`
                ).join('')}</div>` : ''}
            `;
        }

        // Same related stamps again in the side panel (shown beside the card on wide screens; CSS picks which one is visible)
        const relEl = $('#projRelated');
        if (relEl) {
            const out = relatedHTML(p, '');
            relEl.innerHTML = out.replace(/^<div class="related ">/, '').replace(/<\/div>$/, '');
            relEl.hidden = !out;
            fitRelated();
        }

        if (projEl) {
            projEl.scrollTop = 0;
            // If a case-study image can't be found, say which path failed (F12 > Console)
            projEl.querySelectorAll('.proj-stack img, .poster-art img').forEach(img => {
                img.addEventListener('error', () => console.warn(`Project image not found: "${img.getAttribute('src')}". Check data-folder and the file name.`));
            });
        }

        hide('bookOv');
        show('projOv');
        fitRelated();
        if (projEl) projEl.style.setProperty('--sbw', (projEl.offsetWidth - projEl.clientWidth) + 'px');
        const backBtn = $('#proj .back');
        if (backBtn) backBtn.focus();
    }

    function openBook() {
        renderBook();
        show('bookOv');
        const activeTab = $('.tab[aria-selected="true"]');
        if (activeTab) activeTab.focus();
    }

    function openAbout() {
        show('aboutModal');
        const xBtn = $('#aboutModal .x');
        if (xBtn) xBtn.focus();
    }

    function openGengar() {
        show('gengarModal');
        const gAudio = $('#gengarAudio');
        if (!hasPlayedGengarAudio && gAudio) {
            hasPlayedGengarAudio = true;
            gAudio.currentTime = 0;
            gAudio.play().catch(e => console.log('Audio playback notice:', e));
        }
        const xBtn = $('#gengarModal .x');
        if (xBtn) xBtn.focus();
    }

    // -------------------------------------------------------------------------
    // Click handling
    // -------------------------------------------------------------------------
    document.addEventListener('click', e => {
        const t = e.target.closest('button');

        if (!t) {
            if (e.target.classList.contains('ov')) closeAll();
            return;
        }

        if (t.id === 'bookHot') {
            opener = t;
            openBook();
        } else if (t.id === 'nameGraffiti') {
            opener = t;
            openAbout();
        } else if (t.id === 'gengarGraffiti') {
            opener = t;
            openGengar();
        } else if (t.dataset.sec) {
            cur = t.dataset.sec;
            renderBook();
            const activeTab = $('.tab[aria-selected="true"]');
            if (activeTab) activeTab.focus();
        } else if (t.dataset.p !== undefined) {
            openProj(+t.dataset.p);
        } else if (t.dataset.back !== undefined) {
            hide('projOv');
            openBook();
        } else if (t.dataset.close !== undefined || t.classList.contains('x')) {
            closeAll();
        }
    });

    // -------------------------------------------------------------------------
    // Tooltips: instant and bigger than the browser's own. Any element with a title="..." gets one;
    // the title text is moved to data-tip so the slow native tooltip never appears.
    // -------------------------------------------------------------------------
    const tip = document.createElement('div');
    tip.id = 'tip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    let tipEl = null;

    function tipTarget(node) {
        const el = node.closest && node.closest('[title], [data-tip]');
        if (!el) return null;
        if (el.hasAttribute('title')) {
            const v = el.getAttribute('title');
            if (v) el.dataset.tip = v;
            el.removeAttribute('title');
        }
        return el.dataset.tip ? el : null;
    }

    function placeTip(e) {
        const gapX = 24, gapY = 28;      // far enough from the pointer that the cursor never covers the text
        const r = tip.getBoundingClientRect();
        let x = e.clientX + gapX;
        let y = e.clientY + gapY;
        if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - gapX;
        if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - gapY;
        tip.style.left = Math.max(8, x) + 'px';
        tip.style.top = Math.max(8, y) + 'px';
    }

    function hideTip() {
        tipEl = null;
        tip.classList.remove('on');
    }

    document.addEventListener('mouseover', e => {
        const el = tipTarget(e.target);
        if (el === tipEl) return;
        if (!el) { hideTip(); return; }
        tipEl = el;
        tip.textContent = el.dataset.tip;
        tip.classList.add('on');
        placeTip(e);
    });
    document.addEventListener('mousemove', e => { if (tipEl) placeTip(e); });
    document.documentElement.addEventListener('mouseleave', hideTip);
    document.addEventListener('click', hideTip);

    // Lets the 3D scene (scene3d.js) show the same tooltip for things inside the canvas
    window.siteTip = {
        show(text, x, y) { tip.textContent = text; tip.classList.add('on'); placeTip({ clientX: x, clientY: y }); },
        hide: hideTip
    };

    // -------------------------------------------------------------------------
    // Keyboard: Escape, F (fullscreen)
    // -------------------------------------------------------------------------
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'Escape') {
            const projOv = $('#projOv');
            if (projOv && projOv.classList.contains('on')) {
                hide('projOv');
                openBook();
                return;
            }
            closeAll();
            return;
        }

        if (e.key === 'f' || e.key === 'F') {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        }
    });
});
