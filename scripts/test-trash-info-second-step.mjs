/* ITALIANO: PROVA DELLA SCRITTA IN CIMA AL CESTINO (trashInfo)
   La scritta diceva che "Svuota Cestino" sposta le foto nel Cestino di Windows "o chiede prima
   quando non e' possibile". Ma la seconda conferma esiste solo per le foto di una cartella aperta
   con "Carica Cartella": le foto caricate una per una o trascinate da una chiavetta, una scheda SD,
   una cartella di rete o un disco senza Cestino non vengono chieste, restano nel cestino del
   programma e compare l'errore deleteNoRecycleBin. Il README lo dice gia'; la scritta no.
   La regola: in tutte e nove le lingue trashInfo nomina "Ripristina", "Svuota Cestino" e
   "Carica Cartella" con le loro etichette vere, e dice che le altre foto restano nel cestino del
   programma. Si leggono i testi VERI di src/constants.ts e la riga VERA di src/App.tsx.
   Uso:  node scripts/test-trash-info-second-step.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE SENTENCE AT THE TOP OF THE TRASH (trashInfo)
   The sentence said "Empty Trash" moves the photos to the Windows Recycle Bin "or asks first when
   that is not possible". But the second confirmation only exists for photos of a folder opened
   with "Load Folder": photos loaded one by one or dropped in from a USB stick, an SD card, a
   network folder or a drive without a Recycle Bin are not asked about, they stay in the app's trash
   and the deleteNoRecycleBin error appears. The README already says so; the sentence did not.
   The rule: in all nine languages trashInfo names "Restore", "Empty Trash" and "Load Folder" with
   their real labels, and says the other photos stay in the app's trash. The REAL texts of
   src/constants.ts and the REAL line of src/App.tsx are read.
   Usage:  node scripts/test-trash-info-second-step.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const lingue = (await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'))).translations;
const LINGUE = ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'];

// ITALIANO: premessa: senza cartella aperta (niente dirHandle) un rifiuto del Cestino diventa
//           'norecycle' (errore, nessuna domanda); con la cartella aperta 'nopath' (seconda conferma).
// ENGLISH: premise: without an open folder (no dirHandle) a Recycle Bin refusal becomes
//          'norecycle' (error, no question); with the folder open 'nopath' (second confirmation).
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
dice("premessa: App.tsx chiede la seconda conferma solo con la cartella aperta", true,
    app.includes("if (esitoImg === 'rifiutato') return img.dirHandle ? 'nopath' : 'norecycle';"));

// ITALIANO: in ogni lingua, le parole che dicono "le altre restano nel cestino del programma".
// ENGLISH: in each language, the words saying "the others stay in the app's trash".
const RESTANO = {
    it: /le altre restano nel cestino del programma/,
    en: /the others stay in the app's trash/,
    fr: /les autres restent dans la corbeille du programme/,
    es: /las demás se quedan en la papelera del programa/,
    de: /Die anderen bleiben im Papierkorb des Programms/,
    zh: /其他照片会留在程序的回收站中/,
    ja: /それ以外の写真はアプリのゴミ箱に残ります/,
    pt: /as outras ficam na lixeira do programa/,
    ru: /остальные останутся в корзине программы/,
};

for (const l of LINGUE) {
    const t = lingue[l];
    const info = String(t.trashInfo || '');
    console.log(`\n--- ${l} ---`);
    dice(`${l}: trashInfo nomina "${t.restore}"`, true, info.includes(t.restore));
    dice(`${l}: trashInfo nomina "${t.emptyTrash}"`, true, info.includes(t.emptyTrash));
    dice(`${l}: trashInfo nomina "${t.loadFolder}" (la seconda conferma vale solo li')`, true, info.includes(t.loadFolder));
    dice(`${l}: trashInfo dice che le altre foto restano nel cestino del programma`, true, RESTANO[l].test(info));
}

// ITALIANO: la promessa vecchia, senza condizioni, non deve tornare.
// ENGLISH: the old promise, with no condition, must not come back.
dice('en: niente piu\' "or asks first when that is not possible"', false, /or asks first when that is not possible/.test(lingue.en.trashInfo));


// ITALIANO: dalla 2.0.1 una cartella TRASCINATA sulla finestra si apre come con «Carica Cartella»
//           (stessa cartella collegata, quindi stessa seconda conferma): le due frasi lo dicono,
//           altrimenti chi trascina la cartella crederebbe di dover passare dal pulsante.
// ENGLISH: since 2.0.1 a folder DROPPED on the window opens as with "Load Folder" (same attached
//          folder, hence the same second confirmation): both sentences say so, otherwise whoever
//          drops the folder would think the button is required.
const TRASCINATA = {
    it: [/o trascinata sulla finestra/, /o trascinala sulla finestra/],
    en: [/or dropped on the window/, /or drop it on the window/],
    fr: [/ou déposé sur la fenêtre/, /ou déposez-le sur la fenêtre/],
    es: [/o arrastrada a la ventana/, /o arrástrala a la ventana/],
    de: [/oder auf das Fenster gezogen wurde/, /oder ziehen Sie ihn auf das Fenster/],
    zh: [/或拖到窗口上的文件夹/, /或把该文件夹拖到窗口上/],
    ja: [/ウィンドウにドラッグしたフォルダー/, /ウィンドウにドラッグして/],
    pt: [/ou arrastada para a janela/, /ou arraste-a para a janela/],
    ru: [/или перетащенной в окно/, /или перетащите её в окно/],
};
console.log('\n--- la cartella trascinata conta come «Carica Cartella» ---');
for (const l of LINGUE) {
    const t = lingue[l];
    dice(`${l}: trashInfo nomina anche la cartella trascinata`, true, TRASCINATA[l][0].test(String(t.trashInfo || '')));
    dice(`${l}: deleteNoRecycleBin propone anche di trascinare la cartella, e nomina "${t.loadFolder}"`, [true, true],
        [TRASCINATA[l][1].test(String(t.deleteNoRecycleBin || '')), String(t.deleteNoRecycleBin || '').includes(t.loadFolder)]);
}
const readme = fs.readFileSync(path.join(radice, 'README.md'), 'utf8');
dice('README: la seconda conferma vale anche per una cartella trascinata', true, /opened with \*\*Load Folder\*\* or dropped on the window/.test(readme));

process.exit(esito());
