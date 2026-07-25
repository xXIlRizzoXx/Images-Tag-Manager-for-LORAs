/**
 * ITALIANO
 * --------
 * Genera le immagini del wizard di installazione (NSIS / MUI2) partendo dal
 * logo dell'app, cosi' l'installer ha lo stesso aspetto del programma.
 *
 *   build/installerSidebar.bmp    164 x 314  fascia laterale (pagine Benvenuto e Fine)
 *   build/uninstallerSidebar.bmp  164 x 314  idem, versione disinstallazione
 *   build/installerHeader.bmp     150 x  57  striscia in alto nelle pagine interne
 *
 * Si rigenera con:  npm run installer:art
 *
 * Nessuna libreria esterna: il PNG viene decodificato con lo zlib incluso in
 * Node e il BMP viene scritto byte per byte. I colori NON sono scritti a mano:
 * sono gli stessi valori OKLCH della palette Tailwind usata dall'app,
 * convertiti qui in sRGB, cosi' installer e app restano in tinta.
 *
 * ATTENZIONE: nessun TESTO nelle immagini. L'installer parla 9 lingue e una
 * scritta cotta dentro il BMP sarebbe sbagliata in 8 casi su 9.
 *
 * ENGLISH
 * -------
 * Generates the NSIS/MUI2 wizard artwork from the app logo so the installer
 * looks like the app. No external deps: PNG is decoded with Node's built-in
 * zlib, BMP is written by hand. Colors are the app's own Tailwind OKLCH
 * tokens converted to sRGB. No baked-in TEXT: the installer is multilingual.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGO = path.join(ROOT, 'public', 'logo.png');
const OUT_DIR = path.join(ROOT, 'build');

/* ------------------------------------------------------------------ colori */
/* Valori presi da dist/assets/*.css (palette Tailwind v4, formato OKLCH). */
const TW = {
    // ITALIANO: palette tutta sul VIOLA, come l'app (niente piu' toni grigio/azzurro).
    // ENGLISH: all-VIOLET palette, matching the app (no more gray/blue tones).
    violet950: [0.283, 0.141, 291.089],
    violet900: [0.379, 0.146, 292.717],
    violet700: [0.491, 0.27, 292.581],
    violet500: [0.606, 0.25, 292.717],
    violet400: [0.702, 0.183, 293.541],
    purple950: [0.291, 0.149, 302.717],
    purple600: [0.558, 0.288, 302.321],
    slate400: [0.704, 0.04, 256.788], // ITALIANO: solo per la versione disinstalla (grigio neutro) — ENGLISH: uninstall only (neutral grey)
};

/** OKLCH -> sRGB 0..255 (Bjorn Ottosson, https://bottosson.github.io/posts/oklab/) */
function oklch(L, C, Hdeg) {
    const h = (Hdeg * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const lin = [
        +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];

    // gamma sRGB + clamp nel gamut
    return lin.map(v => {
        const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
        return Math.max(0, Math.min(255, Math.round(c * 255)));
    });
}

const C = Object.fromEntries(Object.entries(TW).map(([k, v]) => [k, oklch(...v)]));

/* ------------------------------------------------------------- PNG -> RGBA */
function decodePng(file) {
    const buf = fs.readFileSync(file);
    const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) if (buf[i] !== SIG[i]) throw new Error(`${file}: non e' un PNG`);

    let off = 8;
    let ihdr = null;
    const idat = [];
    while (off < buf.length) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString('ascii', off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') {
            ihdr = {
                w: data.readUInt32BE(0),
                h: data.readUInt32BE(4),
                depth: data[8],
                color: data[9],
                interlace: data[12],
            };
        } else if (type === 'IDAT') {
            idat.push(data);
        } else if (type === 'IEND') break;
        off += 12 + len;
    }
    if (!ihdr) throw new Error(`${file}: IHDR mancante`);
    if (ihdr.depth !== 8 || ihdr.color !== 6 || ihdr.interlace !== 0) {
        throw new Error(`${file}: serve un PNG RGBA 8 bit non interlacciato (trovato depth=${ihdr.depth} color=${ihdr.color} interlace=${ihdr.interlace})`);
    }

    const raw = zlib.inflateSync(Buffer.concat(idat));
    const { w, h } = ihdr;
    const bpp = 4;
    const stride = w * bpp;
    const out = Buffer.alloc(stride * h);

    // de-filtering per scanline (PNG filter types 0..4)
    let p = 0;
    for (let y = 0; y < h; y++) {
        const filter = raw[p++];
        const line = raw.subarray(p, p + stride);
        p += stride;
        const cur = out.subarray(y * stride, (y + 1) * stride);
        const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

        for (let x = 0; x < stride; x++) {
            const a = x >= bpp ? cur[x - bpp] : 0;
            const b = prev ? prev[x] : 0;
            const c = prev && x >= bpp ? prev[x - bpp] : 0;
            let v = line[x];
            switch (filter) {
                case 0: break;
                case 1: v += a; break;
                case 2: v += b; break;
                case 3: v += (a + b) >> 1; break;
                case 4: {
                    const pp = a + b - c;
                    const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
                    v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
                    break;
                }
                default: throw new Error(`filtro PNG sconosciuto: ${filter}`);
            }
            cur[x] = v & 0xff;
        }
    }
    return { w, h, data: out };
}

