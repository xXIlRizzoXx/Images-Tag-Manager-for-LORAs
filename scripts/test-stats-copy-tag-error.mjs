/* ITALIANO: PROVA DEL TASTO COPIA DI UN TAG NELLE STATISTICHE QUANDO GLI APPUNTI RIFIUTANO
   Nelle Statistiche il tasto Copia accanto a un tag scrive il tag negli appunti. Se la scrittura
   veniva rifiutata (pagina senza permesso, finestra che perde il fuoco) compariva l'errore
   dell'import dei tag del progetto, «Impossibile leggere il file dei tag»: un file che non c'entra.
   La regola: l'errore dice che non si e' potuto copiare negli appunti (mcpCopyFailed, la frase
   gia' usata dalla copia dei testi MCP), anche quando gli appunti non ci sono proprio.
   Si esegue il testo VERO del gestore onClick preso da src/App.tsx.
   Uso:  node scripts/test-stats-copy-tag-error.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE STATISTICS COPY BUTTON OF A TAG WHEN THE CLIPBOARD REFUSES
   In the Statistics the Copy button beside a tag writes the tag to the clipboard. When the write
   was refused (page without permission, window losing focus) the project tag import error showed,
   "Could not read the tags file": a file that has nothing to do with it. The rule: the error says
   the copy to the clipboard failed (mcpCopyFailed, the sentence already used by the MCP text copy),
   also when there is no clipboard at all.
   The REAL text of the onClick handler taken from src/App.tsx is run.
   Usage:  node scripts/test-stats-copy-tag-error.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const lingue = (await import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'))).translations;
const t = lingue.en;

// ITALIANO: il gestore e' l'onClick del pulsante con title={t.statsCopyTag}.
// ENGLISH: the handler is the onClick of the button with title={t.statsCopyTag}.
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const titolo = sorgente.indexOf('title={t.statsCopyTag}');
const inizio = titolo < 0 ? -1 : sorgente.lastIndexOf('onClick={', titolo);
const fine = inizio < 0 ? -1 : sorgente.lastIndexOf('}}', titolo);
if (inizio < 0 || fine < inizio) { console.log('NO  pulsante Copia delle Statistiche non trovato in src/App.tsx'); process.exit(1); }
const testo = sorgente.slice(inizio + 'onClick={'.length, fine + 1);
const codice = (await esbuild.transform('const gestore = ' + testo + ';', { loader: 'tsx' })).code;

const clic = async (clipboard) => {
    const r = { notifiche: [], suoni: 0 };
    const gestore = new Function('navigator', 'soundManager', 'showNotification', 't', 'tag', codice + '\nreturn gestore;')(
        clipboard === undefined ? {} : { clipboard }, { pop() { r.suoni++; } }, (m, tipo) => r.notifiche.push([m, tipo]), t, 'blue eyes');
    try { gestore(); } catch (e) { r.eccezione = String(e && e.message || e); }
    await new Promise(ok => setTimeout(ok, 5));
    return r;
};

console.log('\n--- gli appunti rifiutano la scrittura ---');
{
    const r = await clic({ writeText: () => Promise.reject(new Error('NotAllowedError')) });
    dice('compare la frase sugli appunti, non quella del file dei tag', [[t.mcpCopyFailed, 'error']], r.notifiche);
    dice('nessuna eccezione', undefined, r.eccezione);
}

console.log('\n--- gli appunti non ci sono ---');
{
    const r = await clic(undefined);
    dice('lo si dice con la stessa frase, invece del silenzio', [[t.mcpCopyFailed, 'error']], r.notifiche);
    dice('nessuna eccezione', undefined, r.eccezione);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const scritti = [];
    const r = await clic({ writeText: (x) => { scritti.push(x); return Promise.resolve(); } });
    dice('copia riuscita: il tag negli appunti, il suono e il messaggio verde',
        [['blue eyes'], 1, [[`${t.statsTagCopied}: blue eyes`, 'success']]], [scritti, r.suoni, r.notifiche]);
}
dice('il gestore non usa piu\' importTagsError', false, testo.includes('importTagsError'));
for (const l of ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru']) {
    dice(l + ': mcpCopyFailed presente', true, typeof lingue[l].mcpCopyFailed === 'string' && lingue[l].mcpCopyFailed.trim().length > 0);
}

process.exit(esito());
