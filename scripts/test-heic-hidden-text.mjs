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
   Anche: pixel (metodo 0) dentro una free/skip di meta o dentro idat restano; una grpl che non si legge
   diventa 'free' invece di far scartare la foto; ster/pymd/brst diventano 'free'; i testi in coda a
   pitm, iloc, ipma, iref, dentro dinf e nell'indirizzo di un elemento 'uri ' si tolgono.
   ENGLISH: HEIC SENT TO GOOGLE: THE HIDDEN TEXTS OUTSIDE EXIF AND XMP
   HEIC cleaning removed Exif, XMP and four properties (uuid, udes, taic, itai) but let through: the
   other descriptive properties of the standard (altt, crtt, mdft) and vendor ones with another code;
   each item's name (infe); the name in hdlr; the address in dref; the bytes of mdat (and of the top
   free/skip boxes) that no picture points to. This tests the REAL code with a fake HEIC carrying a
   recognisable text in each of those places, plus the neighbouring cases that must not change.
   Also: pixels (method 0) inside a free/skip box of meta or inside idat stay; a grpl that cannot be read
   becomes 'free' instead of getting the photo rejected; ster/pymd/brst become 'free'; the texts in the
   tails of pitm, iloc, ipma, iref, inside dinf and in a 'uri ' item's address are removed. */

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

