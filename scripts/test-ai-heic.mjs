/* ITALIANO: PROVA DELLE FOTO HEIC (IPHONE) MANDATE A GOOGLE
   Fino alla 1.2.0 una foto .heic partiva per la taggatura AI cosi' com'era, con la posizione GPS e
   il numero di serie dentro. La pulizia dei dati nascosti aggiunta dopo sapeva pulire solo JPEG,
   PNG e WebP: una HEIC doveva essere ridisegnata, ma Chromium non sa leggere le HEIC, quindi non
   partiva piu' niente e le foto dell'iPhone non si potevano piu' taggare con l'AI. Qui si controlla
   che una HEIC parta di nuovo, come image/heic, con i suoi pixel identici e senza i dati nascosti
   (Exif, XMP, testi e parti sconosciute azzerati al loro posto, cosi' nessuna posizione nel file
   cambia); che una HEIC che non si riesce a pulire non parta (e che si dica che e' la foto); e che
   un AVIF, che ha la stessa struttura, venga ancora ridisegnato come PNG.
   Gira SENZA rete e SENZA chiave: si prova il codice VERO di src/services/geminiService.ts,
   compilato con esbuild; la libreria di Google e' un finto che registra la richiesta.
   Uso:  node scripts/test-ai-heic.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE HEIC (IPHONE) PHOTOS SENT TO GOOGLE
   Up to 1.2.0 a .heic photo went to AI tagging as it was, with the GPS position and the serial
   number inside. The removal of hidden data added later could clean only JPEG, PNG and WebP: a
   HEIC had to be redrawn, but Chromium cannot read HEIC, so nothing was sent any more and iPhone
   photos could no longer be AI-tagged. This checks that a HEIC goes again, as image/heic, with
   its pixels identical and without the hidden data (Exif, XMP, text and unknown parts zeroed in
   place, so no position in the file changes); that a HEIC that cannot be cleaned is not sent (and
   that the error says it is the photo); and that an AVIF, which has the same structure, is still
   redrawn as PNG.
   Runs WITHOUT network and WITHOUT a key: the REAL code of src/services/geminiService.ts is
   tested, compiled with esbuild; Google's library is a fake that records the request.
   Usage:  node scripts/test-ai-heic.mjs      (exits with code 1 if anything is off) */

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

// ITALIANO: Chromium non decodifica le HEIC: createImageBitmap le rifiuta, come qui.
// ENGLISH: Chromium does not decode HEIC: createImageBitmap rejects them, as here.
const PNG_RIDISEGNATA = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3]);
const tela = ({ decodifica }) => {
    globalThis.createImageBitmap = async () => {
        if (!decodifica) throw new Error('The source image could not be decoded.');
        return { width: 4, height: 3, close: () => {} };
    };
    globalThis.OffscreenCanvas = class {
        getContext() { return { drawImage: () => {} }; }
        async convertToBlob() { return new Blob([PNG_RIDISEGNATA], { type: 'image/png' }); }
    };
};
tela({ decodifica: false });

let guai = 0, fatti = 0;
const dice = (cosa, ok, dettaglio = '') => {
    fatti++;
    if (!ok) guai++;
    console.log('  ' + (ok ? 'OK  ' : 'NO  ') + cosa + (ok || !dettaglio ? '' : '\n        ' + dettaglio));
};

