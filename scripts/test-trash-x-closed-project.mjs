/* ITALIANO: PROVA DELLA X SU UNA FOTO DEL CESTINO QUANDO IL PROGETTO SI CHIUDE NEL FRATTEMPO
   La X su una foto del cestino manda il file nel Cestino di Windows, che su un'unita' lenta (un
   NAS che si sveglia) risponde dopo qualche secondo. Intanto si poteva chiudere la finestra del
   cestino, premere "Chiudi progetto" e aprire un'altra cartella. Alla risposta, nel progetto NUOVO
   comparivano la seconda conferma "Foto che non possono andare nel Cestino di Windows: 1 ...",
   "File spostati nel Cestino di Windows." o "Non e' stato possibile spostare i file...", per una
   foto che li' non c'e'. La regola, la stessa di Svuota cestino ed Elimina per sempre: il lavoro
   appartiene al progetto in cui e' partito; se il progetto e' stato chiuso, alla fine non dice e
   non tocca niente. Senza chiusura tutto resta come prima.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-trash-x-closed-project.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE X ON A TRASHED PHOTO WHEN THE PROJECT IS CLOSED MEANWHILE
   The X on a trashed photo sends the file to the Windows Recycle Bin, which on a slow drive (a NAS
   waking up) answers after a few seconds. Meanwhile the trash window could be closed, "Close
   project" pressed and another folder opened. On the answer, the NEW project showed the second
   confirmation "Photos that cannot go to the Windows Recycle Bin: 1 ...", "Files moved to the
   Windows Recycle Bin." or "The files could not be moved...", for a photo that is not there. The
   rule, the same as Empty trash and Delete forever: the job belongs to the project it started in;
   if that project was closed, at the end it says and touches nothing. Without closing everything
   stays as before.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-trash-x-closed-project.mjs      (exits with code 1 if anything is off) */

import { creaApp, foto, apiFinta, cartellaFinta, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const messaggi = (app, da) => app.notifiche.slice(da).map(([m]) => m);
const finestraAperta = (app) => Boolean(app.stato.confirmDialog && app.stato.confirmDialog.isOpen);
const TESTI_CESTINO = [t.deleteSuccess, t.deleteError, t.deleteNoRecycleBin];

for (const esitoCestino of ['rifiutato', 'ok', 'errore']) {
    console.log(`\n--- X su una foto, Cestino di Windows "${esitoCestino}", progetto chiuso mentre risponde ---`);
    {
        let app = null;
        const cartella = cartellaFinta();
        let dopoChiusura = -1;
        const api = apiFinta({
            esitoDi: () => esitoCestino,
            prima: async () => { app.render().closeProjectNow(); await app.attendi(); dopoChiusura = app.notifiche.length; },
        });
        app = creaApp([foto('A', { cartella })], { api });
        await app.render().handleDeletePermanently('A');
        await app.attendi();
        dice('premessa: il progetto e\' stato chiuso durante l\'attesa', true, dopoChiusura >= 0 && app.refs.progettoGenRef.current > 0);
        dice('nessuna seconda conferma aperta nel progetto nuovo', false, finestraAperta(app));
        dice('nessun messaggio del cestino nel progetto nuovo', [],
            messaggi(app, dopoChiusura).filter(m => TESTI_CESTINO.includes(m) || /Recycle Bin/.test(m)));
        dice('il progetto nuovo resta vuoto', [], app.vista());
        dice('niente cancellato per sempre dalla cartella', [], cartella.rimossi);
    }
}

console.log('\n--- quello che NON deve cambiare: X senza chiudere il progetto ---');
{
    const cartella = cartellaFinta();
    const app = creaApp([foto('A', { cartella }), foto('B', { cestinata: false })], { api: apiFinta({ esitoDi: () => 'rifiutato' }) });
    await app.render().handleDeletePermanently('A');
    await app.attendi();
    dice('Cestino rifiutato: si apre la seconda conferma', true, finestraAperta(app));
}
{
    const app = creaApp([foto('A'), foto('B', { cestinata: false })], { api: apiFinta({ esitoDi: () => 'ok' }) });
    const da = app.notifiche.length;
    await app.render().handleDeletePermanently('A');
    await app.attendi();
    dice('Cestino ok: "File spostati nel Cestino di Windows."', true, messaggi(app, da).includes(t.deleteSuccess));
    dice('Cestino ok: la foto esce dal progetto', false, app.stato.images.some(i => i.id === 'A'));
}
{
    const app = creaApp([foto('A'), foto('B', { cestinata: false })], { api: apiFinta({ esitoDi: () => 'errore' }) });
    const da = app.notifiche.length;
    await app.render().handleDeletePermanently('A');
    await app.attendi();
    dice('Cestino in errore: il messaggio di errore', true, messaggi(app, da).includes(t.deleteError));
    dice('Cestino in errore: la foto resta nel cestino dell\'app', true, app.stato.images.some(i => i.id === 'A' && i.isTrashed));
}

process.exit(esito());
