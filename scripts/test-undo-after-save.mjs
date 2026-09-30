/* ITALIANO: PROVA DI Ctrl+Z DOPO UN SALVATAGGIO
   Una foto con il tag "a" riceveva "b", si premeva "Salva modifiche" (su disco: "a, b,") e poi
   Ctrl+Z due volte per togliere "b". La card mostrava "a", ma l'app riportava indietro anche il
   suo ricordo di cosa c'e' su disco (originalTags, che sta in ogni passo della cronologia): da li'
   "Salva modifiche" rispondeva "Nessuna modifica da salvare." e "Chiudi progetto" non avvisava,
   mentre il .txt conteneva ancora "a, b,". Lo stesso dopo il "Salva file .txt" del visualizzatore
   e dopo un salvataggio dall'editor di tag. La regola: Ctrl+Z e Ctrl+Shift+Z cambiano i tag, non
   quello che c'e' su disco; una foto diversa dal suo .txt risulta sempre da salvare.
   Si eseguono i testi VERI presi da src/App.tsx (vedi undo-harness.mjs).
   Uso:  node scripts/test-undo-after-save.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF Ctrl+Z AFTER A SAVE
   A photo tagged "a" got "b", "Save changes" was pressed (on disk: "a, b,") and then Ctrl+Z twice
   to remove "b". The card showed "a", but the app also rolled back its record of what is on disk
   (originalTags, which sits in every history step): from there "Save changes" answered "No
   changes to save." and "Close project" gave no warning, while the .txt still held "a, b,". The
   same after the viewer's "Save .txt file" and after a save from the tag editor. The rule: Ctrl+Z
   and Ctrl+Shift+Z change the tags, not what is on disk; a photo that differs from its .txt always
   counts as unsaved.
   The REAL code taken from src/App.tsx is run (see undo-harness.mjs).
   Usage:  node scripts/test-undo-after-save.mjs      (exits with code 1 if anything is off) */

import { creaApp, cartellaFinta, foto, t, cronologia } from './undo-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

console.log('\n--- la regola pura (src/utils/historyUtils.ts) ---');
{
    const { withLiveOriginalTags } = cronologia;
    dice('la regola esiste', 'function', typeof withLiveOriginalTags);
    if (typeof withLiveOriginalTags === 'function') {
        const uguale = { id: 'U', tags: ['x'], originalTags: ['x'] };
        const passo = [uguale, { id: 'P', tags: ['a'], originalTags: ['a'] }, { id: 'C', tags: ['z'], originalTags: ['z'] }];
        const adesso = [uguale, { id: 'P', tags: ['a', 'b'], originalTags: ['a', 'b'] }];
        const fuori = withLiveOriginalTags(passo, adesso);
        dice('i tag vengono dal passo, il ricordo del disco dalle foto di adesso', [['a'], ['a', 'b']], [fuori[1].tags, fuori[1].originalTags]);
        dice('una foto che adesso non c\'e\' tiene il valore del suo passo', ['z'], fuori[2].originalTags);
        dice('una foto che non cambia resta lo stesso oggetto (la card non si ridisegna)', true, fuori[0] === uguale);
        dice('il passo salvato nella cronologia non viene toccato', ['a'], passo[1].originalTags);
    }
}

// ITALIANO: "Salva modifiche" e "Chiudi progetto" come li vede l'utente adesso.
// ENGLISH: "Save changes" and "Close project" as the user sees them now.
const salvaEChiudi = async (app, cartella) => {
    const primaScritti = new Map(cartella.scritti);
    const notifiche = app.notifiche.length;
    await app.render().handleSaveChanges();
    await app.attendi();
    const nuovi = [...cartella.scritti].filter(([k, v]) => primaScritti.get(k) !== v).map(([k, v]) => `${k}=${v}`);
    const messaggi = app.notifiche.slice(notifiche).map(([m]) => m);
    return { nuovi, nessunaModifica: messaggi.includes(t.noChanges) };
};
const avvisaChiudendo = async (app) => {
    app.render().handleCloseProject();
    await app.attendi();
    const avviso = Boolean(app.stato.saveCloseDialog && app.stato.saveCloseDialog.isOpen);
    app.stato.saveCloseDialog = { isOpen: false };
    app.stato.confirmDialog = { isOpen: false };
    return avviso;
};
const ctrlZ = async (app, volte = 1) => { for (let i = 0; i < volte; i++) { app.render().handleUndo(); await app.attendi(); } };
const ctrlShiftZ = async (app, volte = 1) => { for (let i = 0; i < volte; i++) { app.render().handleRedo(); await app.attendi(); } };

