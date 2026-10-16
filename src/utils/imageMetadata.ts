/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: DATI NASCOSTI DI UNA FOTO, TOLTI PRIMA DELL'INVIO A GOOGLE      **
**  Una foto del telefono porta con se' la posizione GPS, il numero di serie  **
**  della fotocamera, il nome dell'autore e la storia delle modifiche. Per    **
**  i tag servono solo i pixel: qui si toglie il resto, senza toccare i       **
**  pixel di JPEG, PNG, WebP e HEIC. Regola pura, senza React: le prove la    **
**  possono eseguire da sola.                                                 **
**                                                                            **
**  ENGLISH: A PHOTO'S HIDDEN DATA, REMOVED BEFORE IT IS SENT TO GOOGLE       **
**  A phone photo carries its GPS position, the camera's serial number, the   **
**  author's name and its editing history. Tagging needs only the pixels:    **
**  the rest is removed here, without touching the pixels of JPEG, PNG, WebP  **
**  and HEIC. Pure rule, no React: the tests can run it on its own.           **
**                                                                            **
*******************************************************************************
*******************************************************************************/

export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';

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
    if (isHeic(b)) return 'image/heic';
    return null;
};

// ITALIANO: HEIC (le foto dell'iPhone) e AVIF hanno la stessa struttura a scatole; si distinguono
//           dalle "marche" della prima scatola (ftyp). Solo le marche HEVC sono HEIC: un AVIF
//           (o un file con tutte e due le marche) resta null e si ridisegna come PNG.
// ENGLISH: HEIC (iPhone photos) and AVIF share the same box structure; they are told apart by the
//          "brands" of the first box (ftyp). Only the HEVC brands are HEIC: an AVIF (or a file with
//          both kinds of brand) stays null and is redrawn as PNG.
const HEVC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx']);
const AV1_BRANDS = new Set(['avif', 'avis']);
const isHeic = (b: Uint8Array): boolean => {
    if (b.length < 16 || ascii(b, 4, 4) !== 'ftyp') return false;
    const size = be32(b, 0);
    if (size < 16 || size > b.length) return false;
    const brands = [ascii(b, 8, 4)];
    for (let i = 16; i + 4 <= size; i += 4) brands.push(ascii(b, i, 4));
    return brands.some(x => HEVC_BRANDS.has(x)) && !brands.some(x => AV1_BRANDS.has(x));
};

const be32 = (b: Uint8Array, at: number): number =>
    b[at] * 0x1000000 + ((b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]);

const ascii = (b: Uint8Array, at: number, len: number): string => {
    let s = '';
    for (let i = at; i < at + len && i < b.length; i++) s += String.fromCharCode(b[i]);
    return s;
};

const malformed = (): Error => new Error('Unsupported file type');
// ITALIANO: il file si legge, ma i suoi dati nascosti stanno in un posto che qui non si sa
//           azzerare: la foto non parte (decisione del 16/10/2026), e l'errore lo dice
//           con un segno suo, cosi' l'app spiega il motivo invece di "formato illeggibile".
// ENGLISH: the file reads fine, but its hidden data sits somewhere that cannot be zeroed here: the
//          photo is not sent, and the error says so with its own mark, so the app explains why
//          instead of "unreadable format".
export const METADATI_NON_PULIBILI = 'hidden-data-not-removable';
const nonPulibile = (): Error => Object.assign(new Error('Hidden data cannot be removed'), { code: METADATI_NON_PULIBILI });

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
// ITALIANO: un PNG che finisce prima di IEND (copia interrotta, programma che non lo scrive) e che
//           ha gia' almeno un IDAT completo parte con le sole parti COMPLETE lette fin li', come il
//           JPEG troncato; la parte tagliata non parte mai, perche' non si sa che cosa contiene.
//           Senza un IDAT completo la foto non parte.
// ENGLISH: a PNG that ends before IEND (cut-off copy, a writer that omits it) and already has at
//          least one complete IDAT is sent with only the COMPLETE parts read so far, like the
//          truncated JPEG; the cut part is never sent, since its content is unknown. Without one
//          complete IDAT the photo is not sent.
const stripPng = (b: Uint8Array): Uint8Array => {
    const out: Uint8Array[] = [b.subarray(0, 8)];
    let i = 8;
    let pixel = false;
    while (true) {
        if (i + 12 > b.length) { if (pixel) break; throw malformed(); }
        const len = b[i] * 0x1000000 + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
        const type = ascii(b, i + 4, 4);
        const end = i + 12 + len;
        if (end > b.length) { if (pixel) break; throw malformed(); }
        const critical = type.charCodeAt(0) >= 65 && type.charCodeAt(0) <= 90;
        if (critical || PNG_KEEP.has(type)) out.push(b.subarray(i, end));
        if (type === 'IDAT') pixel = true;
        i = end;
        if (type === 'IEND') break;
    }
    return concat(out);
};

