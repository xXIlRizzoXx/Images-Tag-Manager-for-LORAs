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

// ITALIANO: copia di un segmento con i soli primi `campi` byte dopo la lunghezza, che viene riscritta;
//           `zeri` = da dove azzerare (le misure della miniatura JFIF). Il file di partenza non cambia.
// ENGLISH: copy of a segment with only the first `campi` bytes after the length, which is rewritten;
//          `zeri` = where to start zeroing (the JFIF thumbnail size). The source file is not changed.
const soliCampi = (b: Uint8Array, i: number, campi: number, zeri = campi + 4): Uint8Array => {
    const s = b.slice(i, i + 4 + campi);
    s[2] = 0; s[3] = campi + 2;
    s.fill(0, zeri);
    return s;
};

// ITALIANO: JPEG. Restano APP0 solo se JFIF, il profilo colore (APP2 ICC_PROFILE), APP14 solo se Adobe
//           (serve a decodificare i colori) e le parti dell'immagine; via APP1 (Exif, XMP), gli altri
//           APPn (Photoshop/IPTC, C2PA, dati dei produttori), i commenti, anche fra una scansione e
//           l'altra di un JPEG progressivo, e il DNL (chi disegna lo ignora). Di JFIF e Adobe partono
//           solo i campi che chi disegna legge (14 e 12 byte): la miniatura del JFIF (pixel non
//           compressi, magari della foto prima del ritaglio) e i byte in coda non partono. Quello
//           che segue la fine dell'immagine (foto secondarie, video delle "foto in movimento", dati
//           dei produttori) non si manda.
// ENGLISH: JPEG. Kept: APP0 only if JFIF, the colour profile (APP2 ICC_PROFILE), APP14 only if Adobe
//          (needed to decode the colours) and the parts of the image; removed: APP1 (Exif, XMP), the
//          other APPn (Photoshop/IPTC, C2PA, maker data), comments, also between the scans of a
//          progressive JPEG, and DNL (the decoder ignores it). Of JFIF and Adobe only the fields the
//          decoder reads go (14 and 12 bytes): the JFIF thumbnail (uncompressed pixels, maybe of the
//          photo before cropping) and any trailing bytes are not sent. What follows the end of the
//          image (secondary pictures, the video of "motion photos", maker data) is not sent.
// ITALIANO: i marcatori riservati o di estensione (JPG 0xC8, DHP 0xDE, EXP 0xDF, JPG0-13 0xF0-0xFD,
//           RES 0x02-0xBF) e un secondo SOI: libjpeg-turbo (quella di Chromium) si ferma con un errore
//           su ognuno, quindi nessuno li vede disegnati. Possono pero' portare un testo: la foto non
//           parte (come un file rovinato) invece di mandarli interi.
// ENGLISH: reserved or extension markers (JPG 0xC8, DHP 0xDE, EXP 0xDF, JPG0-13 0xF0-0xFD, RES
//          0x02-0xBF) and a second SOI: libjpeg-turbo (Chromium's) stops with an error on each of them,
//          so nobody sees such a file drawn. They can carry a text though: the photo is not sent (like
//          a damaged file) instead of sending them whole.
const jpegMarcatoreRifiutato = (m: number): boolean =>
    m === 0xD8 || m === 0xC8 || m === 0xDE || m === 0xDF || (m >= 0xF0 && m <= 0xFD) || (m >= 0x02 && m <= 0xBF);
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
        // ITALIANO: FF 00 fuori dai dati compressi non e' un marcatore: libjpeg lo scarta con i byte che
        //           seguono fino al prossimo FF. Prima veniva letto come una parte con la sua lunghezza
        //           e partiva intero; ora si salta come gli altri byte di troppo.
        // ENGLISH: FF 00 outside the compressed data is not a marker: libjpeg discards it with the bytes
        //          that follow up to the next FF. It used to be read as a part with its own length and
        //          sent whole; now it is skipped like the other extra bytes.
        if (m === 0x00) { i += 2; continue; }
        if (jpegMarcatoreRifiutato(m)) throw malformed();
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
        } else if (m === 0xE0) {
            // ITALIANO: solo JFIF; via JFXX (miniatura), CIFF (proprietario e numero di serie), AVI1...
            //           Del JFIF una copia di 16 byte con la miniatura 0x0; uno piu' corto parte com'e'.
            // ENGLISH: JFIF only; JFXX (thumbnail), CIFF (owner and serial number), AVI1... removed.
            //          Of JFIF a 16-byte copy with a 0x0 thumbnail; a shorter one goes as it is.
            if (ascii(b, i + 4, 5) === 'JFIF\0') out.push(len >= 16 ? soliCampi(b, i, 14, 16) : b.subarray(i, end));
        } else if (m === 0xEE) {
            if (ascii(b, i + 4, 5) === 'Adobe') out.push(len >= 14 ? soliCampi(b, i, 12) : b.subarray(i, end));
        } else if (m === 0xFE || m === 0xDC || isApp) {
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
//           iTXt: autore, programma, a volte percorsi), eXIf, data (tIME), C2PA, parti private, le
//           tavolozze suggerite sPLT e l'istogramma hIST (chi disegna non li usa, e sPLT ha un nome
//           libero).
//           Delle parti tenute parte solo quello che chi disegna legge davvero (le regole di libpng,
//           quella di Chromium): PLTE solo nelle foto a tavolozza (colore 3) e al massimo con i colori
//           che la profondita' permette (nelle altre e' solo "suggerita", o vietata); tRNS, bKGD, sBIT
//           e le parti a misura fissa solo con la loro misura giusta (con un'altra libpng le ignora);
//           tRNS mai nelle foto con il canale alfa e, a tavolozza, non piu' lunga della tavolozza;
//           acTL, fcTL e fdAT solo in un APNG vero (acTL prima del primo IDAT); IEND sempre vuota.
//           Una IHDR che non e' la prima o non e' lunga 13, una parte "critica" sconosciuta
//           (iniziale maiuscola) o una seconda PLTE fanno fermare libpng: la foto non parte.
// ENGLISH: PNG. Kept: the parts needed to draw the photo (the mandatory ones and those for colour,
//          transparency, pixel size and APNG animation); removed: text (tEXt, zTXt, iTXt: author,
//          software, sometimes paths), eXIf, date (tIME), C2PA, private parts, the suggested
//          palettes sPLT and the histogram hIST (the decoder does not use them, and sPLT has a free
//          name).
//          Of the kept parts only what the decoder really reads goes (libpng's rules, Chromium's
//          decoder): PLTE only in palette photos (colour type 3) and with at most the colours the
//          bit depth allows (elsewhere it is only "suggested", or forbidden); tRNS, bKGD, sBIT and
//          the fixed-size parts only with their right size (with another one libpng ignores them);
//          tRNS never in photos with an alpha channel and, with a palette, not longer than the
//          palette; acTL, fcTL and fdAT only in a real APNG (acTL before the first IDAT); IEND always
//          empty. An IHDR that is not the first part or not 13 bytes long, an unknown "critical"
//          part (capital initial) or a second PLTE make libpng stop: the photo is not sent.
const PNG_KEEP = new Set(['tRNS', 'cHRM', 'gAMA', 'iCCP', 'sBIT', 'sRGB', 'cICP', 'mDCV', 'cLLI', 'bKGD', 'pHYs',
    'acTL', 'fcTL', 'fdAT']);
// ITALIANO: misure fisse; per sBIT, bKGD e tRNS la misura dipende dal tipo di colore (0, 2, 3, 4, 6).
// ENGLISH: fixed sizes; for sBIT, bKGD and tRNS the size depends on the colour type (0, 2, 3, 4, 6).
const PNG_MISURE: Record<string, number> = { cHRM: 32, gAMA: 4, sRGB: 1, pHYs: 9, cICP: 4, mDCV: 24, cLLI: 8, acTL: 8, fcTL: 26 };
const PNG_MISURE_SBIT: Record<number, number> = { 0: 1, 2: 3, 3: 3, 4: 2, 6: 4 };
const PNG_MISURE_BKGD: Record<number, number> = { 0: 2, 2: 6, 3: 1, 4: 2, 6: 6 };
const PNG_MISURE_TRNS: Record<number, number> = { 0: 2, 2: 6 };
const PNG_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
// ITALIANO: una parte PNG nuova (lunghezza, tipo, dati, CRC giusto), per le parti accorciate.
// ENGLISH: a new PNG part (length, type, data, right CRC), for the shortened parts.
const pngParte = (type: string, data: Uint8Array): Uint8Array => {
    const n = data.length;
    const s = new Uint8Array(12 + n);
    s[0] = (n >>> 24) & 0xFF; s[1] = (n >>> 16) & 0xFF; s[2] = (n >>> 8) & 0xFF; s[3] = n & 0xFF;
    for (let k = 0; k < 4; k++) s[4 + k] = type.charCodeAt(k);
    s.set(data, 8);
    let c = 0xFFFFFFFF;
    for (let k = 4; k < 8 + n; k++) c = PNG_CRC[(c ^ s[k]) & 0xFF] ^ (c >>> 8);
    c = (c ^ 0xFFFFFFFF) >>> 0;
    s[8 + n] = (c >>> 24) & 0xFF; s[9 + n] = (c >>> 16) & 0xFF; s[10 + n] = (c >>> 8) & 0xFF; s[11 + n] = c & 0xFF;
    return s;
};
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
    let colore = -1;
    let voci = 0;          // colori della tavolozza tenuti / palette colours kept
    let tavolozza = false; // PLTE gia' vista (colore 3) / PLTE already seen (colour type 3)
    let animata = false;   // acTL prima del primo IDAT / acTL before the first IDAT
    while (true) {
        if (i + 12 > b.length) { if (pixel) break; throw malformed(); }
        const len = b[i] * 0x1000000 + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
        const type = ascii(b, i + 4, 4);
        const end = i + 12 + len;
        if (end > b.length) { if (pixel) break; throw malformed(); }
        const critical = type.charCodeAt(0) >= 65 && type.charCodeAt(0) <= 90;
        const intera = b.subarray(i, end);
        // ITALIANO: senza IHDR in testa il tipo di colore resta sconosciuto (-1): PLTE, tRNS, sBIT e bKGD
        //           non partono.
        // ENGLISH: without IHDR at the top the colour type stays unknown (-1): PLTE, tRNS, sBIT and bKGD
        //          are not sent.
        if (type === 'IHDR') {
            if (i !== 8 || len !== 13) throw malformed();
            colore = b[i + 17];
            if (!(colore in PNG_MISURE_SBIT)) throw malformed();
            out.push(intera);
        } else if (type === 'PLTE') {
            if (colore === 3) {
                if (tavolozza || pixel || len === 0 || len % 3 !== 0 || len > 768) throw malformed();
                tavolozza = true;
                voci = Math.min(len / 3, 1 << Math.min(b[24], 8)); // b[24] = profondita' / bit depth
                out.push(voci * 3 < len ? pngParte('PLTE', b.subarray(i + 8, i + 8 + voci * 3)) : intera);
            }
        } else if (type === 'IDAT') {
            out.push(intera);
            pixel = true;
        } else if (type === 'IEND') {
            out.push(len === 0 ? intera : pngParte('IEND', new Uint8Array(0)));
            break;
        } else if (critical) {
            throw malformed();
        } else if (PNG_KEEP.has(type)) {
            let giusta: boolean;
            if (type === 'tRNS') giusta = colore === 3 ? tavolozza && len >= 1 && len <= voci : PNG_MISURE_TRNS[colore] === len;
            else if (type === 'sBIT') giusta = PNG_MISURE_SBIT[colore] === len;
            else if (type === 'bKGD') giusta = PNG_MISURE_BKGD[colore] === len;
            else if (type === 'acTL') giusta = len === 8 && !pixel && !animata;
            else if (type === 'fdAT') giusta = animata && len >= 4;
            else if (type === 'fcTL') giusta = animata && len === 26;
            else giusta = !(type in PNG_MISURE) || PNG_MISURE[type] === len;
            if (giusta) out.push(intera);
            if (type === 'acTL' && giusta) animata = true;
        }
        i = end;
    }
    return concat(out);
};