// ITALIANO: import di P ("a"), poi l'utente aggiunge "b".
// ENGLISH: import of P ("a"), then the user adds "b".
const prepara = async () => {
    const cartella = cartellaFinta();
    cartella.scritti.set('P.txt', 'a,');
    const app = creaApp([foto('P', ['a'], cartella)]);
    app.importa();
    await app.attendi();
    app.modifica(prev => prev.map(i => (i.id === 'P' ? { ...i, tags: ['a', 'b'] } : i)));
    await app.attendi();
    return { app, cartella };
};

console.log('\n--- "Salva modifiche", poi Ctrl+Z fino a togliere "b" ---');
{
    const { app, cartella } = await prepara();
    const primo = await salvaEChiudi(app, cartella);
    dice('il salvataggio scrive "a, b," nel .txt', ['P.txt=a, b,'], primo.nuovi);
    await ctrlZ(app, 2);
    dice('dopo due Ctrl+Z la card mostra "a"', ['a'], app.fotoCon('P').tags);
    dice('"Chiudi progetto" avvisa che ci sono modifiche non salvate (il .txt dice ancora "a, b,")', true, await avvisaChiudendo(app));
    const secondo = await salvaEChiudi(app, cartella);
    dice('"Salva modifiche" NON risponde "Nessuna modifica da salvare."', false, secondo.nessunaModifica);
    dice('"Salva modifiche" riscrive il .txt con "a,"', ['P.txt=a,'], secondo.nuovi);
}

console.log('\n--- Ctrl+Shift+Z dopo il salvataggio: si torna a una foto uguale al disco ---');
{
    const { app, cartella } = await prepara();
    await salvaEChiudi(app, cartella);
    await ctrlZ(app, 2);
    await ctrlShiftZ(app, 2);
    dice('dopo due Ctrl+Shift+Z la card mostra di nuovo "a, b"', ['a', 'b'], app.fotoCon('P').tags);
    dice('e non risulta niente da salvare: il .txt dice gia\' "a, b,"', false, await avvisaChiudendo(app));
    const r = await salvaEChiudi(app, cartella);
    dice('"Salva modifiche" non scrive niente', [], r.nuovi);
}

console.log('\n--- "Salva file .txt" del visualizzatore, poi Ctrl+Z ---');
{
    const { app, cartella } = await prepara();
    // ITALIANO: il visualizzatore scrive il file da se' e poi chiama updateOriginalTags.
    // ENGLISH: the viewer writes the file on its own and then calls updateOriginalTags.
    cartella.scritti.set('P.txt', 'a, b,');
    app.render().updateOriginalTags('P', ['a', 'b']);
    await app.attendi();
    await ctrlZ(app, 2);
    dice('dopo Ctrl+Z la card mostra "a"', ['a'], app.fotoCon('P').tags);
    dice('"Chiudi progetto" avvisa', true, await avvisaChiudendo(app));
    const r = await salvaEChiudi(app, cartella);
    dice('"Salva modifiche" riscrive il .txt con "a,"', ['P.txt=a,'], r.nuovi);
}

console.log('\n--- l\'editor di tag salva il .txt della foto, poi Ctrl+Z ---');
{
    const { app, cartella } = await prepara();
    // ITALIANO: nell'editor l'utente apre P.txt, lo cambia in "a, c" e lo salva.
    // ENGLISH: in the editor the user opens P.txt, changes it to "a, c" and saves it.
    cartella.scritti.set('P.txt', 'a, c,');
    await app.render().handleTagEditorSaved('P.txt', ['a', 'c'], { isSameEntry: async (h) => h && h.nome === 'P.txt' });
    await app.attendi();
    dice('la foto prende i tag del file salvato', ['a', 'c'], app.fotoCon('P').tags);
    await ctrlZ(app, 2);
    dice('dopo due Ctrl+Z la card mostra "a"', ['a'], app.fotoCon('P').tags);
    dice('"Chiudi progetto" avvisa (il .txt dice "a, c,")', true, await avvisaChiudendo(app));
    const r = await salvaEChiudi(app, cartella);
    dice('"Salva modifiche" riscrive il .txt con "a,"', ['P.txt=a,'], r.nuovi);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const { app, cartella } = await prepara();
    await ctrlZ(app);
    dice('una modifica mai salvata e poi annullata: la foto e\' di nuovo uguale al disco', false, await avvisaChiudendo(app));
    const r = await salvaEChiudi(app, cartella);
    dice('e "Salva modifiche" risponde "Nessuna modifica da salvare."', [[], true], [r.nuovi, r.nessunaModifica]);
    await ctrlZ(app);
    dice('Ctrl+Z oltre l\'import svuota la galleria come prima', [], app.stato.images.map(i => i.id));
    await ctrlShiftZ(app);
    dice('e Ctrl+Shift+Z la riporta', ['P'], app.stato.images.map(i => i.id));
}

process.exit(esito());
