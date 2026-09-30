/* ITALIANO: PROVA DI "SVUOTA CESTINO" MENTRE "ANNULLA LO SVUOTAMENTO" STA ANCORA LAVORANDO
   "Annulla lo svuotamento" ripesca i file dal Cestino di Windows (qualche secondo, fino a un
   minuto). Nel frattempo "Svuota cestino" restava cliccabile: il nuovo svuotamento liberava le
   anteprime proprio delle foto che l'annullamento stava per rimettere nel cestino dell'app (che
   tornavano con l'immagine rotta), e poi l'annullamento, finendo, scriveva sopra il ricordo del
   nuovo svuotamento, che non si poteva piu' annullare dall'app. La regola: durante l'annullamento
   "Svuota cestino" e' spento, e se lo svuotamento parte lo stesso (una conferma aperta prima) non
   fa niente finche' l'annullamento non ha finito; un'anteprima di una foto che sta nel progetto
   non viene mai liberata.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-empty-trash-during-undo.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "EMPTY TRASH" WHILE "UNDO THE EMPTYING" IS STILL WORKING
   "Undo the emptying" fishes the files back out of the Windows Recycle Bin (a few seconds, up to a
   minute). Meanwhile "Empty trash" stayed clickable: the new emptying released the thumbnails of
   the very photos the undo was about to put back in the app's trash (which came back with a
   broken image), and then the undo, on finishing, wrote over the record of the new emptying, which
   could no longer be undone from the app. The rule: during the undo "Empty trash" is off, and if
   the emptying starts anyway (a confirmation opened earlier) it does nothing until the undo has
   finished; a thumbnail of a photo that is in the project is never released.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-empty-trash-during-undo.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, foto, sorgenteApp, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

// ITALIANO: un Cestino di Windows lento: il primo ripristino resta in sospeso finche' la prova non
//           lo lascia andare; gli altri (i .txt) rispondono subito.
// ENGLISH: a slow Windows Recycle Bin: the first restore stays pending until the test lets it go;
//          the others (the .txt files) answer at once.
const cestinoLento = () => {
    let libera = null, chiamate = 0;
    const api = apiFinta({
        ripristino: (percorsi) => {
            chiamate++;
            const risposta = { results: percorsi.map(p => ({ percorso: p, esito: 'ok' })) };
            if (chiamate > 1) return risposta;
            return new Promise(ok => { libera = () => ok(risposta); });
        },
    });
    return { api, libera: () => libera && libera() };
};

// ITALIANO: X svuotata (si puo' annullare), poi A messa nel cestino dell'app.
// ENGLISH: X emptied (it can be undone), then A put in the app's trash.
const prepara = async () => {
    const lento = cestinoLento();
    const app = creaApp([foto('X'), foto('A', { cestinata: false })], { api: lento.api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    app.cestina('A');
    await app.attendi();
    return { app, lento };
};
const vive = (app) => app.stato.images.filter(i => app.revocati.includes(i.thumb)).map(i => i.id);
const ricordo = (app) => (app.stato.ultimoSvuotamento?.voci || []).map(v => v.img.id);

console.log('\n--- "Svuota" confermato mentre l\'annullamento aspetta ancora il Cestino di Windows ---');
{
    const { app, lento } = await prepara();
    // ITALIANO: la conferma conserva la funzione del momento in cui e' stata aperta.
    // ENGLISH: the confirmation keeps the function from the moment it was opened.
    const conferma = app.render().handleEmptyTrash;
    const annulla = app.render().annullaSvuotamento();
    await app.attendi();
    await conferma();
    await app.attendi();
    dice('l\'utente sa perche\' non si svuota niente', true, app.notifiche.some(([m, tipo]) => m === t.undoEmptyWorking && tipo === 'info'));
    lento.libera();
    await annulla;
    await app.attendi();
    dice('nessuna foto del progetto ha l\'anteprima liberata', [], vive(app));
    dice('A non e\' andata nel Cestino di Windows a meta\' annullamento: e\' ancora nel cestino dell\'app', true, app.vista().includes('A(cestino)'));
    dice('X e\' tornata nel cestino dell\'app', true, app.vista().includes('X(cestino)'));
    // ITALIANO: finito l'annullamento, "Svuota" funziona e il nuovo svuotamento si puo' annullare.
    // ENGLISH: once the undo is over, "Empty" works and the new emptying can be undone.
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('poi "Svuota" svuota tutte e due e le ricorda per l\'annullamento', [[], ['A', 'X']], [app.vista(), ricordo(app).sort()]);
}

console.log('\n--- l\'annullamento finisce con la conferma ancora aperta, poi "Svuota" ---');
{
    const { app, lento } = await prepara();
    const conferma = app.render().handleEmptyTrash;
    const annulla = app.render().annullaSvuotamento();
    await app.attendi();
    lento.libera();
    await annulla;
    await app.attendi();
    await conferma();
    await app.attendi();
    dice('l\'anteprima di X, tornata nel cestino dell\'app, non viene liberata', [], vive(app));
    dice('X resta nel cestino dell\'app con la sua anteprima', ['X(cestino)'], app.vista());
    dice('il nuovo svuotamento (A) si puo\' annullare', ['A'], ricordo(app));
}

// ITALIANO: il tasto "Svuota cestino" e' spento durante l'annullamento, come "Annulla lo
//           svuotamento" e' spento durante lo svuotamento. E' un attributo dell'interfaccia: lo si
//           controlla sul sorgente.
// ENGLISH: the "Empty trash" button is off during the undo, just as "Undo the emptying" is off
//          during the emptying. It is an attribute of the interface: it is checked on the source.
console.log('\n--- src/App.tsx, i tasti in cima al cestino ---');
{
    const bottone = (dentro) => {
        const i = sorgenteApp.indexOf(dentro);
        if (i < 0) return '';
        const inizio = sorgenteApp.lastIndexOf('<button', i);
        const fine = sorgenteApp.indexOf('</button>', i);
        return sorgenteApp.slice(inizio, fine);
    };
    const disabilitato = (testo) => (/disabled=\{([^}]*)\}/.exec(testo) || [])[1] || '';
    dice('"Svuota cestino" spento durante l\'annullamento dello svuotamento', true, disabilitato(bottone('onConfirm: handleEmptyTrash,')).includes('ripristinoInCorso'));
    dice('"Svuota cestino" resta spento durante lo svuotamento', true, disabilitato(bottone('onConfirm: handleEmptyTrash,')).includes('isEmptyingTrash'));
    dice('"Annulla lo svuotamento" resta spento durante lo svuotamento', true, disabilitato(bottone('onClick={annullaSvuotamento}')).includes('isEmptyingTrash'));
}

process.exit(esito());
