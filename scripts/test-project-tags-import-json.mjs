/* ITALIANO: PROVA DELL'IMPORT DEI TAG DEL PROGETTO DA UN JSON CHE NON E' QUELLO DELL'APP
   Un elenco JSON semplice, '["1girl", "solo", "smile"]', si leggeva come TXT: nella palette
   entravano '["1girl"', '"solo"', '"smile"]' con parentesi e virgolette, con l'avviso verde
   "importati (3)", e applicandoli finivano nei .txt. Un JSON con i tag come oggetti
   ({"tags":[{"tag":"1girl","count":5}]}) dava un tag '[object Object]', una voce null il tag
   'null'. L'editor dei file di tag della stessa app accetta l'elenco semplice e rifiuta gli
   oggetti: ora l'import fa lo stesso (e le voci null si saltano).
   Si esegue il testo VERO di handleImportProjectTags preso da src/App.tsx (compilato con esbuild),
   con src/utils/sidecarTags.ts e i testi veri di src/constants.ts.
   Uso:  node scripts/test-project-tags-import-json.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE PROJECT TAGS IMPORT FROM A JSON THAT IS NOT THE APP'S OWN
   A plain JSON list, '["1girl", "solo", "smile"]', was read as TXT: the palette got '["1girl"',
   '"solo"', '"smile"]' with brackets and quotes, with the green "imported (3)" notice, and once
   applied they went into the .txt files. A JSON with the tags as objects
   ({"tags":[{"tag":"1girl","count":5}]}) gave a tag '[object Object]', a null entry the tag
   'null'. The same app's tag file editor accepts the plain list and refuses objects: now the
   import does the same (and null entries are skipped).
   The REAL text of handleImportProjectTags taken from src/App.tsx is run (compiled with esbuild),
   with src/utils/sidecarTags.ts and the real strings of src/constants.ts.
   Usage:  node scripts/test-project-tags-import-json.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const S = await carica('src/utils/sidecarTags.ts');
const t = (await carica('src/constants.ts')).translations.en;
const { dice, esito } = creaControlli();

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const handleImportProjectTags = async (e: any) => {');
const chiusura = /\r?\n    \};\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (inizio < 0 || !fine) {
    console.log('NO  handleImportProjectTags non trovato in src/App.tsx');
    process.exit(1);
}
const js = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
const fabbrica = new Function('t', 'showNotification', 'setCustomProjectTags', 'soundManager', 'projectTagsImportRef', 'pulisciTagProgetto', 'leggiTestoSidecar',
    js + '\nreturn handleImportProjectTags;');

const importa = async (testo, iniziale = []) => {
    const r = { palette: [...iniziale], notifiche: [] };
    const fn = fabbrica(t, (m, tipo) => r.notifiche.push([m, tipo]), (f) => { r.palette = typeof f === 'function' ? f(r.palette) : f; },
        { chime() { } }, { current: { value: 'x' } }, S.pulisciTagProgetto, S.leggiTestoSidecar);
    await fn({ target: { files: [{ size: Buffer.byteLength(testo), text: async () => testo }] } });
    return r;
};
const errore = [[t.importTagsError, 'error']];

console.log('\n--- un elenco JSON semplice ---');
{
    const r = await importa('["1girl", "solo", "smile"]');
    dice('entrano 1girl, solo, smile senza parentesi ne\' virgolette', ['1girl', 'solo', 'smile'], r.palette);
    dice('messaggio "importati (3)"', [[`${t.projectTagsImported} (3)`, 'success']], r.notifiche);
    const su = await importa('[\n  "1girl",\n  "solo"\n]\n');
    dice('anche su piu\' righe', ['1girl', 'solo'], su.palette);
}

console.log('\n--- tag come oggetti o elenchi: rifiutati, palette intatta ---');
{
    const o = await importa(JSON.stringify({ tags: [{ tag: '1girl', count: 5 }] }), ['prima']);
    dice('{"tags":[{...}]}: errore di lettura', errore, o.notifiche);
    dice('...e nessun "[object Object]" nella palette', ['prima'], o.palette);
    const a = await importa(JSON.stringify([{ tag: 'x' }, 'y']), ['prima']);
    dice('[{...}, "y"]: errore di lettura, palette intatta', [errore, ['prima']], [a.notifiche, a.palette]);
    const n = await importa(JSON.stringify([['a', 'b']]), ['prima']);
    dice('[["a","b"]]: errore di lettura, palette intatta', [errore, ['prima']], [n.notifiche, n.palette]);
    const g = await importa(JSON.stringify({ tags: ['a'], globalTriggers: [{ w: 'ohwx' }] }), ['prima']);
    dice('trigger come oggetto: errore di lettura, palette intatta', [errore, ['prima']], [g.notifiche, g.palette]);
}

console.log('\n--- voci null: saltate ---');
{
    const r = await importa(JSON.stringify({ tags: ['a', null, 'b'] }));
    dice('{"tags":["a",null,"b"]} -> a, b (niente "null")', ['a', 'b'], r.palette);
    const l = await importa('["a", null]');
    dice('["a", null] -> a', ['a'], l.palette);
    const solo = await importa('[null]');
    dice('[null]: niente da importare, errore di lettura', errore, solo.notifiche);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const app = await importa(JSON.stringify({ app: 'Images Tag Manager for LORAs', globalTriggers: ['ohwx'], tags: ['smile', 3] }));
    dice('il formato dell\'app: tag, numeri come testo, poi le trigger', ['smile', '3', 'ohwx'], app.palette);
    const txt = await importa('red hair, smile\nblue eyes\n');
    dice('TXT: virgole e righe separano', ['red hair', 'smile', 'blue eyes'], txt.palette);
    const quadra = await importa('[artist name], smile\n');
    dice('TXT che inizia con una parentesi quadra ma non e\' JSON: letto come TXT', ['[artist name]', 'smile'], quadra.palette);
    const rotto = await importa('{"tags": ["a",');
    dice('JSON rotto: errore di lettura', errore, rotto.notifiche);
    const vuoto = await importa('[]');
    dice('elenco vuoto: errore di lettura', errore, vuoto.notifiche);
}

process.exit(esito());
