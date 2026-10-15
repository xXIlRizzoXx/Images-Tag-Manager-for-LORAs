/* ITALIANO: PROVA DELL'EDITOR DEI FILE DI TAG CON MODIFICHE NON SALVATE SULLA CARD
   Su disco la foto ha "smile, hat". In galleria l'utente aggiunge "blue eyes" e toglie "hat",
   senza salvare. Poi apre lo stesso .txt nell'editor dei file di tag, che mostra solo il disco
   ("smile, hat"), aggiunge "red dress" e salva. La foto prendeva il file sia come tag sia come
   disco: "blue eyes" spariva, "hat" tornava, la foto risultava salvata, e nessun avviso. La regola:
   il file salvato diventa il disco, e sopra si rimettono le modifiche della card non ancora salvate
   (tag aggiunti e tolti, senza badare alle maiuscole); "Salva modifiche" poi le scrive.
   Si esegue il testo VERO di handleTagEditorSaved preso da src/App.tsx, con la regola vera di
   src/utils/sidecarTags.ts (compilati con esbuild) e una cartella finta.
   Uso:  node scripts/test-tag-editor-keeps-card-edits.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE TAG FILE EDITOR WITH UNSAVED EDITS ON THE CARD
   On disk the photo has "smile, hat". In the gallery the user adds "blue eyes" and removes "hat",
   without saving. Then they open the same .txt in the tag file editor, which shows only the disk
   ("smile, hat"), add "red dress" and save. The photo took the file both as tags and as disk: "blue
   eyes" vanished, "hat" came back, the photo counted as saved, and no notice. The rule: the saved
   file becomes the disk, and the card's edits not saved yet (tags added and removed, regardless of
   case) are put back on top; "Save changes" then writes them.
   The REAL text of handleTagEditorSaved taken from src/App.tsx is run, with the real rule of
   src/utils/sidecarTags.ts (compiled with esbuild) and a fake folder.
   Usage:  node scripts/test-tag-editor-keeps-card-edits.mjs      (exits with code 1 if anything is off) */

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

const sidecar = { nome: 'p.txt' };
const cartella = { getFileHandle: async (nome) => { if (nome !== 'p.txt') throw new Error('not found'); return sidecar; } };
const salvato = { isSameEntry: async (h) => h === sidecar };
// ITALIANO: l'editor salva `nuovi` in p.txt; torna la foto come la vede la galleria dopo.
// ENGLISH: the editor saves `nuovi` into p.txt; returns the photo as the gallery sees it afterwards.
const salvaNellEditor = async (tags, originalTags, nuovi, trigger = [], altro = {}) => {
    let stato = [{ id: 'p', file: { name: 'p.png' }, dirHandle: cartella, tags, originalTags, ...altro }];
    const f = new Function('images', 'setImages', 'globalTriggers', 'tagDopoEditor', codice + '\nreturn handleTagEditorSaved;')(
        stato, (agg) => { stato = typeof agg === 'function' ? agg(stato) : agg; }, trigger, S.tagDopoEditor);
    await f('p.txt', nuovi, salvato);
    return stato[0];
};
const daSalvare = (p) => JSON.stringify(p.tags) !== JSON.stringify(p.originalTags);

console.log('\n--- card: +"blue eyes" -"hat" non salvati; l\'editor salva "smile, hat, red dress" ---');
{
    const p = await salvaNellEditor(['smile', 'blue eyes'], ['smile', 'hat'], ['smile', 'hat', 'red dress']);
    dice('la card tiene "blue eyes", "hat" resta tolto, arriva "red dress"', ['smile', 'red dress', 'blue eyes'], p.tags);
    dice('il ricordo del disco e\' il file scritto dall\'editor', ['smile', 'hat', 'red dress'], p.originalTags);
    dice('la foto risulta da salvare, cosi\' "Salva modifiche" scrive le modifiche della card', true, daSalvare(p));
}

console.log('\n--- le modifiche della card si confrontano senza maiuscole ---');
{
    const p = await salvaNellEditor(['Smile', 'Blue Eyes'], ['smile', 'hat'], ['smile', 'hat', 'blue eyes']);
    dice('"Blue Eyes" gia\' nel file non si raddoppia; "hat" tolto sulla card resta tolto', ['smile', 'blue eyes'], p.tags);
}

