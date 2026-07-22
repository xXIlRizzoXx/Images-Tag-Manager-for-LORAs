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
    gray900: [0.21, 0.034, 264.665],
    slate900: [0.208, 0.042, 265.755],
    purple950: [0.291, 0.149, 302.717],
    indigo500: [0.585, 0.233, 277.117],
    purple600: [0.558, 0.288, 302.321],
    slate400: [0.704, 0.04, 256.788],
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

    paintGradient(cv, [C.gray900, C.purple950, C.slate900]);

    const cx = cv.w / 2, cy = cv.h * 0.33;
    paintGlow(cv, cx, cy, cv.w * 0.95, uninstall ? C.slate400 : C.indigo500, uninstall ? 0.16 : 0.30);
    paintGlow(cv, cv.w * 0.85, cv.h * 0.86, cv.w * 0.7, C.purple600, 0.16);

    // Nuvola di "tag" che sfuma verso il basso: dice cosa fa il programma.
    // x, y, larghezza (frazioni della tela) + tinta: 1 = indaco acceso.
    const rows = [
        [0.09, 0.575, 0.34, 1], [0.48, 0.575, 0.24, 0],
        [0.09, 0.645, 0.26, 0], [0.39, 0.645, 0.33, 1],
        [0.14, 0.715, 0.31, 0], [0.49, 0.715, 0.22, 0],
        [0.09, 0.785, 0.23, 1], [0.36, 0.785, 0.29, 0],
        [0.17, 0.855, 0.27, 0], [0.50, 0.855, 0.19, 0],
    ];
    rows.forEach(([fx, fy, fw, tint]) => {
        // Sbiadiscono scendendo: l'occhio resta sul logo.
        const fade = 1 - smooth(clamp01((fy - 0.575) / 0.34)) * 0.75;
        const base = (uninstall ? 0.055 : 0.085) * (tint ? 1.35 : 1) * fade;
        paintPill(cv, fx * cv.w, fy * cv.h, fw * cv.w, 0.0205 * cv.h,
            tint ? C.indigo500 : [255, 255, 255], base);
    });

    const logoW = Math.round(cv.w * 0.52);
    paintLogo(cv, logo, Math.round(cx - logoW / 2), Math.round(cy - logoW / 2), logoW, logoW,
        uninstall ? { opacity: 0.85, desaturate: 0.55 } : {});

    // Filo luminoso sotto al logo
    const lineY = Math.round(cy + logoW * 0.72);
    for (let x = 0; x < cv.w; x++) {
        const t = Math.abs(x - cx) / (cv.w * 0.42);
        if (t >= 1) continue;
        const a = (1 - t) ** 2 * (uninstall ? 0.28 : 0.5);
        for (let y = lineY; y < lineY + SS; y++) cv.blend(x, y, ...(uninstall ? C.slate400 : C.indigo500), a);
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

    // Accento verticale indaco a sinistra del logo
    const bx = dx - Math.round(cv.w * 0.045);
    for (let y = Math.round(cv.h * 0.24); y < Math.round(cv.h * 0.76); y++) {
        for (let x = bx; x < bx + Math.max(1, Math.round(SS * 0.75)); x++) {
            cv.blend(x, y, ...C.indigo500, 0.55);
        }
    }
    return cv.downsample(W, H);
}

/* ------------------------------------------------------------------- main */
const logo = decodePng(LOGO);
console.log(`logo: ${logo.w}x${logo.h} RGBA`);
console.log(`palette: indigo-500 rgb(${C.indigo500}) · purple-950 rgb(${C.purple950}) · gray-900 rgb(${C.gray900})`);

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
