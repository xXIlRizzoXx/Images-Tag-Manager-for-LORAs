/* ITALIANO: PROVA DELLA CHIAVE API INCOLLATA CON UN CARATTERE "STRANO"
   Una chiave copiata da Word, da una chat o da una pagina web puo' arrivare fra virgolette curve,
   con davanti uno spazio a larghezza zero (U+200B), oppure al suo posto c'e' un testo in russo o in
   cinese rimasto negli appunti. trim() non toglie niente di tutto questo. La libreria di Google mette
   la chiave in un'intestazione HTTP e il browser si ferma con un errore SENZA stato prima di mandare
   qualunque richiesta: l'errore diventava 'unknown' e la finestra diceva "Controlla la connessione",
   mentre la rete funziona e il problema e' la chiave. La regola: una chiave che non e' fatta solo di
   caratteri ASCII stampabili e' una chiave non valida, si dice "API key non valida" e Google non si
   chiama nemmeno. Le chiavi di Google sono solo lettere, cifre, "-" e "_".
   Si usano la libreria VERA di Google compilata come per la pagina (platform browser), il servizio
   vero e il testo VERO di handleVerifyApiKey preso da src/App.tsx, con un fetch finto che conta le
   richieste (nessuna rete, nessuna chiave vera). Si controlla errorKind e non il testo dell'errore,
   che in Node e' diverso da quello di Chromium.
   Uso:  node scripts/test-key-invalid-chars.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF AN API KEY PASTED WITH AN "ODD" CHARACTER
   A key copied from Word, a chat or a web page can arrive between curly quotes, with a zero-width
   space (U+200B) in front, or be replaced by Russian or Chinese text left on the clipboard. trim()
   removes none of these. Google's library puts the key in an HTTP header and the browser stops with
   an error WITHOUT a status before sending any request: the error became 'unknown' and the dialog
   said "Check your connection", while the network works and the key is the problem. The rule: a key
   not made only of printable ASCII characters is an invalid key, the dialog says "API key invalid"
   and Google is not even called. Google keys are only letters, digits, "-" and "_".
   Google's REAL library built as for the page (platform browser), the real service and the REAL
   text of handleVerifyApiKey taken from src/App.tsx are used, with a fake fetch that counts the
   requests (no network, no real key). errorKind is checked, not the error text, which differs
   between Node and Chromium.
   Usage:  node scripts/test-key-invalid-chars.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
console.warn = () => { };

const carica = async (rel, platform) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform, write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
// ITALIANO: la libreria vera di Google, nella versione per il browser come nella pagina.
// ENGLISH: Google's real library, in its browser build as in the page.
const S = await carica('src/services/geminiService.ts', 'browser');
const lingue = (await carica('src/constants.ts', 'node')).translations;

// ITALIANO: il fetch finto: conta le richieste e risponde come Google (chiave sbagliata o buona).
// ENGLISH: the fake fetch: counts the requests and answers as Google does (wrong or good key).
let richieste = 0;
let risposta = 'sbagliata';
globalThis.fetch = async () => {
    richieste++;
    if (risposta === 'buona') {
        return new Response(JSON.stringify({ models: [{ name: 'models/gemini-finto-flash' }] }),
            { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.',
        status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }),
        { status: 400, headers: { 'content-type': 'application/json' } });
};

const servizio = async (chiave, come = 'sbagliata') => {
    richieste = 0;
    risposta = come;
    const r = await S.verifyGeminiApiKey(chiave);
    return [r.ok, r.errorKind, richieste];
};

// ITALIANO: il testo VERO di handleVerifyApiKey, come in test-key-dialog-message.mjs.
// ENGLISH: the REAL text of handleVerifyApiKey, as in test-key-dialog-message.mjs.
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const handleVerifyApiKey = useCallback(');
const chiusura = /\r?\n    \}, \[tempApiKey, t\]\);\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (!fine) { console.log('NO  handleVerifyApiKey non trovato in src/App.tsx'); process.exit(1); }
const codice = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
const fabbrica = new Function('tempApiKey', 't', 'verifyGeminiApiKey', 'setApiKeyError', 'setIsVerifyingApiKey', 'setGeminiApiKey',
    'setIsApiKeyDialogOpen', 'soundManager', 'showNotification', 'useCallback', 'geminiApiKeyRef', 'setSecret', codice + '\nreturn handleVerifyApiKey;');
const finestra = async (t, chiave, come = 'sbagliata') => {
    richieste = 0;
    risposta = come;
    const errori = [];
    let salvata = null;
    await fabbrica(chiave, t, S.verifyGeminiApiKey, (m) => errori.push(m), () => { }, (k) => { salvata = k; },
        () => { }, { chime() { } }, () => { }, (f) => f, { current: '' }, async () => true)();
    return { mostrato: errori.filter(Boolean).pop(), salvata, richieste };
};

const CORPO = 'FAKE-KEY-ONLY-FOR-THIS-OFFLINE-TEST';
const strane = {
    'virgolette curve': '“' + CORPO + '”',
    'spazio a larghezza zero davanti': '​' + CORPO,
    'frase in cirillico': 'это не ключ, а просто текст из буфера',
    'frase in cinese': '这不是密钥这只是剪贴板里的一段文字而已啊啊啊啊',
    'a capo in mezzo': 'FAKE-KEY-ONLY-FOR\nTHIS-OFFLINE-TEST-0000',
    'spazio in mezzo': 'FAKE-KEY-ONLY-FOR THIS-OFFLINE-TEST-0000',
    'lettera accentata (Latin-1)': 'FAKE-KEY-ONLY-FOR-THIS-OFFLINE-TEST-è',
};

console.log('--- il servizio: chiave con caratteri strani = non valida, Google non si chiama ---');
for (const [nome, chiave] of Object.entries(strane)) {
    dice(`${nome}: invalid_key, 0 richieste`, [false, 'invalid_key', 0], await servizio(chiave.trim()));
}

console.log('\n--- la finestra: "API key non valida", non "Controlla la connessione" ---');
for (const l of ['it', 'en', 'ru', 'zh']) {
    const t = lingue[l];
    for (const [nome, chiave] of Object.entries(strane)) {
        const r = await finestra(t, chiave);
        dice(`${l}: ${nome} -> aiKeyInvalid, nessuna richiesta, niente salvato`, [t.aiKeyInvalid, 0, null], [r.mostrato, r.richieste, r.salvata]);
    }
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const ascii = 'AIzaSy' + 'x'.repeat(33);
    dice('chiave ASCII sbagliata: Google si chiama ancora (1 richiesta) e dice invalid_key',
        [false, 'invalid_key', 1], await servizio(ascii));
    dice('chiave ASCII buona: ok, 1 richiesta', [true, undefined, 1], await servizio(ascii, 'buona'));
    dice('chiave con "-" e "_": ok, 1 richiesta', [true, undefined, 1], await servizio('AIza-_' + 'Ab9'.repeat(11), 'buona'));
    dice('chiave troppo corta: invalid_key, 0 richieste', [false, 'invalid_key', 0], await servizio('corta'));
    const t = lingue.it;
    const buona = await finestra(t, '  ' + ascii + '  ', 'buona');
    dice('finestra: chiave buona con spazi normali ai lati (trim) -> salvata, nessun errore',
        [ascii, undefined, 1], [buona.salvata, buona.mostrato, buona.richieste]);
    const sbagliata = await finestra(t, ascii);
    dice('finestra: chiave ASCII sbagliata -> aiKeyInvalid dopo 1 richiesta', [t.aiKeyInvalid, 1], [sbagliata.mostrato, sbagliata.richieste]);
}

process.exit(esito());
