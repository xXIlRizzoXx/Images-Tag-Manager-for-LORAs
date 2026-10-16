/* ITALIANO: PROVA DI "SVUOTA CESTINO" CONTRO UNA FOTO RIPRISTINATA NEL FRATTEMPO
   Lo svuotamento lavorava sull'elenco del momento in cui si era premuto "Svuota": una foto
   ripristinata DOPO (con il suo "Ripristina" durante lo svuotamento, che per centinaia di foto
   dura parecchi secondi, o con Ctrl+Z mentre la conferma era aperta) finiva lo stesso nel
   Cestino di Windows e spariva anche dalla galleria. Lo stesso per la X su una foto con Ctrl+Z
   prima di confermare. La scelta esplicita dell'utente veniva scavalcata in silenzio. La regola:
   si svuota solo cio' che nel cestino dell'app c'e' ANCORA, e durante lo svuotamento i tasti
   delle singole foto sono spenti come quelli in alto.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-empty-trash-live.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "EMPTY TRASH" AGAINST A PHOTO RESTORED MEANWHILE
   Emptying worked on the list from the moment "Empty" was pressed: a photo restored AFTERWARDS
   (with its own "Restore" during the emptying, which lasts several seconds for hundreds of
   photos, or with Ctrl+Z while the confirmation was open) still went to the Windows Recycle Bin
   and vanished from the gallery too. The same for the X on a photo with Ctrl+Z before confirming.
   The user's explicit choice was silently overridden. The rule: only what is STILL in the app's
   trash is emptied, and during the emptying the single-photo buttons are off like the top ones.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-empty-trash-live.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, foto, percorsoImg, percorsoTxt, sorgenteApp, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

console.log('\n--- "Ripristina" su una foto mentre lo svuotamento e\' in corso ---');
{
    let app = null;
    const api = apiFinta({
        prima: async (p) => {
            // ITALIANO: mentre A si sta spostando, l'utente ripristina C.
            // ENGLISH: while A is being moved, the user restores C.
            if (p === percorsoImg('A')) { app.render().handleRestore('C'); await app.attendi(); }
        },
    });
    app = creaApp([foto('A'), foto('B'), foto('C')], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    const toccati = api.chiamate.flat();
    dice('i file di C non vanno nel Cestino di Windows', false, toccati.includes(percorsoImg('C')) || toccati.includes(percorsoTxt('C')));
    dice('C resta in galleria, A e B escono', ['C'], app.vista());
    dice('annullare lo svuotamento riguarda solo A e B', ['A', 'B'], (app.stato.ultimoSvuotamento?.voci || []).map(v => v.img.id));
}

console.log('\n--- "Svuota", poi Ctrl+Z con la conferma aperta, poi "Conferma" ---');
{
    const api = apiFinta();
    const app = creaApp([foto('A', { cestinata: false })], { api });
    app.cestina('A');
    await app.attendi();
    // ITALIANO: la conferma conserva la funzione del momento del clic su "Svuota".
    // ENGLISH: the confirmation keeps the function from the moment "Empty" was clicked.
    const conferma = app.render().handleEmptyTrash;
    app.render().handleUndo();
    await app.attendi();
    dice('Ctrl+Z ha rimesso A in galleria', ['A'], app.vista());
    await conferma();
    await app.attendi();
    dice('nessun file va nel Cestino di Windows', [], api.chiamate);
    dice('A resta in galleria', ['A'], app.vista());
    dice('nessun "spostati nel Cestino di Windows" per un cestino che non aveva niente', false, app.notifiche.some(([m]) => m === t.deleteSuccess));
}

console.log('\n--- la X su una foto, poi Ctrl+Z con la conferma aperta, poi "Conferma" ---');
{
    const api = apiFinta();
    const app = creaApp([foto('A', { cestinata: false })], { api });
    app.cestina('A');
    await app.attendi();
    const conferma = app.render().handleDeletePermanently;
    app.render().handleUndo();
    await app.attendi();
    await conferma('A');
    await app.attendi();
    dice('nessun file va nel Cestino di Windows', [], api.chiamate);
    dice('A resta in galleria', ['A'], app.vista());
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const api = apiFinta();
    const app = creaApp([foto('A'), foto('B')], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('senza interruzioni si svuota tutto e lo si dice', [[], [[t.deleteSuccess, 'success']]], [app.vista(), app.notifiche]);
}

// ITALIANO: durante lo svuotamento i tasti di ogni foto nel cestino (Ripristina e X) sono spenti,
//           come "Ripristina tutte" e "Svuota" in alto. E' un attributo dell'interfaccia: lo si
//           controlla sul sorgente.
// ENGLISH: during the emptying the buttons of every trashed photo (Restore and X) are off, like
//          "Restore all" and "Empty" at the top. It is an attribute of the interface: it is checked
//          on the source.
console.log('\n--- src/App.tsx, i tasti di ogni foto nel cestino ---');
{
    const bottone = (dentro) => {
        const i = sorgenteApp.indexOf(dentro);
        if (i < 0) return '';
        const inizio = sorgenteApp.lastIndexOf('<button', i);
        const fine = sorgenteApp.indexOf('</button>', i);
        return sorgenteApp.slice(inizio, fine);
    };
    dice('"Ripristina" della singola foto spento durante lo svuotamento', true, bottone('onClick={() => handleRestore(img.id)}').includes('disabled={isEmptyingTrash}'));
    dice('la X della singola foto spenta durante lo svuotamento', true, bottone('handleDeletePermanently(img.id);').includes('disabled={isEmptyingTrash}'));
}

process.exit(esito());