// ITALIANO: altri posti dove un testo restava: le free/skip DENTRO meta, i byte di idat a cui nessuna
//           immagine punta, una scatola sconosciuta figlia di iprp (non ipco/ipma), un gruppo dentro
//           grpl (sconosciuto, o dopo l'elenco degli elementi di un gruppo 'altr'). Foto a griglia: la
//           descrizione della griglia sta in idat (metodo 1) e deve restare identica, come i pixel del
//           riquadro in mdat e l'elenco degli elementi del gruppo 'altr'.
// ENGLISH: other places where a text stayed: the free/skip boxes INSIDE meta, the idat bytes no
//          picture points to, an unknown child of iprp (not ipco/ipma), a group inside grpl (unknown,
//          or after the entity list of an 'altr' group). Grid photo: the grid description lives in idat
//          (method 1) and must stay identical, like the tile pixels in mdat and the 'altr' entity list.
const SEGRETI_META = {
    metaFree: 'META-FREE gps=45.1,9.5',
    metaSkip: 'META-SKIP owner=example',
    idatOrfano: 'IDAT-ORPHAN gps=11.1,22.2',
    iprpIgnoto: 'IPRP-VENDOR serial=SN-1',
    grplIgnoto: 'GRPL-VENDOR note=example',
    codaAltr: 'ALTR-TAIL note=example',
};
const GRIGLIA = B([0, 0, 0, 0], be16(64), be16(64)); // ImageGrid: versione, flag, 1x1, larghezza, altezza
const RIQUADRO = B('hevc-tile-pixels-ABCDEFGHIJ');
const ALTR = full('altr', 0, be32(7), be32(2), be32(1), be32(2));
const heicGriglia = (o = {}) => {
    const { metodoRiquadro = 0 } = o;
    const ftyp = box('ftyp', 'heic', be32(0), 'mif1', 'heic');
    const voce = (id, metodo, off, len) => B(be16(id), be16(metodo), be16(0), be32(0), be16(1), be32(off), be32(len));
    const meta = (mb) => full('meta', 0,
        full('hdlr', 0, be32(0), 'pict', zeri(12), '\0'),
        full('pitm', 0, be16(1)),
        full('iloc', 1, [0x44, 0x40], be16(2), voce(1, 1, 0, GRIGLIA.length), voce(2, metodoRiquadro, mb, RIQUADRO.length)),
        full('iinf', 0, be16(2), full('infe', 2, be16(1), [0, 0], 'grid', '\0'), full('infe', 2, be16(2), [0, 0], 'hvc1', '\0')),
        full('iref', 0, box('dimg', be16(1), be16(1), be16(2))),
        box('iprp',
            box('ipco', HVCC, ISPE),
            full('ipma', 0, be32(2), be16(1), [1], [2], be16(2), [2], [0x81], [2]),
            box('XvNd', SEGRETI_META.iprpIgnoto)),
        box('idat', GRIGLIA, SEGRETI_META.idatOrfano),
        box('grpl', full('altr', 0, be32(7), be32(2), be32(1), be32(2), SEGRETI_META.codaAltr),
            full('ZzGp', 0, be32(9), be32(1), be32(1), SEGRETI_META.grplIgnoto)),
        box('free', SEGRETI_META.metaFree),
        box('skip', SEGRETI_META.metaSkip));
    const mb = ftyp.length + meta(0).length + 8;
    return B(ftyp, meta(mb), box('mdat', RIQUADRO));
};
console.log('\n--- HEIC a griglia con testi in meta (free/skip), idat, iprp e grpl ---');
{
    const file = heicGriglia();
    const { r, errore } = pulisci(file);
    dice('la foto si pulisce e parte come image/heic', !!r && r.mimeType === 'image/heic', String(errore));
    if (r) {
        const fuori = Buffer.from(r.bytes);
        dice('stessa lunghezza', fuori.length === file.length, `${file.length} -> ${fuori.length}`);
        for (const [chiave, testo] of Object.entries(SEGRETI_META)) dice(`tolto: ${chiave}`, trova(fuori, testo) < 0);
        const iGriglia = trova(file, 'idat') + 4;
        dice('la descrizione della griglia in idat resta identica, allo stesso posto', fuori.subarray(iGriglia, iGriglia + GRIGLIA.length).equals(GRIGLIA));
        const iRiquadro = trova(file, RIQUADRO.toString('latin1'));
        dice('i pixel del riquadro in mdat restano identici', fuori.subarray(iRiquadro, iRiquadro + RIQUADRO.length).equals(RIQUADRO));
        const iAltr = trova(file, 'altr') - 4;
        dice('il gruppo altr resta, con la sua misura e il suo elenco di elementi identici',
            fuori.readUInt32BE(iAltr) === file.readUInt32BE(iAltr) && fuori.subarray(iAltr + 4, iAltr + ALTR.length).equals(ALTR.subarray(4)));
        for (const tipo of ['iloc', 'iinf', 'iref', 'dimg', 'ipco', 'ipma', 'hvcC', 'ispe', 'idat', 'grpl', 'grid', 'hvc1']) {
            dice(`scatola ${tipo} al suo posto`, trova(fuori, tipo) === trova(file, tipo));
        }
        const iIref = trova(file, 'iref') - 4;
        const lungIref = file.readUInt32BE(iIref);
        dice('iref (la griglia punta al riquadro) identica', fuori.subarray(iIref, iIref + lungIref).equals(file.subarray(iIref, iIref + lungIref)));
        const rifatta = pulisci(fuori);
        dice('la foto pulita si ripulisce uguale', !!rifatta.r && Buffer.from(rifatta.r.bytes).equals(fuori), String(rifatta.errore));
    }
}
{
    // ITALIANO: riquadro indicato dentro un altro elemento (metodo 2): non si sa quali byte servono, quindi
    //           ne' mdat ne' idat si toccano (la foto deve restare disegnabile); gli altri testi si tolgono.
    // ENGLISH: tile given inside another item (method 2): which bytes are needed is unknown, so neither
    //          mdat nor idat is touched (the photo must stay drawable); the other texts are removed.
    const file = heicGriglia({ metodoRiquadro: 2 });
    const { r, errore } = pulisci(file);
    const fuori = r ? Buffer.from(r.bytes) : Buffer.alloc(0);
    const iGriglia = trova(file, 'idat') + 4;
    dice('metodo 2: la foto parte, griglia e pixel intatti, testi di meta/iprp/grpl tolti',
        !!r && fuori.subarray(iGriglia, iGriglia + GRIGLIA.length).equals(GRIGLIA) && trova(fuori, RIQUADRO.toString('latin1')) === trova(file, RIQUADRO.toString('latin1'))
        && trova(fuori, SEGRETI_META.metaFree) < 0 && trova(fuori, SEGRETI_META.iprpIgnoto) < 0 && trova(fuori, SEGRETI_META.grplIgnoto) < 0,
        String(errore));
}