/** Riduzione a media d'area (box filter) con alfa premoltiplicata. */
function resizeRgba(src, sw, sh, dw, dh) {
    const out = Buffer.alloc(dw * dh * 4);
    const xr = sw / dw, yr = sh / dh;
    for (let dy = 0; dy < dh; dy++) {
        const y0 = Math.floor(dy * yr), y1 = Math.max(y0 + 1, Math.floor((dy + 1) * yr));
        for (let dx = 0; dx < dw; dx++) {
            const x0 = Math.floor(dx * xr), x1 = Math.max(x0 + 1, Math.floor((dx + 1) * xr));
            let r = 0, g = 0, b = 0, a = 0, n = 0;
            for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                    const i = (y * sw + x) * 4;
                    const al = src[i + 3] / 255;
                    r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al;
                    a += src[i + 3];
                    n++;
                }
            }
            const o = (dy * dw + dx) * 4;
            const am = a / n;
            const inv = am > 0 ? 255 / am : 0;
            out[o] = Math.min(255, Math.round((r / n) * inv));
            out[o + 1] = Math.min(255, Math.round((g / n) * inv));
            out[o + 2] = Math.min(255, Math.round((b / n) * inv));
            out[o + 3] = Math.round(am);
        }
    }
    return out;
}

/* ------------------------------------------------------------ tela di lavoro */
class Canvas {
    constructor(w, h) {
        this.w = w; this.h = h;
        this.px = new Float64Array(w * h * 3);
    }
    set(x, y, r, g, b) {
        const i = (y * this.w + x) * 3;
        this.px[i] = r; this.px[i + 1] = g; this.px[i + 2] = b;
    }
    blend(x, y, r, g, b, a) {
        if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
        const i = (y * this.w + x) * 3;
        this.px[i] += (r - this.px[i]) * a;
        this.px[i + 1] += (g - this.px[i + 1]) * a;
        this.px[i + 2] += (b - this.px[i + 2]) * a;
    }
    /** Riduce la tela supercampionata alla dimensione finale (antialiasing). */
    downsample(dw, dh) {
        const out = new Canvas(dw, dh);
        const xr = this.w / dw, yr = this.h / dh;
        for (let dy = 0; dy < dh; dy++) {
            const y0 = Math.floor(dy * yr), y1 = Math.max(y0 + 1, Math.floor((dy + 1) * yr));
            for (let dx = 0; dx < dw; dx++) {
                const x0 = Math.floor(dx * xr), x1 = Math.max(x0 + 1, Math.floor((dx + 1) * xr));
                let r = 0, g = 0, b = 0, n = 0;
                for (let y = y0; y < y1; y++) {
                    for (let x = x0; x < x1; x++) {
                        const i = (y * this.w + x) * 3;
                        r += this.px[i]; g += this.px[i + 1]; b += this.px[i + 2];
                        n++;
                    }
                }
                out.set(dx, dy, r / n, g / n, b / n);
            }
        }
        return out;
    }
}

