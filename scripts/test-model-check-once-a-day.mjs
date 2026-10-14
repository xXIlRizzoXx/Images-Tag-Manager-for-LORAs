/* ITALIANO: PROVA DEL CONTROLLO AUTOMATICO DEI MODELLI "AL MASSIMO UNA VOLTA AL GIORNO"
   Il README e la spiegazione nelle Impostazioni promettono che, con l'AI accesa, il programma si
   collega da solo a Google al massimo una volta al giorno per controllare i modelli. Ma il
   controllo all'avvio guardava solo "ultimo controllo riuscito", che non si scrive quando Google
   e' occupato, la prova del modello nuovo risponde 503/429, la rete manca o la chiave non va:
   allora ogni avvio, e ogni volta che si spegneva e riaccendeva l'AI, rifaceva l'elenco e la
   prova. La regola: il controllo automatico si fa al massimo una volta ogni 24 ore, riuscito o
   no; "ultimo controllo" nelle Impostazioni resta quello vero (riuscito). "Controlla ora" e la
   riparazione dopo "modello non disponibile" non passano da qui.
   Si esegue il testo VERO dell'effetto di avvio preso da src/App.tsx, con un controllaModello
   finto che conta le chiamate (nessuna rete, nessuna chiave).
   Uso:  node scripts/test-model-check-once-a-day.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE AUTOMATIC MODEL CHECK "AT MOST ONCE A DAY"
   The README and the hint in Settings promise that, with the AI on, the app connects to Google
   on its own at most once a day to check the models. But the startup check only looked at "last
   successful check", which is not written when Google is busy, the new model's probe answers
   503/429, the network is down or the key does not work: then every launch, and every time the
   AI was switched off and on, redid the list and the probe. The rule: the automatic check runs at
   most once every 24 hours, successful or not; "last check" in Settings stays the true
   (successful) one. "Check now" and the repair after "model unavailable" do not go through here.
   The REAL text of the startup effect taken from src/App.tsx is run, with a fake controllaModello
   counting the calls (no network, no key).
   Usage:  node scripts/test-model-check-once-a-day.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');

// ITALIANO: l'effetto di avvio, trovato dalla sua riga sulle 24 ore.
// ENGLISH: the startup effect, found from its 24-hour line.
const iGiorno = sorgente.indexOf('if (Date.now() - modelloControllatoIl < 24 * 60 * 60 * 1000) return;');
const i0 = iGiorno < 0 ? -1 : sorgente.lastIndexOf('    useEffect(() => {', iGiorno);
const i1 = iGiorno < 0 ? -1 : sorgente.indexOf('    }, [aiEnabled, geminiApiKey]);', iGiorno);
if (i0 < 0 || i1 < 0) { console.log('NO  effetto di avvio del controllo dei modelli non trovato in src/App.tsx'); process.exit(1); }
const testo = sorgente.slice(i0 + '    useEffect('.length, i1 + '    }'.length);
const js = (await esbuild.transform('const effetto = ' + testo + ';', { loader: 'ts' })).code;
const NOMI = ['aiEnabled', 'geminiApiKey', 'modelloControllatoIl', 'controllaModello', 'localStorage', 'Date'];
const fabbrica = new Function(...NOMI, js + '\nreturn effetto;');

const ORA = 3600 * 1000;
const T0 = Date.UTC(2026, 9, 14, 8, 0, 0);
// ITALIANO: la memoria del browser resta da un avvio all'altro; l'ora la decide la prova.
// ENGLISH: the browser storage survives from one launch to the next; the test decides the time.
const creaPC = () => {
    const salvato = new Map();
    const memoria = { getItem: (k) => (salvato.has(k) ? salvato.get(k) : null), setItem: (k, v) => salvato.set(k, String(v)), removeItem: (k) => salvato.delete(k) };
    let chiamate = 0;
    // ITALIANO: un avvio (o un cambio di AI o chiave): l'effetto gira con lo stato di quel momento.
    //           Il controllo finto finisce come uno "occupato": "ultimo controllo" non si scrive.
    // ENGLISH: a launch (or an AI or key change): the effect runs with that moment's state. The fake
    //          check ends like a "busy" one: "last check" is not written.
    const avvio = (adesso, { aiEnabled = true, geminiApiKey = 'chiave-finta' } = {}) => {
        const prima = chiamate;
        const controllatoIl = parseInt(memoria.getItem('aiModelloControllatoIl') || '0', 10);
        fabbrica(aiEnabled, geminiApiKey, controllatoIl, () => { chiamate++; }, memoria, { now: () => adesso })();
        return chiamate - prima;
    };
    return { avvio, salvato, memoria };
};

console.log('\n--- il controllo all\'avvio non riesce (Google occupato): gli avvii dopo, lo stesso giorno ---');
{
    const pc = creaPC();
    dice('il primo avvio controlla', 1, pc.avvio(T0));
    dice('"ultimo controllo" non si scrive per un controllo non riuscito', false, pc.salvato.has('aiModelloControllatoIl'));
    dice('un secondo avvio un\'ora dopo non si collega di nuovo', 0, pc.avvio(T0 + ORA));
    dice('neanche spegnendo e riaccendendo l\'AI', 0, pc.avvio(T0 + 2 * ORA, { aiEnabled: false }) + pc.avvio(T0 + 2 * ORA));
    dice('il giorno dopo (25 ore) si riprova', 1, pc.avvio(T0 + 25 * ORA));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const pc = creaPC();
    dice('AI spenta: nessun collegamento', 0, pc.avvio(T0, { aiEnabled: false }));
    dice('senza chiave: nessun collegamento', 0, pc.avvio(T0, { geminiApiKey: '' }));
    dice('...e nessun tentativo annotato: accesa l\'AI, il controllo parte', 1, pc.avvio(T0 + ORA));
    const ok = creaPC();
    ok.memoria.setItem('aiModelloControllatoIl', String(T0 - 2 * ORA));
    dice('un controllo riuscito due ore fa basta per oggi', 0, ok.avvio(T0));
    const vecchio = creaPC();
    vecchio.memoria.setItem('aiModelloControllatoIl', String(T0 - 30 * ORA));
    dice('un controllo riuscito ieri: oggi si controlla', 1, vecchio.avvio(T0));
}

console.log('\n--- src/App.tsx: "Controlla ora" e la riparazione non passano dal limite del giorno ---');
{
    const iRipara = sorgente.indexOf('if (riparaModello > 0) controllaModello(true, true);');
    dice('la riparazione chiama controllaModello direttamente', true, iRipara > 0);
    dice('"Controlla ora" chiama controllaModello direttamente', true, /onClick=\{\(\) => controllaModello\(false, true\)\}/.test(sorgente));
}

process.exit(esito());
