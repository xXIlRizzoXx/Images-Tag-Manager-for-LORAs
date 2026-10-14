/* ITALIANO: PROVA DEI MESSAGGI DI "SALVA MODIFICHE"
   Quando qualcosa non si salvava, il messaggio era fatto di pezzi incollati ("Salvataggio
   parziale: 0/5 — non salvate: img.png…") e diceva "parziale" anche quando non si era salvato
   niente. Nell'anteprima del browser, salvando foto di "Carica immagini", i .txt venivano offerti
   come download e subito dopo compariva lo stesso errore rosso, come se fosse fallito tutto; il
   "Salva .txt" del visualizzatore diceva "Download multiplo avviato" per un solo file. Ora sono
   frasi intere, nelle nove lingue: niente salvato, salvate N su M, offerte come download (una o
   piu'). Il risultato non cambia: con un download o un errore "Salva e chiudi" non chiude.
   Si eseguono i testi VERI di performSave (src/App.tsx) e di handleSaveSingleTxt
   (src/components/Lightbox.tsx), con i testi veri di src/constants.ts.
   Uso:  node scripts/test-save-messages.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "SAVE CHANGES" MESSAGES
   When something was not saved, the message was made of glued pieces ("Partial save: 0/5 —
   failed: img.png…") and said "partial" even when nothing had been saved. In the browser preview,
   saving photos from "Load images", the .txt files were offered as downloads and right after the
   same red error showed, as if everything had failed; the viewer's "Save .txt" said "Multiple
   download started" for a single file. Now they are whole sentences, in all nine languages:
   nothing saved, N of M saved, offered as downloads (one or more). The outcome does not change:
   with a download or an error "Save and close" does not close.
   The REAL text of performSave (src/App.tsx) and of handleSaveSingleTxt
   (src/components/Lightbox.tsx) is run, with the real strings of src/constants.ts.
   Usage:  node scripts/test-save-messages.mjs      (exits with code 1 if anything is off) */

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
const P = await carica('src/utils/pathUtils.ts');
const lingue = (await carica('src/constants.ts')).translations;
const LINGUE = ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'];

const ritaglia = async (file, intestazione) => {
    const sorgente = fs.readFileSync(path.join(radice, file), 'utf8');
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) {
        console.log(`NO  non trovato in ${file}: ${intestazione.trim()}`);
        process.exit(1);
    }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'tsx' })).code;
};
const jsSalva = await ritaglia('src/App.tsx', '    const performSave = async (imagesToSave: any[]): Promise<boolean> => {');
const jsLightbox = await ritaglia('src/components/Lightbox.tsx', '    const handleSaveSingleTxt = async () => {');
const muto = { log() { }, warn() { }, error() { } };
const documento = { createElement: () => ({ click() { } }), body: { appendChild() { }, removeChild() { } } };
const url = { createObjectURL: () => 'blob:finto', revokeObjectURL() { } };
// ITALIANO: niente attese vere fra un download e l'altro.
// ENGLISH: no real waits between one download and the next.
const subito = (fn) => { fn(); return 0; };

// ITALIANO: una cartella che non si lascia scrivere (rinominata o scollegata dopo l'import).
// ENGLISH: a folder that refuses writes (renamed or unplugged after the import).
const cartellaRotta = () => ({ getFileHandle: async () => { throw new DOMException('gone', 'NotFoundError'); } });
const cartellaBuona = () => ({ getFileHandle: async () => ({ createWritable: async () => ({ write: async () => { }, close: async () => { } }) }) });

