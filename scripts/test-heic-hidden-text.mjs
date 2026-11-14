/* ITALIANO: HEIC MANDATE A GOOGLE: I TESTI NASCOSTI FUORI DALL'EXIF E DALL'XMP
   La pulizia delle HEIC toglieva l'Exif, l'XMP e quattro proprieta' (uuid, udes, taic, itai), ma
   lasciava passare: le altre proprieta' descrittive dello standard (altt = testo alternativo, crtt e
   mdft = date) e quelle di un produttore con una sigla diversa da 'uuid'; il nome di ogni elemento
   (infe); il nome nella scatola hdlr; l'indirizzo nella tabella dref; i byte di mdat (e delle
   scatole free/skip in cima) a cui nessuna immagine punta. Qui si prova il codice VERO di
   src/utils/imageMetadata.ts (compilato con esbuild) su una HEIC finta con un testo riconoscibile
   in ognuno di quei posti, e i casi vicini che non devono cambiare: pixel, lunghezza e proprieta'
   per disegnare identici, una proprieta' sconosciuta segnata "indispensabile" tenuta (la foto parte
   ancora), il tipo di contenuto di un elemento mime al suo posto, una dref "in questo stesso file"
   identica, una HEIC senza dati nascosti identica byte per byte.
   ENGLISH: HEIC SENT TO GOOGLE: THE HIDDEN TEXTS OUTSIDE EXIF AND XMP
   HEIC cleaning removed Exif, XMP and four properties (uuid, udes, taic, itai) but let through: the
   other descriptive properties of the standard (altt, crtt, mdft) and vendor ones with another code;
   each item's name (infe); the name in hdlr; the address in dref; the bytes of mdat (and of the top
   free/skip boxes) that no picture points to. This tests the REAL code with a fake HEIC carrying a
   recognisable text in each of those places, plus the neighbouring cases that must not change. */

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
const zeri = n => new Uint8Array(n);
const box = (tipo, ...c) => { const corpo = B(...c); return B(be32(corpo.length + 8), tipo, corpo); };
const full = (tipo, v, ...c) => box(tipo, [v, 0, 0, 0], ...c);

const SEGRETI = {
    altt: 'ALT-TEXT example person in a garden',
    crtt: 'CRTT-2026-08-15T10:22:33',
    mdft: 'MDFT-2026-08-16T09:00:00',
    produttore: 'VENDOR-PROP owner=example serial=SN-778899',
    nomeImmagine: 'ITEM-NAME example_birthday',
    nomeMime: 'ITEM-NAME-MIME example_notes',
    hdlr: 'HDLR-NAME edited by example',
    dref: 'file:///C:/example/originale.heic',
    orfano: 'UNREFERENCED-MDAT gps=45.1234,9.5678',
    cimaLibera: 'OLD-FREE-BOX gps=12.3456,65.4321',
};
const IMG = B('hevc-pixel-data-0123456789');
const ESSENZIALE = B('needed-to-draw-42');
const HVCC = box('hvcC', [1, 2, 3, 4]);
const ISPE = full('ispe', 0, be32(4), be32(3));
const IROT = box('irot', [1]);

// ITALIANO: o.u16 = ipma con indici a 16 bit (flag 1); o.semplice = HEIC senza dati nascosti;
//           o.dref = 'indirizzo' (voce url con un percorso) o 'stesso' (url con flag 1);
//           o.metodo = come si indica dove stanno i pixel (2 = dentro un altro elemento).
// ENGLISH: o.u16 = ipma with 16-bit indexes (flag 1); o.semplice = HEIC without hidden data;
//          o.dref = 'indirizzo' (url entry with a path) or 'stesso' (url with flag 1).
const heic = (o = {}) => {
    const { u16 = false, semplice = false, dref = 'indirizzo', metodo = 0 } = o;
    const ftyp = box('ftyp', 'heic', be32(0), 'mif1', 'heic');
    const infe = (id, tipo, nome, extra = '') => full('infe', 2, be16(id), [0, 0], tipo, nome, '\0', extra);
    const voce = (id, off, len) => B(be16(id), be16(metodo), be16(0), be32(0), be16(1), be32(off), be32(len));
    const assoc = (ess, i) => u16 ? be16((ess ? 0x8000 : 0) | i) : [(ess ? 0x80 : 0) | i];
    const cima = semplice ? B() : box('free', SEGRETI.cimaLibera);
    const meta = (mb) => full('meta', 0,
        full('hdlr', 0, be32(0), 'pict', zeri(12), semplice ? '' : SEGRETI.hdlr, '\0'),
        full('pitm', 0, be16(1)),
        full('iloc', 1, [0x44, 0x40], be16(1), voce(1, mb, IMG.length)),
        semplice
            ? full('iinf', 0, be16(1), infe(1, 'hvc1', ''))
            : full('iinf', 0, be16(2), infe(1, 'hvc1', SEGRETI.nomeImmagine), infe(2, 'mime', SEGRETI.nomeMime, 'application/rdf+xml\0')),
        box('iprp',
            box('ipco', HVCC, ISPE, IROT,
                ...(semplice ? [] : [
                    full('altt', 0, SEGRETI.altt, '\0', 'en\0'),
                    full('crtt', 0, SEGRETI.crtt),
                    full('mdft', 0, SEGRETI.mdft),
                    box('XyZw', SEGRETI.produttore),
                    box('Ess1', ESSENZIALE),
                ])),
            box('ipma', [0, 0, 0, u16 ? 1 : 0], be32(1), be16(1),
                semplice ? [3] : [8],
                assoc(true, 1), assoc(false, 2), assoc(false, 3),
                ...(semplice ? [] : [assoc(false, 4), assoc(false, 5), assoc(false, 6), assoc(false, 7), assoc(true, 8)]))),
        ...(semplice ? [] : [box('dinf', full('dref', 0, be32(1),
            dref === 'indirizzo' ? full('url ', 0, SEGRETI.dref, '\0') : box('url ', [0, 0, 0, 1])))]));
    const mdat = semplice ? IMG : B(IMG, SEGRETI.orfano);
    const mb = ftyp.length + meta(0).length + cima.length + 8;
    return B(ftyp, meta(mb), cima, box('mdat', mdat));
};
const pulisci = (file) => {
    try { return { r: M.stripImageMetadata(new Uint8Array(file)), errore: null }; }
    catch (e) { return { r: null, errore: e }; }
};
const trova = (buf, testo) => buf.indexOf(Buffer.from(testo, 'latin1'));

