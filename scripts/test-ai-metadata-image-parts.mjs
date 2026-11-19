/* ITALIANO: PROVA DEI DATI NASCOSTI NELLE PARTI «DELL'IMMAGINE» DI JPEG, PNG E WEBP
   La pulizia prima dell'invio a Google teneva intere alcune parti che servono a disegnare la foto,
   ma dentro le quali possono viaggiare una miniatura o un testo che chi disegna ignora: la
   miniatura dentro il blocco JFIF (pixel non compressi, magari della foto prima del ritaglio, lo
   stesso caso per cui JFXX e la miniatura dell'Exif si tolgono gia') e i byte dopo i suoi campi;
   un APP14 che non e' di Adobe e i byte dopo i 12 di quello Adobe; il segmento DNL; nel PNG le
   tavolozze suggerite sPLT e l'istogramma hIST; nel WebP i byte dopo i 10 di VP8X. Ora partono
   solo i campi che chi disegna legge. Le foto normali devono partire identiche byte per byte.
   Gira SENZA rete: si prova la VERA stripImageMetadata di src/utils/imageMetadata.ts, compilata
   con esbuild.
   Uso:  node scripts/test-ai-metadata-image-parts.mjs   (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE HIDDEN DATA IN THE "PICTURE" PARTS OF JPEG, PNG AND WEBP
   The cleaning before sending to Google kept whole some parts needed to draw the photo, inside
   which a thumbnail or a text the decoder ignores can travel: the thumbnail inside the JFIF block
   (uncompressed pixels, maybe of the photo before cropping, the same case for which JFXX and the
   Exif thumbnail are already removed) and the bytes after its fields; an APP14 that is not
   Adobe's and the bytes after the 12 of Adobe's; the DNL segment; in PNG the suggested palettes
   sPLT and the histogram hIST; in WebP the bytes after the 10 of VP8X. Now only the fields the
   decoder reads go. Normal photos must go byte for byte identical.
   Runs WITHOUT network: the REAL stripImageMetadata of src/utils/imageMetadata.ts is tested,
   compiled with esbuild.
   Usage:  node scripts/test-ai-metadata-image-parts.mjs   (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/imageMetadata.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const M = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));

let guai = 0, fatti = 0;
const dice = (cosa, ok, dettaglio = '') => {
    fatti++;
    if (!ok) guai++;
    console.log('  ' + (ok ? 'OK  ' : 'NO  ') + cosa + (ok || !dettaglio ? '' : '\n        ' + dettaglio));
};

const B = (...parti) => Buffer.concat(parti.map(p => typeof p === 'string' ? Buffer.from(p, 'latin1') : Buffer.from(p)));
const be16 = n => [(n >> 8) & 0xFF, n & 0xFF];
const be32 = n => [(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF];
const le32 = n => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
const pulisci = (file) => {
    const copia = new Uint8Array(file);
    const r = M.stripImageMetadata(copia);
    return { dati: Buffer.from(r.bytes), mime: r.mimeType, intatto: Buffer.from(copia).equals(file) };
};
const confronta = (cosa, avuto, atteso) => dice(cosa, avuto.equals(atteso), 'atteso ' + atteso.toString('hex') + '\n        avuto  ' + avuto.toString('hex'));
const senza = (cosa, dati, testi) => {
    const restati = testi.filter(s => dati.toString('latin1').includes(s));
    dice(cosa, restati.length === 0, 'restano: ' + restati.join(', '));
};

// =============================================================================
console.log('\n--- JPEG ---');
const seg = (marker, corpo) => B([0xFF, marker], be16(corpo.length + 2), corpo);
// ITALIANO: i 14 byte dei campi JFIF: firma, versione, unita', densita' X e Y, misure della miniatura.
// ENGLISH: the 14 bytes of the JFIF fields: signature, version, units, X and Y density, thumbnail size.
const campiJfif = (xt, yt, versione = [1, 2]) => B('JFIF\0', versione, [1], be16(72), be16(72), [xt, yt]);
const JFIF_NORMALE = seg(0xE0, campiJfif(0, 0, [1, 1]));
const ADOBE = seg(0xEE, B('Adobe', [0, 100, 0, 0, 0, 0, 1]));
const DQT = seg(0xDB, B([0], Array.from({ length: 64 }, (_, i) => i + 1)));
const SOF = seg(0xC0, B([8], be16(16), be16(16), [1, 1, 0x11, 0]));
const DHT = seg(0xC4, B([0], Array(16).fill(0)));
const SOS = seg(0xDA, B([1, 1, 0, 0, 63, 0]));
const DATI = B([0x12, 0x34, 0xFF, 0x00, 0x56, 0xFF, 0xD0, 0x78, 0x9A]);
const EOI = B([0xFF, 0xD9]);
const IMMAGINE = B(DQT, SOF, DHT, SOS, DATI, EOI);
{
    // ITALIANO: miniatura JFIF 4x2 = 24 byte RGB (qui un testo riconoscibile al posto dei pixel), piu' una coda.
    // ENGLISH: JFIF thumbnail 4x2 = 24 RGB bytes (here a recognisable text instead of pixels), plus a tail.
    const MINI = 'JFIF-THUMB-BEFORE-CROP!!';
    const CODA = 'JFIF-TAIL owner=someone';
    const file = B([0xFF, 0xD8], seg(0xE0, B(campiJfif(4, 2), MINI, CODA)), IMMAGINE);
    const r = pulisci(file);
    senza('miniatura dentro il JFIF e coda: non partono', r.dati, [MINI, CODA]);
    confronta('resta un JFIF di 16 byte con gli stessi campi e la miniatura 0x0; il resto identico', r.dati, B([0xFF, 0xD8], seg(0xE0, campiJfif(0, 0)), IMMAGINE));
    dice('il file di partenza non viene toccato', r.intatto);
}
{
    const CODA = 'JFIF-TAIL after the fields';
    const r = pulisci(B([0xFF, 0xD8], seg(0xE0, B(campiJfif(0, 0, [1, 1]), CODA)), IMMAGINE));
    confronta('JFIF senza miniatura ma con byte dopo i campi: resta solo il JFIF di 16 byte', r.dati, B([0xFF, 0xD8], JFIF_NORMALE, IMMAGINE));
}
{
    // ITALIANO: casi vicini che non devono cambiare.
    // ENGLISH: neighbouring cases that must not change.
    const normale = B([0xFF, 0xD8], JFIF_NORMALE, ADOBE, IMMAGINE);
    confronta('JPEG normale (JFIF di 16 byte, Adobe di 12): parte identico', pulisci(normale).dati, normale);
    const corto = B([0xFF, 0xD8], seg(0xE0, B('JFIF\0', [1, 1])), IMMAGINE);
    confronta('JFIF piu\' corto dei suoi campi: parte com\'era prima', pulisci(corto).dati, corto);
    const senzaApp = B([0xFF, 0xD8], IMMAGINE);
    confronta('JPEG senza APP0: parte identico', pulisci(senzaApp).dati, senzaApp);
    const SOF2 = seg(0xC2, B([8], be16(16), be16(16), [1, 1, 0x11, 0]));
    const progressivo = B([0xFF, 0xD8], JFIF_NORMALE, DQT, SOF2, DHT, SOS, DATI, DHT, SOS, DATI, EOI);
    confronta('JPEG progressivo: parte identico', pulisci(progressivo).dati, progressivo);
    const RST = B([0xFF, 0xDD], be16(4), be16(1));
    const conRiavvio = B([0xFF, 0xD8], JFIF_NORMALE, DQT, SOF, DHT, RST, SOS, DATI, EOI);
    confronta('JPEG con l\'intervallo di riavvio (DRI): parte identico', pulisci(conRiavvio).dati, conRiavvio);
}
{
    const NON_ADOBE = 'APP14-NOT-ADOBE note: Via Roma 12';
    const CODA_ADOBE = 'ADOBE-TAIL author';
    const file = B([0xFF, 0xD8], JFIF_NORMALE, seg(0xEE, B(NON_ADOBE)), seg(0xEE, B('Adobe', [0, 100, 0, 0, 0, 0, 1], CODA_ADOBE)), IMMAGINE);
    const r = pulisci(file);
    senza('APP14 che non e\' Adobe e coda di quello Adobe: non partono', r.dati, [NON_ADOBE, CODA_ADOBE]);
    confronta('resta l\'APP14 Adobe con i suoi 12 byte (servono a decodificare i colori)', r.dati, B([0xFF, 0xD8], JFIF_NORMALE, ADOBE, IMMAGINE));
}
{
    const DNL = 'DNL-SEGMENT gps=45.0000,9.0000';
    const r = pulisci(B([0xFF, 0xD8], JFIF_NORMALE, DQT, SOF, DHT, SOS, DATI, seg(0xDC, B(DNL)), EOI));
    senza('segmento DNL (ignorato da chi disegna): non parte', r.dati, [DNL]);
    confronta('senza DNL il resto identico', r.dati, B([0xFF, 0xD8], JFIF_NORMALE, IMMAGINE));
}

// =============================================================================
console.log('\n--- PNG ---');
const chunk = (tipo, corpo) => B(be32(Buffer.from(corpo).length), tipo, corpo, [0, 0, 0, 0]);
const FIRMA = B([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const IHDR3 = chunk('IHDR', B(be32(1), be32(1), [8, 3, 0, 0, 0]));
const PLTE = chunk('PLTE', B([255, 0, 0, 0, 255, 0]));
const TRNS = chunk('tRNS', B([128, 255]));
const IDAT = chunk('IDAT', B([0x78, 0x9C, 1, 2, 3]));
const IEND = chunk('IEND', B([]));
{
    const SPLT = 'sPLT-entries: seed 123456 model xyz';
    const HIST = 'hIST-free-text';
    const file = B(FIRMA, IHDR3, PLTE, chunk('sPLT', B('pal\0', [8], SPLT)), chunk('hIST', B(HIST)), TRNS, IDAT, IEND);
    const r = pulisci(file);
    senza('sPLT e hIST (non servono a disegnare): non partono', r.dati, [SPLT, HIST]);
    confronta('restano IHDR, PLTE, tRNS, IDAT e IEND identici', r.dati, B(FIRMA, IHDR3, PLTE, TRNS, IDAT, IEND));
    const IHDR6 = chunk('IHDR', B(be32(16), be32(16), [8, 6, 0, 0, 0]));
    const normale = B(FIRMA, IHDR6, chunk('gAMA', B(be32(45455))), chunk('pHYs', B(be32(2835), be32(2835), [1])), chunk('bKGD', B(be16(0), be16(0), be16(0))), IDAT, IEND);
    confronta('PNG normale (gAMA, pHYs, bKGD): parte identico', pulisci(normale).dati, normale);
    const animato = B(FIRMA, IHDR6, chunk('acTL', B(be32(2), be32(0))), chunk('fcTL', B(be32(0), Array(22).fill(0))), IDAT,
        chunk('fcTL', B(be32(1), Array(22).fill(0))), chunk('fdAT', B(be32(2), [1, 2, 3])), IEND);
    confronta('PNG animato (acTL, fcTL, fdAT): parte identico', pulisci(animato).dati, animato);
}

// =============================================================================
console.log('\n--- WebP ---');
const wchunk = (tipo, corpo) => { const c = Buffer.from(corpo); return B(tipo, le32(c.length), c, c.length & 1 ? [0] : []); };
const riff = (...chunks) => { const corpo = B('WEBP', ...chunks); return B('RIFF', le32(corpo.length), corpo); };
const campiVp8x = (flag) => B([flag, 0, 0, 0], [15, 0, 0], [15, 0, 0]);
const VP8 = wchunk('VP8 ', B([1, 2, 3, 4, 5, 6]));
{
    const CODA = 'VP8X-TAIL someone';
    const r = pulisci(riff(wchunk('VP8X', B(campiVp8x(0x20 | 0x08), CODA)), VP8, wchunk('EXIF', B('Exif gps'))));
    senza('coda dopo i 10 byte di VP8X ed EXIF: non partono', r.dati, [CODA, 'Exif gps']);
    confronta('resta VP8X di 10 byte (senza il segno EXIF), VP8 identica, lunghezza RIFF giusta', r.dati, riff(wchunk('VP8X', campiVp8x(0x20)), VP8));
    const CODA_DISPARI = 'odd-tail';
    const r2 = pulisci(riff(wchunk('VP8X', B(campiVp8x(0x10), CODA_DISPARI, 'x')), wchunk('ALPH', B([0, 9, 9])), VP8));
    confronta('VP8X di lunghezza dispari con la coda: 10 byte, il resto identico', r2.dati, riff(wchunk('VP8X', campiVp8x(0x10)), wchunk('ALPH', B([0, 9, 9])), VP8));
    const normale = riff(wchunk('VP8X', campiVp8x(0x20)), wchunk('ICCP', B('profilo')), VP8);
    confronta('WebP normale (VP8X di 10 byte, ICCP): parte identico', pulisci(normale).dati, normale);
    const semplice = riff(VP8);
    confronta('WebP semplice: parte identico', pulisci(semplice).dati, semplice);
}

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
