/* ITALIANO: PROVA DELL'IMMAGINE DI PROVA DEI MODELLI
   La scelta automatica del modello e "Prova i modelli recenti" mandano a Google una piccola
   immagine PNG scritta nel codice (PIXEL_PNG). Se quel PNG e' rotto Google risponde 400 a OGNI
   modello: la prova li segnava tutti "non adatti" e la scelta automatica non adottava mai un
   modello nuovo, mentre il tagging con le foto vere funzionava. Le prove con il Google finto non
   lo vedevano, perche' il finto non apre l'immagine. Qui il PNG si apre davvero: firma, blocchi
   con il loro CRC, dati che si decomprimono nella misura giusta per larghezza, altezza e colori.
   Uso:  node scripts/test-ai-probe-image.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MODEL PROBE IMAGE
   The automatic model choice and "Test recent models" send Google a small PNG written in the code
   (PIXEL_PNG). If that PNG is broken Google answers 400 to EVERY model: the probe marked them all
   "not suitable" and the automatic choice never adopted a new model, while tagging real photos
   worked. The tests with the fake Google missed it, since the fake never opens the image. Here
   the PNG is really opened: signature, chunks with their CRC, data inflating to the right size
   for width, height and colour type.
   Usage:  node scripts/test-ai-probe-image.mjs      (exits with code 1 if anything is off) */

import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let guai = 0;
let fatti = 0;
const dice = (cosa, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log(`${ok ? 'OK  ' : 'NO  '} ${cosa}${ok ? '' : `  (atteso ${JSON.stringify(atteso)}, avuto ${JSON.stringify(avuto)})`}`);
};

const sorgente = fs.readFileSync(path.join(radice, 'src/services/geminiService.ts'), 'utf8');
const base64 = /const PIXEL_PNG = '([A-Za-z0-9+/=]+)';/.exec(sorgente)?.[1] || '';
dice('PIXEL_PNG si trova nel codice', true, base64.length > 0);

const tabella = [];
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabella[n] = c >>> 0;
}
const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const x of buf) c = tabella[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};

const png = Buffer.from(base64, 'base64');
dice('ha la firma PNG', '89504e470d0a1a0a', png.subarray(0, 8).toString('hex'));
const blocchi = [];
let crcGiusti = true;
for (let p = 8; p + 12 <= png.length;) {
    const lunghezza = png.readUInt32BE(p);
    const tipo = png.subarray(p + 4, p + 8).toString('latin1');
    const dati = png.subarray(p + 8, p + 8 + lunghezza);
    if (png.readUInt32BE(p + 8 + lunghezza) !== crc32(png.subarray(p + 4, p + 8 + lunghezza))) crcGiusti = false;
    blocchi.push({ tipo, dati });
    p += 12 + lunghezza;
}
dice('blocchi IHDR, IDAT, IEND in ordine', ['IHDR', 'IDAT', 'IEND'], blocchi.map(b => b.tipo));
dice('ogni blocco ha il CRC giusto', true, crcGiusti);

const ihdr = blocchi.find(b => b.tipo === 'IHDR')?.dati;
const larghezza = ihdr ? ihdr.readUInt32BE(0) : 0;
const altezza = ihdr ? ihdr.readUInt32BE(4) : 0;
const profondita = ihdr ? ihdr[8] : 0;
const colore = ihdr ? ihdr[9] : -1;
const canali = { 0: 1, 2: 3, 4: 2, 6: 4 }[colore] || 0;
dice('8 bit per canale', 8, profondita);
// ITALIANO: senza trasparenza: un'immagine tutta trasparente non mostra niente al modello.
// ENGLISH: no transparency: a fully transparent image shows the model nothing.
dice('niente canale alfa (grigio o RGB)', true, colore === 0 || colore === 2);

let grezzi = Buffer.alloc(0);
try { grezzi = zlib.inflateSync(Buffer.concat(blocchi.filter(b => b.tipo === 'IDAT').map(b => b.dati))); } catch (_) { }
const attesi = altezza * (1 + larghezza * canali);
dice(`i dati decompressi sono ${attesi} byte, come chiedono ${larghezza}x${altezza} e ${canali} canali`, attesi, grezzi.length);
let filtriValidi = grezzi.length === attesi;
for (let y = 0; filtriValidi && y < altezza; y++) if (grezzi[y * (1 + larghezza * canali)] > 4) filtriValidi = false;
dice('ogni riga ha un filtro PNG valido', true, filtriValidi);

// ITALIANO: entrambe le prove (scelta automatica e "Prova i modelli recenti") usano questa immagine.
// ENGLISH: both probes (automatic choice and "Test recent models") use this image.
dice('le due prove mandano PIXEL_PNG', 2, (sorgente.match(/inlineData: \{ data: PIXEL_PNG, mimeType: 'image\/png' \}/g) || []).length);

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
