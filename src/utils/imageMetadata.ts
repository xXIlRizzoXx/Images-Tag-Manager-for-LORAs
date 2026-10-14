/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: DATI NASCOSTI DI UNA FOTO, TOLTI PRIMA DELL'INVIO A GOOGLE      **
**  Una foto del telefono porta con se' la posizione GPS, il numero di serie  **
**  della fotocamera, il nome dell'autore e la storia delle modifiche. Per    **
**  i tag servono solo i pixel: qui si toglie il resto, senza toccare i       **
**  pixel di JPEG, PNG e WebP. Regola pura, senza React: le prove la possono  **
**  eseguire da sola.                                                         **
**                                                                            **
**  ENGLISH: A PHOTO'S HIDDEN DATA, REMOVED BEFORE IT IS SENT TO GOOGLE       **
**  A phone photo carries its GPS position, the camera's serial number, the   **
**  author's name and its editing history. Tagging needs only the pixels:    **
**  the rest is removed here, without touching the pixels of JPEG, PNG and    **
**  WebP. Pure rule, no React: the tests can run it on its own.               **
**                                                                            **
*******************************************************************************
*******************************************************************************/

export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';

// ITALIANO: il formato si riconosce dai primi byte, non dal nome o dal tipo dichiarato: una foto
//           .png che in realta' e' un JPEG si pulisce come JPEG. null = un formato che questa
//           regola non sa pulire byte per byte (GIF, BMP, AVIF, TIFF, ICO, SVG...).
// ENGLISH: the format is recognised from the first bytes, not from the name or the declared type:
//          a .png photo that is really a JPEG is cleaned as a JPEG. null = a format this rule
//          cannot clean byte by byte (GIF, BMP, AVIF, TIFF, ICO, SVG...).
export const detectImageFormat = (b: Uint8Array): ImageFormat | null => {
    if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
    if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47
        && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) return 'image/png';
    if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image/webp';
    return null;
};

const ascii = (b: Uint8Array, at: number, len: number): string => {
    let s = '';
    for (let i = at; i < at + len && i < b.length; i++) s += String.fromCharCode(b[i]);
    return s;
};

const malformed = (): Error => new Error('Unsupported file type');

// ITALIANO: l'orientamento e' l'unico dato dell'Exif che cambia COME si vede la foto: una foto del
//           telefono tenuto in verticale e' spesso salvata di lato con "ruota di 90 gradi". Si
//           legge da IFD0 e si rimette in un Exif minimo che contiene solo quello.
// ENGLISH: orientation is the only Exif datum that changes HOW the photo looks: a photo taken with
//          the phone upright is often stored sideways with "rotate by 90 degrees". It is read from
//          IFD0 and put back in a minimal Exif that holds nothing else.
const readExifOrientation = (b: Uint8Array, start: number, end: number): number | null => {
    const tiff = start + 6; // dopo / after "Exif\0\0"
    if (end - tiff < 8) return null;
    const little = b[tiff] === 0x49 && b[tiff + 1] === 0x49;
    const big = b[tiff] === 0x4D && b[tiff + 1] === 0x4D;
    if (!little && !big) return null;
    const u16 = (at: number) => little ? b[at] | (b[at + 1] << 8) : (b[at] << 8) | b[at + 1];
    const u32 = (at: number) => little
        ? (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16)) + b[at + 3] * 0x1000000
        : b[at] * 0x1000000 + ((b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]);
    if (u16(tiff + 2) !== 42) return null;
    const ifd = tiff + u32(tiff + 4);
    if (ifd + 2 > end) return null;
    const count = u16(ifd);
    for (let k = 0; k < count; k++) {
        const e = ifd + 2 + k * 12;
        if (e + 12 > end) return null;
        if (u16(e) === 0x0112 && u16(e + 2) === 3) {
            const v = u16(e + 8);
            return v >= 2 && v <= 8 ? v : null;
        }
    }
    return null;
};

