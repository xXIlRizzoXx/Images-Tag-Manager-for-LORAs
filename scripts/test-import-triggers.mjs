/* ITALIANO: PROVA DELLE TRIGGER WORD GIA' ATTIVE QUANDO SI AGGIUNGONO FOTO
   Con una trigger word gia' scritta, le foto aggiunte dopo (con "Carica immagini", trascinandole
   o aprendo una seconda cartella) la mostravano davanti ai loro tag, ma il programma la contava
   come se fosse GIA' nel loro .txt: "Salva modifiche" rispondeva "Nessuna modifica" e i .txt
   restavano senza trigger word, mentre lo schermo diceva il contrario.
   Si prova la regola VERA di src/utils/sidecarTags.ts (compilata al volo con esbuild), con la
   stessa prova di "Salva modifiche" su cosa e' da salvare.
   Uso:  node scripts/test-import-triggers.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF TRIGGER WORDS ALREADY ACTIVE WHEN PHOTOS ARE ADDED
   With a trigger word already typed, the photos added afterwards ("Load images", drag and drop,
   or a second folder) showed it in front of their tags, but the program counted it as ALREADY in
   their .txt: "Save changes" answered "No changes" and the .txt files stayed without the trigger
   word, while the screen said otherwise.
   The REAL rule of src/utils/sidecarTags.ts is tested (compiled on the fly with esbuild), with the
   same test "Save changes" uses to decide what needs saving.
   Usage:  node scripts/test-import-triggers.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/sidecarTags.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const S = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
const { dice, esito } = creaControlli();

// ITALIANO: la prova di handleSaveChanges in App.tsx: da salvare se tags e originalTags differiscono.
// ENGLISH: handleSaveChanges' test in App.tsx: to be saved when tags and originalTags differ.
const daSalvare = (r) => JSON.stringify(r.tags) !== JSON.stringify(r.originalTags);

console.log('\n--- trigger attiva, il .txt non la contiene ---');
{
    const r = S.tagDiImport(['mychar'], ['1girl', 'smile']);
    dice('la foto mostra la trigger davanti', ['mychar', '1girl', 'smile'], r.tags);
    dice('originalTags = quello che c\'e\' davvero nel .txt', ['1girl', 'smile'], r.originalTags);
    dice('"Salva modifiche" la scrive', true, daSalvare(r));
}

console.log('\n--- trigger attiva, foto senza .txt ---');
{
    const r = S.tagDiImport(['mychar'], []);
    dice('tags = la sola trigger, originalTags vuoto', [['mychar'], []], [r.tags, r.originalTags]);
    dice('"Salva modifiche" crea il .txt con la trigger', true, daSalvare(r));
}

// ITALIANO: un .txt che c'e' ma non si e' potuto leggere (oltre 1 MB, bloccato, un file di OneDrive
//           solo in rete): il suo contenuto non si conosce. Contarlo come "foto senza .txt" faceva
//           scrivere al primo "Salva modifiche" la sola trigger SOPRA il file vero, cancellandolo.
// ENGLISH: a .txt that exists but could not be read (over 1 MB, locked, a OneDrive online-only
//          file): its content is unknown. Counting it as "photo with no .txt" made the first "Save
//          changes" write the trigger alone OVER the real file, wiping it.
console.log('\n--- trigger attiva, il .txt c\'e\' ma non si e\' potuto leggere ---');
{
    const r = S.tagDiImport(['mychar'], [], true);
    dice('la foto mostra la trigger', ['mychar'], r.tags);
    dice('"Salva modifiche" non la conta come modificata: il .txt non letto resta intatto', false, daSalvare(r));
    // ITALIANO: App.tsx deve segnare i .txt saltati e passarlo all'import di ogni foto.
    // ENGLISH: App.tsx must record the skipped .txt files and pass that on to each photo's import.
    const app = (await import('node:fs')).readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
    const segnati = (app.match(/txtNonLetti\.add\(folderKeyOf\(txtFiles\[i\]\)\)/g) || []).length;
    dice('App.tsx: i .txt saltati (troppo grandi e illeggibili) vengono segnati', 2, segnati);
    dice('App.tsx: l\'import di ogni foto sa se il suo .txt non e\' stato letto', true,
        /tagDiImport\(globalTriggers, textMap\.get\(([^)]+\))\) \|\| \[\], txtNonLetti\.has\(\1\)\)/.test(app));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const gia = S.tagDiImport(['mychar'], ['1girl', 'mychar', 'smile']);
    dice('il .txt ha gia\' la trigger (altrove): stesso ordine, niente da salvare', [['mychar', '1girl', 'smile'], false], [gia.tags, daSalvare(gia)]);
    const due = S.tagDiImport(['a', 'b'], ['x', 'b']);
    dice('due trigger, il .txt ne ha una: tags e originalTags', [['a', 'b', 'x'], ['b', 'x']], [due.tags, due.originalTags]);
    const senza = S.tagDiImport([], ['1girl', 'smile']);
    dice('nessuna trigger attiva: identici, niente da salvare', [['1girl', 'smile'], ['1girl', 'smile'], false], [senza.tags, senza.originalTags, daSalvare(senza)]);
    const vuota = S.tagDiImport([], []);
    dice('nessuna trigger e nessun .txt: niente da salvare', false, daSalvare(vuota));
}

process.exit(esito());
