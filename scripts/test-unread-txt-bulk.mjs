/* ITALIANO: PROVA DI UN .TXT NON LETTO ALL'IMPORT, POI TAG IN BLOCCO, INCOLLA O AI, POI SALVA
   Un .txt che c'e' ma non si legge (oltre 1 MB, bloccato, un file di OneDrive solo in rete con il PC
   offline) viene saltato dall'import: la foto appare senza tag. Bastava aggiungere un tag a tutte
   (o incollare, o "Tagga tutte con AI" con "Salta foto gia' taggate" acceso, che non la saltava
   perche' sembrava senza tag) e premere Salva: il suo .txt vero, mai letto, veniva sostituito dai
   soli tag nuovi (con OneDrive anche nel cloud). La regola: "Salva modifiche" (e "Salva e chiudi")
   non scrive sopra un .txt che non ha potuto leggere, e lo dice con i nomi; "Salta foto gia'
   taggate" la conta fra quelle che hanno gia' dei tag.
   Si eseguono i testi VERI di performSave, handleSaveChanges e handleAITagAll presi da src/App.tsx
   (banchi undo-harness.mjs e ai-batch-harness.mjs), con le regole vere di src/utils e i testi veri.
   Uso:  node scripts/test-unread-txt-bulk.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF A .TXT NOT READ AT IMPORT, THEN BULK TAGS, PASTE OR AI, THEN SAVE
   A .txt that exists but cannot be read (over 1 MB, locked, a OneDrive online-only file with the PC
   offline) is skipped by the import: the photo shows no tags. Adding a tag to all photos (or
   pasting, or "Auto-tag all with AI" with "Skip already-tagged photos" on, which did not skip it
   because it looked untagged) and pressing Save was enough: its real .txt, never read, was replaced
   by the new tags alone (with OneDrive in the cloud too). The rule: "Save changes" (and "Save and
   close") does not write over a .txt it could not read, and says so with the names; "Skip
   already-tagged photos" counts it among those that already have tags.
   The REAL text of performSave, handleSaveChanges and handleAITagAll taken from src/App.tsx is run
   (benches undo-harness.mjs and ai-batch-harness.mjs), with the real rules of src/utils and the
   real strings.
   Usage:  node scripts/test-unread-txt-bulk.mjs      (exits with code 1 if anything is off) */

import { creaApp, cartellaFinta, foto, t } from './undo-harness.mjs';
import { nuovaApp, BUONA } from './ai-batch-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

// ITALIANO: b.png col .txt non letto (come la segna l'import: baseTxtNonLetto = i tag di allora),
//           c.png col .txt letto. `trigger` = la trigger attiva all'import.
// ENGLISH: b.png with the unread .txt (as the import marks it: baseTxtNonLetto = the tags of that
//          time), c.png with the .txt read. `trigger` = the trigger active at import.
const progetto = async (trigger = []) => {
    const cartella = cartellaFinta();
    // ITALIANO: come l'import, baseTxtNonLetto e' lo stesso array di originalTags (vedi txtNonLettoInVigore).
    // ENGLISH: as the import does, baseTxtNonLetto is the same array as originalTags (see txtNonLettoInVigore).
    const b0 = foto('b', [...trigger], cartella);
    const b = { ...b0, baseTxtNonLetto: b0.originalTags };
    const c = foto('c', [...trigger, 'blue sky'], cartella);
    const app = creaApp([b, c], { trigger });
    app.importa();
    await app.attendi();
    app.cartella = cartella;
    app.aggiungiATutte = async (tag) => { app.modifica(prev => prev.map(i => ({ ...i, tags: [...i.tags, tag] }))); await app.attendi(); };
    app.salva = async () => { cartella.scritti.clear(); const ok = await app.render().handleSaveChanges(); await app.attendi(); return ok; };
    return app;
};
const scritti = (app) => [...app.cartella.scritti.keys()].sort();
const ultima = (app) => app.notifiche[app.notifiche.length - 1] || ['', ''];

