/* ITALIANO: PROVA DEL SEGNALE DI FINE LAVORO DELL'AI ESTERNA DOPO «CHIUDI PROGETTO» O «RESETTA»
   Un'AI esterna (server MCP) cambia dei tag; entro 30 secondi l'utente chiude il progetto (Chiudi
   progetto, Salva e chiudi, Chiudi senza salvare) o preme Resetta Progetto. Il conto di fine lavoro
   andava avanti: a progetto chiuso il semaforo restava giallo («un'AI esterna sta lavorando») fino
   ai 30 secondi, e poi suonava il segnale di fine lavoro, anche con un'altra cartella aperta nel
   frattempo. Lo spegnimento del server lo fermava gia'; ora lo fermano anche la chiusura e il reset.
   Si eseguono i testi VERI di closeProjectNow e handleResetProject presi da src/App.tsx, con il
   modulo vero src/utils/mcpFineLavoro.ts e un orologio finto.
   Uso:  node scripts/test-mcp-chime-after-close.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE EXTERNAL AI'S END-OF-WORK CHIME AFTER "CLOSE PROJECT" OR "RESET"
   An external AI (MCP server) changes some tags; within 30 seconds the user closes the project
   (Close project, Save and close, Close without saving) or presses Reset Project. The end-of-work
   count went on: with the project closed the light stayed yellow ("an external AI is working")
   until the 30 seconds, and then the end-of-work chime played, even with another folder opened
   meanwhile. Switching the server off already stopped it; now closing and resetting stop it too.
   The REAL text of closeProjectNow and handleResetProject taken from src/App.tsx is run, with the
   real module src/utils/mcpFineLavoro.ts and a fake clock.
   Usage:  node scripts/test-mcp-chime-after-close.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const M = await carica('src/utils/mcpFineLavoro.ts');
const ritaglia = (intestazione) => {
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (!fine) { console.log('NO  non trovato in src/App.tsx: ' + intestazione.trim()); process.exit(1); }
    return sorgente.slice(inizio, fine.index + fine[0].length);
};
const js = (await esbuild.transform(ritaglia('    const closeProjectNow = ') + ritaglia('    const handleResetProject = '), { loader: 'ts' })).code;
const NOMI = ['progettoGenRef', 'aiCancelRequestedRef', 'setAiCancelRequested', 'aiAbortControllerRef', 'localStorage', 'backupDopoChiusura',
    'imagesRef', 'fotoChiuseRef', 'releaseThumbnails', 'images', 'liberaAnteprimeProgetto', 'ultimoSvuotamento', 'setUltimoSvuotamento',
    'setImages', 'setGlobalTriggers', 'setSelectedForBulk', 'setStagedBulkTags', 'setCustomProjectTags', 'setDirHandle', 'setSelectedImageId',
    'setCopiedTags', 'setHistory', 'setHistoryIndex', 'discoNotoRef', 'soundManager', 'showNotification', 't', 'setConfirmDialog',
    'setTagSearch', 'setBulkSearch', 'mcpFineRef'];
const fabbrica = new Function(...NOMI, js + '\nreturn { closeProjectNow, handleResetProject };');

// ITALIANO: un orologio finto: avanza(ms) fa scattare i timer scaduti.
// ENGLISH: a fake clock: avanza(ms) fires the timers that are due.
const orologio = () => {
    let adesso = 0, prossimo = 1;
    const timer = new Map();
    return {
        imposta: (fn, ms) => { const id = prossimo++; timer.set(id, { fn, quando: adesso + ms }); return id; },
        annulla: (id) => { timer.delete(id); },
        avanza: (ms) => {
            const fine = adesso + ms;
            for (;;) {
                const pronti = [...timer.entries()].filter(([, x]) => x.quando <= fine).sort((a, b) => a[1].quando - b[1].quando);
                if (!pronti.length) break;
                const [id, x] = pronti[0];
                timer.delete(id); adesso = x.quando; x.fn();
            }
            adesso = fine;
        },
    };
};

// ITALIANO: l'app finta: il conto vero di fine lavoro, con il suono e il semaforo annotati come in App.tsx.
// ENGLISH: the fake app: the real end-of-work count, with the chime and the light recorded as in App.tsx.
const app = () => {
    const r = { suoni: 0, giallo: false, dialogo: null };
    const clock = orologio();
    const nulla = () => { };
    const mcpFineRef = { current: M.creaFineLavoroMcp(() => { r.suoni++; }, { attivita: (v) => { r.giallo = v; }, orologio: clock }) };
    const finti = {
        progettoGenRef: { current: 0 }, aiCancelRequestedRef: { current: false }, aiAbortControllerRef: { current: null },
        localStorage: { getItem: () => null, setItem: nulla, removeItem: nulla }, backupDopoChiusura: nulla,
        imagesRef: { current: [] }, fotoChiuseRef: { current: new Map() }, releaseThumbnails: nulla, images: [],
        liberaAnteprimeProgetto: nulla, ultimoSvuotamento: null, discoNotoRef: { current: new Map() },
        soundManager: { chime() { }, pop() { } }, showNotification: nulla, t: {},
        setConfirmDialog: (d) => { r.dialogo = d; }, mcpFineRef,
    };
    const f = fabbrica(...NOMI.map(n => (n in finti ? finti[n] : nulla)));
    // ITALIANO: una chiamata dell'AI che cambia dei tag (inizio, poi fine con «cambiate»).
    // ENGLISH: an AI call that changes some tags (inizio, then fine with "changed").
    r.chiamataAi = (cambia = true) => { const giro = mcpFineRef.current.inizio(); mcpFineRef.current.fine(cambia, giro); };
    return { r, clock, ...f };
};

console.log('\n--- l\'AI cambia dei tag, a 5 s si chiude il progetto ---');
{
    const a = app();
    a.r.chiamataAi();
    dice('premessa: semaforo giallo dopo la chiamata', true, a.r.giallo);
    a.clock.avanza(5000);
    a.closeProjectNow();
    dice('Chiudi progetto: il giallo si spegne subito', false, a.r.giallo);
    a.clock.avanza(30000);
    dice('...e a 35 s nessun segnale di fine lavoro', 0, a.r.suoni);
    // ITALIANO: caso vicino: una chiamata arrivata dopo la chiusura fa ripartire il conto da sola.
    // ENGLISH: neighbouring case: a call arriving after the close restarts the count by itself.
    a.r.chiamataAi();
    dice('una chiamata dopo la chiusura riaccende il giallo', true, a.r.giallo);
    a.clock.avanza(30000);
    dice('...e 30 s dopo suona una volta', [1, false], [a.r.suoni, a.r.giallo]);
}

console.log('\n--- lo stesso con «Resetta Progetto» ---');
{
    const a = app();
    a.r.chiamataAi();
    a.clock.avanza(5000);
    a.handleResetProject();
    dice('prima della conferma il conto non cambia (giallo)', true, a.r.giallo);
    a.r.dialogo.onConfirm();
    dice('Reset confermato: il giallo si spegne subito', false, a.r.giallo);
    a.clock.avanza(30000);
    dice('...e nessun segnale di fine lavoro', 0, a.r.suoni);
}
{
    const a = app();
    a.r.chiamataAi();
    a.handleResetProject();
    a.r.dialogo.onCancel();
    a.clock.avanza(30000);
    dice('Reset annullato: il lavoro dell\'AI finisce come sempre (un segnale)', [1, false], [a.r.suoni, a.r.giallo]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const a = app();
    a.r.chiamataAi();
    a.clock.avanza(30000);
    dice('senza chiusura: dopo 30 s di silenzio un segnale e il giallo spento', [1, false], [a.r.suoni, a.r.giallo]);
    const b = app();
    b.r.chiamataAi(false);
    b.clock.avanza(30000);
    dice('solo letture: nessun segnale', 0, b.r.suoni);
}

process.exit(esito());