console.log('\n--- con una trigger ancora da salvare ---');
{
    const p = await salvaNellEditor(['ohwx', 'smile', 'blue eyes'], ['smile'], ['smile', 'hat'], ['ohwx']);
    dice('trigger davanti, poi il file, poi l\'aggiunta della card', ['ohwx', 'smile', 'hat', 'blue eyes'], p.tags);
    dice('disco = file', ['smile', 'hat'], p.originalTags);
    // ITALIANO: la trigger tolta a mano da questa sola card, mentre il file la contiene ancora.
    // ENGLISH: the trigger removed by hand from this one card, while the file still holds it.
    const q = await salvaNellEditor(['smile'], ['ohwx', 'smile'], ['ohwx', 'smile', 'hat'], ['ohwx']);
    dice('una trigger tolta a mano dalla card resta tolta, e Salva lo scrivera\'', [['smile', 'hat'], ['ohwx', 'smile', 'hat'], true], [q.tags, q.originalTags, daSalvare(q)]);
}

console.log('\n--- .txt non letto all\'import con la trigger "ohwx" attiva, poi salvato nell\'editor ---');
{
    // ITALIANO: come la segna l'import (processImportData): baseTxtNonLetto e' il ricordo del disco
    //           di allora, cioe' le sole trigger, che nel .txt non sono mai state scritte.
    // ENGLISH: as the import marks it (processImportData): baseTxtNonLetto is the disk record of that
    //          time, i.e. only the triggers, which were never written into the .txt.
    const imp = S.tagDiImport(['ohwx'], [], true);
    const p = await salvaNellEditor(imp.tags, imp.originalTags, ['girl', 'red hair', 'smile'], ['ohwx'], { baseTxtNonLetto: imp.originalTags });
    dice('la trigger resta davanti, il disco e\' il file, e la foto resta da salvare',
        [['ohwx', 'girl', 'red hair', 'smile'], ['girl', 'red hair', 'smile'], true], [p.tags, p.originalTags, S.fotoDaSalvare(p, ['ohwx'])]);
    const imp2 = S.tagDiImport(['ohwx'], [], true);
    const q = await salvaNellEditor(['ohwx', 'cat'], imp2.originalTags, ['girl'], ['ohwx'], { baseTxtNonLetto: imp2.originalTags });
    dice('...con un tag aggiunto sulla card prima: resta anche quello', [['ohwx', 'girl', 'cat'], ['girl']], [q.tags, q.originalTags]);
    const imp3 = S.tagDiImport(['ohwx'], [], true);
    const r = await salvaNellEditor([], imp3.originalTags, ['girl'], ['ohwx'], { baseTxtNonLetto: imp3.originalTags });
    dice('la trigger tolta a mano dalla card prima dell\'editor resta tolta', [['girl'], ['girl'], false], [r.tags, r.originalTags, S.fotoDaSalvare(r, ['ohwx'])]);
    const imp4 = S.tagDiImport(['ohwx'], [], true);
    const u = await salvaNellEditor(imp4.tags, imp4.originalTags, ['ohwx', 'girl'], ['ohwx'], { baseTxtNonLetto: imp4.originalTags });
    dice('il file salvato ha gia\' la trigger: niente da salvare', [['ohwx', 'girl'], ['ohwx', 'girl'], false], [u.tags, u.originalTags, S.fotoDaSalvare(u, ['ohwx'])]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const p = await salvaNellEditor(['smile', 'hat'], ['smile', 'hat'], ['smile', 'red dress']);
    dice('card senza modifiche: la foto prende il file e risulta salvata', [['smile', 'red dress'], ['smile', 'red dress'], false], [p.tags, p.originalTags, daSalvare(p)]);
    const q = await salvaNellEditor(['smile', 'hat'], ['smile', 'hat'], ['smile']);
    dice('un tag tolto nell\'editor resta tolto', [['smile'], false], [q.tags, daSalvare(q)]);
    const r = await salvaNellEditor(['ohwx', 'smile'], ['ohwx', 'smile'], ['smile'], ['ohwx']);
    dice('una trigger che il file aveva, tolta nell\'editor, resta tolta', [['smile'], ['smile'], false], [r.tags, r.originalTags, daSalvare(r)]);
}

process.exit(esito());