// ITALIANO: un'immagine i cui byte (metodo 0, posizione assoluta nel file) stanno dentro una free/skip di
//           meta o dentro idat: azzerare tutta la free, o in idat tenere solo i tratti di metodo 1, la
//           mandava con i pixel azzerati. Ora si azzera solo quello che sta fuori dai tratti delle immagini;
//           un testo nella stessa scatola, fuori dal tratto, si toglie lo stesso.
// ENGLISH: a picture whose bytes (method 0, absolute position in the file) lie inside a free/skip box of
//          meta or inside idat: zeroing the whole free box, or keeping only the method 1 ranges in idat,
//          sent it with zeroed pixels. Now only what lies outside the pictures' ranges is zeroed; a text in
//          the same box, outside the range, is removed all the same.
const PIXEL_IN_META = 'PIXELS-IN-META-0123456789';
const SEGRETO_ACCANTO = 'NEXT-TO-PIXELS gps=33.3,44.4';
const heicPixelInMeta = (dove) => {
    const ftyp = box('ftyp', 'heic', be32(0), 'mif1', 'heic');
    const contenitore = dove === 'idat' ? box('idat', PIXEL_IN_META, SEGRETO_ACCANTO) : box(dove, PIXEL_IN_META, SEGRETO_ACCANTO);
    const meta = (off) => full('meta', 0,
        full('hdlr', 0, be32(0), 'pict', zeri(12), '\0'),
        full('pitm', 0, be16(1)),
        full('iloc', 1, [0x44, 0x40], be16(1), B(be16(1), be16(0), be16(0), be32(0), be16(1), be32(off), be32(PIXEL_IN_META.length))),
        full('iinf', 0, be16(1), full('infe', 2, be16(1), [0, 0], 'hvc1', '\0')),
        box('iprp', box('ipco', HVCC, ISPE), full('ipma', 0, be32(1), be16(1), [2], [0x81], [2])),
        contenitore);
    const prova = B(ftyp, meta(0), box('mdat', IMG));
    const off = trova(prova, PIXEL_IN_META);
    return B(ftyp, meta(off), box('mdat', IMG));
};
console.log('\n--- pixel (metodo 0) dentro una free/skip di meta o dentro idat ---');
for (const dove of ['free', 'skip', 'idat']) {
    const file = heicPixelInMeta(dove);
    const { r, errore } = pulisci(file);
    const fuori = r ? Buffer.from(r.bytes) : Buffer.alloc(0);
    const i = trova(file, PIXEL_IN_META);
    dice(`${dove} in meta: la foto parte, stessa lunghezza, pixel identici allo stesso posto`,
        !!r && fuori.length === file.length && fuori.subarray(i, i + PIXEL_IN_META.length).toString('latin1') === PIXEL_IN_META, String(errore));
    dice(`${dove} in meta: il testo accanto ai pixel si toglie`, !!r && trova(fuori, SEGRETO_ACCANTO) < 0);
    dice(`${dove} in meta: la scatola resta al suo posto`, !!r && trova(fuori, dove) === trova(file, dove));
}