/** BMP 24 bit, righe dal basso verso l'alto, padding a 4 byte: il formato che NSIS digerisce sempre. */
function writeBmp24(file, canvas) {
    const { w, h } = canvas;
    const rowSize = Math.ceil((w * 3) / 4) * 4;
    const pixels = Buffer.alloc(rowSize * h);
    for (let y = 0; y < h; y++) {
        const dstY = h - 1 - y; // bottom-up
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 3;
            const o = dstY * rowSize + x * 3;
            pixels[o] = Math.max(0, Math.min(255, Math.round(canvas.px[i + 2]))); // B
            pixels[o + 1] = Math.max(0, Math.min(255, Math.round(canvas.px[i + 1]))); // G
            pixels[o + 2] = Math.max(0, Math.min(255, Math.round(canvas.px[i]))); // R
        }
    }
    const header = Buffer.alloc(54);
    header.write('BM', 0, 'ascii');
    header.writeUInt32LE(54 + pixels.length, 2);
    header.writeUInt32LE(54, 10);
    header.writeUInt32LE(40, 14);   // BITMAPINFOHEADER
    header.writeInt32LE(w, 18);
    header.writeInt32LE(h, 22);
    header.writeUInt16LE(1, 26);    // planes
    header.writeUInt16LE(24, 28);   // bit depth
    header.writeUInt32LE(0, 30);    // BI_RGB, nessuna compressione
    header.writeUInt32LE(pixels.length, 34);
    header.writeInt32LE(2835, 38);  // ~72 DPI
    header.writeInt32LE(2835, 42);
    fs.writeFileSync(file, Buffer.concat([header, pixels]));
    return 54 + pixels.length;
}

/** PNG RGB 8bit (solo per ANTEPRIMA: non entra nell'installer, serve a vedere il risultato). */
function writePngPreview(file, canvas, scale = 2) {
    const W = canvas.w * scale, H = canvas.h * scale;
    const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; // RGB
    const raw = Buffer.alloc((W * 3 + 1) * H);
    let o = 0;
    for (let y = 0; y < H; y++) {
        raw[o++] = 0; // filtro none
        const sy = Math.floor(y / scale);
        for (let x = 0; x < W; x++) {
            const sx = Math.floor(x / scale);
            const i = (sy * canvas.w + sx) * 3;
            raw[o++] = Math.max(0, Math.min(255, Math.round(canvas.px[i])));
            raw[o++] = Math.max(0, Math.min(255, Math.round(canvas.px[i + 1])));
            raw[o++] = Math.max(0, Math.min(255, Math.round(canvas.px[i + 2])));
        }
    }
    const png = Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
    fs.writeFileSync(file, png);
}

/* ------------------------------------------------------------ disegno */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = t => t * t * (3 - 2 * t);

