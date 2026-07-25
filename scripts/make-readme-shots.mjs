/*
 * ITALIANO: genera gli SCREENSHOT per il README.
 *   Apre l'app dentro una finestra Electron nascosta (quindi con lo stesso aspetto del
 *   programma vero), la riempie con un piccolo set di immagini di esempio DISEGNATE
 *   al momento — nessuna foto reale, nessun volto di persone vere — e fotografa le
 *   varie schermate. Serve il server di sviluppo gia' avviato (npm run dev).
 *
 * ENGLISH: generates the README screenshots. It opens the app inside a hidden Electron
 *   window (so it looks exactly like the real program), fills it with a small set of
 *   sample images DRAWN on the fly — no real photos, no real faces — and captures the
 *   various screens. Requires the dev server to be running (npm run dev).
 *
 *   node scripts/make-readme-shots.mjs [--url http://localhost:3100] [--only 02,03]
 */
import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'docs', 'img');

const argv = process.argv.slice(2);
const argOf = (name, def) => {
    const i = argv.indexOf('--' + name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const URL_APP = argOf('url', 'http://localhost:3100');
const ONLY = argOf('only', '').split(',').map(s => s.trim()).filter(Boolean);
const FOLDER = argOf('folder', '');           // cartella vera da usare / real folder to use
const COUNT = parseInt(argOf('count', '14'), 10);
const W = 1600;
const H = 1000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// ITALIANO: prepara le immagini VERE. Le copio dentro public/ perche' la
//   Content-Security-Policy dell'app permette di scaricare solo dalla propria
//   origine: cosi' la pagina puo' leggerle e "farsele rilasciare" dentro.
// ENGLISH: stages the REAL images. They are copied into public/ because the app's
//   Content-Security-Policy only allows fetching from its own origin, so the page
//   can read them and have them "dropped" into itself.
// ---------------------------------------------------------------------------
const STAGE_DIR = path.join(ROOT, 'public', '__shots');
const IMG_RE = /\.(jpe?g|png|webp|gif|bmp)$/i;

function stageRealFiles(dir, count) {
    const tutti = fs.readdirSync(dir);
    const testi = new Set(tutti.filter(f => f.toLowerCase().endsWith('.txt')).map(f => f.slice(0, -4)));
    const coppie = tutti.filter(f => IMG_RE.test(f) && testi.has(f.replace(IMG_RE, ''))).sort();
    if (coppie.length === 0) throw new Error('nessuna immagine con .txt accanto in ' + dir);
    // scelta distribuita su tutta la cartella / evenly spread across the whole folder
    const passo = Math.max(1, Math.floor(coppie.length / count));
    const scelte = [];
    for (let i = 0; i < coppie.length && scelte.length < count; i += passo) scelte.push(coppie[i]);

    fs.rmSync(STAGE_DIR, { recursive: true, force: true });
    fs.mkdirSync(STAGE_DIR, { recursive: true });
    const elenco = [];
    for (const img of scelte) {
        const base = img.replace(IMG_RE, '');
        const txt = base + '.txt';
        fs.copyFileSync(path.join(dir, img), path.join(STAGE_DIR, img));
        fs.copyFileSync(path.join(dir, txt), path.join(STAGE_DIR, txt));
        elenco.push([img, txt]);
    }
    console.log('  ' + elenco.length + ' immagini vere pronte (su ' + coppie.length + ' disponibili)');
    // un tag presente su circa meta' delle foto scelte: la ricerca mostra un risultato parziale
    // a tag on roughly half of the chosen photos, so the search shows a partial result
    const conta = new Map();
    for (const [, txt] of elenco) {
        const tags = fs.readFileSync(path.join(STAGE_DIR, txt), 'utf8').split(',').map(t => t.trim()).filter(Boolean);
        new Set(tags).forEach(t => conta.set(t, (conta.get(t) || 0) + 1));
    }
    const buoni = Array.from(conta.entries())
        .filter(([t, c]) => c >= elenco.length * 0.3 && c <= elenco.length * 0.7)
        .sort((a, b) => b[1] - a[1]);
    elenco.tagRicerca = buoni.length ? buoni[0][0] : '';
    console.log('  tag per la ricerca: "' + elenco.tagRicerca + '"');
    return elenco;
}

const seedRealJs = elenco => `(async () => {
    const elenco = ${JSON.stringify(elenco)};
    const tipo = n => n.toLowerCase().endsWith('.png') ? 'image/png'
        : n.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    const files = [];
    for (const [img, txt] of elenco) {
        const bi = await (await fetch('/__shots/' + encodeURIComponent(img))).blob();
        const bt = await (await fetch('/__shots/' + encodeURIComponent(txt))).blob();
        files.push(new File([bi], img, { type: tipo(img) }));
        files.push(new File([bt], txt, { type: 'text/plain' }));
    }
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    return files.length;
})()`;

// ---------------------------------------------------------------------------
// Codice iniettato nella pagina: disegna le immagini di esempio e le "rilascia"
// nell'app come farebbe un trascinamento vero.
// Injected page code: draws the sample images and "drops" them into the app
// exactly like a real drag & drop would.
// ---------------------------------------------------------------------------
const SEED_FILES = `(async () => {
    const PALETTES = [
        ['#f5d0c5', '#c98f7a', '#5b3a34'], ['#cfe3f7', '#7aa7d9', '#2f4a6b'],
        ['#e8ddf7', '#a98cd8', '#4a3568'], ['#fdeecf', '#e0b072', '#6b4a25'],
        ['#d6f0e6', '#79c4a6', '#2d5a49'], ['#f7d9e6', '#d488ab', '#5e3049'],
        ['#e3e7ef', '#98a2b8', '#3b4256'], ['#fce3d2', '#e39a6e', '#6b3f28'],
        ['#dbe8d3', '#8fb37a', '#3c5230'], ['#efe0f5', '#bb8fd0', '#54325f'],
        ['#d2e9f5', '#6fb0cf', '#26505f'], ['#f6e2c7', '#cfa261', '#5e4222'],
    ];
    const SHAPES = ['bust', 'full', 'profile', 'wide'];

    function draw(i) {
        const portrait = i % 4 !== 3;
        const w = portrait ? 640 : 896;
        const h = portrait ? 896 : 640;
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const g = cv.getContext('2d');
        const p = PALETTES[i % PALETTES.length];
        const shape = SHAPES[i % SHAPES.length];

        // fondale da studio / studio backdrop
        const bg = g.createRadialGradient(w * 0.5, h * 0.3, w * 0.04, w * 0.5, h * 0.62, h * 0.92);
        bg.addColorStop(0, p[0]); bg.addColorStop(1, p[1]);
        g.fillStyle = bg; g.fillRect(0, 0, w, h);

        // inquadratura: quanto e' vicino il soggetto / framing: how close the subject is
        const near = shape === 'profile' || shape === 'bust' ? 1 : shape === 'wide' ? 0.72 : 0.58;
        const headR = h * 0.115 * near;
        const headY = h * (shape === 'full' ? 0.2 : shape === 'wide' ? 0.26 : 0.3);
        const cx = w * (shape === 'profile' ? 0.44 : 0.5);
        const dark = p[2];

        // ombra morbida dietro il soggetto / soft shadow behind the subject
        const sh = g.createRadialGradient(cx, headY + headR * 3.2, 0, cx, headY + headR * 3.2, headR * 6);
        sh.addColorStop(0, 'rgba(0,0,0,0.16)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = sh; g.fillRect(0, 0, w, h);

        g.fillStyle = dark;
        // spalle: trapezio morbido che scende fuori dal bordo / shoulders: soft trapezoid running off-frame
        const shTop = headY + headR * 1.62;
        const shHalf = headR * (shape === 'full' ? 1.5 : 1.95);
        const baseHalf = headR * (shape === 'full' ? 2.1 : 3.1);
        const baseY = shape === 'full' ? headY + headR * 7.2 : h * 1.02;
        g.beginPath();
        g.moveTo(cx - baseHalf, baseY);
        g.bezierCurveTo(cx - baseHalf, shTop + headR * 0.9, cx - shHalf, shTop + headR * 0.1, cx - headR * 0.52, shTop - headR * 0.25);
        g.lineTo(cx + headR * 0.52, shTop - headR * 0.25);
        g.bezierCurveTo(cx + shHalf, shTop + headR * 0.1, cx + baseHalf, shTop + headR * 0.9, cx + baseHalf, baseY);
        g.closePath(); g.fill();
        // collo / neck
        g.beginPath();
        g.moveTo(cx - headR * 0.4, headY + headR * 0.6);
        g.lineTo(cx + headR * 0.4, headY + headR * 0.6);
        g.lineTo(cx + headR * 0.46, shTop);
        g.lineTo(cx - headR * 0.46, shTop);
        g.closePath(); g.fill();
        // testa leggermente ovale / slightly oval head
        g.beginPath(); g.ellipse(cx, headY, headR * 0.82, headR, 0, 0, 7); g.fill();
        // massa dei capelli / hair mass
        g.beginPath();
        g.ellipse(cx, headY - headR * 0.18, headR * 0.98, headR * 0.92, 0, Math.PI * 1.02, Math.PI * 1.98);
        g.fill();
        if (shape !== 'full' && shape !== 'wide') {
            // ciocche laterali dei capelli / side locks
            g.beginPath();
            g.ellipse(cx - headR * 0.86, headY + headR * 0.42, headR * 0.3, headR * 0.85, -0.12, 0, 7);
            g.ellipse(cx + headR * 0.86, headY + headR * 0.42, headR * 0.3, headR * 0.85, 0.12, 0, 7);
            g.fill();
        }

        // luce di contorno / rim light
        g.save();
        g.globalCompositeOperation = 'lighter';
        const rim = g.createLinearGradient(cx - headR * 1.4, headY - headR, cx + headR * 1.6, headY + headR * 2);
        rim.addColorStop(0, 'rgba(255,255,255,0)');
        rim.addColorStop(1, 'rgba(255,255,255,0.16)');
        g.fillStyle = rim; g.fillRect(0, 0, w, h);
        g.restore();

        // vignettatura / vignette
        const vg = g.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.34, w * 0.5, h * 0.5, Math.max(w, h) * 0.76);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.32)');
        g.fillStyle = vg; g.fillRect(0, 0, w, h);
        return cv;
    }

    const TAGS = [
        '1girl, solo, long hair, brown hair, looking at viewer, upper body, soft lighting, simple background',
        '1girl, solo, blue eyes, short hair, portrait, side lighting, gradient background, closed mouth',
        '1boy, solo, standing, full body, wide shot, outdoors, sunset, backlighting',
        '1girl, solo, from side, profile, long hair, warm lighting, depth of field',
        '1girl, solo, upper body, smile, green background, studio lighting, looking away',
        '1girl, solo, pink theme, medium shot, soft focus, bokeh, indoors',
        '1boy, solo, grey background, neutral expression, upper body, rim lighting',
        '1girl, solo, orange theme, full body, dynamic pose, dramatic lighting',
        '1girl, solo, outdoors, nature, wide shot, natural lighting, calm',
        '1girl, solo, purple theme, portrait, close-up, high contrast',
        '1boy, solo, cool tones, upper body, looking at viewer, blue lighting',
        '1girl, solo, golden hour, full body, standing, warm tones, backlit',
    ];

    const files = [];
    for (let i = 0; i < 12; i++) {
        const cv = draw(i);
        const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
        const base = 'dataset_' + String(i + 1).padStart(2, '0');
        files.push(new File([blob], base + '.jpg', { type: 'image/jpeg' }));
        files.push(new File([TAGS[i]], base + '.txt', { type: 'text/plain' }));
    }

    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    return files.length;
})()`;

// helper iniettabili / injectable helpers
const HELPERS = `
window.__shot = {
    byText(text, tags) {
        const wanted = String(text).toLowerCase();
        const list = document.querySelectorAll(tags || 'button, [role=button], a');
        for (const el of list) {
            const label = ((el.innerText || '') + ' ' + (el.getAttribute('title') || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
            if (label.includes(wanted)) return el;
        }
        return null;
    },
    clickEsatto(text) {
        // solo i tasti della barra in alto: "Trash" compare anche come titolo sulle miniature
        // header buttons only: "Trash" also shows up as a tooltip on the thumbnails
        const el = Array.from(document.querySelectorAll('button')).find(b =>
            (b.innerText || '').trim().startsWith(text) && b.getBoundingClientRect().top < 130);
        if (el) { el.click(); return true; }
        return false;
    },
    click(text, tags) {
        const el = window.__shot.byText(text, tags);
        if (el) { el.click(); return true; }
        return false;
    },
    buttons() {
        return Array.from(document.querySelectorAll('button')).map(b => (b.innerText || b.getAttribute('title') || b.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim()).filter(Boolean);
    },
    set(sel, value, index) {
        const el = document.querySelectorAll(sel)[index || 0];
        if (!el) return false;
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(value));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    },
    topOverlay() {
        // ITALIANO: il velo del trascinamento e' anch'esso fisso e a tutto schermo ma non ha
        //           bottoni: prendo l'ultimo pannello fisso che ne contiene almeno uno.
        // ENGLISH: the drag overlay is fixed and full-screen too but has no buttons: take the
        //          last fixed panel that actually contains one.
        const fissi = Array.from(document.querySelectorAll('body *')).filter(el => {
            if (getComputedStyle(el).position !== 'fixed') return false;
            const r = el.getBoundingClientRect();
            if (r.width < innerWidth * 0.5 || r.height < innerHeight * 0.4) return false;
            return el.querySelector('button') !== null;
        });
        return fissi[fissi.length - 1] || null;
    },
    overlays() {
        const top = window.__shot.topOverlay();
        if (!top) return ['(nessun overlay)'];
        return Array.from(top.querySelectorAll('button')).slice(0, 12).map((b, i) =>
            i + ': "' + (b.innerText || '').replace(/\\s+/g, ' ').trim() + '" title=' + (b.getAttribute('title') || '-'));
    },
    closeTop() {
        const top = window.__shot.topOverlay();
        if (!top) return false;
        // il tasto di chiusura e' quello senza testo piu' in alto a destra
        // the close button is the text-less one nearest the top-right corner
        const cand = Array.from(top.querySelectorAll('button')).filter(b => !(b.innerText || '').trim());
        const scelto = cand.sort((a, b) => {
            const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
            return (ra.top - ra.right) - (rb.top - rb.right);
        })[0];
        if (scelto) { scelto.click(); return true; }
        return false;
    },
    path(sel, index) {
        let el = document.querySelectorAll(sel)[index || 0];
        const out = [];
        for (let i = 0; el && i < 6; i++, el = el.parentElement) {
            out.push(el.tagName + '.' + (el.className || '').toString().replace(/\\s+/g, '.').slice(0, 80));
        }
        return out;
    },
    hit(sel, index, up) {
        let el = document.querySelectorAll(sel)[index || 0];
        for (let i = 0; i < (up || 0) && el; i++) el = el.parentElement;
        if (!el) return false;
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
    },
    colonne() {
        // conto le posizioni orizzontali diverse delle miniature: e' l'unico modo affidabile
        // count the distinct horizontal positions of the cards: the only reliable way
        const carte = document.querySelectorAll('div.grid > div');
        const x = new Set();
        carte.forEach(c => x.add(Math.round(c.getBoundingClientRect().left)));
        return x.size;
    },
    async zoomPerColonne(n) {
        const inp = document.querySelector('input[type=range]');
        if (!inp) return null;
        const setta = v => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, String(v));
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
        };
        for (let v = Number(inp.max); v >= Number(inp.min); v -= 10) {
            setta(v);
            await new Promise(r => setTimeout(r, 160));
            if (window.__shot.colonne() >= n) return { zoom: v, colonne: window.__shot.colonne() };
        }
        return { zoom: Number(inp.min), colonne: window.__shot.colonne() };
    },
    interruttore(i) {
        // gli interruttori sono <div class="w-12 h-6 ...">: 0 suoni, 1 tema, 2 strumenti IA
        // the switches are <div class="w-12 h-6 ...">: 0 sounds, 1 theme, 2 AI tools
        const sw = Array.from(document.querySelectorAll('div.w-12.h-6.rounded-full'));
        if (!sw[i]) return false;
        sw[i].click();
        return true;
    },
    temaChiaro() { return window.__shot.interruttore(1); },
    rettangolo(sel, index) {
        const el = document.querySelectorAll(sel)[index || 0];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 120)) };
    },
    tagFrequente() {
        // un tag presente su circa meta' delle foto: la ricerca mostra un risultato parziale
        // a tag on roughly half of the photos, so the search shows a partial result
        const carte = document.querySelectorAll('div.grid > div');
        const conta = new Map();
        carte.forEach(c => new Set(Array.from(c.querySelectorAll('button[title]')).map(b => b.getAttribute('title')))
            .forEach(t => conta.set(t, (conta.get(t) || 0) + 1)));
        const n = carte.length || 1;
        const ordinati = Array.from(conta.entries())
            .filter(([t, c]) => t && t.length > 2 && c >= n * 0.25 && c <= n * 0.75)
            .sort((a, b) => b[1] - a[1]);
        return ordinati.length ? ordinati[0][0] : '';
    },
};
true`;

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const win = new BrowserWindow({
        width: W, height: H, useContentSize: true, show: false,
        backgroundColor: '#2e1065',
        webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false },
    });
    const wc = win.webContents;
    const run = js => wc.executeJavaScript(js, true);

    const shot = async (name) => {
        if (ONLY.length && !ONLY.some(o => name.startsWith(o))) return;
        await sleep(400);
        const img = await wc.capturePage();
        const file = path.join(OUT_DIR, name + '.png');
        fs.writeFileSync(file, img.toPNG());
        console.log('  ->', path.relative(ROOT, file), img.getSize().width + 'x' + img.getSize().height);
    };

    // ITALIANO: click VERO col mouse: alcuni gestori di React non reagiscono a un evento
    //   costruito a mano, mentre un click inviato al browser e' indistinguibile da quello umano.
    // ENGLISH: a REAL mouse click: some React handlers ignore a hand-built event, while a click
    //   sent to the browser itself is indistinguishable from a human one.
    const clickReale = async (sel, index) => {
        const p = await run(`window.__shot.rettangolo(${JSON.stringify(sel)}, ${index || 0})`);
        if (!p) { console.log('   click mancato:', sel, index); return false; }
        wc.sendInputEvent({ type: 'mouseMove', x: p.x, y: p.y });
        await sleep(120);
        wc.sendInputEvent({ type: 'mouseDown', x: p.x, y: p.y, button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x: p.x, y: p.y, button: 'left', clickCount: 1 });
        return true;
    };

    const elenco = FOLDER ? stageRealFiles(FOLDER, COUNT) : null;

    // ITALIANO: prima di OGNI scatto riparto da capo (ricarico e reimporto). Costa qualche
    //   secondo ma evita che un pannello rimasto aperto sporchi la foto successiva.
    // ENGLISH: every shot starts from scratch (reload + re-import). It costs a few seconds but
    //   stops a panel left open from spoiling the next picture.
    const daCapo = async ({ lingua = 'en', conImmagini = true, primoAvvio = false } = {}) => {
        await run(`try {
            localStorage.setItem('lang', '${lingua}');
            ${primoAvvio ? `localStorage.removeItem('langChosen');` : `localStorage.setItem('langChosen','1');`}
            localStorage.removeItem('tagBackup');
            localStorage.setItem('aiEnabled', 'false');
        } catch(e) {}; true`).catch(() => { });
        await wc.reload();
        await sleep(1600);
        await run(HELPERS);
        await sleep(4400); // schermata di avvio / splash screen
        await run(HELPERS);
        if (!conImmagini) return;
        if (elenco) await run(seedRealJs(elenco)); else await run(SEED_FILES);
        await sleep(3800);
        await run(`window.__shot.click('Import') || window.__shot.click('Importa')`);
        await sleep(4000);
        console.log('   griglia:', JSON.stringify(await run(`window.__shot.zoomPerColonne(5)`)));
        // aspetto che sparisca la notifica verde "immagini caricate"
        // wait for the green "images loaded" toast to fade out
        await sleep(7000);
    };

    console.log('apro', URL_APP);
    await wc.loadURL(URL_APP);
    await sleep(1200);

    // --- 1. galleria ---------------------------------------------------------
    await daCapo();
    await shot('01-gallery');

    // --- 2. selezione multipla ----------------------------------------------
    await run(`window.__shot.click('Select all')`);
    await sleep(1500);
    await shot('02-bulk-tagging');

    // --- 3. ricerca per tag --------------------------------------------------
    await daCapo();
    const tag = (elenco && elenco.tagRicerca) || await run(`window.__shot.tagFrequente()`);
    console.log('   cerco il tag:', tag);
    await run(`window.__shot.set('input[placeholder*="earch"]', ${JSON.stringify(tag)})`);
    await sleep(1800);
    await shot('03-tag-search');

    // --- 4. visualizzatore ---------------------------------------------------
    await daCapo();
    await clickReale('div.grid > div', 3);
    await sleep(2600);
    await shot('04-lightbox');

    // --- 5. editor dei file di tag -------------------------------------------
    await daCapo();
    await run(`window.__shot.click('Tag Editor') || window.__shot.click('Editor')`);
    await sleep(1800);
    await run(`window.__shot.click('project tags') || window.__shot.click('Add project')`);
    await sleep(1800);
    await shot('05-tag-editor');

    // --- 6. statistiche ------------------------------------------------------
    await daCapo();
    await run(`window.__shot.click('Statistics') || window.__shot.click('Project stat')`);
    await sleep(2000);
    await run(`window.dispatchEvent(new Event('resize')); true`);
    await sleep(3000);
    await shot('06-statistics');

    // --- 7. impostazioni / IA ------------------------------------------------
    await daCapo();
    await run(`window.__shot.click('Settings')`);
    await sleep(1400);
    console.log('   accendo gli strumenti IA:', await run(`window.__shot.interruttore(2)`));
    await sleep(1800);
    await shot('07-ai-settings');

    // --- 8. tema chiaro ------------------------------------------------------
    await daCapo();
    await run(`window.__shot.click('Settings')`);
    await sleep(1200);
    console.log('   interruttore tema:', await run(`window.__shot.temaChiaro()`));
    await sleep(900);
    await run(`window.__shot.click('Settings')`); // richiudo il pannello / close the panel again
    await sleep(1200);
    await shot('08-light-theme');

    // --- 9. cestino ----------------------------------------------------------
    await daCapo();
    for (const i of [2, 5, 7]) {
        await run(`(() => { const c = document.querySelectorAll('div.grid > div')[${i}];
            const b = c && Array.from(c.querySelectorAll('button')).find(x => (x.getAttribute('title')||'').toLowerCase().includes('trash'));
            if (b) { b.click(); return true; } return false; })()`);
        await sleep(900);
    }
    console.log('   apro il cestino:', await run(`window.__shot.clickEsatto('Trash')`));
    await sleep(2200);
    await shot('09-trash');

    // --- 10. scelta della lingua --------------------------------------------
    await daCapo({ conImmagini: false, primoAvvio: true });
    await shot('10-languages');

    console.log('fine');
    app.quit();
}

const pulisci = () => { try { fs.rmSync(STAGE_DIR, { recursive: true, force: true }); } catch (_) { /* niente */ } };
app.whenReady().then(() => main().catch(err => { console.error(err); pulisci(); app.exit(1); }));
app.on('quit', pulisci);
app.on('window-all-closed', () => app.quit());
