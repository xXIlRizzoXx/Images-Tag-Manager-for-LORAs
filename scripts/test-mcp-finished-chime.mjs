/* ITALIANO: PROVA DEL SUONO DI FINE LAVORO E DEL SEMAFORO DELL'AI ESTERNA (SERVER MCP)
   Gemini a fine giro suona; un'AI collegata via MCP non diceva niente, perche' non esiste un
   segnale "ho finito". Ora src/utils/mcpFineLavoro.ts suona una volta (e ripete l'avviso) quando
   l'AI, dopo aver cambiato dei tag, resta in silenzio per MCP_SILENZIO_MS con nessuna chiamata in
   corso, e dice al semaforo in alto quando l'AI sta lavorando. Si prova con un orologio finto:
   - solo letture: nessun suono;
   - una modifica e poi silenzio: un suono, uno solo;
   - letture in mezzo fanno ripartire l'attesa, anche con pause lunghe per ragionare (29 s);
   - una chiamata lenta ancora in corso non fa finire il lavoro (revisione del 23/10/2026);
   - due lavori separati da un silenzio: due suoni;
   - ferma() (smontaggio, server spento) annulla il suono in attesa.
   Poi si esegue il testo VERO del gestore MCP di src/App.tsx (inizio all'arrivo, fine dopo la
   risposta, true solo se la chiamata ha cambiato dei tag) e si controllano in App.tsx il suono, il
   semaforo (solo con il server acceso; rosso solo se il server non gira), la finestrella, la
   rilettura dello stato mentre il server parte e l'arresto quando il server e' spento davvero.
   Uso:  node scripts/test-mcp-finished-chime.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE END-OF-WORK SOUND AND OF THE LIGHT OF THE EXTERNAL AI (MCP SERVER)
   Gemini plays a sound at the end of a run; an AI connected through MCP said nothing, because there
   is no "done" signal. Now src/utils/mcpFineLavoro.ts sounds once (and repeats the notice) when the
   AI, after changing some tags, stays silent for MCP_SILENZIO_MS with no call in progress, and
   tells the light at the top when the AI is working. Tested with a fake clock:
   - reads only: no sound;
   - a change and then silence: one sound, only one;
   - reads in between restart the wait, even with long pauses to reason (29 s);
   - a slow call still in progress does not end the work (review of 23/10/2026);
   - two jobs separated by a silence: two sounds;
   - ferma() (unmount, server off) cancels the pending sound.
   Then the REAL text of the MCP handler of src/App.tsx runs (start on arrival, end after the answer,
   true only if the call changed tags) and App.tsx is checked for the sound, the light (only with the
   server on; red only if the server is not running), the small window, the state read again while
   the server starts and the stop when the server is really off.
   Usage:  node scripts/test-mcp-finished-chime.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const uscita = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const F = await carica('src/utils/mcpFineLavoro.ts');
const S = F.MCP_SILENZIO_MS;

// ITALIANO: orologio finto: avanza() fa scattare i timer scaduti. ENGLISH: fake clock: avanza() fires due timers.
const orologio = () => {
    let ora = 0, prossimo = 1;
    const timer = new Map();
    return {
        imposta: (fn, ms) => { const id = prossimo++; timer.set(id, { fn, quando: ora + ms }); return id; },
        annulla: (id) => { timer.delete(id); },
        avanza(ms) {
            ora += ms;
            for (const [id, v] of [...timer].sort((x, y) => x[1].quando - y[1].quando)) {
                if (v.quando <= ora && timer.has(id)) { timer.delete(id); v.fn(); }
            }
        },
        inAttesa: () => timer.size,
    };
};
const prova = () => {
    const o = orologio();
    const p = { suoni: 0, o, lavora: [] };
    p.f = F.creaFineLavoroMcp(() => { p.suoni++; }, { silenzioMs: S, orologio: o, attivita: (v) => p.lavora.push(v) });
    // ITALIANO: una chiamata veloce: arriva e la risposta parte subito. ENGLISH: a quick call: it arrives and the answer leaves at once.
    p.chiamata = (cambia) => { const g = p.f.inizio(); p.f.fine(cambia, g); };
    return p;
};

dice('il silenzio che vale come "finito" e\' di 30 secondi (un\'AI che ragiona puo\' tacere piu\' di 10 s)', 30000, S);

console.log('\n--- solo letture ---');
{
    const p = prova();
    for (let i = 0; i < 5; i++) { p.chiamata(false); p.o.avanza(3000); }
    p.o.avanza(S * 3);
    dice('list_photos e get_photo senza modifiche non suonano', 0, p.suoni);
    dice('...e non lasciano timer in giro', 0, p.o.inAttesa());
}

console.log('\n--- una modifica, poi silenzio ---');
{
    const p = prova();
    p.chiamata(true);
    p.o.avanza(S - 1);
    dice('prima dei 30 secondi non suona', 0, p.suoni);
    p.o.avanza(1);
    dice('a 30 secondi di silenzio suona una volta', 1, p.suoni);
    p.o.avanza(S * 5);
    dice('poi non suona piu\'', 1, p.suoni);
}

console.log('\n--- l\'AI guarda le foto e ragiona tra una modifica e l\'altra ---');
{
    const p = prova();
    p.chiamata(true);                 // add_tags su tutte
    for (let i = 0; i < 6; i++) { p.o.avanza(S - 1000); p.chiamata(false); }  // get_photo dopo 29 s di ragionamento
    p.chiamata(true);                 // add_tags a un gruppo
    p.o.avanza(S - 1000);
    dice('finche\' arrivano chiamate (anche letture, anche dopo 29 s) non suona', 0, p.suoni);
    p.o.avanza(1000);
    dice('dopo l\'ultima chiamata e 30 secondi di silenzio: un solo suono per tutto il lavoro', 1, p.suoni);
}

console.log('\n--- una chiamata lenta ancora in corso ---');
{
    const p = prova();
    p.chiamata(true);                 // add_tags
    const lenta = p.f.inizio();       // get_photo di una foto grande su un disco di rete...
    p.o.avanza(S * 3);
    dice('mentre la risposta non e\' partita il lavoro non finisce: niente suono, resta giallo', [0, [true]], [p.suoni, p.lavora]);
    p.f.fine(false, lenta);           // ...la risposta parte
    p.o.avanza(S);
    dice('finita la chiamata, 30 secondi di silenzio: suono e verde', [1, [true, false]], [p.suoni, p.lavora]);
    const q = prova();
    const g1 = q.f.inizio(), g2 = q.f.inizio();  // due chiamate insieme
    q.f.fine(true, g1); q.o.avanza(S * 2);
    dice('con due chiamate insieme conta l\'ultima che finisce', 0, q.suoni);
    q.f.fine(false, g2); q.o.avanza(S);
    dice('...e la modifica della prima non si perde', 1, q.suoni);
}

console.log('\n--- due lavori separati ---');
{
    const p = prova();
    p.chiamata(true); p.o.avanza(S);
    p.chiamata(false); p.o.avanza(S);
    dice('una lettura dopo la fine non fa suonare di nuovo', 1, p.suoni);
    p.chiamata(true); p.o.avanza(S);
    dice('un secondo lavoro con modifiche suona di nuovo', 2, p.suoni);
}

console.log('\n--- smontaggio o server spento ---');
{
    const p = prova();
    p.chiamata(true); p.o.avanza(S / 2);
    p.f.ferma(); p.o.avanza(S * 2);
    dice('ferma() annulla il suono in attesa', [0, 0], [p.suoni, p.o.inAttesa()]);
    p.chiamata(false); p.o.avanza(S * 2);
    dice('...e una lettura dopo non lo fa ripartire', 0, p.suoni);
    const q = prova();
    const vecchia = q.f.inizio(); q.f.ferma();
    q.f.fine(true, vecchia); q.o.avanza(S);
    dice('una risposta partita dopo ferma() non conta: niente suono, giallo spento', [0, [true, false], 0], [q.suoni, q.lavora, q.o.inAttesa()]);
    const w = prova();
    const prima = w.f.inizio(); w.f.ferma();
    const nuova = w.f.inizio();      // server riacceso, chiamata nuova e lenta
    w.f.fine(false, prima); w.o.avanza(S * 2);
    dice('...e non chiude una chiamata nuova ancora in corso (resta giallo)', [[true, false, true], 0], [w.lavora, w.suoni]);
    w.f.fine(true, nuova); w.o.avanza(S);
    dice('...che a sua volta finisce con il suo suono', 1, w.suoni);
}

// ITALIANO: il semaforo in alto e' giallo mentre l'AI lavora, anche se legge soltanto.
// ENGLISH: the light at the top is yellow while the AI works, even if it only reads.
console.log('\n--- "al lavoro" per il semaforo ---');
{
    const p = prova();
    const g = p.f.inizio();
    dice('l\'ARRIVO della prima chiamata, anche di sola lettura, accende "al lavoro"', [true], p.lavora);
    p.f.fine(false, g);
    p.o.avanza(S - 1000); p.chiamata(false); p.o.avanza(S - 1000); p.chiamata(true);
    dice('le chiamate seguenti non lo riaccendono ogni volta', [true], p.lavora);
    p.o.avanza(S);
    dice('30 secondi di silenzio lo spengono, insieme al suono di fine', [[true, false], 1], [p.lavora, p.suoni]);
    const q = prova();
    q.chiamata(false); q.o.avanza(S);
    dice('solo letture: si accende e si spegne, ma senza suono', [[true, false], 0], [q.lavora, q.suoni]);
    const r = prova();
    r.chiamata(true); r.f.ferma();
    dice('ferma() lo spegne subito', [true, false], r.lavora);
    r.f.ferma();
    dice('...e un secondo ferma() non manda un altro "spento"', [true, false], r.lavora);
}

console.log('\n--- il semaforo in App.tsx ---');
{
    const pulito = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8').replace(/\r/g, '');
    const inizio = pulito.indexOf("{window.electronAPI?.mcp && mcpStato?.acceso && (() => {");
    const blocco = inizio < 0 ? '' : pulito.slice(inizio, pulito.indexOf('})()}', inizio));
    dice('il semaforo esiste ed e\' prima del tasto Cestino', true, blocco !== '' && inizio < pulito.indexOf('<button onClick={() => setIsTrashOpen(true)}'));
    dice('si vede solo nel programma installato e con il server MCP acceso', true, blocco.startsWith('{window.electronAPI?.mcp && mcpStato?.acceso && '));
    dice('rosso con porta o avvio falliti, grigio mentre parte, giallo al lavoro, verde in ascolto; un salvataggio fallito resta verde', true,
        /const stato = mcpStato\.errore === 'porta' \|\| mcpStato\.errore === 'avvio' \? 'errore' : !mcpStato\.attivo \? 'partenza' : mcpAlLavoro \? 'lavoro' : 'ascolto';/.test(blocco)
        && /partenza: 'bg-gray-400'/.test(blocco) && /partenza: t\.mcpTitle/.test(blocco) && !/mcpErrStart/.test(blocco)
        && /errore: 'bg-red-500/.test(blocco) && /lavoro: 'bg-amber-400/.test(blocco) && /ascolto: 'bg-emerald-500/.test(blocco));
    dice('ogni stato ha la sua spiegazione tradotta (title e aria-label)', true,
        /errore: t\.mcpLightError, partenza: t\.mcpTitle, lavoro: t\.mcpLightBusy, ascolto: t\.mcpLightOn/.test(blocco)
        && /title=\{testo\}/.test(blocco) && /aria-label=\{testo\}/.test(blocco));
    dice('il clic apre e chiude la finestrella (rileggendo lo stato), non le Impostazioni', true,
        /if \(!mcpFinestraAperta\) window\.electronAPI\?\.mcp\?\.getStatus\(\)\.then\(setMcpStato\)/.test(blocco)
        && /setMcpFinestraAperta\(v => !v\);/.test(blocco) && !/setIsSettingsOpen/.test(blocco));
    dice('la finestrella mostra gli stessi dati di collegamento delle Impostazioni (datiMcp)', [2, true],
        [pulito.split('{datiMcp()}').length - 1, /\{mcpFinestraAperta && \([\s\S]*\{datiMcp\(\)\}/.test(blocco)]);
    dice('si chiude cliccando fuori', true,
        /if \(mcpFinestraRef\.current && !mcpFinestraRef\.current\.contains\(event\.target\)\) setMcpFinestraAperta\(false\);/.test(pulito));
    dice('a server spento davvero (stato letto): finestrella chiusa e attesa fermata', true,
        /if \(mcpStato\?\.acceso\) return;\s*setMcpFinestraAperta\(false\);\s*mcpFineRef\.current\?\.ferma\(\);\s*\}, \[mcpStato\?\.acceso\]\);/.test(pulito)
        && !/const cambiaMcp = async \(acceso: boolean\) => \{[\s\S]{0,200}mcpFineRef\.current\?\.ferma\(\)/.test(pulito));
    dice('acceso ma non ancora attivo, senza errori: lo stato si rilegge dopo 1,5 s', true,
        /if \(!api \|\| !mcpStato\?\.acceso \|\| mcpStato\.attivo \|\| mcpStato\.errore\) return undefined;\s*const id = setTimeout\(\(\) => \{ api\.getStatus\(\)\.then\(setMcpStato\)\.catch\(\(\) => \{ \}\); \}, 1500\);\s*return \(\) => clearTimeout\(id\);\s*\}, \[mcpStato\]\);/.test(pulito));
    const T = (await carica('src/constants.ts')).translations;
    const mancanti = Object.entries(T).flatMap(([l, x]) => ['mcpLightOn', 'mcpLightBusy', 'mcpLightError'].filter(k => !x[k]).map(k => `${l}.${k}`));
    dice('i 3 testi ci sono in tutte e 9 le lingue', [9, []], [Object.keys(T).length, mancanti]);
    const conImpostazioni = Object.entries(T).filter(([, x]) => [x.mcpLightOn, x.mcpLightBusy, x.mcpLightError].some(s => s.includes(x.settings))).map(([l]) => l);
    dice('nessun testo del semaforo manda piu\' alle Impostazioni', [], conImpostazioni);
}

console.log('\n--- il gestore MCP vero di src/App.tsx ---');
{
    const B = await carica('src/utils/mcpBridge.ts');
    const G = await carica('src/utils/closeGuard.ts');
    const t = (await carica('src/constants.ts')).translations.en;
    const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
    const inizio = sorgente.indexOf('    mcpGestoreRef.current = async (r: McpRichiesta) => {');
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (!fine) { console.log('NO  gestore MCP non trovato in src/App.tsx'); process.exit(1); }
    const codice = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
    const NOMI = ['mcpGestoreRef', 'eseguiStrumentoMcp', 'imagesRef', 'globalTriggersRef', 'setImages', 'fotoPerMcp', 'fileDiAdesso', 'console',
        'window', 'showNotification', 't', 'setToast', 'fotoDaSalvare', 'mcpCambiateRef', 'mcpFineRef', 'mcpAvvisoRef'];
    const rif = { current: null };
    const chiamate = [];
    const dip = {
        mcpGestoreRef: rif, eseguiStrumentoMcp: B.eseguiStrumentoMcp, globalTriggersRef: { current: [] },
        imagesRef: { current: [0, 1].map(i => ({ id: 'p' + i, isTrashed: false, tags: [], originalTags: [], file: { name: `p${i}.png` } })) },
        setImages: () => { }, fotoPerMcp: async () => null, fileDiAdesso: async () => null, console: { log() { }, warn() { }, error() { } },
        window: { electronAPI: { mcp: { respond: () => { chiamate.push('risposta'); } } } },
        showNotification: () => { }, t, setToast: () => { }, fotoDaSalvare: G.fotoDaSalvare, mcpCambiateRef: { current: new Map() },
        mcpFineRef: { current: { inizio: () => { chiamate.push('arriva'); return 7; }, fine: (c, g) => chiamate.push(g === 7 ? c : 'giro sbagliato'), ferma: () => { } } },
        mcpAvvisoRef: { current: () => chiamate.push('avviso') },
    };
    new Function(...NOMI, codice)(...NOMI.map(n => dip[n]));
    await rif.current({ id: 1, strumento: 'list_photos', argomenti: {} });
    await rif.current({ id: 2, strumento: 'add_tags', argomenti: { ids: ['p0', 'p1'], tags: ['dragon'] } });
    await rif.current({ id: 3, strumento: 'add_tags', argomenti: { ids: ['p0'], tags: ['dragon'] } });
    await rif.current({ id: 4, strumento: 'add_tags', argomenti: { ids: ['p0'], tags: [] } });
    dice('arriva -> risposta -> fine (true solo se ha cambiato tag, poi l\'avviso), anche con un errore',
        ['arriva', 'risposta', false, 'arriva', 'risposta', true, 'avviso', 'arriva', 'risposta', false, 'arriva', 'risposta', false], chiamate);

    const pulito = sorgente.replace(/\r/g, '');
    dice('la fine si conta anche se l\'invio della risposta fallisse (finally)', true,
        /const giroMcp = mcpFineRef\.current\?\.inizio\(\) \?\? 0;/.test(pulito)
        && /try \{ window\.electronAPI\?\.mcp\?\.respond\(r\.id, risposta\); \} finally \{ mcpFineRef\.current\?\.fine\(!!risposta\.cambiate, giroMcp\); \}/.test(pulito));
    dice('a fine lavoro, con il server acceso, suona soundManager.chime (spento con "Suoni UI") e ripete l\'avviso', true,
        /mcpFineRef\.current = creaFineLavoroMcp\(\(\) => \{ if \(!mcpAccesoRef\.current\) return; soundManager\.chime\(\); mcpAvvisoRef\.current\(\); \}, \{ attivita: setMcpAlLavoro \}\)/.test(pulito)
        && /mcpAccesoRef\.current = !!mcpStato\?\.acceso;/.test(pulito));
    dice('allo smontaggio l\'attesa si ferma', true,
        /const smetti = api\.onRequest\([^\n]*\n\s*return \(\) => \{ smetti\(\); mcpFineRef\.current\?\.ferma\(\); \};/.test(pulito));
}

process.exit(esito());