function mix(c1, c2, t) {
    return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

/** Gradiente diagonale a 3 tappe, come "bg-gradient-to-br from-X via-Y to-Z". */
function paintGradient(cv, stops) {
    for (let y = 0; y < cv.h; y++) {
        for (let x = 0; x < cv.w; x++) {
            const t = clamp01((x / cv.w + y / cv.h) / 2);
            const c = t < 0.5 ? mix(stops[0], stops[1], t * 2) : mix(stops[1], stops[2], (t - 0.5) * 2);
            cv.set(x, y, c[0], c[1], c[2]);
        }
    }
}

/** Alone radiale morbido (il bagliore che l'app ha dietro al logo). */
function paintGlow(cv, cx, cy, radius, color, strength) {
    const r2 = radius * radius;
    for (let y = 0; y < cv.h; y++) {
        for (let x = 0; x < cv.w; x++) {
            const d2 = (x - cx) ** 2 + (y - cy) ** 2;
            if (d2 > r2) continue;
            const f = 1 - Math.sqrt(d2) / radius;
            cv.blend(x, y, color[0], color[1], color[2], smooth(f) * f * strength);
        }
    }
}

/**
 * Pillola arrotondata con il pallino a sinistra: e' la forma dei "tag"
 * dell'app. Il pallino e' quello che la fa leggere come etichetta e non
 * come rettangolo di caricamento.
 */
function paintPill(cv, x, y, w, h, color, alpha) {
    const r = h / 2;
    const dotR = h * 0.26;
    const dotX = x + h * 0.62, dotY = y + r;

    for (let py = Math.floor(y) - 1; py < Math.ceil(y + h) + 1; py++) {
        for (let px = Math.floor(x) - 1; px < Math.ceil(x + w) + 1; px++) {
            const dx = Math.max(x + r - px, 0, px - (x + w - r));
            const dy = py - (y + r);
            const d = Math.sqrt(dx * dx + dy * dy);
            const inPill = clamp01(r - d + 0.5);
            if (inPill <= 0) continue;

            // Il pallino "buca" la pillola: piu' luminoso al centro.
            const dd = Math.sqrt((px - dotX) ** 2 + (py - dotY) ** 2);
            const inDot = clamp01(dotR - dd + 0.5);

            cv.blend(px, py, color[0], color[1], color[2], alpha * inPill);
            if (inDot > 0) cv.blend(px, py, 255, 255, 255, alpha * 1.9 * inDot);
        }
    }
}

/**
 * ITALIANO: Distanza con segno da un rettangolo con angoli arrotondati (negativa dentro).
 *           Serve a disegnare cornici morbide senza scalettature.
 * ENGLISH: Signed distance to a rounded rectangle (negative inside). Used to draw soft frames
 *          without jaggies.
 */
function sdRoundRect(px, py, x, y, w, h, r) {
    const qx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
    const qy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
    const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
    return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * ITALIANO: Piccola "fotografia": cornice arrotondata con dentro un sole e un profilo di
 *           montagna, cioe' il simbolo universale dell'immagine. Riempie la parte bassa della
 *           fascia dicendo che questo programma lavora su FOTO, mentre le pillole sopra dicono
 *           che ci mette i TAG. Resta molto tenue: e' sfondo, non deve rubare la scena al logo.
 * ENGLISH: A small "photo": rounded frame holding a sun and a mountain outline, the universal
 *          picture symbol. It fills the lower part of the sidebar saying this program works on
 *          PHOTOS, while the pills above say it puts TAGS on them. Kept very faint: it is
 *          background, it must not steal the scene from the logo.
 */
function paintPhoto(cv, cx, cy, w, h, angle, color, alpha, fillColor, fillAlpha) {
    const r = Math.min(w, h) * 0.16;
    const stroke = Math.max(1, SS * 1.0);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    // ITALIANO: ruotando, il riquadro da scandire e' piu' grande del rettangolo: uso la mezza
    //           diagonale, cosi' nessun angolo resta fuori.
    // ENGLISH: once rotated the box to scan is larger than the rectangle: I use the half diagonal,
    //          so no corner is left out.
    const rad = Math.ceil(Math.sqrt(w * w + h * h) / 2) + 2;

    // posizioni di sole e montagna nel sistema di riferimento della foto (origine al centro)
    const sunX = -w * 0.20, sunY = -h * 0.18, sunR = Math.min(w, h) * 0.13;
    const mBaseY = h * 0.30, mHalf = w * 0.36, mPeakY = -h * 0.10, mPeakX = w * 0.02;

    for (let py = Math.floor(cy) - rad; py <= Math.ceil(cy) + rad; py++) {
        for (let px = Math.floor(cx) - rad; px <= Math.ceil(cx) + rad; px++) {
            // ITALIANO: porto il punto nel sistema della foto ruotando all'indietro: cosi' posso
            //           continuare a ragionare su un rettangolo dritto.
            // ENGLISH: bring the point into the photo's frame by rotating backwards: that way I can
            //          keep reasoning about an upright rectangle.
            const ox = px - cx, oy = py - cy;
            const lx = ox * cos + oy * sin;
            const ly = -ox * sin + oy * cos;

            const d = sdRoundRect(lx, ly, -w / 2, -h / 2, w, h, r);
            const dentro = clamp01(0.5 - d);
            if (dentro <= 0 && Math.abs(d) > stroke) continue;

            // ITALIANO: il ripieno serve al VENTAGLIO: senza, le cornici sovrapposte si
            //           incrociavano e non si capiva quale foto stesse sopra.
            // ENGLISH: the fill is what makes the FAN readable: without it the overlapping frames
            //          crossed each other and you could not tell which photo was on top.
            if (dentro > 0 && fillAlpha > 0) {
                cv.blend(px, py, fillColor[0], fillColor[1], fillColor[2], fillAlpha * dentro);
            }

            let a = clamp01(stroke / 2 - Math.abs(d) + 0.5);   // cornice
            if (d < 0) {
                const ds = Math.sqrt((lx - sunX) ** 2 + (ly - sunY) ** 2);
                a = Math.max(a, clamp01(sunR - ds + 0.5) * 0.95);
                if (ly <= mBaseY && ly >= mPeakY) {
                    const t = (mBaseY - ly) / (mBaseY - mPeakY);
                    if (Math.abs(lx - mPeakX) <= mHalf * (1 - t)) a = Math.max(a, 0.8);
                }
            }
            if (a > 0) cv.blend(px, py, color[0], color[1], color[2], alpha * a);
        }
    }
}

/** Vignettatura: scurisce i bordi, stacca l'immagine dalla finestra bianca. */
function paintVignette(cv, strength) {
    for (let y = 0; y < cv.h; y++) {
        for (let x = 0; x < cv.w; x++) {
            const nx = (x / cv.w - 0.5) * 2, ny = (y / cv.h - 0.5) * 2;
            const d = clamp01(Math.sqrt(nx * nx + ny * ny) / 1.414);
            const a = smooth(clamp01((d - 0.45) / 0.55)) * strength;
            cv.blend(x, y, 0, 0, 0, a);
        }
    }
}

/** Incolla il logo RGBA sulla tela, con opacita' e desaturazione opzionali. */
function paintLogo(cv, logo, dx, dy, dw, dh, { opacity = 1, desaturate = 0 } = {}) {
    const scaled = resizeRgba(logo.data, logo.w, logo.h, dw, dh);
    for (let y = 0; y < dh; y++) {
        for (let x = 0; x < dw; x++) {
            const i = (y * dw + x) * 4;
            let r = scaled[i], g = scaled[i + 1], b = scaled[i + 2];
            const a = (scaled[i + 3] / 255) * opacity;
            if (desaturate > 0) {
                const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                r = lerp(r, lum, desaturate); g = lerp(g, lum, desaturate); b = lerp(b, lum, desaturate);
            }
            cv.blend(dx + x, dy + y, r, g, b, a);
        }
    }
}

/* ------------------------------------------------------------ composizioni */
const SS = 4; // supercampionamento: disegno 4x piu' grande e poi rimpicciolisco

function buildSidebar(logo, { uninstall = false } = {}) {
    const W = 164, H = 314;
    const cv = new Canvas(W * SS, H * SS);

    paintGradient(cv, [C.violet900, C.purple950, C.violet950]);

    const cx = cv.w / 2, cy = cv.h * 0.31;
    paintGlow(cv, cx, cy, cv.w * 0.95, uninstall ? C.slate400 : C.violet500, uninstall ? 0.16 : 0.32);
    paintGlow(cv, cv.w * 0.85, cv.h * 0.86, cv.w * 0.7, C.purple600, 0.18);
    // ITALIANO: un secondo alone in basso a sinistra riempie l'angolo scuro sotto i tag.
    // ENGLISH: a second glow bottom-left fills the dark corner under the tag cloud.
    paintGlow(cv, cv.w * 0.12, cv.h * 0.9, cv.w * 0.6, C.violet700, 0.16);

    // ITALIANO: Nuvola di "tag" piu' fitta e piu' visibile sotto il logo: e' cio' che l'utente
    //           voleva "arricchire". Righe: x, y, larghezza (frazioni della tela) + tinta
    //           (1 = pillola viola accesa, 0 = pillola chiara). Piu' file, piu' contrasto.
    // ENGLISH: A denser, more visible "tag" cloud under the logo — what the user asked to enrich.
    //          Rows: x, y, width (canvas fractions) + tint (1 = bright violet pill, 0 = light pill).
    //          More rows, more contrast.
    // ITALIANO: PARTE BASSA — tre fotografie, e basta. Prima c'era anche una nuvola di pillole
    //           (i "tag"), ma facevano confusione: sembravano righe di caricamento. Ora restano
    //           solo le foto, TUTTE UGUALI e in proporzione corretta 4:3 — la forma di una
    //           fotografia vera — allineate sulla stessa base e distanziate in modo regolare.
    //           L'altezza si ricava dalla larghezza in PIXEL, non in frazioni di tela: la tela e'
    //           piu' alta che larga, quindi usare frazioni per entrambi i lati le avrebbe
    //           schiacciate. La fila e' centrata nello spazio sotto il filo luminoso.
    // ENGLISH: LOWER PART — three photos, nothing else. There used to be a cloud of pills (the
    //          "tags") as well, but they were confusing: they read as loading bars. Only the
    //          photos remain, ALL EQUAL and in a correct 4:3 ratio — the shape of a real
    //          photograph — sharing one baseline and evenly spaced. The height is derived from
    //          the width in PIXELS, not in canvas fractions: the canvas is taller than it is
    //          wide, so using fractions for both sides would have squashed them. The row is
    //          centred in the space below the glowing line.
    // ITALIANO: righe di "tag" fra il logo e le foto: sono le etichette che il programma mette
    //           sulle immagini, quindi stanno bene proprio li' in mezzo.
    // ENGLISH: rows of "tags" between the logo and the photos: they are the labels the program puts
    //          on images, so the middle is exactly where they belong.
    // ITALIANO: ogni riga e' una COPPIA di pillole CENTRATA: calcolo la larghezza totale della
    //           coppia (le due pillole piu' lo spazio in mezzo) e la faccio partire da meta' del
    //           margine che avanza. Prima partivano tutte dal bordo sinistro e finivano dove
    //           capitava, quindi il blocco risultava sbilanciato a sinistra.
    // ENGLISH: each row is a CENTRED PAIR of pills: I work out the pair's total width (the two
    //          pills plus the gap) and start it at half of the leftover margin. They used to all
    //          start at the left edge and end wherever, so the block looked skewed to the left.
    const GAP = 0.05;
    const rows = [
        [0.560, 0.30, 0.27, 1],
        [0.625, 0.22, 0.36, 0],
        [0.690, 0.33, 0.20, 1],
        [0.755, 0.26, 0.28, 0],
    ];
    rows.forEach(([fy, w1, w2, primaAccesa]) => {
        const start = (1 - (w1 + GAP + w2)) / 2;
        const fade = 1 - smooth(clamp01((fy - 0.560) / 0.30)) * 0.30;
        [[start, w1, primaAccesa], [start + w1 + GAP, w2, primaAccesa ? 0 : 1]]
            .forEach(([fx, fw, tint]) => {
                const base = (uninstall ? 0.09 : 0.15) * (tint ? 1.4 : 1) * fade;
                paintPill(cv, fx * cv.w, fy * cv.h, fw * cv.w, 0.021 * cv.h,
                    tint ? C.violet500 : [235, 230, 255], base);
            });
    });

    // ITALIANO: VENTAGLIO di fotografie in fondo. Ognuna e' 4:3 (proporzione vera) e sono tutte
    //           della stessa misura; cambiano solo inclinazione e posizione. Le due esterne sono
    //           ruotate in direzioni opposte e stanno un filo piu' in basso, come quando si apre
    //           un mazzo di foto in mano. Si disegnano dalle esterne verso il centro, cosi' quella
    //           centrale finisce SOPRA: e' il ripieno di ciascuna a rendere leggibile quale sta
    //           davanti, altrimenti le cornici si incrocerebbero e basta.
    // ENGLISH: FAN of photos at the bottom. Each is 4:3 (a true photo ratio) and they are all the
    //          same size; only tilt and position change. The outer two are rotated in opposite
    //          directions and sit slightly lower, like a hand of photos being spread. They are
    //          drawn outer-to-centre so the middle one ends up ON TOP: it is each one's fill that
    //          makes the stacking readable, otherwise the frames would merely cross each other.
    const pw = cv.w * 0.285;
    const ph = pw * 0.75;                   // 4:3
    const fanCx = cv.w / 2, fanCy = cv.h * 0.845;
    const GRADI = Math.PI / 180;
    const ventaglio = [
        { dx: -cv.w * 0.20, dy: cv.h * 0.010, ang: -15 * GRADI, acceso: false },
        { dx: cv.w * 0.20, dy: cv.h * 0.010, ang: 15 * GRADI, acceso: false },
        { dx: 0, dy: 0, ang: 0, acceso: true },
    ];
    ventaglio.forEach(({ dx, dy, ang, acceso }) => {
        const alpha = (uninstall ? 0.16 : 0.26) * (acceso ? 1 : 0.82);
        // ITALIANO: la foto CENTRALE ha il ripieno OPACO: cosi' copre davvero le due dietro,
        //           invece di lasciarle trasparire. La tinta e' quella dello sfondo in quel punto
        //           (mescolanza dei due viola del gradiente), quindi copre senza diventare un
        //           rettangolo che salta all'occhio. Le due esterne restano semitrasparenti: sono
        //           dietro, devono fondersi.
        // ENGLISH: the MIDDLE photo has an OPAQUE fill: that way it really covers the two behind
        //          instead of letting them show through. Its tint is the background colour at that
        //          spot (a blend of the gradient's two violets), so it covers without turning into
        //          a rectangle that jumps out. The outer two stay semi-transparent: they are
        //          behind, they must blend in.
        const ripieno = acceso ? mix(C.violet950, C.purple950, 0.5) : C.violet950;
        const opacita = acceso ? 1 : (uninstall ? 0.30 : 0.42);
        paintPhoto(cv, fanCx + dx, fanCy + dy, pw, ph, ang,
            acceso ? C.violet400 : [235, 230, 255], alpha, ripieno, opacita);
    });

    const logoW = Math.round(cv.w * 0.52);
    paintLogo(cv, logo, Math.round(cx - logoW / 2), Math.round(cy - logoW / 2), logoW, logoW,
        uninstall ? { opacity: 0.85, desaturate: 0.55 } : {});

    // Filo luminoso sotto al logo
    const lineY = Math.round(cy + logoW * 0.72);
    for (let x = 0; x < cv.w; x++) {
        const t = Math.abs(x - cx) / (cv.w * 0.42);
        if (t >= 1) continue;
        const a = (1 - t) ** 2 * (uninstall ? 0.28 : 0.55);
        for (let y = lineY; y < lineY + SS; y++) cv.blend(x, y, ...(uninstall ? C.slate400 : C.violet400), a);
    }

    paintVignette(cv, 0.32);
    return cv.downsample(W, H);
}

function buildHeader(logo) {
    // La striscia in alto sta su fondo BIANCO di sistema: qui si resta chiari,
    // altrimenti si vede un rettangolo scuro incollato sopra la finestra.
    const W = 150, H = 57;
    const cv = new Canvas(W * SS, H * SS);

    for (let y = 0; y < cv.h; y++) {
        for (let x = 0; x < cv.w; x++) {
            const t = clamp01((x / cv.w) * 0.9 + (y / cv.h) * 0.1);
            const c = mix([255, 255, 255], [244, 243, 255], smooth(t));
            cv.set(x, y, c[0], c[1], c[2]);
        }
    }

    const size = Math.round(cv.h * 0.78);
    const dx = cv.w - size - Math.round(cv.w * 0.06);
    paintLogo(cv, logo, dx, Math.round((cv.h - size) / 2), size, size);

    // Accento verticale viola a sinistra del logo
    const bx = dx - Math.round(cv.w * 0.045);
    for (let y = Math.round(cv.h * 0.24); y < Math.round(cv.h * 0.76); y++) {
        for (let x = bx; x < bx + Math.max(1, Math.round(SS * 0.75)); x++) {
            cv.blend(x, y, ...C.violet500, 0.55);
        }
    }
    return cv.downsample(W, H);
}

/* ------------------------------------------------------------------- main */
const logo = decodePng(LOGO);
console.log(`logo: ${logo.w}x${logo.h} RGBA`);
console.log(`palette: violet-500 rgb(${C.violet500}) · violet-950 rgb(${C.violet950}) · purple-950 rgb(${C.purple950})`);

fs.mkdirSync(OUT_DIR, { recursive: true });
const jobs = [
    ['installerSidebar.bmp', buildSidebar(logo)],
    ['uninstallerSidebar.bmp', buildSidebar(logo, { uninstall: true })],
    ['installerHeader.bmp', buildHeader(logo)],
];
for (const [name, cv] of jobs) {
    const bytes = writeBmp24(path.join(OUT_DIR, name), cv);
    console.log(`OK  build/${name}  ${cv.w}x${cv.h}  24bpp  ${(bytes / 1024).toFixed(1)} KB`);
}

// ITALIANO: anteprima PNG solo se richiesta con la variabile ITM_PREVIEW (non entra mai
//           nell'installer). Serve a guardare il risultato in fase di sviluppo.
// ENGLISH: PNG preview only when asked via the ITM_PREVIEW env var (never ships). For dev viewing.
if (process.env.ITM_PREVIEW) {
    writePngPreview(process.env.ITM_PREVIEW, jobs[0][1], 2);
    console.log('anteprima PNG:', process.env.ITM_PREVIEW);
}
