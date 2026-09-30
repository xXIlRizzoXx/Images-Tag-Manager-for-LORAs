/* ITALIANO: PROVA DELL'AVVISO DI FINE IMPORT
   Dopo un import in cui il backup anti-crash aveva rimesso dei tag non salvati, o in cui dei .txt
   erano stati saltati (illeggibili o oltre 1 MB), l'avviso diceva per esempio
   "Immagini caricate: 120 · ↻ 3 · ⊘ 2 .txt": simboli che nessuna lingua spiega. L'utente non poteva
   sapere che 3 foto avevano ora tag diversi dal loro .txt, ne' che 2 file di tag erano stati
   ignorati. La regola del progetto: gli avvisi sono frasi intere, tradotte nelle nove lingue.
   Si provano la regola VERA di src/utils/importNotice.ts e i testi veri di src/constants.ts
   (compilati al volo con esbuild), e che processImportData in src/App.tsx la usi davvero.
   Uso:  node scripts/test-import-notice.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE END-OF-IMPORT NOTICE
   After an import where the crash backup had put back unsaved tags, or where some .txt files had
   been skipped (unreadable or over 1 MB), the notice read e.g. "Images loaded: 120 · ↻ 3 · ⊘ 2 .txt":
   symbols no language explains. The user could not know that 3 photos now had tags different from
   their .txt, nor that 2 tag files had been ignored. The project rule: notices are whole sentences,
   translated into the nine languages.
   The REAL rule of src/utils/importNotice.ts and the real strings of src/constants.ts are tested
   (compiled on the fly with esbuild), plus that processImportData in src/App.tsx really uses it.
   Usage:  node scripts/test-import-notice.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const lingue = (await carica('src/constants.ts')).translations;
const CODICI = ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'];

console.log('\n--- le due frasi nuove esistono nelle nove lingue ---');
for (const chiave of ['importRestoredFromBackup', 'importTxtSkipped']) {
    dice(`${chiave}: presente, con {n} una sola volta, senza simboli`, [],
        CODICI.filter(l => {
            const s = lingue[l] && lingue[l][chiave];
            return typeof s !== 'string' || s.split('{n}').length !== 2 || /[↻⊘]/.test(s);
        }));
}

// ITALIANO: processImportData non deve piu' incollare simboli, e deve passare dalla regola.
// ENGLISH: processImportData must no longer glue symbols, and must go through the rule.
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const processImportData = async (');
const fine = sorgente.indexOf('    const calculateImportSummary = (', inizio);
const corpo = inizio >= 0 && fine > inizio ? sorgente.slice(inizio, fine) : '';
console.log('\n--- src/App.tsx, processImportData ---');
dice('processImportData trovato', true, corpo !== '');
dice('nessun simbolo ↻ o ⊘ incollato all\'avviso', false, /[↻⊘]/.test(corpo));
dice('l\'avviso passa da avvisoImport', true, /showNotification\(\s*avviso\.testo\s*,\s*avviso\.tipo\s*\)/.test(corpo) && /avvisoImport\(/.test(corpo));

// ITALIANO: tre frasi intere sono piu' lunghe dei simboli (in tedesco ~165 caratteri): il messaggio
//           a comparsa deve poter andare a capo, altrimenti esce dalla finestra da 1280 px.
// ENGLISH: three whole sentences are longer than the symbols (~165 characters in German): the pop-up
//          must be able to wrap, otherwise it runs off a 1280 px window.
const ui = fs.readFileSync(path.join(radice, 'src/components/ui.tsx'), 'utf8');
const toast = ui.slice(ui.indexOf('export const Toast'), ui.indexOf('export const ExportChoiceDialog'));
dice('il messaggio a comparsa va a capo quando e\' lungo (niente whitespace-nowrap sul testo)', [true, false],
    [toast.includes('{message}') && toast.includes('max-w-[90vw]'), /whitespace-nowrap[^>]*>\{message\}/.test(toast)]);

let N = null;
try { N = await carica('src/utils/importNotice.ts'); } catch (e) { console.log('  NO  src/utils/importNotice.ts non si carica: ' + String(e && e.message || e).split('\n')[0]); }
if (N) {
    console.log('\n--- l\'avviso, lingua per lingua ---');
    for (const l of CODICI) {
        const t = lingue[l];
        const a = N.avvisoImport(t, { caricate: 120, ripristinate: 3, saltati: 2, accorciati: 0 });
        dice(`${l}: 120 caricate, 3 recuperate, 2 saltati -> tre frasi intere`,
            { testo: [t.successImport.replace('{n}', '120'), t.importRestoredFromBackup.replace('{n}', '3'), t.importTxtSkipped.replace('{n}', '2')].join(' · '), tipo: 'success' }, a);
        const uno = N.avvisoImport(t, { caricate: 1, ripristinate: 1, saltati: 1, accorciati: 0 });
        dice(`${l}: con 1 si legge "…: 1" in ogni frase`, true,
            uno.testo === [t.successImport, t.importRestoredFromBackup, t.importTxtSkipped].map(s => s.replace('{n}', '1')).join(' · '));
    }
    const t = lingue.en;
    console.log('\n--- quello che NON deve cambiare ---');
    dice('niente recuperato ne\' saltato: esattamente "Images loaded: N"', { testo: t.successImport.replace('{n}', '7'), tipo: 'success' },
        N.avvisoImport(t, { caricate: 7, ripristinate: 0, saltati: 0, accorciati: 0 }));
    dice('.txt accorciati: l\'avviso d\'errore di prima prende il posto di "Images loaded", e le altre frasi restano',
        { testo: [t.importTxtShortened.replace('{n}', '2'), t.importRestoredFromBackup.replace('{n}', '1')].join(' · '), tipo: 'error' },
        N.avvisoImport(t, { caricate: 7, ripristinate: 1, saltati: 0, accorciati: 2 }));
}

process.exit(esito());