const minimalExifSegment = (orientation: number): number[] => [
    0xFF, 0xE1, 0x00, 0x22,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,             // "Exif\0\0"
    0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08, // "MM", 42, IFD0 a 8 / at 8
    0x00, 0x01,                                     // una voce / one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,                         // nessun altro IFD / no next IFD
];

// ITALIANO: JPEG. Restano APP0 (JFIF), il profilo colore (APP2 ICC_PROFILE), APP14 (Adobe, serve a
//           decodificare i colori) e tutte le parti dell'immagine; via APP1 (Exif, XMP), gli altri
//           APPn (Photoshop/IPTC, C2PA, dati dei produttori) e i commenti, anche fra una scansione e
//           l'altra di un JPEG progressivo. Quello che segue la fine dell'immagine (foto secondarie,
//           video delle "foto in movimento", dati dei produttori) non si manda.
// ENGLISH: JPEG. Kept: APP0 (JFIF), the colour profile (APP2 ICC_PROFILE), APP14 (Adobe, needed to
//          decode the colours) and every part of the image; removed: APP1 (Exif, XMP), the other
//          APPn (Photoshop/IPTC, C2PA, maker data) and comments, also between the scans of a
//          progressive JPEG. What follows the end of the image (secondary pictures, the video of
//          "motion photos", maker data) is not sent.
const stripJpeg = (b: Uint8Array): Uint8Array => {
    const out: Uint8Array[] = [b.subarray(0, 2)];
    let i = 2;
    let orientationDone = false;
    while (true) {
        // ITALIANO: byte di troppo fra due parti: Chromium li salta, qui si saltano e non partono.
        // ENGLISH: extra bytes between two parts: Chromium skips them, here they are skipped and not sent.
        while (i < b.length && b[i] !== 0xFF) i++;
        if (i >= b.length) throw malformed();
        while (i + 1 < b.length && b[i + 1] === 0xFF) i++; // byte di riempimento / fill bytes
        if (i + 1 >= b.length) throw malformed();
        const m = b[i + 1];
        if (m === 0xD9) { out.push(b.subarray(i, i + 2)); break; }
        if ((m >= 0xD0 && m <= 0xD7) || m === 0x01) { out.push(b.subarray(i, i + 2)); i += 2; continue; }
        if (i + 4 > b.length) throw malformed();
        const len = (b[i + 2] << 8) | b[i + 3];
        const end = i + 2 + len;
        if (len < 2 || end > b.length) throw malformed();
        const isApp = m >= 0xE0 && m <= 0xEF;
        if (m === 0xE1) {
            if (!orientationDone && ascii(b, i + 4, 6) === 'Exif\0\0') {
                orientationDone = true;
                const o = readExifOrientation(b, i + 4, end);
                if (o !== null) out.push(new Uint8Array(minimalExifSegment(o)));
            }
        } else if (m === 0xE2) {
            if (ascii(b, i + 4, 12) === 'ICC_PROFILE\0') out.push(b.subarray(i, end));
        } else if (m === 0xFE || (isApp && m !== 0xE0 && m !== 0xEE)) {
            // via / removed
        } else {
            out.push(b.subarray(i, end));
        }
        i = end;
        if (m === 0xDA) {
            // ITALIANO: dati compressi: FF 00 e FF D0..D7 ne fanno parte, ogni altro FF xx e' il
            //           prossimo marcatore. Se il file finisce qui (JPEG troncato) si manda cosi'.
            // ENGLISH: compressed data: FF 00 and FF D0..D7 belong to it, any other FF xx is the
            //          next marker. If the file ends here (truncated JPEG) it is sent as it is.
            let j = i;
            while (j + 1 < b.length) {
                if (b[j] === 0xFF) {
                    const n = b[j + 1];
                    if (n === 0x00 || (n >= 0xD0 && n <= 0xD7)) { j += 2; continue; }
                    if (n === 0xFF) { j++; continue; }
                    break;
                }
                j++;
            }
            if (j + 1 >= b.length) { out.push(b.subarray(i)); break; }
            out.push(b.subarray(i, j));
            i = j;
        }
    }
    return concat(out);
};

