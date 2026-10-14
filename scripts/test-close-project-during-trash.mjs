/* ITALIANO: PROVA DI "CHIUDI PROGETTO" E "RESET" MENTRE IL CESTINO LAVORA
   Con un cestino grande, "Svuota cestino" (un file alla volta nel Cestino di Windows) e "Annulla lo
   svuotamento" (PowerShell, qualche secondo) durano a lungo. Intanto si poteva chiudere la finestra
   del cestino con la sua X e premere "Chiudi progetto" o "Reset". Finito il lavoro, il suo
   risultato finiva nel progetto NUOVO: il tasto "Annulla lo svuotamento" compariva li' e ci
   infilava le foto di quello chiuso, e l'annullamento metteva le foto ripescate nel suo cestino,
   con le anteprime gia' liberate (immagini rotte). La regola: un lavoro del cestino appartiene al
   progetto in cui e' partito; se nel frattempo il progetto e' stato chiuso o azzerato, alla fine
   non tocca niente del progetto di adesso (i file restano dove li ha messi: nel Cestino di Windows,
   o di nuovo nella loro cartella).
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-close-project-during-trash.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "CLOSE PROJECT" AND "RESET" WHILE THE TRASH IS WORKING
   With a large trash, "Empty trash" (one file at a time to the Windows Recycle Bin) and "Undo the
   emptying" (PowerShell, a few seconds) take long. Meanwhile the trash window could be closed with
   its X and "Close project" or "Reset" pressed. When the work finished, its result landed in the
   NEW project: the "Undo the emptying" button showed up there and pushed the closed project's
   photos into it, and the undo put the photos it fished back into its trash, with thumbnails
   already released (broken images). The rule: a trash job belongs to the project it started in;
   if that project was closed or reset meanwhile, at the end it touches nothing of the current
   project (the files stay where it put them: in the Windows Recycle Bin, or back in their folder).
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-close-project-during-trash.mjs      (exits with code 1 if anything is off) */

import { creaApp, foto, apiFinta, percorsoImg, percorsoTxt, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

const ricordo = (app) => (app.stato.ultimoSvuotamento?.voci || []).map(v => v.img.id);
const messaggi = (app) => app.notifiche.map(([m]) => m);
// ITALIANO: Reset: la conferma si apre, poi l'utente preme "Conferma".
// ENGLISH: Reset: the confirmation opens, then the user presses "Confirm".
const reset = async (app) => {
    app.render().handleResetProject();
    await app.attendi(1);
    app.stato.confirmDialog.onConfirm();
};

for (const [nome, chiudi] of [
    ['Chiudi progetto', async (app) => app.render().closeProjectNow()],
    ['Reset', reset],
]) {
    console.log(`\n--- "Svuota cestino" in corso, poi "${nome}" ---`);
    {
        let app = null;
        let fatto = false;
        // ITALIANO: mentre il primo file si sta spostando, l'utente chiude il progetto.
        // ENGLISH: while the first file is being moved, the user closes the project.
        const api = apiFinta({ prima: async () => { if (!fatto) { fatto = true; await chiudi(app); } } });
        app = creaApp([foto('A'), foto('B'), foto('C')], { api });
        const notifichePrima = app.notifiche.length;
        await app.render().handleEmptyTrash();
        await app.attendi();
        dice('il progetto nuovo e\' vuoto: nessuna foto di quello chiuso', [], app.vista());
        dice('nessun "Annulla lo svuotamento" con le foto del progetto chiuso', [], ricordo(app));
        dice('nessun messaggio dello svuotamento nel progetto nuovo', false,
            messaggi(app).slice(notifichePrima).some(m => m === t.deleteSuccess));
        dice('nessuna seconda finestra (eliminazione definitiva) aperta nel progetto nuovo', false, Boolean(app.stato.confirmDialog && app.stato.confirmDialog.isOpen));
        dice('dopo la chiusura nessun altro file e\' andato nel Cestino di Windows (solo la coppia di A, gia\' partita)',
            [[percorsoImg('A')], [percorsoTxt('A')]], api.chiamate);
        dice('la spia dello svuotamento si spegne', false, app.stato.isEmptyingTrash);
    }

    console.log(`\n--- "Annulla lo svuotamento" in corso, poi "${nome}" ---`);
    {
        let libera = null, chiamate = 0;
        const api = apiFinta({
            ripristino: (percorsi) => {
                chiamate++;
                const risposta = { results: percorsi.map(p => ({ percorso: p, esito: 'ok' })) };
                if (chiamate > 1) return risposta;
                return new Promise(ok => { libera = () => ok(risposta); });
            },
        });
        const app = creaApp([foto('X'), foto('Y')], { api });
        await app.render().handleEmptyTrash();
        await app.attendi();
        dice('premessa: X e Y svuotate, si possono annullare', ['X', 'Y'], ricordo(app).sort());
        const annulla = app.render().annullaSvuotamento();
        await app.attendi();
        await chiudi(app);
        await app.attendi();
        const notifichePrima = app.notifiche.length;
        libera();
        await annulla;
        await app.attendi();
        dice('il progetto nuovo resta vuoto: le foto ripescate non entrano nel suo cestino', [], app.vista());
        dice('nessun "Annulla lo svuotamento" nel progetto nuovo', [], ricordo(app));
        dice('nessun messaggio "rimesse nel cestino dell\'app" nel progetto nuovo', [], messaggi(app).slice(notifichePrima));
        dice('le immagini E i loro .txt sono comunque tornati su disco insieme', [[percorsoImg('X'), percorsoImg('Y')], [percorsoTxt('X'), percorsoTxt('Y')]],
            api.ripristini.map(l => [...l].sort()));
        dice('la spia dell\'annullamento si spegne', false, app.stato.ripristinoInCorso);
    }
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const api = apiFinta();
    const app = creaApp([foto('A'), foto('B')], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('senza chiudere niente, "Svuota cestino" si puo\' annullare come sempre', ['A', 'B'], ricordo(app).sort());
    dice('e dice che e\' riuscito', true, messaggi(app).includes(t.deleteSuccess));
    await app.render().annullaSvuotamento();
    await app.attendi();
    dice('e "Annulla lo svuotamento" le rimette nel cestino dell\'app', ['A(cestino)', 'B(cestino)'], app.vista().sort());
}

process.exit(esito());
