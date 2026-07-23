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

// ITALIANO: "Caricamento moduli AI" era un residuo dell'AI locale, rimossa tempo fa:
//           l'app non carica piu' nessun modulo AI all'avvio.
// ENGLISH: "Loading AI modules" was a leftover from the local AI, removed long ago:
//          the app no longer loads any AI module at startup.
const messages = [
    'Inizializzazione ambiente...',
    'Preparazione interfaccia...',
    'Quasi pronto...',
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

// ITALIANO: Chiede la versione al processo principale tramite il ponte sicuro (preload).
//           La scrive sotto al sottotitolo (ben visibile) e anche in basso a destra.
// ENGLISH: Asks the main process for the version through the secure bridge (preload).
//          Writes it under the subtitle (clearly visible) and also at the bottom right.
if (window.electronAPI && typeof window.electronAPI.getAppVersion === 'function') {
    window.electronAPI.getAppVersion()
        .then(function (v) {
            if (!v) return;
            const principale = document.getElementById('version-main');
            if (principale) principale.innerText = 'v' + v;
        })
        .catch(function () { /* ITALIANO: fallback silenzioso — ENGLISH: silent fallback */ });
}

// ITALIANO: Il copyright apre il profilo GitHub nel browser di sistema (non dentro l'app).
//           L'apertura passa dal processo principale, che accetta solo http/https.
// ENGLISH: The copyright opens the GitHub profile in the system browser (not inside the app).
//          It goes through the main process, which only accepts http/https.
const PROFILO_GITHUB = 'https://github.com/xXIlRizzoXx';
const copyrightEl = document.getElementById('copyright-link');
if (copyrightEl && window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
    copyrightEl.addEventListener('click', function () {
        window.electronAPI.openExternal(PROFILO_GITHUB);
    });
}