// ITALIANO: WebP. Via le parti EXIF e XMP, ogni parte sconosciuta e i loro segni nell'intestazione
//           VP8X; delle altre parte solo quello che chi disegna legge (vedi sotto, prima di stripWebp).
//           Di VP8X partono solo i suoi 10 byte: quelli in piu' chi disegna non li legge.
// ENGLISH: WebP. The EXIF and XMP parts, every unknown part and their flags in the VP8X header go;
//          of the others only what the decoder reads goes (see below, before stripWebp).
//          Of VP8X only its 10 bytes go: the decoder does not read any extra ones.
const WEBP_KEEP = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP']);
// ITALIANO: alcuni programmi contano nella lunghezza RIFF il byte di riempimento dell'ultima parte
//           (lunghezza dispari) senza scriverlo: un solo byte in meno si accetta; se manca un byte
//           di dati la parte resta piu' lunga del file e la foto non parte.
// ENGLISH: some writers count the last part's pad byte (odd length) in the RIFF size without
//          writing it: one missing byte is accepted; if a data byte is missing the part runs past
//          the file and the photo is not sent.
// ITALIANO: delle parti tenute parte solo quello che libwebp (quella di Chromium) legge davvero,
//           provato con libwebp 1.6: in un WebP semplice (prima parte VP8 o VP8L) solo quella prima
//           parte, le altre sono ignorate; ALPH solo in una foto ferma con il segno della trasparenza,
//           la prima, prima della sua VP8 (con VP8L, dopo l'immagine, doppia o senza il segno non si
//           usa, o rende la foto illeggibile) e, se non compressa, solo i byte larghezza x altezza;
//           ANIM e ANMF solo con il segno dell'animazione, ANIM con i suoi 6 byte; ICCP solo con il
//           segno del profilo colore.
// ENGLISH: of the kept parts only what libwebp (Chromium's) really reads goes, tested with libwebp 1.6:
//          in a simple WebP (first part VP8 or VP8L) only that first part, the others are ignored;
//          ALPH only in a still photo with the transparency flag, the first one, before its VP8 (with
//          VP8L, after the image, doubled or without the flag it is not used, or it makes the photo
//          unreadable) and, if uncompressed, only the width x height bytes; ANIM and ANMF only with the
//          animation flag, ANIM with its 6 bytes; ICCP only with the colour profile flag.
const webpParte = (b: Uint8Array, at: number, n: number): Uint8Array => {
    const s = new Uint8Array(8 + n + (n & 1));
    s.set(b.subarray(at, at + 4));
    s[4] = n & 0xFF; s[5] = (n >>> 8) & 0xFF; s[6] = (n >>> 16) & 0xFF; s[7] = (n >>> 24) & 0xFF;
    s.set(b.subarray(at + 8, at + 8 + n), 8);
    return s;
};
const stripWebp = (b: Uint8Array): Uint8Array => {
    let riffEnd = 8 + (b[4] | (b[5] << 8) | (b[6] << 16)) + b[7] * 0x1000000;
    if (riffEnd === b.length + 1) riffEnd = b.length;
    if (riffEnd > b.length) throw malformed();
    const parti: { type: string; i: number; len: number; end: number }[] = [];
    for (let i = 12; i < riffEnd;) {
        if (i + 8 > riffEnd) throw malformed();
        const type = ascii(b, i, 4);
        const len = (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16)) + b[i + 7] * 0x1000000;
        const end = i + 8 + len + (len & 1);
        if (i + 8 + len > riffEnd) throw malformed();
        parti.push({ type, i, len, end });
        i = end;
    }
    const prima = parti[0];
    const semplice = prima !== undefined && (prima.type === 'VP8 ' || prima.type === 'VP8L');
    const flag = prima?.type === 'VP8X' && prima.len >= 1 ? b[prima.i + 8] : 0;
    const animata = (flag & 0x02) !== 0;
    const pixelAlfa = prima?.type === 'VP8X' && prima.len >= 10
        ? (1 + (b[prima.i + 12] | (b[prima.i + 13] << 8) | (b[prima.i + 14] << 16)))
          * (1 + (b[prima.i + 15] | (b[prima.i + 16] << 8) | (b[prima.i + 17] << 16)))
        : Infinity;
    const out: Uint8Array[] = [];
    let alfaPresa = false;
    let immagine = false;
    for (let k = 0; k < (semplice ? 1 : parti.length); k++) {
        const { type, i, len, end } = parti[k];
        if (!WEBP_KEEP.has(type)) continue;
        if (type === 'ALPH') {
            const dopo = parti.slice(k + 1).find(x => x.type === 'VP8 ' || x.type === 'VP8L');
            if ((flag & 0x10) === 0 || animata || alfaPresa || immagine || dopo?.type !== 'VP8 ') continue;
            alfaPresa = true;
            // ITALIANO: compressione 0 = alfa non compressa: chi disegna legge 1 + larghezza x altezza byte.
            // ENGLISH: compression 0 = uncompressed alpha: the decoder reads 1 + width x height bytes.
            const n = len >= 1 && (b[i + 8] & 0x03) === 0 ? Math.min(len, 1 + pixelAlfa) : len;
            out.push(n < len ? webpParte(b, i, n) : b.slice(i, Math.min(end, riffEnd)));
            continue;
        }
        if ((type === 'ANIM' || type === 'ANMF') && !animata) continue;
        if (type === 'ICCP' && (flag & 0x20) === 0) continue;
        if (type === 'VP8 ' || type === 'VP8L') immagine = true;
        if (type === 'ANIM' && len > 6) { out.push(webpParte(b, i, 6)); continue; }
        const chunk = type === 'VP8X' && len > 10 ? b.slice(i, i + 18) : b.slice(i, Math.min(end, riffEnd));
        if (type === 'VP8X' && len > 10) { chunk[4] = 10; chunk[5] = 0; chunk[6] = 0; chunk[7] = 0; }
        if (type === 'VP8X' && len >= 1) chunk[8] &= ~(0x08 | 0x04);
        out.push(chunk);
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
const HEIC_PROPRIETA_TOLTE = new Set(['uuid', 'udes', 'taic', 'itai', 'altt', 'crtt', 'mdft']);
// ITALIANO: le proprieta' che servono a disegnare la foto. Ogni altra proprieta' si azzera, salvo
//           quelle segnate "indispensabili" nella ipma (un lettore che non le capisce non deve
//           disegnare la foto: sono istruzioni di disegno, non testi).
// ENGLISH: the properties needed to draw the photo. Every other property is zeroed, except those
//          marked "essential" in ipma (a reader that does not understand them must not draw the
//          photo: they are drawing instructions, not texts).
const HEIC_PROPRIETA_TENUTE = new Set(['hvcC', 'lhvC', 'ispe', 'irot', 'imir', 'iscl', 'clap', 'pasp', 'colr', 'pixi', 'cloc', 'auxC', 'clli', 'mdcv', 'cclv', 'amve', 'rloc', 'lsel', 'oinf', 'tols']);
// ITALIANO: scatole in cima al file dove possono restare byte a cui nessuna immagine punta.
// ENGLISH: top-level boxes where bytes no picture points to can remain.
const HEIC_SENZA_RIFERIMENTI = new Set(['mdat', 'free', 'skip']);
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
    // ITALIANO: il nome in hdlr (ultimo campo, dopo 12 byte riservati) si azzera al suo posto.
    // ENGLISH: the name in hdlr (last field, after 12 reserved bytes) is zeroed in place.
    if (hdlr.body + 24 < hdlr.end) out.fill(0, hdlr.body + 24, hdlr.end);
    // ITALIANO: le free/skip dentro meta si azzerano piu' sotto, letta la iloc: possono contenere i byte di
    //           un'immagine (metodo 0, posizione assoluta), che restano.
    // ENGLISH: the free/skip boxes inside meta are zeroed further down, once iloc is read: they can hold a
    //          picture's bytes (method 0, absolute position), which stay.
    for (const x of parts) if (!HEIC_META_KEEP.has(x.type)) blank(x);
    // ITALIANO: grpl (gruppi di elementi) non serve a disegnare la foto principale (pitm). Si tiene solo il
    //           gruppo 'altr' (le alternative: chi non sa disegnare un elemento ne sceglie un altro), con i
    //           byte dopo il suo elenco di elementi azzerati; ogni altro gruppo diventa 'free'.
    // ENGLISH: grpl (entity groups) is not needed to draw the primary photo (pitm). Only the 'altr' group
    //          is kept (alternatives: a reader that cannot draw an item picks another one), with the bytes
    //          after its entity list zeroed; every other group becomes 'free'.
    // ITALIANO: una grpl che non si legge (byte in coda, un gruppo con la misura sbagliata) diventa tutta
    //           'free' invece di far scartare la foto: prima di questa pulizia la foto partiva.
    // ENGLISH: a grpl that cannot be read (trailing bytes, a group with a wrong size) becomes a 'free' box as
    //          a whole instead of getting the photo rejected: before this cleaning the photo was sent.
    for (const grpl of parts.filter(x => x.type === 'grpl')) {
        let gruppi: Box[];
        try { gruppi = childBoxes(b, grpl.body, grpl.end); } catch (_) { blank(grpl); continue; }
        for (const g of gruppi) {
            const fine = g.type === 'altr' && g.body + 12 <= g.end ? g.body + 12 + 4 * be32(b, g.body + 8) : Infinity;
            if (fine > g.end) blank(g);
            else out.fill(0, fine, g.end);
        }
    }
    // ITALIANO: la tabella dref: l'indirizzo di una voce url/urn (un percorso o un sito) si azzera;
    //           una voce "in questo stesso file" (flag 1) non ha indirizzo e resta identica.
    // ENGLISH: the dref table: the address of a url/urn entry (a path or a site) is zeroed; an "in
    //          this same file" entry (flag 1) has no address and stays identical.
    // ITALIANO: in dinf c'e' solo la dref: ogni altra scatola (sconosciuta, puo' contenere un indirizzo)
    //           diventa 'free'.
    // ENGLISH: dinf holds only dref: any other box (unknown, it can hold an address) becomes 'free'.
    for (const dinf of parts.filter(x => x.type === 'dinf')) {
        for (const dref of childBoxes(b, dinf.body, dinf.end)) {
            if (dref.type !== 'dref') { blank(dref); continue; }
            for (const v of childBoxes(b, dref.body + 8, dref.end)) {
                if ((v.type === 'url ' || v.type === 'urn ') && v.body + 4 < v.end) out.fill(0, v.body + 4, v.end);
            }
        }
    }
    // ITALIANO: iref: ogni riferimento e' "da, quanti, a..." (16 bit, 32 con la versione 1); i byte dopo
    //           l'ultimo "a" si azzerano. Un riferimento che non si legge resta com'e': la foto parte come
    //           prima (la griglia, dimg, sta qui e serve a disegnare).
    // ENGLISH: iref: every reference is "from, count, to..." (16 bits, 32 with version 1); the bytes after
    //          the last "to" are zeroed. A reference that cannot be read stays as it is: the photo is sent as
    //          before (the grid, dimg, lives here and is needed to draw).
    for (const iref of parts.filter(x => x.type === 'iref')) {
        try {
            const larghi = b[iref.body] !== 0;
            for (const rif of childBoxes(b, iref.body + 4, iref.end)) {
                const q = fieldReader(b, rif.body, rif.end);
                if (larghi) q.u32(); else q.u16();
                const quanti = q.u16();
                for (let k = 0; k < quanti; k++) { if (larghi) q.u32(); else q.u16(); }
                out.fill(0, q.pos(), rif.end);
            }
        } catch (_) { /* ITALIANO: resta com'e' — ENGLISH: stays as it is */ }
    }

    r = fieldReader(b, pitm.body, pitm.end);
    const pitmVersion = r.u8();
    r.skip(3);
    const primary = pitmVersion === 0 ? r.u16() : r.u32();
    // ITALIANO: dopo i campi letti (qui, in iloc e in ipma) non c'e' niente che serva: i byte in coda, dove
    //           puo' restare un testo, si azzerano. Misura e campi restano identici.
    // ENGLISH: after the fields read (here, in iloc and in ipma) nothing needed follows: the trailing bytes,
    //          where a text can stay, are zeroed. Size and fields stay identical.
    out.fill(0, r.pos(), pitm.end);

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
        // ITALIANO: il nome dell'elemento (testo libero; in v0/v1 viene dopo i 2 byte della protezione)
        //           diventa spazi della stessa lunghezza: lo zero che lo chiude resta dov'e', quindi i
        //           campi dopo (tipo di contenuto) non si spostano.
        // ENGLISH: the item name (free text; in v0/v1 it follows the 2 protection bytes) becomes spaces
        //          of the same length: its closing zero stays where it is, so the fields after it
        //          (content type) do not move.
        let k = q.pos() + (v >= 2 ? 0 : 2);
        for (; k < e.end && b[k] !== 0; k++) out[k] = 0x20;
        // ITALIANO: un elemento 'uri ' ha dopo il nome il suo indirizzo (item_uri_type, testo libero): si
        //           azzera. Non e' un'immagine: chi disegna la foto non lo legge.
        // ENGLISH: a 'uri ' item has its address after the name (item_uri_type, free text): it is zeroed.
        //          It is not a picture: whoever draws the photo does not read it.
        if (type === 'uri ' && k < e.end) out.fill(0, k + 1, e.end);
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
    // ITALIANO: i tratti del file che appartengono alle immagini (metodo 0). Se un'immagine sta dentro
    //           un altro elemento (metodo 2) non si sa dove sono i suoi byte: allora i tratti senza
    //           riferimenti non si azzerano (la foto deve restare disegnabile).
    // ENGLISH: the file ranges that belong to pictures (method 0). If a picture lies inside another
    //          item (method 2) where its bytes are is unknown: then unreferenced ranges are not zeroed
    //          (the photo must stay drawable).
    // ITALIANO: `tenutiIdat` = lo stesso per i dati delle immagini dentro idat (metodo 1), per esempio la
    //           descrizione di una griglia.
    // ENGLISH: `tenutiIdat` = the same for picture data inside idat (method 1), for example a grid's
    //          description.
    const tenuti: Array<[number, number]> = [];
    const tenutiIdat: Array<[number, number]> = [];
    let tenutiIncerti = false;
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
            if (keep) {
                if (method === 0) tenuti.push([base + off, len === 0 ? b.length : base + off + len]);
                else if (method === 1) { if (idat) tenutiIdat.push([idat.body + base + off, len === 0 ? idat.end : idat.body + base + off + len]); }
                else tenutiIncerti = true;
                continue;
            }
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
    out.fill(0, r.pos(), iloc.end); // la coda dopo le voci (vedi pitm) / the tail after the entries (see pitm)
    // ITALIANO: in mdat (e nelle free/skip in cima) si azzera ogni byte a cui nessuna immagine punta:
    //           per esempio un Exif "tolto" da un programma che ha cancellato solo il riferimento. Lo
    //           stesso in idat, coi tratti delle immagini di metodo 1 e di metodo 0 (posizione assoluta,
    //           che puo' cadere dentro idat).
    // ENGLISH: in mdat (and in the top free/skip boxes) every byte no picture points to is zeroed:
    //          for example an Exif "removed" by a program that deleted only the reference. The same in
    //          idat, with the ranges of the method 1 and method 0 pictures (absolute position, which can
    //          fall inside idat).
    const azzeraFuori = (inizio: number, fine: number, tratti: Array<[number, number]>) => {
        let p = inizio;
        for (const [da, a] of tratti) {
            if (a <= p) continue;
            if (da >= fine) break;
            if (da > p) out.fill(0, p, da);
            p = Math.max(p, a);
        }
        if (p < fine) out.fill(0, p, fine);
    };
    tenuti.sort((p, q) => p[0] - q[0]);
    if (!tenutiIncerti) {
        for (const x of top) if (HEIC_SENZA_RIFERIMENTI.has(x.type)) azzeraFuori(x.body, x.end, tenuti);
        if (idat) azzeraFuori(idat.body, idat.end, [...tenuti, ...tenutiIdat].sort((p, q) => p[0] - q[0]));
    }
    // ITALIANO: le free/skip dentro meta: il loro contenuto non serve a niente e puo' contenere un testo, ma
    //           un'immagine (metodo 0) puo' avere i byte li': si azzera tutto tranne i suoi tratti. Anche con
    //           un'immagine di metodo 2: i byte di un'immagine che sta in un altro elemento sono nei tratti di
    //           quell'elemento (tenuti se e' un'immagine, azzerati comunque sopra se non lo e').
    // ENGLISH: the free/skip boxes inside meta: their content serves nothing and can hold a text, but a
    //          picture (method 0) can have its bytes there: everything but its ranges is zeroed. Also with a
    //          method 2 picture: the bytes of a picture lying in another item are in that item's ranges
    //          (kept if it is a picture, zeroed above anyway if it is not).
    for (const x of parts) if (x.type === 'free' || x.type === 'skip') azzeraFuori(x.body, x.end, tenuti);
    if (iprp) {
        const figli = childBoxes(b, iprp.body, iprp.end);
        // ITALIANO: in iprp servono solo ipco e ipma: ogni altra scatola (di un produttore) diventa 'free'.
        // ENGLISH: in iprp only ipco and ipma are needed: any other (vendor) box becomes 'free'.
        for (const x of figli) if (x.type !== 'ipco' && x.type !== 'ipma') blank(x);
        // ITALIANO: quali proprieta' (indice da 1 dentro ipco) sono segnate indispensabili nella ipma.
        // ENGLISH: which properties (1-based index inside ipco) are marked essential in ipma.
        const indispensabili = new Set<number>();
        for (const x of figli) {
            if (x.type !== 'ipma') continue;
            const m = fieldReader(b, x.body, x.end);
            const mv = m.u8();
            const larghi = (m.u8() << 16 | m.u16()) & 1;
            const voci = m.u32();
            for (let k = 0; k < voci; k++) {
                if (mv < 1) m.u16(); else m.u32();
                const quante = m.u8();
                for (let a = 0; a < quante; a++) {
                    if (larghi) { const v = m.u16(); if (v & 0x8000) indispensabili.add(v & 0x7FFF); }
                    else { const v = m.u8(); if (v & 0x80) indispensabili.add(v & 0x7F); }
                }
            }
            out.fill(0, m.pos(), x.end); // la coda dopo le voci (vedi pitm) / the tail after the entries (see pitm)
        }
        for (const x of figli) {
            if (x.type !== 'ipco') continue;
            // ITALIANO: si tolgono sempre le proprieta' private (uuid), i testi scritti dall'utente (udes,
            //           altt) e gli orari (taic, itai, crtt, mdft); delle altre restano solo quelle per
            //           disegnare e quelle indispensabili. La scatola tolta diventa 'free' della stessa
            //           misura: gli indici della ipma restano validi.
            // ENGLISH: private properties (uuid), user-written texts (udes, altt) and times (taic, itai,
            //          crtt, mdft) are always removed; of the others only the drawing ones and the
            //          essential ones stay. The removed box becomes a 'free' box of the same size: the
            //          ipma indexes stay valid.
            childBoxes(b, x.body, x.end).forEach((p, i) => {
                if (HEIC_PROPRIETA_TOLTE.has(p.type) || (!HEIC_PROPRIETA_TENUTE.has(p.type) && !indispensabili.has(i + 1))) blank(p);
            });
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