// ITALIANO: WebP. Via le parti EXIF e XMP e i loro segni nell'intestazione VP8X; resta il resto.
// ENGLISH: WebP. The EXIF and XMP parts and their flags in the VP8X header go; the rest stays.
const WEBP_KEEP = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP']);
// ITALIANO: alcuni programmi contano nella lunghezza RIFF il byte di riempimento dell'ultima parte
//           (lunghezza dispari) senza scriverlo: un solo byte in meno si accetta; se manca un byte
//           di dati la parte resta piu' lunga del file e la foto non parte.
// ENGLISH: some writers count the last part's pad byte (odd length) in the RIFF size without
//          writing it: one missing byte is accepted; if a data byte is missing the part runs past
//          the file and the photo is not sent.
const stripWebp = (b: Uint8Array): Uint8Array => {
    let riffEnd = 8 + (b[4] | (b[5] << 8) | (b[6] << 16)) + b[7] * 0x1000000;
    if (riffEnd === b.length + 1) riffEnd = b.length;
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

// ITALIANO: HEIC. Il file e' fatto di scatole (dimensione, tipo, contenuto) e la foto trova i suoi
//           dati con posizioni assolute nel file: togliere qualcosa sposterebbe tutto. Per questo
//           niente si toglie: si AZZERA al suo posto, e la lunghezza del file resta identica.
//           Azzerati: i dati di ogni elemento che non e' un'immagine (Exif con GPS e numero di
//           serie, XMP, testi), le scatole sconosciute in cima al file e nella 'meta' (uuid, XML,
//           la sequenza 'moov'), che diventano 'free', e le proprieta' private (uuid). Restano
//           immagini, miniature, profilo colore e rotazione (che nelle HEIC non sta nell'Exif).
//           Se qualcosa non torna (posizioni fuori dal file, un dato da azzerare che non si sa
//           trovare) la foto non parte.
// ENGLISH: HEIC. The file is made of boxes (size, type, content) and the picture finds its data
//          through absolute positions in the file: removing anything would shift everything. So
//          nothing is removed: it is ZEROED in place, and the file length stays identical. Zeroed:
//          the data of every item that is not a picture (Exif with GPS and serial number, XMP,
//          text), the unknown boxes at the top of the file and in 'meta' (uuid, XML, the 'moov'
//          sequence), which become 'free', and private properties (uuid). Kept: pictures,
//          thumbnails, colour profile and rotation (which in HEIC is not in the Exif). If anything
//          does not add up (positions outside the file, data to zero that cannot be located) the
//          photo is not sent.
type Box = { type: string; start: number; body: number; end: number };
const readBox = (b: Uint8Array, at: number, limit: number): Box => {
    if (at + 8 > limit) throw malformed();
    let size = be32(b, at);
    let body = at + 8;
    if (size === 1) {
        if (at + 16 > limit) throw malformed();
        size = be32(b, at + 8) * 0x100000000 + be32(b, at + 12);
        body = at + 16;
    } else if (size === 0) {
        size = limit - at;
    }
    const end = at + size;
    if (size < body - at || end > limit) throw malformed();
    return { type: ascii(b, at + 4, 4), start: at, body, end };
};
const childBoxes = (b: Uint8Array, from: number, limit: number): Box[] => {
    const out: Box[] = [];
    for (let i = from; i < limit;) { const x = readBox(b, i, limit); out.push(x); i = x.end; }
    return out;
};
const fieldReader = (b: Uint8Array, from: number, end: number) => {
    let p = from;
    const need = (n: number) => { if (p + n > end) throw malformed(); };
    const u8 = () => { need(1); return b[p++]; };
    const u16 = () => { need(2); const v = (b[p] << 8) | b[p + 1]; p += 2; return v; };
    const u32 = () => { need(4); const v = be32(b, p); p += 4; return v; };
    const uN = (n: number) => {
        if (n === 0) return 0;
        if (n === 4) return u32();
        if (n === 8) { const v = u32() * 0x100000000 + u32(); if (!Number.isSafeInteger(v)) throw malformed(); return v; }
        throw malformed();
    };
    const skip = (n: number) => { need(n); p += n; };
    const four = () => { need(4); const s = ascii(b, p, 4); p += 4; return s; };
    return { u8, u16, u32, uN, skip, four, pos: () => p };
};
const HEIC_PICTURE_ITEMS = new Set(['hvc1', 'grid', 'iden', 'iovl', 'tmap']);
const HEIC_TOP_KEEP = new Set(['ftyp', 'meta', 'mdat', 'free', 'skip']);
const HEIC_META_KEEP = new Set(['hdlr', 'pitm', 'iloc', 'iinf', 'iref', 'iprp', 'idat', 'dinf', 'grpl', 'free', 'skip']);
const HEIC_PROPRIETA_TOLTE = new Set(['uuid', 'udes', 'taic', 'itai']);
const stripHeic = (b: Uint8Array): Uint8Array => {
    const out = b.slice();
    const blank = (x: Box) => { out.set([0x66, 0x72, 0x65, 0x65], x.start + 4); out.fill(0, x.body, x.end); }; // 'free'
    const top = childBoxes(b, 0, b.length);
    const metas = top.filter(x => x.type === 'meta');
    if (metas.length !== 1) throw malformed();
    for (const x of top) if (!HEIC_TOP_KEEP.has(x.type)) blank(x);
    const meta = metas[0];
    const parts = childBoxes(b, meta.body + 4, meta.end); // meta e' una FullBox / meta is a FullBox
    const one = (type: string): Box | undefined => {
        const found = parts.filter(x => x.type === type);
        if (found.length > 1) throw malformed();
        return found[0];
    };
    const hdlr = one('hdlr'), pitm = one('pitm'), iinf = one('iinf'), iloc = one('iloc'), idat = one('idat'), iprp = one('iprp');
    if (!hdlr || !pitm || !iinf || !iloc) throw malformed();
    let r = fieldReader(b, hdlr.body, hdlr.end);
    r.skip(8);
    if (r.four() !== 'pict') throw malformed();
    for (const x of parts) if (!HEIC_META_KEEP.has(x.type)) blank(x);

    r = fieldReader(b, pitm.body, pitm.end);
    const pitmVersion = r.u8();
    r.skip(3);
    const primary = pitmVersion === 0 ? r.u16() : r.u32();

    // ITALIANO: il tipo di ogni elemento; un elemento senza tipo (infe v0/v1) non e' un'immagine.
    // ENGLISH: the type of every item; an item without a type (infe v0/v1) is not a picture.
    const types = new Map<number, string>();
    r = fieldReader(b, iinf.body, iinf.end);
    const iinfVersion = r.u8();
    r.skip(3);
    r.skip(iinfVersion === 0 ? 2 : 4);
    for (const e of childBoxes(b, r.pos(), iinf.end)) {
        if (e.type !== 'infe') { blank(e); continue; }
        const q = fieldReader(b, e.body, e.end);
        const v = q.u8();
        q.skip(3);
        const id = v === 3 ? q.u32() : q.u16();
        let type = '';
        if (v >= 2) { q.skip(2); type = q.four(); }
        if (types.has(id)) throw malformed();
        types.set(id, type);
    }
    if (!HEIC_PICTURE_ITEMS.has(types.get(primary) ?? '')) throw malformed();

    // ITALIANO: dove stanno i dati di ogni elemento: nel file (metodo 0) o nella scatola idat (1).
    //           Un dato da azzerare in un altro posto, o "fino alla fine" (lunghezza 0), non parte.
    // ENGLISH: where every item's data is: in the file (method 0) or in the idat box (1). Data to
    //          zero anywhere else, or "up to the end" (length 0), is not sent.
    r = fieldReader(b, iloc.body, iloc.end);
    const lv = r.u8();
    r.skip(3);
    if (lv > 2) throw malformed();
    const s1 = r.u8(), s2 = r.u8();
    const offSize = s1 >> 4, lenSize = s1 & 15, baseSize = s2 >> 4, idxSize = lv > 0 ? s2 & 15 : 0;
    const count = lv < 2 ? r.u16() : r.u32();
    for (let k = 0; k < count; k++) {
        const id = lv < 2 ? r.u16() : r.u32();
        const method = lv > 0 ? r.u16() & 15 : 0;
        const dataRef = r.u16();
        const base = r.uN(baseSize);
        const extents = r.u16();
        const keep = HEIC_PICTURE_ITEMS.has(types.get(id) ?? '');
        for (let x = 0; x < extents; x++) {
            r.uN(idxSize);
            const off = r.uN(offSize);
            const len = r.uN(lenSize);
            if (keep) continue;
            // ITALIANO: un indice diverso da 0 rimanda alla tabella dref, che di solito dice "in questo
            //           stesso file" (url con flag 1): saltarlo lasciava il GPS nella foto mandata. Qui
            //           non si interpreta la tabella: la foto non parte.
            // ENGLISH: an index other than 0 points into the dref table, which usually says "in this
            //          same file" (url with flag 1): skipping it left the GPS in the photo sent. The
            //          table is not interpreted here: the photo is not sent.
            if (dataRef !== 0) throw nonPulibile();
            if (len === 0) throw malformed();
            let from: number, limit: number;
            if (method === 0) { from = base + off; limit = b.length; }
            else if (method === 1 && idat) { from = idat.body + base + off; limit = idat.end; }
            else throw malformed();
            if (from + len > limit) throw malformed();
            out.fill(0, from, from + len);
        }
    }
    if (iprp) {
        for (const x of childBoxes(b, iprp.body, iprp.end)) {
            // ITALIANO: proprieta' private (uuid), descrizione scritta dall'utente (udes) e orari (taic, itai).
            // ENGLISH: private properties (uuid), user-written description (udes) and timestamps (taic, itai).
            if (x.type === 'ipco') for (const p of childBoxes(b, x.body, x.end)) if (HEIC_PROPRIETA_TOLTE.has(p.type)) blank(p);
        }
    }
    return out;
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
//           formato non si sa pulire qui. Un JPEG, PNG, WebP o HEIC rovinato fa errore: non si manda
//           mai il file originale "perche' tanto non si riusciva a pulirlo". Un JPEG o PNG troncato
//           dopo l'inizio dei pixel parte con le parti lette (vedi sopra).
// ENGLISH: returns the bytes without the hidden data and their real format, or null if the format
//          cannot be cleaned here. A damaged JPEG, PNG, WebP or HEIC throws: the original file is never
//          sent "because it could not be cleaned anyway". A JPEG or PNG cut off after the pixels began
//          is sent with the parts read (see above).
export const stripImageMetadata = (bytes: Uint8Array): { bytes: Uint8Array; mimeType: ImageFormat } | null => {
    const format = detectImageFormat(bytes);
    if (format === 'image/jpeg') return { bytes: stripJpeg(bytes), mimeType: format };
    if (format === 'image/png') return { bytes: stripPng(bytes), mimeType: format };
    if (format === 'image/webp') return { bytes: stripWebp(bytes), mimeType: format };
    if (format === 'image/heic') return { bytes: stripHeic(bytes), mimeType: format };
    return null;
};