const B = (...parti) => Buffer.concat(parti.map(p => typeof p === 'string' ? Buffer.from(p, 'latin1') : Buffer.from(p)));
const be16 = n => [(n >> 8) & 0xFF, n & 0xFF];
const be32 = n => [(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF];
const be64 = n => [...be32(Math.floor(n / 2 ** 32)), ...be32(n >>> 0)];
const zeri = n => new Uint8Array(n);

const GPS = 'GPS 12.3456N 65.4321E', AUTORE = 'Example Author', SERIALE = 'ABC123', STORIA = 'History=edit-history-secret';
const SEGRETI = [GPS, AUTORE, SERIALE, STORIA, 'xmpmeta'];
const contieneSegreto = (buf) => SEGRETI.filter(s => buf.toString('latin1').includes(s));

// ITALIANO: scatole ISOBMFF (la struttura delle HEIC): dimensione, tipo, contenuto. Una scatola
//           "pulita" e' una 'free' della stessa dimensione piena di zeri.
// ENGLISH: ISOBMFF boxes (the structure of HEIC): size, type, content. A "cleaned" box is a 'free'
//          box of the same size filled with zeros.
const box = (tipo, ...c) => { const corpo = B(...c); return B(be32(corpo.length + 8), tipo, corpo); };
const full = (tipo, v, ...c) => box(tipo, [v, 0, 0, 0], ...c);
const libera = (tipo, ...c) => { const corpo = B(...c); return B(be32(corpo.length + 8), 'free', zeri(corpo.length)); };

const exifConOrientamento = (o) => {
    const testo = Buffer.from(`${GPS} Artist=${AUTORE} SerialNumber=${SERIALE}`, 'latin1');
    const ifd = B([0x02, 0x00],
        [0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, o, 0x00, 0x00, 0x00],
        [0x3B, 0x01, 0x02, 0x00, testo.length, 0x00, 0x00, 0x00, 38, 0x00, 0x00, 0x00],
        [0x00, 0x00, 0x00, 0x00]);
    return B('Exif\0\0', 'II', [0x2A, 0x00, 0x08, 0x00, 0x00, 0x00], ifd, testo);
};

// ITALIANO: una HEIC come quelle dell'iPhone: l'immagine (hvc1) e l'Exif nella scatola mdat, un XMP
//           (mime) indicato con un punto di partenza piu' uno spostamento, un testo nella scatola idat,
//           un XML nella meta, una proprieta' privata (uuid) e una scatola uuid in cima al file.
//           pulita = come deve arrivare a Google. rompi = un difetto da rifiutare.
// ENGLISH: a HEIC like the iPhone's: the picture (hvc1) and the Exif in the mdat box, an XMP (mime)
//          given as a base plus an offset, a text in the idat box, an XML in the meta, a private
//          property (uuid) and a uuid box at the top of the file. pulita = how it must reach Google.
//          rompi = a defect to refuse.
const heic = (o = {}) => {
    const { pulita = false, ilocV = 1, infeV = 2, off8 = false, rompi = '', semplice = false, marche = ['heic', 'mif1', 'heic'] } = o;
    const togli = pulita ? libera : box;
    const IMG = B('hevc-pixel-data-0123456789');
    const EXIF = B(be32(6), exifConOrientamento(6));
    const XMP = B('<x:xmpmeta>', STORIA, '</x:xmpmeta>');
    const TESTO = B('caption by ', AUTORE);
    const ftyp = box('ftyp', marche[0], be32(0), ...marche.slice(1));
    const cima = semplice ? B() : togli('uuid', 'abcdefghijklmnop', '<x:xmpmeta>', GPS);
    const infe = (id, tipo, extra = '') => full('infe', infeV, infeV === 3 ? be32(id) : be16(id), [0, 0], tipo, '\0', extra);
    const offN = off8 ? be64 : be32;
    const voce = (id, metodo, base, off, len, rif = 0) => B(ilocV === 2 ? be32(id) : be16(id), be16(metodo), be16(rif), be32(base), be16(1), offN(off), be32(len));
    const meta = (mb) => {
        const voci = semplice ? [voce(1, 0, 0, mb, IMG.length)] : [
            voce(1, 0, 0, mb, IMG.length),
            voce(2, rompi === 'metodo2' ? 2 : 0, 0, rompi === 'fuori' ? mb + 100000 : mb + IMG.length, rompi === 'zero' ? 0 : EXIF.length, rompi === 'dref' ? 1 : 0),
            voce(3, 0, mb, IMG.length + EXIF.length, XMP.length),
            voce(5, 1, 0, 0, TESTO.length),
        ];
        const iinf = semplice
            ? full('iinf', 0, be16(1), infe(1, 'hvc1'))
            : full('iinf', 0, be16(4), infe(1, 'hvc1'), infe(2, 'Exif'), infe(3, 'mime', 'application/rdf+xml\0'), infe(5, 'mime', 'text/plain\0'));
        return full('meta', 0,
            full('hdlr', 0, be32(0), 'pict', zeri(12), '\0'),
            full('pitm', 0, be16(rompi === 'primaria' ? 2 : 1)),
            full('iloc', ilocV, [off8 ? 0x84 : 0x44, 0x40], ilocV === 2 ? be32(voci.length) : be16(voci.length), ...voci),
            iinf,
            box('iprp',
                box('ipco', box('hvcC', [1, 2, 3, 4]), full('ispe', 0, be32(4), be32(3)), box('irot', [1]),
                    ...(semplice ? [] : [togli('uuid', 'segreto-uuid-123', AUTORE), togli('udes', [0, 0, 0, 0], 'it\0', 'caption\0', SERIALE, '\0')])),
                full('ipma', 0, be32(1), be16(1), [3, 0x81, 0x02, 0x03])),
            ...(semplice ? [] : [togli('xml ', [0, 0, 0, 0], '<x:xmpmeta>', SERIALE), box('idat', pulita ? zeri(TESTO.length) : TESTO)]),
            // ITALIANO: la tabella dref con una sola voce "in questo stesso file" (url con flag 1).
            // ENGLISH: the dref table with a single "in this same file" entry (url with flag 1).
            ...(rompi === 'dref' ? [box('dinf', full('dref', 0, be32(1), box('url ', [0, 0, 0, 1])))] : []));
    };
    const mdat = semplice ? IMG : B(IMG, pulita ? zeri(EXIF.length) : EXIF, pulita ? zeri(XMP.length) : XMP);
    const mb = ftyp.length + meta(0).length + cima.length + 8;
    return B(ftyp, meta(mb), cima, box('mdat', mdat));
};

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
console.log('\n--- HEIC dell\'iPhone: parte, senza i dati nascosti ---');
for (const [nome, opz] of [
    ['iloc v1, infe v2', {}],
    ['iloc v2, infe v3, posizioni a 8 byte', { ilocV: 2, infeV: 3, off8: true }],
]) {
    const file = heic(opz);
    const atteso = heic({ ...opz, pulita: true });
    const r = await invia(file, 'IMG_0001.HEIC', 'image/heic');
    dice(`${nome}: la richiesta parte`, r.chiamate === 1 && !r.errore, String(r.errore));
    dice(`${nome}: il tipo mandato e' image/heic`, r.mime === 'image/heic', String(r.mime));
    if (r.dati) {
        dice(`${nome}: nessun dato nascosto nella richiesta`, contieneSegreto(r.dati).length === 0, 'trovati: ' + contieneSegreto(r.dati).join(', '));
        dice(`${nome}: stessa lunghezza, pixel e struttura identici, Exif/XMP/testi azzerati al loro posto`, r.dati.equals(atteso),
            'atteso ' + atteso.toString('hex') + '\n        avuto  ' + r.dati.toString('hex'));
    }
}
{
    const file = heic({ semplice: true });
    const r = await invia(file, 'pulita.heic', 'image/heic');
    dice('una HEIC senza dati nascosti parte identica', !!r.dati && r.dati.equals(file) && r.mime === 'image/heic', String(r.errore || r.mime));
}
{
    // ITALIANO: su molti PC Windows una .HEIC arriva con il tipo VUOTO (Chromium non la conosce): veniva
    //           rifiutata con "Unsupported file type" prima ancora di guardare i byte.
    // ENGLISH: on many Windows PCs a .HEIC arrives with an EMPTY type (Chromium does not know it): it was
    //          refused with "Unsupported file type" before even looking at the bytes.
    const r = await invia(heic(), 'IMG_0003.HEIC', '');
    dice('una HEIC con il tipo vuoto parte come image/heic, pulita',
        r.chiamate === 1 && !!r.dati && contieneSegreto(r.dati).length === 0 && r.mime === 'image/heic', String(r.errore || r.mime));
    const n = await invia(heic(), 'nota.txt', '');
    dice('un file non immagine con il tipo vuoto resta rifiutato', !!n.errore && n.chiamate === 0, String(n.errore));
}
{
    const r = await invia(heic(), 'finta.jpg', 'image/jpeg');
    dice('una HEIC chiamata .jpg si pulisce come HEIC e parte come image/heic',
        !!r.dati && contieneSegreto(r.dati).length === 0 && r.mime === 'image/heic', String(r.errore || r.mime));
}

// =============================================================================
console.log('\n--- HEIC che non si sa pulire: non parte niente, e si dice che e\' la foto ---');
for (const [cosa, file] of [
    ['l\'Exif indicato oltre la fine del file', heic({ rompi: 'fuori' })],
    ['l\'Exif con lunghezza 0 ("fino alla fine")', heic({ rompi: 'zero' })],
    ['l\'Exif indicato dentro un\'altra parte (metodo 2)', heic({ rompi: 'metodo2' })],
    ['la foto principale e\' l\'Exif', heic({ rompi: 'primaria' })],
    ['nessuna scatola meta', B(box('ftyp', 'heic', be32(0), 'mif1', 'heic'), box('mdat', 'hevc-pixel-data'))],
    ['scatola tagliata a meta\'', heic().subarray(0, 60)],
    ['l\'Exif nello stesso file ma indicato con la tabella dref (indice 1)', heic({ rompi: 'dref' })],
]) {
    const r = await invia(file, 'rotta.heic', 'image/heic');
    dice(`${cosa}: errore, nessuna richiesta, segnata come problema della foto`,
        !!r.errore && r.chiamate === 0 && r.errore.geminiKind === 'photo', `chiamate ${r.chiamate}, errore ${r.errore}, tipo ${r.errore?.geminiKind}`);
}

{
    // ITALIANO: il caso dref ha un motivo suo: l'app spiega che sono i dati nascosti, non il formato.
    // ENGLISH: the dref case has its own reason: the app explains it is the hidden data, not the format.
    const r = await invia(heic({ rompi: 'dref' }), 'IMG_0002.HEIC', 'image/heic');
    dice('dref: segnata come "dati nascosti non pulibili" (motivoFoto = metadati)', r.errore?.motivoFoto === 'metadati', `motivo ${r.errore?.motivoFoto}`);
    const rotta = await invia(heic({ rompi: 'fuori' }), 'rotta.heic', 'image/heic');
    dice('una HEIC rovinata resta "formato illeggibile" (nessun motivo metadati)', rotta.errore?.motivoFoto === undefined, `motivo ${rotta.errore?.motivoFoto}`);
}

// =============================================================================
console.log('\n--- vicini che non devono cambiare ---');
{
    tela({ decodifica: true });
    const avif = heic({ marche: ['avif', 'mif1', 'miaf'] });
    const r = await invia(avif, 'foto.avif', 'image/avif');
    dice('AVIF (stessa struttura, marca avif): parte la copia PNG ridisegnata, non il file',
        !!r.dati && r.dati.equals(PNG_RIDISEGNATA) && r.mime === 'image/png', `mime ${r.mime}, errore ${r.errore}`);
    const mista = heic({ marche: ['mif1', 'heic', 'avif'] });
    const r2 = await invia(mista, 'foto.heif', 'image/heif');
    dice('marche HEIC e AVIF insieme: ridisegnata come PNG, non mandata come HEIC', !!r2.dati && r2.mime === 'image/png', `mime ${r2.mime}`);
    tela({ decodifica: false });
}
{
    const r = await invia(B([0xFF, 0xD8], [0xFF, 0xE1, 0x40, 0x00], 'Exif\0\0', GPS), 'rotta.jpg', 'image/jpeg');
    dice('JPEG rovinato: errore, nessuna richiesta, segnato come problema della foto',
        !!r.errore && r.chiamate === 0 && r.errore.geminiKind === 'photo', `tipo ${r.errore?.geminiKind}`);
}
{
    const r = await invia(B([73, 73, 42, 0, 8, 0, 0, 0]), 'f0.tif', 'image/tiff');
    dice('TIFF (Chromium non lo legge): errore, nessuna richiesta, segnato come problema della foto',
        !!r.errore && r.chiamate === 0 && r.errore.geminiKind === 'photo');
}

console.log(`\n${fatti - guai}/${fatti} prove superate`);
if (fatti === 0 || guai > 0) process.exit(1);
