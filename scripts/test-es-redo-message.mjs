/* ITALIANO: PROVA DEL MESSAGGIO DI RIPETI (Ctrl+Y) IN SPAGNOLO
   Con la lingua spagnola, Ripeti mostrava "Acción rehacer" (verbo all'infinito: frase sgrammaticata),
   mentre Annulla mostra "Acción deshecha". Ora Ripeti dice "Acción rehecha", con il participio come
   Annulla. Si controllano anche le altre otto lingue: nessuna ha un messaggio vuoto o uguale a quello
   di Annulla, e il toast di App.tsx usa ancora t.redoSuccess.
   Uso:  node scripts/test-es-redo-message.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE REDO (Ctrl+Y) MESSAGE IN SPANISH
   In Spanish, Redo showed "Acción rehacer" (an infinitive: ungrammatical), while Undo shows "Acción
   deshecha". Redo now says "Acción rehecha", a participle like Undo. The other eight languages are
   checked too: none has an empty message or one equal to Undo's, and the App.tsx toast still uses
   t.redoSuccess.
   Usage:  node scripts/test-es-redo-message.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const lingue = (await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'))).translations;
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');

console.log('\n--- spagnolo ---');
dice('Ripeti: "Acción rehecha"', 'Acción rehecha', lingue.es.redoSuccess);
dice('Annulla resta "Acción deshecha"', 'Acción deshecha', lingue.es.undoSuccess);
dice('nessun infinito (-ar/-er/-ir) in fondo al messaggio di Ripeti', false, /(ar|er|ir)$/.test(lingue.es.redoSuccess));

console.log('\n--- le nove lingue ---');
for (const codice of ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru']) {
    const t = lingue[codice];
    dice(`${codice}: Ripeti ha un testo suo, diverso da Annulla`, true, !!t.redoSuccess && t.redoSuccess !== t.undoSuccess);
}

console.log('\n--- App.tsx ---');
dice('il toast di Ripeti usa t.redoSuccess', true, /setToast\([^)]*t\.redoSuccess/.test(app));

process.exit(esito());
