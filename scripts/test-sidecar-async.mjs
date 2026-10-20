/* ITALIANO: PROVA: LETTURA E SCRITTURA DEI .txt NON BLOCCANO IL PROCESSO PRINCIPALE
   I canali images:read-sidecar-tags e images:write-sidecar-tags (foto caricate con "Carica immagini"
   o trascinate) leggevano e scrivevano con le funzioni sincrone di fs: con migliaia di foto o una
   cartella di rete lenta il processo principale restava fermo e la finestra sembrava bloccata.
   Ora usano fs.promises. La prova rende "velenose" tutte le funzioni sincrone di fs mentre i canali
   lavorano: se uno le usa ancora, la prova lo vede. Gli esiti devono restare quelli di prima.
   Uso:  node scripts/test-sidecar-async.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: READING AND WRITING THE .txt FILES DO NOT BLOCK THE MAIN PROCESS
   The images:read-sidecar-tags and images:write-sidecar-tags channels (photos loaded with "Load
   images" or dropped) read and wrote with fs's synchronous functions: with thousands of photos or a
   slow network folder the main process stood still and the window looked frozen. They now use
   fs.promises. The test makes every synchronous fs function "poisonous" while the channels work: if
   one still uses them, the test sees it. The outcomes must stay the same as before.
   Usage:  node scripts/test-sidecar-async.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { caricaMain, creaControlli } from './main-harness.mjs';

const { handlers } = caricaMain();
const { dice, esito } = creaControlli();
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-async-'));
const img = (n) => path.join(cartella, n);
fs.writeFileSync(img('a.png'), Buffer.from([137, 80, 78, 71]));
fs.writeFileSync(img('a.txt'), 'ohwx, red hair', 'utf8');
fs.writeFileSync(img('b.png'), Buffer.from([137, 80, 78, 71]));

const sincrone = ['statSync', 'lstatSync', 'readFileSync', 'writeFileSync', 'existsSync', 'openSync', 'closeSync', 'renameSync', 'unlinkSync'];
const veri = Object.fromEntries(sincrone.map(n => [n, fs[n]]));
const usate = [];
const avvelena = () => { for (const n of sincrone) fs[n] = (...a) => { usate.push(n); return veri[n](...a); }; };
const ripristina = () => { for (const n of sincrone) fs[n] = veri[n]; };

let codice = 1;
try {
    avvelena();
    const lettura = handlers.get('images:read-sidecar-tags')(null, [img('a.png'), img('b.png')]);
    dice('la lettura torna una promessa (non blocca)', true, lettura instanceof Promise);
    const letti = await lettura;
    const scrittura = handlers.get('images:write-sidecar-tags')(null, [{ imagePath: img('a.png'), content: 'ohwx, blue hair' }, { imagePath: img('b.png'), content: '' }]);
    dice('la scrittura torna una promessa (non blocca)', true, scrittura instanceof Promise);
    const scritti = await scrittura;
    ripristina();
    dice('nessuna funzione sincrona di fs usata dai due canali', [], [...new Set(usate)]);
    dice('esito della lettura come prima', [{ name: 'a.txt', content: 'ohwx, red hair', dir: cartella }], letti);
    dice('esito della scrittura come prima (b.png senza tag e senza .txt: nessun file)', { ok: true, written: 1, failed: 0, results: [true, true] }, scritti);
    dice('il .txt contiene il testo nuovo e b.txt non nasce', ['ohwx, blue hair', false], [fs.readFileSync(img('a.txt'), 'utf8'), fs.existsSync(img('b.txt'))]);
    dice('nessun temporaneo rimasto', ['a.png', 'a.txt', 'b.png'], fs.readdirSync(cartella).sort());
    codice = esito();
} finally {
    ripristina();
    fs.rmSync(cartella, { recursive: true, force: true });
}
process.exit(codice);