console.log('\n--- .txt non letto, poi un tag aggiunto a tutte le foto, poi Salva ---');
{
    const app = await progetto();
    await app.aggiungiATutte('masterpiece');
    const ok = await app.salva();
    dice('Salva scrive solo il .txt letto, non quello mai letto', ['c.txt'], scritti(app));
    dice('l\'avviso nomina la foto rimasta fuori', true, ultima(app)[0].includes('b.png'));
    dice('...e non e\' un avviso di successo', 'info', ultima(app)[1]);
    dice('Salva risponde "non tutto salvato": "Salva e chiudi" non chiude il progetto', false, ok);
    dice('la foto resta da salvare', ['masterpiece'], app.fotoCon('b').tags);
}
{
    const app = await progetto(['ohwx']);
    await app.aggiungiATutte('masterpiece');
    await app.salva();
    dice('con la trigger attiva all\'import: stessa regola', ['c.txt'], scritti(app));
}
{
    // ITALIANO: solo la foto col .txt non letto e' modificata: niente da scrivere, ma lo si dice.
    // ENGLISH: only the photo with the unread .txt is edited: nothing to write, but it is said.
    const app = await progetto();
    app.modifica(prev => prev.map(i => i.id === 'b' ? { ...i, tags: ['pasted', 'tags'] } : i));
    await app.attendi();
    const ok = await app.salva();
    dice('solo lei modificata: nessun file scritto', [], scritti(app));
    dice('...l\'avviso la nomina (non "Nessuna modifica")', [true, false], [ultima(app)[0].includes('b.png'), ultima(app)[0] === t.noChanges]);
    dice('...e Salva risponde "non tutto salvato"', false, ok);
}

console.log('\n--- "Tagga tutte con AI" con "Salta foto gia\' taggate" acceso ---');
{
    const ai = nuovaApp([{ id: 'b' }, { id: 'c' }], () => BUONA, { skip: true });
    const disco = [];
    Object.assign(ai.foto[0], { originalTags: disco, baseTxtNonLetto: disco });
    Object.assign(ai.foto[1], { originalTags: [] });
    await ai.tutte();
    dice('la foto col .txt non letto e\' saltata, quella senza tag no', [1, [], ['cat', 'sofa']], [ai.chiamate(), ai.foto[0].tags, ai.foto[1].tags]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const ai = nuovaApp([{ id: 'b' }], () => BUONA, { skip: false });
    const disco = [];
    Object.assign(ai.foto[0], { originalTags: disco, baseTxtNonLetto: disco });
    await ai.tutte();
    dice('con "Salta" spento la foto col .txt non letto si tagga (poi Salva non la scrive)', 1, ai.chiamate());
}
{
    // ITALIANO: il .txt e' stato scritto in questa sessione (ricordo del disco diverso da quello
    //           dell'import): ora e' noto, e Salva lo riscrive come sempre.
    // ENGLISH: the .txt was written in this session (disk record different from the import's): it
    //          is known now, and Save rewrites it as always.
    const app = await progetto();
    app.modifica(prev => prev.map(i => i.id === 'b' ? { ...i, originalTags: ['cat'], tags: ['cat', 'smile'] } : i));
    await app.attendi();
    await app.salva();
    dice('.txt gia\' scritto in questa sessione: Salva lo riscrive', ['b.txt'], scritti(app));
}
{
    const app = await progetto(['ohwx']);
    app.modifica(prev => prev.map(i => i.id === 'c' ? { ...i, tags: [...i.tags, 'smile'] } : i));
    await app.attendi();
    const ok = await app.salva();
    dice('nessuna foto col .txt non letto modificata: Salva come prima', [['c.txt'], true, 'success'], [scritti(app), ok, ultima(app)[1]]);
}
{
    const app = await progetto();
    const ok = await app.salva();
    dice('niente da salvare: "Nessuna modifica" come prima', [t.noChanges, true], [ultima(app)[0], ok]);
}

process.exit(esito());
