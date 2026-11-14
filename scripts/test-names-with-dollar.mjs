/* ITALIANO: PROVA DEI NOMI DI FOTO CON «$» NEGLI AVVISI
   Il nome di una foto entrava nella frase con `testo.replace('{names}', nome)`: in JavaScript, nel
   testo nuovo di replace, le coppie $$, $&, $` e $' hanno un significato speciale anche quando si
   cerca un testo semplice. «price $$ 20.png» usciva «price $ 20.png», «a$&b.png» usciva
   «a{names}b.png», e con «a$`b.png» dentro il nome si ripeteva tutta la frase. L'avviso nominava
   un file che non esiste. Ora il nome entra con una funzione, che non interpreta il $.
   Si eseguono i testi VERI di performSave (src/App.tsx), di exportAllAsZip (export-harness.mjs) e
   di avvisoImport (src/utils/importNotice.ts), e si controlla sul sorgente che ogni nome di file
   messo in una frase passi da una funzione.
   Uso:  node scripts/test-names-with-dollar.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF PHOTO NAMES WITH "$" IN THE NOTICES
   A photo's name went into the sentence with `text.replace('{names}', name)`: in JavaScript, in the
   replacement text of replace, the pairs $$, $&, $` and $' have a special meaning even when a plain
   string is searched. "price $$ 20.png" came out as "price $ 20.png", "a$&b.png" as "a{names}b.png",
   and with "a$`b.png" the whole sentence was repeated inside the name. The notice named a file that
   does not exist. Now the name goes in through a function, which does not interpret the $.
   The REAL text of performSave (src/App.tsx), of exportAllAsZip (export-harness.mjs) and of
   avvisoImport (src/utils/importNotice.ts) is run, and the source is checked so that every file name
   put into a sentence goes through a function.
   Usage:  node scripts/test-names-with-dollar.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';
import { creaApp as creaExport, creaSonda, FotoFinta, byteDi } from './export-harness.mjs';

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
const N = await carica('src/utils/importNotice.ts');
const t = (await carica('src/constants.ts')).translations.en;
// ITALIANO: la frase attesa costruita senza replace (split/join non interpreta il $).
// ENGLISH: the expected sentence built without replace (split/join does not interpret the $).
const metti = (testo, segnaposto, valore) => testo.split(segnaposto).join(valore);

const NOMI = ['price $$ 20.png', 'a$&b.png', 'a$`b.png', "a$'b.png"];

// ITALIANO: performSave vero, come in scripts/test-save-messages.mjs, con una cartella che rifiuta la scrittura.
// ENGLISH: the real performSave, as in scripts/test-save-messages.mjs, with a folder that refuses writes.
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = async (intestazione) => {
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) { console.log(`NO  non trovato in src/App.tsx: ${intestazione.trim()}`); process.exit(1); }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'tsx' })).code;
};
const jsSalva = await ritaglia('    const performSave = async (imagesToSave: any[]');
const muto = { log() { }, warn() { }, error() { } };
const documento = { createElement: () => ({ click() { } }), body: { appendChild() { }, removeChild() { } } };
const url = { createObjectURL: () => 'blob:finto', revokeObjectURL() { } };
const cartellaRotta = () => ({ getFileHandle: async () => { throw new DOMException('gone', 'NotFoundError'); } });
const cartellaBuona = () => ({ getFileHandle: async () => ({ createWritable: async () => ({ write: async () => { }, close: async () => { } }) }) });
const salva = async (foto) => {
    const notifiche = [];
    const f = new Function('setIsSaving', 'setImportProgress', 'showNotification', 't', 'getOrderedTagString', 'window', 'setImages', 'soundManager', 'console',
        'buildTagFileName', 'sanitizeFileName', 'sidecarTagFileName', 'document', 'URL', 'Blob', 'setTimeout', 'isUndoRedoAction', 'avvisoSalvataggioRef', 'gemelliDelTxt',
        jsSalva + '\nreturn performSave;')(() => { }, () => { }, (m, tipo) => notifiche.push([m, tipo]), t, (tags) => (tags.length ? tags.join(', ') + ',' : ''),
        {}, () => { }, { chime() { } }, muto, P.buildTagFileName, P.sanitizeFileName, P.sidecarTagFileName, documento, url, Blob, (fn) => { fn(); return 0; }, { current: false }, { current: '' }, async () => () => { });
    await f(foto);
    return notifiche[notifiche.length - 1] || null;
};
const foto = (nome, dir) => ({ id: nome, file: { name: nome }, tags: ['nuovo'], originalTags: ['vecchio'], dirHandle: dir });

console.log('\n--- «Salva Modifiche»: la foto non scritta si nomina com\'e\' ---');
for (const nome of NOMI) {
    const r = await salva([foto(nome, cartellaRotta())]);
    dice(`niente salvato, «${nome}»`, [metti(t.saveNoneSaved, '{names}', nome), 'error'], r);
    const r2 = await salva([foto('buona.png', cartellaBuona()), foto(nome, cartellaRotta())]);
    dice(`salvata 1 su 2, «${nome}»`, metti(metti(metti(t.saveSomeFailed, '{saved}', '1'), '{total}', '2'), '{names}', nome), r2 && r2[0]);
}

console.log('\n--- «Esporta (.zip)»: la foto che non si legge si nomina com\'e\' ---');
for (const nome of NOMI) {
    const sonda = creaSonda();
    const images = [{ id: nome, file: new FotoFinta(byteDi(300, 1), nome, sonda, true), tags: ['x'], isTrashed: false, dirHandle: null }];
    const r = await creaExport(images, sonda).esporta(true);
    dice(`foto illeggibile, «${nome}»`, [metti(t.zipPhotoUnreadable, '{name}', nome), 'error'], r.notifiche[r.notifiche.length - 1]);
}

console.log('\n--- avviso di fine import: i .txt saltati si nominano com\'e\' ---');
for (const nome of NOMI) {
    const a = N.avvisoImport(t, { caricate: 1, ripristinate: 0, saltati: 1, accorciati: 0, nomiSaltati: [nome] });
    dice(`.txt saltato, «${nome}»`, true, a.testo.includes(metti(t.importTxtSkippedNames, '{names}', nome)));
}

// ITALIANO: i punti che le prove qui sopra non eseguono (copie doppie, .txt non letti, editor dei file
//           di tag): ogni nome di file messo in una frase deve passare da una funzione.
// ENGLISH: the places the tests above do not run (duplicate copies, unread .txt files, tag file
//          editor): every file name put into a sentence must go through a function.
console.log('\n--- sorgenti: i nomi entrano con una funzione ---');
const nonFunzione = /\.replace\('\{names?\}', (?!\(\) => )/g;
for (const rel of ['src/App.tsx', 'src/utils/importNotice.ts', 'src/components/TagFileEditor.tsx']) {
    const testo = fs.readFileSync(path.join(radice, rel), 'utf8');
    const resti = (testo.match(nonFunzione) || []).length;
    dice(`${rel}: nessun {name}/{names} riempito con un testo semplice`, 0, resti);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = await salva([foto('normale.png', cartellaRotta())]);
    dice('un nome normale resta uguale', [metti(t.saveNoneSaved, '{names}', 'normale.png'), 'error'], r);
}

process.exit(esito());
