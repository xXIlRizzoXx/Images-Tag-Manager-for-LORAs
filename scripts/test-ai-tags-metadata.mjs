/* ITALIANO: PROVA DEI DATI NASCOSTI DELLE FOTO MANDATE A GOOGLE
   La taggatura AI mandava a Google il file originale cosi' com'era: insieme ai pixel partivano la
   posizione GPS, il numero di serie della fotocamera, il nome dell'autore e la storia delle
   modifiche (Exif, XMP, Photoshop, commenti, testi PNG, i dati in coda al JPEG). Qui si controlla
   che parta solo l'immagine: per JPEG, PNG e WebP i byte dell'immagine restano identici e
   l'orientamento resta; gli altri formati partono come copia PNG ridisegnata; se la foto non si
   puo' pulire, non parte niente.
   Gira SENZA rete e SENZA chiave: si prova il codice VERO di src/services/geminiService.ts,
   compilato con esbuild; la libreria di Google e' un finto che registra la richiesta, e il
   FileReader finto restituisce i byte veri che gli si danno.
   Uso:  node scripts/test-ai-tags-metadata.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE HIDDEN DATA OF THE PHOTOS SENT TO GOOGLE
   AI tagging sent Google the original file as it was: along with the pixels went the GPS
   position, the camera's serial number, the author's name and the editing history (Exif, XMP,
   Photoshop, comments, PNG text, the data after the end of a JPEG). This checks that only the
   picture goes: for JPEG, PNG and WebP the picture's bytes stay identical and the orientation
   stays; other formats go as a redrawn PNG copy; if the photo cannot be cleaned, nothing goes.
   Runs WITHOUT network and WITHOUT a key: the REAL code of src/services/geminiService.ts is
   tested, compiled with esbuild; Google's library is a fake that records the request, and the
   fake FileReader returns the real bytes it is given.
   Usage:  node scripts/test-ai-tags-metadata.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const finto = {
    name: 'google-finto',
    setup(b) {
        b.onResolve({ filter: /^@google\/genai$/ }, () => ({ path: 'finto', namespace: 'finto' }));
        b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({
            contents: `
                export const Type = { ARRAY: 'ARRAY', STRING: 'STRING' };
                export class GoogleGenAI {
                    constructor() {}
                    get models() {
                        return { generateContent: async (req) => { globalThis.__RICHIESTE__.push(req); return { text: '["cat"]' }; } };
                    }
                }`,
            loader: 'js',
        }));
    },
};
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/services/geminiService.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, plugins: [finto], logLevel: 'silent',
});
const S = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));

// ITALIANO: come il FileReader vero: il data URL dei byte che riceve.
// ENGLISH: like the real FileReader: the data URL of the bytes it receives.
globalThis.FileReader = class {
    readAsDataURL(blob) {
        blob.arrayBuffer().then(ab => {
            this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(ab).toString('base64');
            this.onloadend && this.onloadend();
        }, e => { this.error = e; this.onerror && this.onerror(); });
    }
};

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
const seg = (marker, corpo) => B([0xFF, marker], be16(corpo.length + 2), corpo);

const GPS = 'GPS 12.3456N 65.4321E', AUTORE = 'Example Author', SERIALE = 'ABC123', STORIA = 'History=edit-history-secret';
const SEGRETI = [GPS, AUTORE, SERIALE, STORIA, 'xmpmeta', 'Photoshop 3.0', 'MotionPhoto'];
const contieneSegreto = (buf) => SEGRETI.filter(s => buf.toString('latin1').includes(s));

// ITALIANO: un Exif vero (little endian) con l'orientamento 6 e, in coda, i dati che identificano.
// ENGLISH: a real Exif (little endian) with orientation 6 and, after it, the identifying data.
const exifConOrientamento = (o) => {
    const testo = Buffer.from(`${GPS} Artist=${AUTORE} SerialNumber=${SERIALE}`, 'latin1');
    const ifd = B([0x02, 0x00],
        [0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, o, 0x00, 0x00, 0x00],
        [0x3B, 0x01, 0x02, 0x00, testo.length, 0x00, 0x00, 0x00, 38, 0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00, 0x00]);
    return B('Exif\0\0', 'II', [0x2A, 0x00, 0x08, 0x00, 0x00, 0x00], ifd, testo);
};
const JFIF = seg(0xE0, B('JFIF\0', [1, 1, 0, 0, 1, 0, 1, 0, 0]));
const ICC = seg(0xE2, B('ICC_PROFILE\0', [1, 1], 'profilo-colore'));
const ADOBE = seg(0xEE, B('Adobe', [0, 100, 0, 0, 0, 0, 1]));
const DQT = seg(0xDB, B([0], Array.from({ length: 64 }, (_, i) => i + 1)));
const SOF = seg(0xC0, B([8], be16(16), be16(16), [1, 1, 0x11, 0]));
const DHT = seg(0xC4, B([0], Array(16).fill(0)));
const SOS = seg(0xDA, B([1, 1, 0, 0, 63, 0]));
// ITALIANO: dati compressi con FF 00 (byte di riempimento) e FF D0 (riavvio): fanno parte dell'immagine.
// ENGLISH: compressed data with FF 00 (stuffing) and FF D0 (restart): they are part of the picture.
const DATI = B([0x12, 0x34, 0xFF, 0x00, 0x56, 0xFF, 0xD0, 0x78, 0x9A]);
const EOI = B([0xFF, 0xD9]);

const invia = async (bytes, nome, tipo) => {
    globalThis.__RICHIESTE__ = [];
    const foto = new File([bytes], nome, { type: tipo });
    let errore = null;
    try { await S.getGeminiTags(foto, { apiKey: 'AIza' + 'x'.repeat(35), modelName: 'gemini-3.6-flash', maxTags: 5 }); }
    catch (e) { errore = e; }
    const req = globalThis.__RICHIESTE__[0];
    const parte = req?.contents?.parts?.[0]?.inlineData;
    return { errore, chiamate: globalThis.__RICHIESTE__.length, mime: parte?.mimeType, dati: parte ? Buffer.from(parte.data, 'base64') : null };
};

// =============================================================================
console.log('\n--- JPEG del telefono: parte solo l\'immagine ---');
{
    const XMP = seg(0xE1, B('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>', STORIA, '</x:xmpmeta>'));
    const PS = seg(0xED, B('Photoshop 3.0\0', AUTORE));
    const COM = seg(0xFE, B('comment ', SERIALE));
    const CODA = B('MotionPhoto video ', GPS);
    const file = B([0xFF, 0xD8], JFIF, seg(0xE1, exifConOrientamento(6)), XMP, ICC, PS, COM, ADOBE, DQT, SOF, DHT, SOS, DATI, EOI, CODA);
    const r = await invia(file, 'foto.jpg', 'image/jpeg');
    dice('la richiesta parte', r.chiamate === 1 && !r.errore, String(r.errore));
    if (r.dati) {
        dice('i byte mandati NON sono quelli del file', !r.dati.equals(file));
        dice('nessun dato nascosto nella richiesta', contieneSegreto(r.dati).length === 0, 'trovati: ' + contieneSegreto(r.dati).join(', '));
        dice('nessun XMP, Photoshop o commento', !r.dati.includes(Buffer.from([0xFF, 0xED])) && !r.dati.includes(Buffer.from([0xFF, 0xFE])) && !r.dati.includes(Buffer.from('http://ns.adobe.com')));
        const atteso = B([0xFF, 0xD8], JFIF,
            seg(0xE1, B('Exif\0\0', 'MM', [0x00, 0x2A], be32(8), [0x00, 0x01], [0x01, 0x12, 0x00, 0x03], be32(1), [0x00, 6, 0x00, 0x00], be32(0))),
            ICC, ADOBE, DQT, SOF, DHT, SOS, DATI, EOI);
        dice('restano JFIF, profilo colore, Adobe, tabelle e dati dell\'immagine identici, e l\'orientamento 6', r.dati.equals(atteso),
            'atteso ' + atteso.toString('hex') + '\n        avuto  ' + r.dati.toString('hex'));
        dice('il tipo mandato e\' image/jpeg', r.mime === 'image/jpeg', String(r.mime));
    }
}
{
    const file = B([0xFF, 0xD8], JFIF, DQT, SOF, DHT, SOS, DATI, EOI);
    const r = await invia(file, 'pulita.jpg', 'image/jpeg');
    dice('un JPEG senza dati nascosti parte identico', !!r.dati && r.dati.equals(file));
}
{
    const file = B([0xFF, 0xD8], seg(0xE1, exifConOrientamento(1)), DQT, SOF, DHT, SOS, DATI, EOI);
    const r = await invia(file, 'dritta.jpg', 'image/jpeg');
    dice('orientamento normale (1): nessun Exif rimesso', !!r.dati && r.dati.equals(B([0xFF, 0xD8], DQT, SOF, DHT, SOS, DATI, EOI)));
}
{
    // ITALIANO: JPEG progressivo: piu' scansioni, con tabelle e un commento fra l'una e l'altra.
    // ENGLISH: progressive JPEG: several scans, with tables and a comment between them.
    const SOF2 = seg(0xC2, B([8], be16(16), be16(16), [1, 1, 0x11, 0]));
    const COM = seg(0xFE, B('between scans ', AUTORE));
    const file = B([0xFF, 0xD8], DQT, SOF2, DHT, SOS, DATI, DHT, COM, SOS, DATI, EOI);
    const r = await invia(file, 'progressiva.jpg', 'image/jpeg');
    dice('JPEG progressivo: via il commento fra le scansioni, il resto identico',
        !!r.dati && r.dati.equals(B([0xFF, 0xD8], DQT, SOF2, DHT, SOS, DATI, DHT, SOS, DATI, EOI)), r.dati?.toString('hex'));
}
{
    const file = B([0xFF, 0xD8], DQT, SOF, DHT, SOS, DATI);
    const r = await invia(file, 'troncata.jpg', 'image/jpeg');
    dice('JPEG troncato nei dati dell\'immagine: parte com\'e\' (niente da togliere)', !!r.dati && r.dati.equals(file));
}
{
    // ITALIANO: byte di troppo fra due parti (alcune fotocamere li scrivono): Chromium li salta, e
    //           anche qui si saltano invece di rifiutare la foto; non partono.
    // ENGLISH: extra bytes between two parts (some cameras write them): Chromium skips them, and
    //          so does this instead of refusing the photo; they are not sent.
    const file = B([0xFF, 0xD8], JFIF, [0x00, 0x00, 0x00], seg(0xE1, exifConOrientamento(1)), DQT, SOF, DHT, SOS, DATI, EOI);
    const r = await invia(file, 'byte-in-piu.jpg', 'image/jpeg');
    dice('byte di troppo fra le parti: la foto parte, pulita', !!r.dati && r.dati.equals(B([0xFF, 0xD8], JFIF, DQT, SOF, DHT, SOS, DATI, EOI)),
        String(r.errore || r.dati?.toString('hex')));
}
{
    // ITALIANO: APP0 diversi da JFIF: CIFF delle vecchie compatte Canon (nome del proprietario e numero
    //           di serie) e JFXX (una miniatura, magari della foto prima del ritaglio). Non partono;
    //           il JFIF resta. Senza JFIF ma con un CIFF la foto parte lo stesso, pulita.
    // ENGLISH: APP0 other than JFIF: CIFF of old Canon compacts (owner name and serial number) and
    //          JFXX (a thumbnail, maybe of the photo before cropping). Not sent; JFIF stays. Without
    //          JFIF but with a CIFF the photo is still sent, clean.
    const CIFF = seg(0xE0, B('II\x1a\0\0\0HEAPJPGM', 'OwnerName=', AUTORE, ';SerialNumber=', SERIALE));
    const JFXX = seg(0xE0, B('JFXX\0', [0x10], 'THUMB-OF-UNCROPPED-ORIGINAL'));
    const file = B([0xFF, 0xD8], JFIF, CIFF, JFXX, DQT, SOF, DHT, SOS, DATI, EOI);
    const r = await invia(file, 'canon.jpg', 'image/jpeg');
    dice('APP0 CIFF e JFXX: la richiesta parte', r.chiamate === 1 && !r.errore, String(r.errore));
    if (r.dati) {
        const testo = r.dati.toString('latin1');
        const restati = [AUTORE, SERIALE, 'HEAPJPGM', 'JFXX', 'THUMB-OF-UNCROPPED-ORIGINAL'].filter(s => testo.includes(s));
        dice('APP0 CIFF e JFXX: nome, numero di serie e miniatura non partono', restati.length === 0, 'trovati: ' + restati.join(', '));
        dice('APP0 CIFF e JFXX: resta solo il JFIF, il resto identico', r.dati.equals(B([0xFF, 0xD8], JFIF, DQT, SOF, DHT, SOS, DATI, EOI)), r.dati.toString('hex'));
    }
    const r2 = await invia(B([0xFF, 0xD8], CIFF, DQT, SOF, DHT, SOS, DATI, EOI), 'canon-senza-jfif.jpg', 'image/jpeg');
    dice('solo APP0 CIFF, senza JFIF: parte senza il CIFF', !!r2.dati && r2.dati.equals(B([0xFF, 0xD8], DQT, SOF, DHT, SOS, DATI, EOI)),
        String(r2.errore || r2.dati?.toString('hex')));
}
{
    const file = B([0xFF, 0xD8], [0xFF, 0xE1, 0x40, 0x00], 'Exif\0\0', GPS);
    const r = await invia(file, 'rotta.jpg', 'image/jpeg');
    dice('JPEG rovinato prima dell\'immagine: errore, e a Google non parte niente', !!r.errore && r.chiamate === 0);
}
{
    const file = B([0xFF, 0xD8], seg(0xE1, exifConOrientamento(6)), DQT, SOF, DHT, SOS, DATI, EOI);
    const r = await invia(file, 'finta.png', 'image/png');
    dice('un JPEG chiamato .png si pulisce come JPEG e parte come image/jpeg',
        !!r.dati && contieneSegreto(r.dati).length === 0 && r.mime === 'image/jpeg', String(r.mime));
}

// =============================================================================
console.log('\n--- PNG ---');
const chunk = (tipo, corpo) => B(be32(Buffer.from(corpo).length), tipo, corpo, [0, 0, 0, 0]);
{
    const FIRMA = B([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const IHDR = chunk('IHDR', B(be32(16), be32(16), [8, 6, 0, 0, 0]));
    const ICCP = chunk('iCCP', B('icc\0\0', 'profilo'));
    const PHYS = chunk('pHYs', B(be32(2835), be32(2835), [1]));
    const IDAT = chunk('IDAT', B([0x78, 0x9C, 1, 2, 3]));
    const IEND = chunk('IEND', B([]));
    const file = B(FIRMA, IHDR, ICCP, chunk('tEXt', B('Author\0', AUTORE)), chunk('iTXt', B('XML:com.adobe.xmp\0\0\0\0\0<x:xmpmeta>', STORIA)),
        chunk('zTXt', B('Comment\0\0', SERIALE)), chunk('eXIf', exifConOrientamento(6).subarray(6)), chunk('tIME', B([7, 0xEA, 10, 14, 0, 0, 0])),
        chunk('caBX', B('c2pa ', GPS)), PHYS, IDAT, IEND, B('MotionPhoto trailing'));
    const r = await invia(file, 'foto.png', 'image/png');
    dice('la richiesta parte', r.chiamate === 1 && !r.errore, String(r.errore));
    dice('nessun dato nascosto nella richiesta', !!r.dati && contieneSegreto(r.dati).length === 0, r.dati ? 'trovati: ' + contieneSegreto(r.dati).join(', ') : '');
    dice('restano firma, IHDR, iCCP, pHYs, IDAT e IEND identici', !!r.dati && r.dati.equals(B(FIRMA, IHDR, ICCP, PHYS, IDAT, IEND)));
    dice('il tipo mandato e\' image/png', r.mime === 'image/png', String(r.mime));
}
{
    // ITALIANO: PNG incompleti che Chromium mostra lo stesso (copia interrotta, programma che non
    //           scrive IEND): come il JPEG troncato partono, con le sole parti COMPLETE gia' lette e
    //           senza i testi; la parte tagliata non parte mai. Senza nemmeno un IDAT completo: errore.
    // ENGLISH: incomplete PNGs that Chromium still shows (cut-off copy, a writer that omits IEND):
    //          like the truncated JPEG they are sent, with only the COMPLETE parts already read and
    //          without the text; the cut part is never sent. Without one complete IDAT: error.
    const FIRMA = B([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const IHDR = chunk('IHDR', B(be32(16), be32(16), [8, 6, 0, 0, 0]));
    const TESTO = chunk('tEXt', B('Author\0', AUTORE));
    const IDAT = chunk('IDAT', B([0x78, 0x9C, 1, 2, 3, 4, 5, 6, 7, 8]));
    const IDAT2 = chunk('IDAT', B([9, 10, 11, 12, 13, 14, 15, 16]));
    const r1 = await invia(B(FIRMA, IHDR, TESTO, IDAT), 'senza-iend.png', 'image/png');
    dice('PNG senza IEND (parti complete): parte, senza i testi', !!r1.dati && r1.dati.equals(B(FIRMA, IHDR, IDAT)),
        String(r1.errore || r1.dati?.toString('hex')));
    const r2 = await invia(B(FIRMA, IHDR, TESTO, IDAT, IDAT2.subarray(0, 13)), 'tagliata.png', 'image/png');
    dice('PNG tagliato dentro il secondo IDAT: parte con gli IDAT completi, senza la parte tagliata ne\' i testi',
        !!r2.dati && r2.dati.equals(B(FIRMA, IHDR, IDAT)), String(r2.errore || r2.dati?.toString('hex')));
    const r3 = await invia(B(FIRMA, IHDR, IDAT, TESTO.subarray(0, 14)), 'testo-tagliato-dopo.png', 'image/png');
    dice('PNG tagliato in un testo dopo i pixel: parte senza il testo tagliato',
        !!r3.dati && r3.dati.equals(B(FIRMA, IHDR, IDAT)) && contieneSegreto(r3.dati).length === 0, String(r3.errore || r3.dati?.toString('hex')));
    const r3b = await invia(B(FIRMA, IHDR, IDAT, [0, 0, 0]), 'coda-corta.png', 'image/png');
    dice('PNG con meno di un\'intestazione di parte dopo i pixel: parte senza quei byte',
        !!r3b.dati && r3b.dati.equals(B(FIRMA, IHDR, IDAT)), String(r3b.errore || r3b.dati?.toString('hex')));
    const r4 = await invia(B(FIRMA, IHDR, TESTO, IDAT.subarray(0, 15)), 'unico-idat-tagliato.png', 'image/png');
    dice('PNG tagliato dentro l\'unico IDAT: errore della foto, e a Google non parte niente',
        !!r4.errore && r4.errore.geminiKind === 'photo' && r4.chiamate === 0, String(r4.errore));
    const r5 = await invia(B(FIRMA, IHDR.subarray(0, 10)), 'rotta-ihdr.png', 'image/png');
    dice('PNG tagliato dentro IHDR: errore della foto, e a Google non parte niente',
        !!r5.errore && r5.errore.geminiKind === 'photo' && r5.chiamate === 0, String(r5.errore));
    const r6 = await invia(B(FIRMA, IHDR, TESTO.subarray(0, 12)), 'rotta-testo.png', 'image/png');
    dice('PNG tagliato in un testo prima dei pixel: errore, e a Google non parte niente', !!r6.errore && r6.chiamate === 0);
    const r7 = await invia(B(FIRMA, IHDR, TESTO), 'senza-pixel.png', 'image/png');
    dice('PNG finito prima dei pixel (nessun IDAT): errore, e a Google non parte niente', !!r7.errore && r7.chiamate === 0);
}

// =============================================================================
console.log('\n--- WebP ---');
const wchunk = (tipo, corpo) => { const c = Buffer.from(corpo); return B(tipo, le32(c.length), c, c.length & 1 ? [0] : []); };
const riff = (...chunks) => { const corpo = B('WEBP', ...chunks); return B('RIFF', le32(corpo.length), corpo); };
{
    const VP8X = (flag) => wchunk('VP8X', B([flag, 0, 0, 0], [15, 0, 0], [15, 0, 0]));
    const ICCP = wchunk('ICCP', B('profilo'));
    const VP8 = wchunk('VP8 ', B([1, 2, 3, 4, 5]));
    const file = riff(VP8X(0x20 | 0x08 | 0x04), ICCP, VP8, wchunk('EXIF', exifConOrientamento(6).subarray(6)), wchunk('XMP ', B('<x:xmpmeta>', STORIA)));
    const r = await invia(file, 'foto.webp', 'image/webp');
    dice('la richiesta parte', r.chiamate === 1 && !r.errore, String(r.errore));
    dice('nessun dato nascosto nella richiesta', !!r.dati && contieneSegreto(r.dati).length === 0);
    dice('restano VP8X (senza i segni EXIF e XMP), ICCP e VP8, con la lunghezza RIFF giusta', !!r.dati && r.dati.equals(riff(VP8X(0x20), ICCP, VP8)),
        r.dati?.toString('hex'));
    const semplice = riff(VP8);
    const r2 = await invia(semplice, 'semplice.webp', 'image/webp');
    dice('un WebP semplice parte identico', !!r2.dati && r2.dati.equals(semplice));
    // ITALIANO: la lunghezza RIFF conta il byte di riempimento finale, ma il file finisce prima.
    // ENGLISH: the RIFF size counts the final pad byte, but the file ends before it.
    const dispari = riff(VP8X(0x20 | 0x08), wchunk('VP8 ', B([1, 2, 3, 4, 5, 6])), wchunk('EXIF', B('Exif ', GPS, 'x')));
    const r3 = await invia(dispari.subarray(0, dispari.length - 1), 'senza-pad.webp', 'image/webp');
    dice('WebP con la lunghezza RIFF che conta il byte finale mancante (EXIF in coda): parte, senza EXIF',
        !!r3.dati && contieneSegreto(r3.dati).length === 0 && r3.dati.equals(riff(VP8X(0x20), wchunk('VP8 ', B([1, 2, 3, 4, 5, 6])))),
        String(r3.errore || r3.dati?.toString('hex')));
    const dispari2 = riff(VP8X(0x20), wchunk('VP8 ', B([1, 2, 3, 4, 5])));
    const r3b = await invia(dispari2.subarray(0, dispari2.length - 1), 'senza-pad-vp8.webp', 'image/webp');
    dice('WebP con l\'immagine dispari in coda e il byte finale mancante: parte con tutti i pixel',
        !!r3b.dati && r3b.dati.subarray(0, 4).toString('latin1') === 'RIFF' && r3b.dati.includes(B('VP8 ', le32(5), [1, 2, 3, 4, 5])),
        String(r3b.errore || r3b.dati?.toString('hex')));
    const pari = riff(VP8X(0x20), wchunk('VP8 ', B([1, 2, 3, 4, 5, 6, 7, 8])));
    const r4 = await invia(pari.subarray(0, pari.length - 1), 'pari-tagliata.webp', 'image/webp');
    dice('WebP con un byte di pixel mancante (lunghezza pari): errore, e a Google non parte niente', !!r4.errore && r4.chiamate === 0);
    const r5 = await invia(pari.subarray(0, pari.length - 3), 'tagliata.webp', 'image/webp');
    dice('WebP con piu\' di un byte mancante: errore, e a Google non parte niente', !!r5.errore && r5.chiamate === 0);
}

// =============================================================================
console.log('\n--- altri formati: copia PNG ridisegnata, mai il file originale ---');
const GIF = B('GIF89a', [1, 0, 1, 0, 0, 0, 0], [0x21, 0xFE, 20], 'comment ', AUTORE, ' ', SERIALE, [0], ';');
const PNG_RIDISEGNATA = B([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 'solo-pixel');
const JPEG_RIDISEGNATA = B([0xFF, 0xD8, 0xFF, 0xDB], 'solo-pixel-jpeg', [0xFF, 0xD9]);
const MB = 1024 * 1024;
// ITALIANO: opz.png / opz.jpeg = quanti byte esce la copia in quel formato (assente = piccola);
//           opz.jpeg = 'no' = il JPEG non si sa fare (esce un PNG, come fa il browser).
// ENGLISH: opz.png / opz.jpeg = how many bytes the copy in that format is (absent = small);
//          opz.jpeg = 'no' = JPEG is not supported (a PNG comes out, as the browser does).
const tela = (opz = {}) => {
    const stato = { decodifiche: 0, chiuse: 0, tipi: [], disegni: [], qualita: [] };
    globalThis.createImageBitmap = async (sorgente) => {
        stato.decodifiche++;
        if (opz.decodificaFallisce) throw new Error('The source image could not be decoded.');
        return { width: 4, height: 3, close: () => { stato.chiuse++; } };
    };
    globalThis.OffscreenCanvas = class {
        constructor(w, h) { this.width = w; this.height = h; }
        getContext() {
            const ctx = {
                fillStyle: '#000000',
                drawImage: () => { stato.disegni.push('immagine'); },
                fillRect: (x, y, w, h) => { stato.disegni.push(`riempi ${ctx.fillStyle} ${x},${y},${w},${h}`); },
            };
            return ctx;
        }
        async convertToBlob(o) {
            stato.tipi.push(o?.type);
            stato.qualita.push(o?.quality);
            if (o?.type === 'image/jpeg' && opz.jpeg !== 'no') return new Blob([opz.jpeg ? new Uint8Array(opz.jpeg) : JPEG_RIDISEGNATA], { type: 'image/jpeg' });
            return new Blob([opz.png ? new Uint8Array(opz.png) : PNG_RIDISEGNATA], { type: 'image/png' });
        }
    };
    return stato;
};
const togliTela = () => { delete globalThis.createImageBitmap; delete globalThis.OffscreenCanvas; };
{
    const st = tela();
    const r = await invia(GIF, 'foto.gif', 'image/gif');
    dice('GIF: parte la copia PNG ridisegnata', !!r.dati && r.dati.equals(PNG_RIDISEGNATA) && r.mime === 'image/png' && st.tipi[0] === 'image/png',
        `mime ${r.mime}, errore ${r.errore}`);
    dice('GIF: nessun dato nascosto nella richiesta', !!r.dati && contieneSegreto(r.dati).length === 0);
    dice('GIF: l\'immagine decodificata viene chiusa', st.decodifiche === 1 && st.chiuse === 1);
    dice('GIF piccola: solo la copia PNG, nessun JPEG, nessuno sfondo', st.tipi.join() === 'image/png' && st.disegni.join() === 'immagine',
        `tipi ${st.tipi.join()}, disegni ${st.disegni.join()}`);
    togliTela();
}
{
    // ITALIANO: un AVIF o una GIF di pochi MB ma con tanti pixel: la copia PNG (senza perdita)
    //           supera i 20 MB. Prima la foto veniva rifiutata ("oltre 20 MB" per un file di
    //           2 MB); ora parte una copia JPEG degli stessi pixel, su fondo bianco.
    // ENGLISH: an AVIF or a GIF of a few MB but with many pixels: the (lossless) PNG copy is
    //          over 20 MB. The photo used to be refused ("over 20 MB" for a 2 MB file); now a
    //          JPEG copy of the same pixels goes, on a white background.
    const st = tela({ png: 21 * MB });
    const r = await invia(GIF, 'grande.avif', 'image/avif');
    dice('copia PNG oltre 20 MB: parte una copia JPEG', !r.errore && r.chiamate === 1 && r.mime === 'image/jpeg' && !!r.dati && r.dati.equals(JPEG_RIDISEGNATA),
        `mime ${r.mime}, errore ${r.errore}, chiamate ${r.chiamate}`);
    dice('...prima il PNG, poi il JPEG', st.tipi.join() === 'image/png,image/jpeg', st.tipi.join());
    dice('...il JPEG ha un fondo bianco sotto l\'immagine (la trasparenza non diventa nera)',
        st.disegni.join() === 'immagine,riempi #ffffff 0,0,4,3,immagine', st.disegni.join());
    dice('...con una qualita\' alta', typeof st.qualita[1] === 'number' && st.qualita[1] >= 0.85 && st.qualita[1] <= 1, String(st.qualita[1]));
    dice('...nessun dato nascosto nella richiesta', !!r.dati && contieneSegreto(r.dati).length === 0);
    dice('...l\'immagine decodificata viene chiusa', st.decodifiche === 1 && st.chiuse === 1);
    togliTela();
}
{
    // ITALIANO: un PNG da 15 MB passa il controllo dei 20 MB, ma in base64 sono 20 MB: Google lo
    //           rifiuterebbe. Anche qui parte il JPEG.
    // ENGLISH: a 15 MB PNG passes the 20 MB check, but in base64 it is 20 MB: Google would refuse
    //          it. Here too the JPEG goes.
    const st = tela({ png: 15 * MB });
    const r = await invia(GIF, 'media.gif', 'image/gif');
    dice('copia PNG da 15 MB: parte la copia JPEG', !r.errore && r.mime === 'image/jpeg' && st.tipi.join() === 'image/png,image/jpeg', `mime ${r.mime}, errore ${r.errore}`);
    togliTela();
}
{
    tela({ png: 15 * MB, jpeg: 'no' });
    const r = await invia(GIF, 'media.gif', 'image/gif');
    dice('copia PNG da 15 MB e JPEG non disponibile: parte il PNG come prima', !r.errore && r.chiamate === 1 && r.mime === 'image/png', `mime ${r.mime}, errore ${r.errore}`);
    togliTela();
}
{
    tela({ png: 21 * MB, jpeg: 'no' });
    const r = await invia(GIF, 'grande.gif', 'image/gif');
    dice('copia PNG oltre 20 MB e JPEG non disponibile: errore della foto, e a Google non parte niente',
        r.errore?.geminiKind === 'photo' && r.chiamate === 0, String(r.errore));
    togliTela();
}
{
    const st = tela({ decodificaFallisce: true });
    const r = await invia(GIF, 'foto.gif', 'image/gif');
    dice('formato che non si sa decodificare: errore, e a Google non parte niente', !!r.errore && r.chiamate === 0 && st.decodifiche === 1);
    togliTela();
}
{
    const r = await invia(GIF, 'foto.gif', 'image/gif');
    dice('senza strumenti per ridisegnare: errore, e a Google non parte niente', !!r.errore && r.chiamate === 0);
}
{
    tela({ png: 21 * MB, jpeg: 21 * MB });
    const r = await invia(GIF, 'foto.gif', 'image/gif');
    dice('copia ridisegnata oltre 20 MB anche in JPEG: errore della foto, e a Google non parte niente', r.errore?.geminiKind === 'photo' && r.chiamate === 0, String(r.errore));
    togliTela();
}

// =============================================================================
console.log('\n--- i controlli di prima restano ---');
{
    const vuota = await invia(B([]), 'vuota.jpg', 'image/jpeg');
    dice('file vuoto: stesso errore di prima', vuota.errore?.message === 'Invalid or empty file' && vuota.chiamate === 0, String(vuota.errore));
    const testo = await invia(B('ciao'), 'nota.txt', 'text/plain');
    dice('non e\' un\'immagine: stesso errore di prima', testo.errore?.message === 'Unsupported file type' && testo.chiamate === 0, String(testo.errore));
    const enorme = await invia(new Uint8Array(20 * 1024 * 1024 + 1), 'enorme.jpg', 'image/jpeg');
    dice('oltre 20 MB: stesso errore di prima', enorme.errore?.message === 'Image too large (> 20 MB)' && enorme.chiamate === 0, String(enorme.errore));
}

// =============================================================================
console.log('\n--- una foto che non si legge piu\' dal disco: e\' la foto, non la rete ---');
{
    // ITALIANO: foto cancellata, spostata, risalvata da un altro programma o su una chiavetta
    //           staccata: il File dell'importazione non si legge piu' (NotReadableError,
    //           NotFoundError) e Google non viene mai chiamato. Prima l'errore non aveva il segno
    //           'photo': un solo scatto diceva "Google non raggiungibile, controlla la connessione",
    //           e tre di fila fermavano la taggatura in blocco come se mancasse la rete.
    // ENGLISH: photo deleted, moved, saved again by another program or on an unplugged stick: the
    //          import's File can no longer be read (NotReadableError, NotFoundError) and Google is
    //          never called. The error used to lack the 'photo' mark: one photo said "Google could
    //          not be reached, check your connection", and three in a row stopped bulk tagging as
    //          if the network were down.
    for (const nome of ['NotReadableError', 'NotFoundError']) {
        globalThis.__RICHIESTE__ = [];
        const foto = new File([B([0xFF, 0xD8, 0xFF, 0xD9])], 'sparita.jpg', { type: 'image/jpeg' });
        foto.arrayBuffer = () => Promise.reject(new DOMException('The requested file could not be read.', nome));
        let errore = null;
        try { await S.getGeminiTags(foto, { apiKey: 'AIza' + 'x'.repeat(35), modelName: 'gemini-3.6-flash', maxTags: 5 }); }
        catch (e) { errore = e; }
        const c = errore ? S.classifyGeminiError(errore) : null;
        dice(`${nome}: errore della foto, e a Google non parte niente`, errore?.geminiKind === 'photo' && globalThis.__RICHIESTE__.length === 0,
            `geminiKind ${errore?.geminiKind}, errore ${errore}`);
        // ITALIANO: la stessa regola di handleAITagAll in src/App.tsx per "errore di rete".
        // ENGLISH: the same rule handleAITagAll in src/App.tsx uses for "network error".
        const erroreRete = c?.kind === 'unknown' && typeof errore?.status !== 'number' && errore?.geminiKind !== 'photo';
        dice(`${nome}: non conta come errore di rete nella taggatura in blocco`, !!errore && !erroreRete);
    }
}

console.log(`\n${fatti - guai}/${fatti} prove superate`);
if (fatti === 0 || guai > 0) process.exit(1);