// ITALIANO: PNG. Restano le parti che servono a disegnare la foto (quelle obbligatorie e quelle
//           di colore, trasparenza, dimensione dei pixel e animazione APNG); via testi (tEXt, zTXt,
//           iTXt: autore, programma, a volte percorsi), eXIf, data (tIME), C2PA e parti private.
// ENGLISH: PNG. Kept: the parts needed to draw the photo (the mandatory ones and those for colour,
//          transparency, pixel size and APNG animation); removed: text (tEXt, zTXt, iTXt: author,
//          software, sometimes paths), eXIf, date (tIME), C2PA and private parts.
const PNG_KEEP = new Set(['tRNS', 'cHRM', 'gAMA', 'iCCP', 'sBIT', 'sRGB', 'cICP', 'mDCV', 'cLLI', 'bKGD', 'hIST', 'pHYs', 'sPLT',
    'acTL', 'fcTL', 'fdAT']);
const stripPng = (b: Uint8Array): Uint8Array => {
    const out: Uint8Array[] = [b.subarray(0, 8)];
    let i = 8;
    while (true) {
        if (i + 12 > b.length) throw malformed();
        const len = b[i] * 0x1000000 + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
        const type = ascii(b, i + 4, 4);
        const end = i + 12 + len;
        if (end > b.length) throw malformed();
        const critical = type.charCodeAt(0) >= 65 && type.charCodeAt(0) <= 90;
        if (critical || PNG_KEEP.has(type)) out.push(b.subarray(i, end));
        i = end;
        if (type === 'IEND') break;
    }
    return concat(out);
};

// ITALIANO: WebP. Via le parti EXIF e XMP e i loro segni nell'intestazione VP8X; resta il resto.
// ENGLISH: WebP. The EXIF and XMP parts and their flags in the VP8X header go; the rest stays.
const WEBP_KEEP = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP']);
const stripWebp = (b: Uint8Array): Uint8Array => {
    const riffEnd = 8 + (b[4] | (b[5] << 8) | (b[6] << 16)) + b[7] * 0x1000000;
    if (riffEnd > b.length) throw malformed();
    const out: Uint8Array[] = [];
    let i = 12;
    while (i < riffEnd) {
        if (i + 8 > riffEnd) throw malformed();
        const type = ascii(b, i, 4);
        const len = (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16)) + b[i + 7] * 0x1000000;
        const end = i + 8 + len + (len & 1);
        if (i + 8 + len > riffEnd) throw malformed();
        if (WEBP_KEEP.has(type)) {
            const chunk = b.slice(i, Math.min(end, riffEnd));
            if (type === 'VP8X' && len >= 1) chunk[8] &= ~(0x08 | 0x04);
            out.push(chunk);
        }
        i = end;
    }
    const body = concat(out);
    const head = new Uint8Array(12);
    head.set(b.subarray(0, 12));
    const size = body.length + 4;
    head[4] = size & 0xFF; head[5] = (size >>> 8) & 0xFF; head[6] = (size >>> 16) & 0xFF; head[7] = (size >>> 24) & 0xFF;
    return concat([head, body]);
};

const concat = (parts: Uint8Array[]): Uint8Array => {
    let n = 0;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
};

// ITALIANO: restituisce i byte senza i dati nascosti e il loro formato vero, oppure null se il
//           formato non si sa pulire qui. Un JPEG, PNG o WebP rovinato fa errore: non si manda
//           mai il file originale "perche' tanto non si riusciva a pulirlo".
// ENGLISH: returns the bytes without the hidden data and their real format, or null if the format
//          cannot be cleaned here. A damaged JPEG, PNG or WebP throws: the original file is never
//          sent "because it could not be cleaned anyway".
export const stripImageMetadata = (bytes: Uint8Array): { bytes: Uint8Array; mimeType: ImageFormat } | null => {
    const format = detectImageFormat(bytes);
    if (format === 'image/jpeg') return { bytes: stripJpeg(bytes), mimeType: format };
    if (format === 'image/png') return { bytes: stripPng(bytes), mimeType: format };
    if (format === 'image/webp') return { bytes: stripWebp(bytes), mimeType: format };
    return null;
};