// ITALIANO: una grpl che non si legge (byte in coda dopo l'ultimo gruppo, un gruppo con la misura oltre la
//           fine) faceva scartare la foto come «tipo di file non supportato». Ora la grpl intera diventa
//           'free' (stessa misura) e la foto parte. I gruppi standard diversi da 'altr' (ster, pymd, brst)
//           diventano 'free' anche loro: non servono a disegnare la foto principale.
// ENGLISH: a grpl that cannot be read (trailing bytes after the last group, a group whose size runs past
//          the end) made the photo be rejected as "unsupported file type". Now the whole grpl becomes 'free'
//          (same size) and the photo is sent. Standard groups other than 'altr' (ster, pymd, brst) become
//          'free' too: they are not needed to draw the primary photo.
const heicConGrpl = (grpl) => {
    const ftyp = box('ftyp', 'heic', be32(0), 'mif1', 'heic');
    const meta = (mb) => full('meta', 0,
        full('hdlr', 0, be32(0), 'pict', zeri(12), '\0'),
        full('pitm', 0, be16(1)),
        full('iloc', 1, [0x44, 0x40], be16(1), B(be16(1), be16(0), be16(0), be32(0), be16(1), be32(mb), be32(IMG.length))),
        full('iinf', 0, be16(1), full('infe', 2, be16(1), [0, 0], 'hvc1', '\0')),
        box('iprp', box('ipco', HVCC, ISPE), full('ipma', 0, be32(1), be16(1), [2], [0x81], [2])),
        grpl);
    const mb = ftyp.length + meta(0).length + 8;
    return B(ftyp, meta(mb), box('mdat', IMG));
};
console.log('\n--- grpl che non si legge, e i gruppi standard ster/pymd/brst ---');
for (const [nome, grpl, testo] of [
    ['3 byte in coda dopo il gruppo altr', box('grpl', full('altr', 0, be32(7), be32(1), be32(1)), 'GRP'), 'GRP'],
    ['un gruppo con la misura oltre la fine', box('grpl', B(be32(400), 'ster', [0, 0, 0, 0], 'BROKEN-GROUP note=x')), 'BROKEN-GROUP note=x'],
]) {
    const file = heicConGrpl(grpl);
    const { r, errore } = pulisci(file);
    const fuori = r ? Buffer.from(r.bytes) : Buffer.alloc(0);
    const iImg = trova(file, IMG.toString('latin1'));
    dice(`grpl rotta (${nome}): la foto parte, stessa lunghezza, pixel identici`,
        !!r && fuori.length === file.length && fuori.subarray(iImg, iImg + IMG.length).equals(IMG), String(errore));
    const iGrpl = trova(file, 'grpl');
    dice(`grpl rotta (${nome}): diventa 'free' della stessa misura, senza il testo dentro`,
        !!r && fuori.subarray(iGrpl, iGrpl + 4).toString('latin1') === 'free' && fuori.readUInt32BE(iGrpl - 4) === file.readUInt32BE(iGrpl - 4) && trova(fuori, testo) < 0);
}
{
    const STER = full('ster', 0, be32(5), be32(2), be32(1), be32(2));
    const PYMD = full('pymd', 0, be32(6), be32(1), be32(1), zeri(8));
    const BRST = full('brst', 0, be32(8), be32(2), be32(1), be32(2));
    const file = heicConGrpl(box('grpl', STER, PYMD, BRST, ALTR));
    const { r, errore } = pulisci(file);
    const fuori = r ? Buffer.from(r.bytes) : Buffer.alloc(0);
    dice('grpl con ster, pymd, brst e altr: la foto parte, stessa lunghezza', !!r && fuori.length === file.length, String(errore));
    dice('...ster, pymd e brst diventano \'free\' (della stessa misura), altr resta identico',
        !!r && ['ster', 'pymd', 'brst'].every(t => trova(fuori, t) < 0)
        && fuori.subarray(trova(file, 'altr') - 4, trova(file, 'altr') - 4 + ALTR.length).equals(ALTR)
        && ['ster', 'pymd', 'brst'].every(t => fuori.readUInt32BE(trova(file, t) - 4) === file.readUInt32BE(trova(file, t) - 4)));
}

