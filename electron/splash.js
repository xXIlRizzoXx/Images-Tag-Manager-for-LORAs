/* ITALIANO: Script della schermata di avvio.
   Sta in un file A PARTE, non dentro splash.html, perche' in produzione la regola di
   sicurezza (CSP "script-src 'self'") rifiuta gli script scritti dentro la pagina: la
   versione restava quindi bloccata sul testo scritto a mano e i messaggi non cambiavano.
   In sviluppo non si notava, perche' li' la regola non viene applicata.

   ENGLISH: Splash screen script.
   It lives in a SEPARATE file rather than inside splash.html because in production the
   security rule (CSP "script-src 'self'") refuses scripts written inside the page: the
   version therefore stayed stuck on the hardcoded text and the messages never rotated.
   It was invisible in development, where the rule is not applied. */

const messages = [
    'Inizializzazione ambiente...',
    'Caricamento moduli AI...',
    'Preparazione interfaccia...',
    'Avvio in corso...',
];

let i = 0;
const msgEl = document.getElementById('loading-msg');

if (msgEl) {
    setInterval(function () {
        i = (i + 1) % messages.length;
        msgEl.style.opacity = 0;
        setTimeout(function () {
            msgEl.innerText = messages[i];
            msgEl.style.opacity = 1;
        }, 200);
    }, 800);
}

// ITALIANO: Chiede la versione al processo principale tramite il ponte sicuro (preload)
// ENGLISH: Asks the main process for the version through the secure bridge (preload)
if (window.electronAPI && typeof window.electronAPI.getAppVersion === 'function') {
    window.electronAPI.getAppVersion()
        .then(function (v) {
            const el = document.getElementById('version-text');
            if (v && el) el.innerText = 'v' + v;
        })
        .catch(function () { /* ITALIANO: fallback silenzioso — ENGLISH: silent fallback */ });
}
