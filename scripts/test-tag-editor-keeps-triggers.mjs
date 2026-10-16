/* ITALIANO: PROVA DELL'EDITOR DEI FILE DI TAG CON UNA TRIGGER WORD ANCORA DA SALVARE
   Con la trigger "ohwx" attiva, una foto il cui .txt non la contiene ancora la mostra davanti ai
   suoi tag, e "Salva modifiche" la scrive. L'editor dei file di tag pero' mostra solo quello che
   c'e' su disco: salvando da li' il .txt di quella foto, la foto prendeva i tag del file sia come
   tag sia come "cosa c'e' su disco". La trigger spariva dalla card, "Salva modifiche" rispondeva
   "Nessuna modifica" e il .txt restava senza, mentre il riquadro delle trigger la mostrava attiva.
   La regola: la trigger ancora da salvare resta sulla foto (e "Salva modifiche" la scrive), una
   trigger che il file aveva e che l'utente ha tolto nell'editor resta tolta, e due grafie dello
   stesso tag diventano una. Il ricordo del disco e' quello che l'editor ha scritto.
   Si esegue il testo VERO di handleTagEditorSaved preso da src/App.tsx, con la regola vera di
   src/utils/sidecarTags.ts (compilati con esbuild) e una cartella finta.
   Uso:  node scripts/test-tag-editor-keeps-triggers.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE TAG FILE EDITOR WITH A TRIGGER WORD STILL TO BE SAVED
   With the trigger "ohwx" active, a photo whose .txt does not hold it yet shows it in front of its
   tags, and "Save changes" writes it. The tag file editor, though, only shows what is on disk:
   saving that photo's .txt from there gave the photo the file's tags both as tags and as "what is
   on disk". The trigger vanished from the card, "Save changes" answered "No changes" and the .txt
   stayed without it, while the trigger box showed it as active.
   The rule: a trigger still to be saved stays on the photo (and "Save changes" writes it), a
   trigger the file had and the user removed in the editor stays removed, and two spellings of the
   same tag become one. The disk record is what the editor wrote.
   The REAL text of handleTagEditorSaved taken from src/App.tsx is run, with the real rule of
   src/utils/sidecarTags.ts (compiled with esbuild) and a fake folder.
   Usage:  node scripts/test-tag-editor-keeps-triggers.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/sidecarTags.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const S = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const handleTagEditorSaved = async ');
const fine = /\r?\n    \};\r?\n/g;
fine.lastIndex = Math.max(inizio, 0);
const trovata = inizio >= 0 ? fine.exec(sorgente) : null;
if (!trovata) { console.log('NO  handleTagEditorSaved non trovato in src/App.tsx'); process.exit(1); }
const codice = (await esbuild.transform(sorgente.slice(inizio, trovata.index + trovata[0].length), { loader: 'ts' })).code;

// ITALIANO: la cartella della foto: getFileHandle('p.txt') da' il suo sidecar, e il file salvato
//           dall'editor E' quel sidecar (isSameEntry).
// ENGLISH: the photo's folder: getFileHandle('p.txt') gives its sidecar, and the file saved by
//          the editor IS that sidecar (isSameEntry).
const sidecar = { nome: 'p.txt' };
const cartella = { getFileHandle: async (nome) => { if (nome !== 'p.txt') throw new Error('not found'); return sidecar; } };
const salvato = { isSameEntry: async (h) => h === sidecar };
// ITALIANO: l'editor salva `nuovi` in p.txt; torna la foto come la vede la galleria dopo.
// ENGLISH: the editor saves `nuovi` into p.txt; returns the photo as the gallery sees it afterwards.
const salvaNellEditor = async (tags, originalTags, nuovi, trigger) => {
    let stato = [{ id: 'p', file: { name: 'p.png' }, dirHandle: cartella, tags, originalTags }];
    const f = new Function('images', 'setImages', 'globalTriggers', 'tagDopoEditor', codice + '\nreturn handleTagEditorSaved;')(
        stato, (agg) => { stato = typeof agg === 'function' ? agg(stato) : agg; }, trigger, S.tagDopoEditor);
    await f('p.txt', nuovi, salvato);
    return stato[0];
};
const daSalvare = (p) => JSON.stringify(p.tags) !== JSON.stringify(p.originalTags);

console.log('\n--- trigger "ohwx" non ancora nel .txt, l\'editor salva "smile, hat" ---');
{
    const p = await salvaNellEditor(['ohwx', 'smile'], ['smile'], ['smile', 'hat'], ['ohwx']);
    dice('la card tiene la trigger davanti, poi i tag salvati', ['ohwx', 'smile', 'hat'], p.tags);
    dice('il ricordo del disco e\' quello che l\'editor ha scritto', ['smile', 'hat'], p.originalTags);
    dice('"Salva modifiche" scrivera\' la trigger', true, daSalvare(p));
}

console.log('\n--- il .txt aveva la trigger e l\'utente la toglie nell\'editor ---');
{
    const p = await salvaNellEditor(['ohwx', 'smile'], ['ohwx', 'smile'], ['smile'], ['ohwx']);
    dice('resta tolta: la foto e\' uguale al file', [['smile'], ['smile'], false], [p.tags, p.originalTags, daSalvare(p)]);
}

console.log('\n--- l\'editor salva la trigger con un\'altra grafia ---');
{
    const p = await salvaNellEditor(['OHWX', 'smile'], ['smile'], ['ohwx', 'smile'], ['OHWX']);
    dice('una sola, con la grafia del riquadro', ['OHWX', 'smile'], p.tags);
    dice('il ricordo del disco resta quello vero, quindi Salva riscrive il .txt pulito', [['ohwx', 'smile'], true], [p.originalTags, daSalvare(p)]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const gia = await salvaNellEditor(['ohwx', 'smile'], ['smile'], ['ohwx', 'smile', 'hat'], ['ohwx']);
    dice('il file salvato ha gia\' la trigger davanti: niente da salvare', [['ohwx', 'smile', 'hat'], false], [gia.tags, daSalvare(gia)]);
    const senza = await salvaNellEditor(['smile', 'blue eyes'], ['smile'], ['smile', 'hat'], []);
    // ITALIANO: l'aggiunta non salvata della card ("blue eyes") resta sopra il file (vedi
    //           test-tag-editor-keeps-card-edits.mjs); prima spariva.
    // ENGLISH: the card's unsaved addition ("blue eyes") stays on top of the file (see
    //          test-tag-editor-keeps-card-edits.mjs); it used to vanish.
    dice('nessuna trigger: il file salvato, piu\' l\'aggiunta non salvata della card', [['smile', 'hat', 'blue eyes'], ['smile', 'hat']], [senza.tags, senza.originalTags]);
    // ITALIANO: una trigger tolta a mano da questa sola foto non torna.
    // ENGLISH: a trigger removed by hand from this one photo does not come back.
    const tolta = await salvaNellEditor(['smile'], ['smile'], ['smile', 'hat'], ['ohwx']);
    dice('una trigger tolta a mano da questa foto non torna', ['smile', 'hat'], tolta.tags);
}

process.exit(esito());