// ITALIANO: altri posti poco usati dove un testo restava: i byte dopo i campi letti di pitm, iloc e ipma,
//           una scatola sconosciuta dentro dinf (diversa da dref), i byte in coda a un riferimento di iref,
//           l'indirizzo (item_uri_type) di un elemento 'uri '. Si azzera solo dopo i campi letti: misure,
//           tipi e campi restano identici.
// ENGLISH: other rarely used places where a text stayed: the bytes after the fields read in pitm, iloc and
//          ipma, an unknown box inside dinf (other than dref), the trailing bytes of an iref reference, the
//          address (item_uri_type) of a 'uri ' item. Only what follows the fields read is zeroed: sizes,
//          types and fields stay identical.
const CODA = 'TAIL-TEXT gps=1.2,3.4';
const heicConCode = ({ pitm = '', iloc = '', ipma = '', dinf = null, iref = null, infe = null }) => {
    const ftyp = box('ftyp', 'heic', be32(0), 'mif1', 'heic');
    const meta = (mb) => full('meta', 0,
        full('hdlr', 0, be32(0), 'pict', zeri(12), '\0'),
        full('pitm', 0, be16(1), pitm),
        full('iloc', 1, [0x44, 0x40], be16(1), B(be16(1), be16(0), be16(0), be32(0), be16(1), be32(mb), be32(IMG.length)), iloc),
        full('iinf', 0, be16(infe ? 2 : 1), full('infe', 2, be16(1), [0, 0], 'hvc1', '\0'), ...(infe ? [infe] : [])),
        box('iprp', box('ipco', HVCC, ISPE), full('ipma', 0, be32(1), be16(1), [2], [0x81], [2], ipma)),
        ...(iref ? [full('iref', 0, iref)] : []),
        ...(dinf ? [box('dinf', full('dref', 0, be32(1), box('url ', [0, 0, 0, 1])), dinf)] : []));
    const mb = ftyp.length + meta(0).length + 8;
    return B(ftyp, meta(mb), box('mdat', IMG));
};
console.log('\n--- testi in coda a pitm, iloc, ipma, iref, dentro dinf e nel tipo di un elemento uri ---');
for (const [nome, opz, campi] of [
    ['coda di pitm', { pitm: CODA }, []],
    ['coda di iloc', { iloc: CODA }, []],
    ['coda di ipma', { ipma: CODA }, []],
    ['scatola sconosciuta dentro dinf', { dinf: box('XURL', CODA) }, [box('url ', [0, 0, 0, 1])]],
    ['coda di un riferimento di iref', { iref: box('Xnot', be16(1), be16(1), be16(1), CODA) }, []],
    ['indirizzo di un elemento uri', { infe: full('infe', 2, be16(2), [0, 0], 'uri ', 'ITEM\0', CODA, '\0') }, []],
]) {
    const file = heicConCode(opz);
    const { r, errore } = pulisci(file);
    const fuori = r ? Buffer.from(r.bytes) : Buffer.alloc(0);
    dice(`${nome}: la foto parte, stessa lunghezza`, !!r && fuori.length === file.length, String(errore));
    dice(`${nome}: il testo si toglie`, !!r && trova(fuori, CODA) < 0);
    const iImg = trova(file, IMG.toString('latin1'));
    dice(`${nome}: pixel identici; pitm, iloc, iinf, ipma, ipco al loro posto`,
        !!r && fuori.subarray(iImg, iImg + IMG.length).equals(IMG)
        && ['pitm', 'iloc', 'iinf', 'ipco', 'ipma', 'hvc1', 'hvcC', 'ispe'].every(t => trova(fuori, t) === trova(file, t)));
    for (const c of campi) dice(`${nome}: campi letti identici`, !!r && trova(fuori, c.toString('latin1')) === trova(file, c.toString('latin1')));
    const rifatta = pulisci(fuori);
    dice(`${nome}: la foto pulita si ripulisce uguale`, !!rifatta.r && Buffer.from(rifatta.r.bytes).equals(fuori), String(rifatta.errore));
}
{
    // ITALIANO: le parti lette restano identiche: il numero dell'immagine principale, la voce di iloc, le
    //           associazioni di ipma, il riferimento di iref (da, quanti, a), il nome dell'elemento uri (spazi).
    // ENGLISH: the parts read stay identical: the primary item number, the iloc entry, the ipma
    //          associations, the iref reference (from, count, to), the uri item's name (spaces).
    const file = heicConCode({ pitm: CODA, iloc: CODA, ipma: CODA, iref: box('dimg', be16(1), be16(1), be16(2), CODA) });
    const { r } = pulisci(file);
    const fuori = r ? Buffer.from(r.bytes) : Buffer.alloc(0);
    const campo = (tipo, da, n) => { const i = trova(file, tipo) + 4 + da; return [file.subarray(i, i + n), fuori.subarray(i, i + n)]; };
    const confronti = [campo('pitm', 0, 6), campo('iloc', 0, 4 + 2 + 2 + 20), campo('ipma', 0, 4 + 4 + 2 + 1 + 2), campo('dimg', 0, 6)];
    dice('campi letti di pitm, iloc, ipma e iref identici, solo la coda azzerata', !!r && confronti.every(([a, b]) => a.equals(b)));
}
console.log(`\n${fatti - guai}/${fatti} prove superate`);
if (fatti === 0 || guai > 0) process.exit(1);
