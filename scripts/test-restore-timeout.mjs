/* ITALIANO: PROVA DELL'ANNULLAMENTO DELLO SVUOTAMENTO QUANDO SCADE IL TEMPO MASSIMO
   Con un cestino grande il ripristino dal Cestino di Windows puo' superare il tempo massimo: il
   processo principale ferma PowerShell e ogni foto tornava 'fallito', anche quelle gia' rimesse
   nella cartella. L'app diceva "dovrebbero essere ancora li', puoi riprovare"; al nuovo tentativo
   quelle foto non erano piu' nel Cestino, tornavano 'nonTrovato' e l'app le toglieva dal progetto
   lasciando il loro .txt nel Cestino: la coppia immagine + .txt si rompeva.
   Ora, dopo l'arresto, una foto che prima non c'era e adesso e' al suo posto torna 'ok'; un
   omonimo che c'era gia' prima non diventa mai 'ok'. E il tempo massimo cresce col numero di foto.
   Il Cestino e' un finto (main-harness.mjs) in cui ogni ripristino ci mette 700 ms; l'arresto si
   fa scattare quando tre foto su otto sono tornate, senza aspettare un minuto.
   Uso:  node scripts/test-restore-timeout.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF UNDOING THE EMPTYING WHEN THE TIME LIMIT RUNS OUT
   With a big trash the restore from the Windows Recycle Bin can run past the time limit: the main
   process stops PowerShell and every photo came back 'fallito', even those already put back in the
   folder. The app said "they should still be there, you can try again"; on the retry those photos
   were no longer in the Recycle Bin, came back 'nonTrovato' and the app dropped them from the
   project, leaving their .txt in the Recycle Bin: the image + .txt pair broke.
   Now, after the stop, a photo that was not there before and is in its place now comes back 'ok';
   a namesake that was already there never becomes 'ok'. And the time limit grows with the number
   of photos.
   The bin is a fake (main-harness.mjs) in which every restore takes 700 ms; the stop is triggered
   once three photos out of eight are back, without waiting a minute.
   Usage:  node scripts/test-restore-timeout.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { caricaMain, creaControlli } from './main-harness.mjs';

if (process.platform !== 'win32') {
    console.log('SALTATA: il ripristino dal Cestino esiste solo su Windows');
    process.exit(0);
}

const { handlers, impostaCestino } = caricaMain();
const { dice, esito } = creaControlli();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-restore-timeout-'));
const setTimeoutVero = globalThis.setTimeout;
// ITALIANO: il timer d'arresto del canale (un minuto o piu') viene annotato e, in modo 'taglia',
//           scatta appena `pronto()` e' vero. Gli altri timer restano quelli veri.
// ENGLISH: the channel's stop timer (a minute or more) is recorded and, in 'taglia' mode, fires as
//          soon as `pronto()` is true. The other timers stay the real ones.
const ritardiArresto = [];
let modo = 'normale';
let pronto = () => false;
globalThis.setTimeout = (fn, ms, ...resto) => {
    if (typeof ms === 'number' && ms >= 60000) {
        ritardiArresto.push(ms);
        if (modo === 'taglia') {
            const inizio = Date.now();
            const guarda = () => {
                if (pronto() || Date.now() - inizio > 60000) fn(...resto);
                else setTimeoutVero(guarda, 25);
            };
            return setTimeoutVero(guarda, 25);
        }
    }
    return setTimeoutVero(fn, ms, ...resto);
};
let codice = 1;
try {
    const cartella = path.join(tmp, 'dataset');
    const cestino = path.join(tmp, 'cestino-finto');
    fs.mkdirSync(cartella);
    fs.mkdirSync(cestino);
    const origini = [];
    const voci = [];
    for (let i = 1; i <= 8; i++) {
        const nome = `000${i}.png`;
        const origine = path.join(cartella, nome);
        const interno = path.join(cestino, `$R00${i}.png`);
        fs.writeFileSync(interno, 'IMG' + i);
        origini.push(origine);
        voci.push({ nome, interno, cartella, origine, giorni: 0, ritardoMs: 700 });
    }
    // ITALIANO: un omonimo gia' sul disco prima del ripristino: non deve mai diventare 'ok'.
    // ENGLISH: a namesake already on disk before the restore: it must never become 'ok'.
    const omonimo = path.join(cartella, 'omonimo.png');
    fs.writeFileSync(omonimo, 'SUL DISCO');
    const internoOmonimo = path.join(cestino, '$ROMO01.png');
    fs.writeFileSync(internoOmonimo, 'NEL CESTINO');
    voci.push({ nome: 'omonimo.png', interno: internoOmonimo, cartella, origine: omonimo, giorni: 0, ritardoMs: 700 });
    impostaCestino(voci);
    const sulDisco = () => origini.filter((p) => fs.existsSync(p));

    console.log('\n--- il tempo massimo scade a meta\' del ripristino ---');
    modo = 'taglia';
    pronto = () => sulDisco().length >= 3;
    const r1 = await handlers.get('shell:restore-trashed')(null, [...origini, omonimo]);
    const esiti1 = new Map(r1.results.map((r) => [r.percorso, r.esito]));
    const tornate = sulDisco();
    dice('l\'arresto e\' arrivato a meta\' (qualche foto tornata, qualcuna no)', true, tornate.length >= 3 && tornate.length < 8);
    dice('ogni foto gia\' tornata nella cartella risulta "ok", non "fallito"', tornate.map(() => 'ok'), tornate.map((p) => esiti1.get(p)));
    dice('le foto ancora nel Cestino risultano "fallito" (si puo\' riprovare)',
        origini.filter((p) => !tornate.includes(p)).map(() => 'fallito'), origini.filter((p) => !tornate.includes(p)).map((p) => esiti1.get(p)));
    dice('l\'omonimo che c\'era gia\' non diventa "ok" e non viene toccato', [true, 'SUL DISCO'], [esiti1.get(omonimo) !== 'ok', fs.readFileSync(omonimo, 'utf8')]);

    console.log('\n--- nuovo tentativo, come fa il pulsante, con le foto non tornate ---');
    modo = 'normale';
    const daRiprovare = origini.filter((p) => esiti1.get(p) !== 'ok');
    impostaCestino(voci.filter((v) => v.origine !== omonimo && fs.existsSync(v.interno)).map((v) => ({ ...v, ritardoMs: null })));
    const r2 = await handlers.get('shell:restore-trashed')(null, daRiprovare);
    const esiti2 = new Map(r2.results.map((r) => [r.percorso, r.esito]));
    dice('il nuovo tentativo le riporta tutte', daRiprovare.map(() => 'ok'), daRiprovare.map((p) => esiti2.get(p)));
    dice('alla fine ogni foto e\' "ok" una volta e nessuna e\' "nonTrovato"', origini.map(() => 'ok'),
        origini.map((p) => (esiti1.get(p) === 'ok' ? 'ok' : esiti2.get(p))));
    dice('...e tutte e otto sono nella cartella', 8, sulDisco().length);

    console.log('\n--- il tempo massimo cresce col numero di foto ---');
    dice('due chiamate, due timer d\'arresto', 2, ritardiArresto.length);
    dice('con nove percorsi si aspetta piu\' di un minuto, e piu\' che con ' + daRiprovare.length, true, ritardiArresto[0] > 60000 && ritardiArresto[0] > ritardiArresto[1]);

    codice = esito();
} finally {
    globalThis.setTimeout = setTimeoutVero;
    fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(codice);