for (const [nome, opz] of [['ipma con indici a 8 bit', {}], ['ipma con indici a 16 bit', { u16: true }]]) {
    console.log(`\n--- HEIC con testi nascosti (${nome}) ---`);
    const file = heic(opz);
    const { r, errore } = pulisci(file);
    dice('la foto si pulisce e parte come image/heic', !!r && r.mimeType === 'image/heic', String(errore));
    if (!r) continue;
    const fuori = Buffer.from(r.bytes);
    dice('stessa lunghezza', fuori.length === file.length, `${file.length} -> ${fuori.length}`);
    for (const [chiave, testo] of Object.entries(SEGRETI)) {
        if (chiave === 'dref' && opz.dref === 'stesso') continue;
        dice(`tolto: ${chiave}`, trova(fuori, testo) < 0);
    }
    // ITALIANO: casi vicini che non devono cambiare.
    // ENGLISH: neighbouring cases that must not change.
    const iImg = trova(file, IMG.toString('latin1'));
    dice('pixel identici allo stesso posto', fuori.subarray(iImg, iImg + IMG.length).equals(IMG));
    for (const [n, p] of [['hvcC', HVCC], ['ispe', ISPE], ['irot', IROT]]) {
        const i = file.indexOf(p);
        dice(`proprieta' per disegnare ${n} identica`, i > 0 && fuori.subarray(i, i + p.length).equals(p));
    }
    dice('proprieta\' sconosciuta segnata indispensabile tenuta', trova(fuori, ESSENZIALE.toString('latin1')) > 0);
    dice('le proprieta\' tolte diventano scatole free della stessa misura',
        ['altt', 'crtt', 'mdft', 'XyZw'].every(t => trova(fuori, t) < 0) && trova(fuori, 'Ess1') > 0);
    dice('tipo di contenuto dell\'elemento mime al suo posto', trova(fuori, 'application/rdf+xml') === trova(file, 'application/rdf+xml'));
    dice('tipi degli elementi e scatole hdlr/pict al loro posto',
        trova(fuori, 'hvc1') === trova(file, 'hvc1') && trova(fuori, 'mime') === trova(file, 'mime') && trova(fuori, 'pict') === trova(file, 'pict'));
    const rifatta = pulisci(fuori);
    dice('la foto pulita si ripulisce uguale (struttura ancora leggibile)', !!rifatta.r && Buffer.from(rifatta.r.bytes).equals(fuori), String(rifatta.errore));
}

console.log('\n--- vicini che non devono cambiare ---');
{
    const file = heic({ semplice: true });
    const { r, errore } = pulisci(file);
    dice('una HEIC senza dati nascosti esce identica byte per byte', !!r && Buffer.from(r.bytes).equals(file), String(errore));
}
{
    const file = heic({ dref: 'stesso' });
    const { r } = pulisci(file);
    // ITALIANO: pixel indicati dentro un altro elemento (metodo 2): non si sa dove stanno, quindi mdat
    //           non si tocca (la foto deve restare disegnabile); gli altri testi si tolgono lo stesso.
    // ENGLISH: pixels given inside another item (method 2): where they are is unknown, so mdat is not
    //          touched (the photo must stay drawable); the other texts are removed all the same.
    const m2 = heic({ metodo: 2 });
    const p = pulisci(m2);
    const f2 = p.r ? Buffer.from(p.r.bytes) : Buffer.alloc(0);
    dice('pixel in un altro elemento (metodo 2): la foto parte, pixel intatti, altri testi tolti',
        !!p.r && trova(f2, IMG.toString('latin1')) === trova(m2, IMG.toString('latin1')) && trova(f2, SEGRETI.altt) < 0 && trova(f2, SEGRETI.hdlr) < 0,
        String(p.errore));
    const voceUrl = box('url ', [0, 0, 0, 1]);
    const i = file.indexOf(voceUrl);
    dice('dref "in questo stesso file" (url con flag 1) identica',
        !!r && i > 0 && Buffer.from(r.bytes).subarray(i, i + voceUrl.length).equals(voceUrl));
}

console.log(`\n${fatti - guai}/${fatti} prove superate`);
if (fatti === 0 || guai > 0) process.exit(1);