const salva = async (t, foto, finestra = {}) => {
    const r = { notifiche: [] };
    const f = new Function('setIsSaving', 'setImportProgress', 'showNotification', 't', 'getOrderedTagString', 'window', 'setImages', 'soundManager', 'console',
        'buildTagFileName', 'sanitizeFileName', 'sidecarTagFileName', 'document', 'URL', 'Blob', 'setTimeout',
        jsSalva + '\nreturn performSave;')(() => { }, () => { }, (m, tipo) => r.notifiche.push([m, tipo]), t, (tags) => (tags.length ? tags.join(', ') + ',' : ''),
        finestra, () => { }, { chime() { } }, muto, P.buildTagFileName, P.sanitizeFileName, P.sidecarTagFileName, documento, url, Blob, subito);
    r.ok = await f(foto);
    r.ultimo = r.notifiche[r.notifiche.length - 1] || null;
    return r;
};
const foto = (id, dir) => ({ id, file: { name: id + '.png' }, tags: ['nuovo'], originalTags: ['vecchio'], dirHandle: dir });
const incollato = (m) => / — /.test(m) || /\{\w+\}/.test(m);

for (const lingua of LINGUE) {
    const t = lingue[lingua];
    console.log(`\n--- [${lingua}] ---`);
    {
        const r = await salva(t, ['a', 'b', 'c', 'd', 'e'].map(id => foto(id, cartellaRotta())));
        dice('niente salvato: non dice "parziale", nessun pezzo incollato o segnaposto avanzato', [false, false, false],
            [r.ultimo[0].includes(String(t.savePartial || '\u0000')), incollato(r.ultimo[0]), r.ok]);
        dice('...e usa la frase "niente salvato" coi primi nomi', true,
            typeof t.saveNoneSaved === 'string' && r.ultimo[0] === t.saveNoneSaved.replace('{names}', 'a.png, b.png, c.png…') && r.ultimo[1] === 'error');
    }
    {
        const r = await salva(t, [foto('a', cartellaBuona()), foto('b', cartellaRotta())]);
        dice('salvata 1 su 2: la frase con 1 e 2 e il nome', true,
            typeof t.saveSomeFailed === 'string' && r.ultimo[0] === t.saveSomeFailed.replace('{saved}', '1').replace('{total}', '2').replace('{names}', 'b.png') && r.ultimo[1] === 'error' && !r.ok);
    }
    {
        const r = await salva(t, [foto('a', null), foto('b', null), foto('c', null)]);
        dice('anteprima, 3 foto di "Carica immagini": offerte come download, non un errore', true,
            typeof t.saveDownloadedMany === 'string' && r.ultimo[0] === t.saveDownloadedMany.replace('{n}', '3') && r.ultimo[1] === 'info');
        dice('...e "Salva e chiudi" non chiude lo stesso', false, r.ok);
        const uno = await salva(t, [foto('a', null)]);
        dice('una sola foto: la frase al singolare', true, typeof t.saveDownloadedOne === 'string' && uno.ultimo[0] === t.saveDownloadedOne && uno.ultimo[1] === 'info');
    }
}

console.log('\n--- "Salva .txt" del visualizzatore nell\'anteprima ---');
{
    const t = lingue.en;
    const notifiche = [];
    const f = new Function('orderTags', 'currentTags', 'image', 'dirHandle', 'updateOriginalTags', 'soundManager', 'showNotification', 't', 'window', 'console',
        'buildTagFileName', 'sidecarTagFileName', 'document', 'URL', 'Blob',
        jsLightbox + '\nreturn handleSaveSingleTxt;')((x) => x, ['nuovo'], { id: '1', file: { name: 'a.png' }, originalTags: [] }, null, () => { }, { chime() { } },
        (m, tipo) => notifiche.push([m, tipo]), t, {}, muto, P.buildTagFileName, P.sidecarTagFileName, documento, url, Blob);
    await f();
    dice('un solo file: la frase al singolare, non "Download multiplo"', [[t.saveDownloadedOne, 'info']], notifiche);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const t = lingue.en;
    const r = await salva(t, [foto('a', cartellaBuona()), foto('b', cartellaBuona())]);
    dice('tutto salvato: il messaggio di sempre', [t.successSaveChanges, 'success'], r.ultimo);
    dice('...e "Salva e chiudi" puo\' chiudere', true, r.ok);
}

process.exit(esito());
