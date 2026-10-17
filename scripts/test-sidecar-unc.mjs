/* ITALIANO: PROVA DEI .txt ACCANTO A UNA FOTO APERTA DA UNA CARTELLA DI RETE (\\server\condivisione)
   Una foto scelta con "Carica immagini", o trascinata, da \\nas\dataset arriva con il suo percorso
   di rete. I due canali del .txt la scartavano: il .txt accanto non veniva letto (la foto arrivava
   senza tag) e "Salva" falliva senza dire perche', mentre la stessa cartella raggiunta con una
   lettera (Z:\) funzionava. Ora i due canali del .txt accettano \\server\condivisione\..., e
   continuano a rifiutare i percorsi "device" (\\?\, \\.\) e i segmenti "..". Il Cestino resta
   chiuso alle cartelle di rete: li' decide la seconda conferma.
   Nessuna rete: il prefisso \\nas\dataset\ e' finto e porta a una cartella temporanea. Qualsiasi
   altro accesso a un percorso che inizia con \\ fa fallire la prova.
   Uso:  node scripts/test-sidecar-unc.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE .txt NEXT TO A PHOTO OPENED FROM A NETWORK FOLDER (\\server\share)
   A photo picked with "Load images", or dropped, from \\nas\dataset arrives with its network path.
   The two .txt channels dropped it: the .txt beside it was not read (the photo arrived untagged)
   and "Save" failed without saying why, while the same folder reached through a letter (Z:\)
   worked. The two .txt channels now accept \\server\share\..., and keep refusing device paths
   (\\?\, \\.\) and ".." segments. The Recycle Bin stays closed to network folders: there the
   second confirmation decides.
   No network: the \\nas\dataset\ prefix is fake and leads to a temporary folder. Any other access
   to a path starting with \\ fails the test.
   Usage:  node scripts/test-sidecar-unc.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { caricaMain, creaControlli } from './main-harness.mjs';

if (process.platform !== 'win32') {
    console.log('TUTTO A POSTO (saltata: percorsi Windows)');
    process.exit(0);
}

const { handlers, cestinati } = caricaMain();
const { dice, esito } = creaControlli();
const B = String.fromCharCode(92);
const PREFISSO = B + B + 'nas' + B + 'dataset' + B;
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-unc-'));
// ITALIANO: anche lstatSync, openSync, unlinkSync e renameSync (entrambi i percorsi): il .txt si scrive
//           in un temporaneo accanto che poi lo sostituisce.
// ENGLISH: lstatSync, openSync, unlinkSync and renameSync (both paths) too: the .txt is written to a
//          temporary file beside it which then replaces it.
const veri = { statSync: fs.statSync, readFileSync: fs.readFileSync, writeFileSync: fs.writeFileSync, existsSync: fs.existsSync,
    lstatSync: fs.lstatSync, openSync: fs.openSync, unlinkSync: fs.unlinkSync, renameSync: fs.renameSync };
const realpathVero = fs.realpathSync.native;
// ITALIANO: ogni accesso a un percorso \\... fuori dal prefisso finto finisce qui (e la prova fallisce).
// ENGLISH: every access to a \\... path outside the fake prefix lands here (and fails the test).
const fuoriPrefisso = [];
const traduci = (p) => {
    if (typeof p !== 'string') return p;
    if (p.startsWith(PREFISSO)) return path.join(cartella, p.slice(PREFISSO.length));
    if (/^[\\/]{2}/.test(p)) fuoriPrefisso.push(p);
    return p;
};
let codice = 1;
try {
    fs.writeFileSync(path.join(cartella, '0001.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    fs.writeFileSync(path.join(cartella, '0001.txt'), 'sks, red hair');
    for (const nome of Object.keys(veri)) fs[nome] = (p, ...resto) => veri[nome](traduci(p), ...resto);
    fs.renameSync = (da, a, ...resto) => veri.renameSync(traduci(da), traduci(a), ...resto);
    fs.realpathSync.native = (p, ...resto) => realpathVero(traduci(p), ...resto);

    const foto = PREFISSO + '0001.jpg';
    console.log('\n--- foto aperta da \\\\nas\\dataset ---');
    const letti = handlers.get('images:read-sidecar-tags')(null, [foto]);
    // ITALIANO: alla radice di una condivisione path.dirname tiene il separatore finale, come per
    //           E:\ (la pagina lo toglie da entrambe le parti, vedi cartellaTesto).
    // ENGLISH: at the root of a share path.dirname keeps the trailing separator, as for E:\ (the
    //          page strips it on both sides, see cartellaTesto).
    dice('il .txt accanto si legge', [{ name: '0001.txt', content: 'sks, red hair', dir: PREFISSO }], letti);
    const scritti = handlers.get('images:write-sidecar-tags')(null, [{ imagePath: foto, content: 'sks, red hair, smile' }]);
    dice('"Salva" scrive il .txt sulla condivisione', { ok: true, written: 1, failed: 0, results: [true] }, scritti);
    dice('...e il .txt contiene davvero il testo nuovo', 'sks, red hair, smile', veri.readFileSync(path.join(cartella, '0001.txt'), 'utf8'));

    // ITALIANO: la pagina abbina il .txt alla foto con la cartella: le due forme devono coincidere
    //           anche per \\server\condivisione (stessa regola di cartellaImmagine / cartellaTesto).
    // ENGLISH: the page pairs the .txt with the photo through the folder: the two forms must match
    //          for \\server\share too (same rule as cartellaImmagine / cartellaTesto).
    const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const u = await esbuild.build({ entryPoints: [path.join(radice, 'src/utils/sidecarTags.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    const S = await import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
    dice('la pagina abbina il .txt alla sua foto', [true, B + B + 'nas' + B + 'dataset'],
        [S.cartellaImmagine(foto) === S.cartellaTesto((letti[0] || {}).dir || ''), S.cartellaImmagine(foto)]);

    console.log('\n--- restano rifiutati, senza toccare niente ---');
    const vietati = [
        B + B + '?' + B + path.join(cartella, '0001.jpg'),
        B + B + '.' + B + path.join(cartella, '0001.jpg'),
        B + B + '?' + B + 'UNC' + B + 'nas' + B + 'dataset' + B + '0001.jpg',
        PREFISSO + '..' + B + 'altro' + B + '0001.jpg',
        B + B + 'nas',
        B + B + 'nas' + B + '0001.jpg',
        '//nas/dataset/0001.jpg',
    ];
    for (const v of vietati) {
        const prima = fuoriPrefisso.length;
        const l = handlers.get('images:read-sidecar-tags')(null, [v]);
        const s = handlers.get('images:write-sidecar-tags')(null, [{ imagePath: v, content: 'x' }]);
        dice('rifiutato: ' + v, [[], [false], 0], [l, s.results, fuoriPrefisso.length - prima]);
    }
    dice('il .txt sulla condivisione non e\' stato toccato dai percorsi rifiutati', 'sks, red hair, smile', veri.readFileSync(path.join(cartella, '0001.txt'), 'utf8'));

    console.log('\n--- il Cestino resta chiuso alle cartelle di rete ---');
    const r = await handlers.get('shell:trash-files')(null, [foto]);
    dice('\\\\nas\\... al Cestino: rifiutato, come deciso', ['rifiutato'], r.results);
    dice('il Cestino di Windows non viene chiamato', [], cestinati);

    dice('nessun accesso a percorsi di rete fuori dal prefisso finto', [], fuoriPrefisso);
    codice = esito();
} finally {
    for (const nome of Object.keys(veri)) fs[nome] = veri[nome];
    fs.realpathSync.native = realpathVero;
    fs.rmSync(cartella, { recursive: true, force: true });
}
process.exit(codice);
