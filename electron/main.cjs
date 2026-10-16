/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: MOTORE DESKTOP (ELECTRON)                                       **
**  Questo file permette al programma di funzionare come una vera app         **
**  per computer, gestendo la finestra e il sistema operativo.                **
**                                                                            **
**  ENGLISH: DESKTOP ENGINE (ELECTRON)                                        **
**  This file allows the program to run as a real computer app,               **
**  managing the window and the operating system.                             **
**                                                                            **
*******************************************************************************
*******************************************************************************/
const { app, BrowserWindow, ipcMain, net, safeStorage, session, Menu, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ITALIANO: "sviluppo" si decide dal fatto che l'app NON sia impacchettata, non da una
//           variabile d'ambiente. NODE_ENV puo' essere impostata da chiunque avvii l'exe:
//           con essa un semplice avvio da riga di comando poteva disattivare le protezioni
//           di produzione (CSP, blocco navigazione, menu). app.isPackaged e' vero solo nell'app
//           installata/portable e non e' influenzabile dall'esterno.
// ENGLISH: "development" is decided by the app NOT being packaged, not by an env var. NODE_ENV
//          can be set by whoever launches the exe: with it, a plain command-line launch could
//          disable the production protections (CSP, navigation lock, menu). app.isPackaged is
//          true only in the installed/portable app and cannot be influenced from outside.
const isDev = !app.isPackaged;

// ITALIANO: Lingua scelta dall'utente, salvata in un file di userData dal renderer. Serve alla
//           schermata di avvio (che e' una finestra a parte e non vede il localStorage dell'app)
//           per mostrare i propri testi nella lingua giusta gia' al primo istante.
// ENGLISH: The user's chosen language, saved to a userData file by the renderer. The splash screen
//          (a separate window that cannot see the app's localStorage) uses it to show its own text
//          in the right language from the very first moment.
// ITALIANO: le 9 lingue dell'interfaccia. Serve solo a non passare allo splash una lingua che poi
//           non saprebbe tradurre (in quel caso ripiega sull'inglese da solo).
// ENGLISH: the 9 UI languages. Only used so we never hand the splash a language it cannot translate
//          (in which case it falls back to English on its own).
const SPLASH_LANGS = ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'];

// ITALIANO: lingua di Windows ridotta alle due lettere iniziali ("it-IT" -> "it"), usata al primo
//           avvio quando l'utente non ha ancora scelto. Stessa regola del selettore nell'app.
// ENGLISH: Windows' language cut to its first two letters ("it-IT" -> "it"), used on first launch
//          when the user has not chosen yet. Same rule the in-app picker uses.
const systemUiLang = () => {
    try {
        const code = String(app.getLocale() || '').slice(0, 2).toLowerCase();
        return SPLASH_LANGS.includes(code) ? code : '';
    } catch (_) {
        return '';
    }
};

const getUiLangPath = () => path.join(app.getPath('userData'), 'ui-lang.json');
const readUiLang = () => {
    try {
        const raw = fs.readFileSync(getUiLangPath(), 'utf8');
        const parsed = JSON.parse(raw);
        const lang = parsed && typeof parsed.lang === 'string' ? parsed.lang : '';
        return /^[a-z]{2}$/.test(lang) ? lang : '';
    } catch (_) {
        return '';
    }
};
ipcMain.handle('app:persist-lang', (_event, lang) => {
    if (typeof lang !== 'string' || !/^[a-z]{2}$/.test(lang)) return false;
    try {
        fs.writeFileSync(getUiLangPath(), JSON.stringify({ lang }), { encoding: 'utf8' });
        return true;
    } catch (e) {
        console.error('Failed to persist ui language', e);
        return false;
    }
});

// ITALIANO: Lettura della versione una sola volta all'avvio
// ENGLISH: Read the version once at startup
let appVersion = '0.0.0';
try {
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    appVersion = packageData.version || appVersion;
} catch (e) {
    console.error('Unable to read version from package.json', e);
}

// ITALIANO: Lock per evitare istanze multiple dell'app
// ENGLISH: Lock to prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
    process.exit(0);
}

// ITALIANO: Riferimenti alle finestre conservati a livello modulo
// ENGLISH: Window references kept at module level
let mainWindow = null;
let splashWindow = null;

// ITALIANO: Handler IPC per la versione dell'app
// ENGLISH: IPC handler for the app version
ipcMain.handle('app:get-version', () => appVersion);

// ITALIANO: Storage cifrato per la API key Gemini: safeStorage (su Windows la protezione dati DPAPI dell'account) in userData/secrets.json
// ENGLISH: Encrypted storage for the Gemini API key: safeStorage (on Windows the account's DPAPI data protection) in userData/secrets.json
const getSecretsPath = () => path.join(app.getPath('userData'), 'secrets.json');

const readSecrets = () => {
    try {
        const p = getSecretsPath();
        if (!fs.existsSync(p)) return {};
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        console.error('Failed to read secrets file', e);
        return {};
    }
};

const writeSecrets = (data) => {
    try {
        fs.writeFileSync(getSecretsPath(), JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
        return true;
    } catch (e) {
        console.error('Failed to write secrets file', e);
        return false;
    }
};

ipcMain.handle('secure-storage:get', (_event, key) => {
    if (typeof key !== 'string' || !key) return '';
    try {
        const secrets = readSecrets();
        const encoded = secrets[key];
        if (!encoded || typeof encoded !== 'string') return '';
        if (!safeStorage.isEncryptionAvailable()) return '';
        const buf = Buffer.from(encoded, 'base64');
        return safeStorage.decryptString(buf);
    } catch (e) {
        console.error('secure-storage:get failed', e);
        return '';
    }
});

ipcMain.handle('secure-storage:set', (_event, key, value) => {
    if (typeof key !== 'string' || !key) return false;
    try {
        const secrets = readSecrets();
        if (typeof value !== 'string' || value === '') {
            delete secrets[key];
        } else {
            if (!safeStorage.isEncryptionAvailable()) return false;
            const encrypted = safeStorage.encryptString(value);
            secrets[key] = encrypted.toString('base64');
        }
        return writeSecrets(secrets);
    } catch (e) {
        console.error('secure-storage:set failed', e);
        return false;
    }
});

ipcMain.handle('secure-storage:delete', (_event, key) => {
    if (typeof key !== 'string' || !key) return false;
    try {
        const secrets = readSecrets();
        delete secrets[key];
        return writeSecrets(secrets);
    } catch (e) {
        console.error('secure-storage:delete failed', e);
        return false;
    }
});

/* ITALIANO: TAG "GEMELLI" (.txt) DELLE IMMAGINI SCELTE
   Quando l'utente sceglie delle immagini singole, il selettore mostra SOLO immagini.
   Qui, per ogni immagine scelta, cerco accanto ad essa il file di testo con lo STESSO
   nome (foto.jpg -> foto.txt) e, se c'e', lo leggo: cosi' i tag si abbinano da soli.
   Se il .txt non c'e' (es. prima volta) non succede nulla: si carica solo l'immagine.

   Limiti di sicurezza (il ponte resta stretto): leggo SOLO file .txt, SOLO se accanto
   a un'immagine vera che esiste su disco, mai in scrittura e mai oltre 1 MB.

   ENGLISH: SIDECAR .txt TAGS FOR THE PICKED IMAGES
   When the user picks individual images the dialog shows ONLY images. Here, for each
   picked image, I look next to it for the text file with the SAME name
   (photo.jpg -> photo.txt) and read it if present, so tags pair up automatically.
   If there is no .txt (e.g. first time) nothing happens: only the image is loaded.

   Safety limits (the bridge stays narrow): read ONLY .txt files, ONLY when sitting next
   to a real image that exists on disk, never write, never above 1 MB. */
// ITALIANO: I percorsi arrivano dal renderer (ricavati dai file scelti dall'utente): sono sempre
//           percorsi LOCALI e ASSOLUTI. Come difesa in profondita' scarto tutto il resto — percorsi
//           di rete UNC (\\server\share), percorsi "device" (\\?\...) e qualsiasi segmento ".." di
//           risalita — cosi' questi canali non possono essere spinti a leggere/scrivere/cestinare
//           file fuori da dove l'utente ha davvero puntato. Unica eccezione: i due canali del .txt
//           accettano anche \\server\condivisione\... (vedi isSafeSidecarPath qui sotto).
// ENGLISH: Paths come from the renderer (derived from the user's picked files): they are always
//          LOCAL, ABSOLUTE paths. As defense in depth I reject everything else — UNC network paths
//          (\\server\share), device paths (\\?\...) and any ".." traversal segment — so these
//          channels cannot be steered into reading/writing/trashing files outside what the user
//          actually pointed at. Only exception: the two .txt channels also accept
//          \\server\share\... (see isSafeSidecarPath below).
const isSafeLocalPath = (p) => {
    if (typeof p !== 'string' || !p) return false;
    if (/^[\\/]{2}/.test(p)) return false;        // UNC / device / //host
    if (!path.isAbsolute(p)) return false;
    if (p.split(/[\\/]+/).includes('..')) return false;
    return true;
};
// ITALIANO: SOLO per i due canali del .txt (lettura e scrittura) si accetta anche una cartella di
//           rete scritta per esteso, \\server\condivisione\...: una foto scelta o trascinata da li'
//           arriva con quel percorso, e la stessa cartella raggiunta con una lettera (Z:\) funzionava
//           gia'. Restano rifiutati i percorsi "device" (\\?\, \\.\), la forma con le barre //host e
//           ogni segmento "..". Toccare \\server fa autenticare Windows verso quel server: va bene,
//           il file l'ha scelto l'utente. Il Cestino, il ripristino e la cartella scelta restano su
//           isSafeLocalPath: li' una cartella di rete resta fuori (decide la seconda conferma).
// ENGLISH: ONLY for the two .txt channels (read and write) a network folder spelled out,
//          \\server\share\..., is accepted too: a photo picked or dropped from there arrives with
//          that path, and the same folder reached through a letter (Z:\) already worked. Device
//          paths (\\?\, \\.\), the //host slash form and any ".." segment stay refused. Touching
//          \\server makes Windows authenticate to that server: fine, the user picked the file. The
//          Recycle Bin, the restore and the picked folder stay on isSafeLocalPath: there a network
//          folder stays out (the second confirmation decides).
const isSafeSidecarPath = (p) => {
    if (isSafeLocalPath(p)) return true;
    if (typeof p !== 'string') return false;
    if (!/^\\\\[^\\/?.][^\\/]*\\[^\\/]+\\[^\\/]/.test(p)) return false;   // \\server\share\file
    if (p.split(/[\\/]+/).includes('..')) return false;
    return path.isAbsolute(p);
};

const SIDECAR_MAX_BYTES = 1024 * 1024;
// ITALIANO: nessun tetto sul NUMERO di foto per richiesta. Prima si leggevano solo le prime 5000,
//           in silenzio: dalla 5001esima la foto arrivava senza tag, e un'aggiunta in blocco
//           seguita da "Salva" le riscriveva il .txt con la sola parola chiave, cancellando i tag
//           veri. I limiti che proteggono restano quelli per file: solo .txt, solo accanto a
//           un'immagine vera, mai oltre 1 MB.
// ENGLISH: no cap on the NUMBER of photos per request. Only the first 5000 used to be read,
//          silently: from the 5001st on the photo arrived without tags, and a bulk addition
//          followed by "Save" rewrote its .txt with the trigger word alone, wiping the real tags.
//          The limits that protect stay per file: .txt only, only next to a real image, never
//          above 1 MB.
// ITALIANO: la pagina accetta un'immagine dal tipo che le da' il browser (image/...), non
//           dall'estensione, e il browser chiama image/jpeg anche .jfif, .jpe, .pjpeg e .pjp
//           (Windows salva cosi' molti JPEG scaricati). Senza queste voci quelle foto si
//           caricavano, ma il loro .txt non si leggeva, non si salvava, e il Cestino le rifiutava.
// ENGLISH: the page accepts an image by the type the browser gives it (image/...), not by its
//          extension, and the browser calls .jfif, .jpe, .pjpeg and .pjp image/jpeg too (Windows
//          saves many downloaded JPEGs that way). Without these entries those photos loaded, but
//          their .txt was not read, could not be saved, and the Recycle Bin refused them.
// ITALIANO: per lo stesso motivo ci sono anche .apng, .ico, .svg, .svgz e .xbm: il browser li
//           chiama image/... e la pagina li carica, quindi il loro .txt va letto, salvato e
//           cestinato come quello delle altre foto.
// ENGLISH: for the same reason .apng, .ico, .svg, .svgz and .xbm are here too: the browser calls
//          them image/... and the page loads them, so their .txt must be read, saved and trashed
//          like the other photos'.
const SIDECAR_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.jfif', '.jpe', '.pjpeg', '.pjp', '.png', '.webp', '.gif', '.bmp', '.avif', '.tif', '.tiff',
    '.apng', '.ico', '.svg', '.svgz', '.xbm', '.heic', '.heif']);

// ITALIANO: il testo di un .txt dai suoi byte, con la STESSA regola di decodificaSidecar in
//           src/utils/sidecarTags.ts (copiata qui perche' questo file e' CommonJS): BOM FF FE / FE FF
//           -> UTF-16 (Windows PowerShell 5.1, Blocco note "Unicode"), altrimenti UTF-8 valido senza
//           caratteri NUL. Il resto (ANSI con lettere accentate, UTF-16 senza BOM) torna null: la
//           codifica non si indovina e il .txt torna come saltato, protetto da Salva. Prima si leggeva
//           sempre in UTF-8 e la spazzatura finiva nei tag, e poi sopra il file vero.
//           UTF-16 BE si scambia a mano in LE: non dipende dai dati ICU.
// ENGLISH: a .txt's text from its bytes, with the SAME rule as decodificaSidecar in
//          src/utils/sidecarTags.ts (copied here because this file is CommonJS): BOM FF FE / FE FF
//          -> UTF-16 (Windows PowerShell 5.1, Notepad "Unicode"), otherwise valid UTF-8 with no NUL
//          characters. Anything else (ANSI with accented letters, UTF-16 with no BOM) returns null:
//          the encoding is not guessed and the .txt comes back as skipped, protected from Save. It
//          used to be always read as UTF-8, and the garbage went into the tags, then over the real
//          file. UTF-16 BE is swapped to LE by hand: no dependence on ICU data.
const decodificaSidecar = (buf) => {
    try {
        if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le', { fatal: true }).decode(buf.subarray(2));
        if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
            const corpo = Buffer.from(buf.subarray(2));
            if (corpo.length % 2 !== 0) return null;
            return new TextDecoder('utf-16le', { fatal: true }).decode(corpo.swap16());
        }
        const testo = new TextDecoder('utf-8', { fatal: true }).decode(buf);
        return testo.includes('\u0000') ? null : testo;
    } catch (_) {
        return null;
    }
};

ipcMain.handle('images:read-sidecar-tags', (_event, imagePaths) => {
    if (!Array.isArray(imagePaths)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of imagePaths) {
        if (!isSafeSidecarPath(raw)) continue;
        try {
            // ITALIANO: dev'essere un'immagine VERA presente su disco
            // ENGLISH: it must be a REAL image present on disk
            if (!SIDECAR_IMAGE_EXT.has(path.extname(raw).toLowerCase())) continue;
            const imgStat = fs.statSync(raw);
            if (!imgStat.isFile()) continue;

            const base = path.basename(raw, path.extname(raw));
            const txtPath = path.join(path.dirname(raw), base + '.txt');
            if (path.extname(txtPath).toLowerCase() !== '.txt') continue;
            if (seen.has(txtPath)) continue;
            seen.add(txtPath);

            // ITALIANO: un .txt che C'E' ma non si legge (oltre 1 MB, bloccato da un altro programma,
            //           un file di OneDrive solo in rete) non si scarta in silenzio: torna segnato
            //           { skipped: true }, senza testo, e la pagina lo conta fra i .txt saltati, come fa
            //           "Carica cartella". Prima la foto sembrava senza tag e un "Salva" dopo
            //           un'aggiunta in blocco riscriveva quel .txt coi soli tag nuovi. Un .txt che non
            //           c'e' resta il caso normale: nessun segnale.
            // ENGLISH: a .txt that EXISTS but cannot be read (over 1 MB, locked by another program, a
            //          OneDrive online-only file) is not dropped silently: it comes back marked
            //          { skipped: true }, with no text, and the page counts it among the skipped .txt
            //          files, as "Load Folder" does. The photo used to look untagged and a "Save" after
            //          a bulk addition rewrote that .txt with the new tags alone. A .txt that is not
            //          there stays the normal case: no signal.
            const saltato = { name: base + '.txt', dir: path.dirname(txtPath), skipped: true };
            const nonCe = (e) => Boolean(e && (e.code === 'ENOENT' || e.code === 'ENOTDIR'));
            let txtStat;
            try { txtStat = fs.statSync(txtPath); } catch (e) { if (!nonCe(e)) out.push(saltato); continue; }
            if (!txtStat.isFile()) continue;
            if (txtStat.size > SIDECAR_MAX_BYTES) { out.push(saltato); continue; }
            let byte;
            try { byte = fs.readFileSync(txtPath); } catch (e) { if (!nonCe(e)) out.push(saltato); continue; }
            const content = decodificaSidecar(byte);
            if (content === null) { out.push(saltato); continue; }
            // ITALIANO: torno anche la cartella del .txt: cosi' il rinnovo lato app puo' abbinare
            //           ogni testo alla SUA immagine anche se due foto scelte hanno lo stesso nome
            //           ma stanno in cartelle diverse.
            // ENGLISH: also return the .txt's folder: this lets the app pair each text with ITS
            //          image even when two picked photos share a name but sit in different folders.
            out.push({ name: base + '.txt', content, dir: path.dirname(txtPath) });
        } catch (_) {
            // ITALIANO: l'immagine stessa non si legge: non c'e' niente da abbinare, si prosegue
            // ENGLISH: the image itself cannot be read: there is nothing to pair, carry on
        }
    }
    return out;
});

/* ITALIANO: SCRITTURA DEL .txt "GEMELLO" (per le foto caricate con "Carica immagini")
   Le foto scelte come file singoli non hanno un handle di cartella scrivibile: prima il loro
   salvataggio degradava a un DOWNLOAD del browser che, in Electron, apre una finestra "Salva
   con nome" annullabile. La funzione pero' dava per "salvato" senza sapere se il file fosse
   stato davvero scritto, e "Salva e chiudi" cancellava il backup: bastava annullare per perdere
   i tag. Questo canale scrive il .txt SUL POSTO (accanto all'immagine vera) e torna l'esito
   REALE per ogni file. Contratto stretto identico alla lettura: si scrive SOLO un .txt accanto
   a un'immagine che esiste davvero su disco — non puo' diventare un "scrivi qualsiasi file".
   ENGLISH: WRITE THE SIDECAR .txt (for photos loaded via "Load images")
   Photos picked as individual files have no writable folder handle: their save used to degrade
   to a browser DOWNLOAD which, in Electron, opens a cancellable "Save as" dialog. The function
   reported "saved" without knowing whether the file was actually written, and "Save and close"
   then deleted the backup: cancelling was enough to lose the tags. This channel writes the .txt
   IN PLACE (next to the real image) and returns the REAL per-file outcome. Narrow contract, same
   as reading: it writes ONLY a .txt next to an image that truly exists on disk — it cannot become
   a "write any file" primitive. */
const WRITE_MAX_BYTES = 1024 * 1024;
// ITALIANO: come per la lettura, nessun tetto sul numero di foto: prima dalla 5001esima in poi
//           non si scriveva niente, e la risposta, piu' corta della richiesta, diceva ok:true.
// ENGLISH: as for reading, no cap on the number of photos: from the 5001st on nothing used to be
//          written, and the answer, shorter than the request, still said ok:true.

ipcMain.handle('images:write-sidecar-tags', (_event, items) => {
    if (!Array.isArray(items)) return { ok: false, written: 0, failed: 0, results: [] };
    let written = 0;
    let failed = 0;
    const results = [];
    for (const it of items) {
        const imagePath = it && typeof it.imagePath === 'string' ? it.imagePath : '';
        const content = it && typeof it.content === 'string' ? it.content : '';
        try {
            // ITALIANO: dev'essere un'immagine VERA presente su disco (stesso contratto della lettura)
            // ENGLISH: it must be a REAL image present on disk (same contract as reading)
            if (!isSafeSidecarPath(imagePath) || !SIDECAR_IMAGE_EXT.has(path.extname(imagePath).toLowerCase())) { failed++; results.push(false); continue; }
            if (Buffer.byteLength(content, 'utf8') > WRITE_MAX_BYTES) { failed++; results.push(false); continue; }
            const imgStat = fs.statSync(imagePath);
            if (!imgStat.isFile()) { failed++; results.push(false); continue; }
            const base = path.basename(imagePath, path.extname(imagePath));
            const txtPath = path.join(path.dirname(imagePath), base + '.txt');
            if (path.extname(txtPath).toLowerCase() !== '.txt') { failed++; results.push(false); continue; }
            // ITALIANO: una foto senza tag e senza .txt resta senza: un .txt vuoto NUOVO farebbe
            //           fermare Kohya ("caption file is empty"), uno che manca no. La foto risulta
            //           salvata (il disco e' gia' com'e' lei). Un .txt che c'era si svuota davvero.
            // ENGLISH: a photo with no tags and no .txt stays without one: a NEW empty .txt would
            //          stop Kohya ("caption file is empty"), a missing one does not. The photo counts
            //          as saved (the disk already matches it). A .txt that was there is really emptied.
            if (content === '' && !fs.existsSync(txtPath)) { results.push(true); continue; }
            fs.writeFileSync(txtPath, content, 'utf8');
            written++;
            results.push(true);
        } catch (e) {
            console.error('write-sidecar-tags: could not write next to', imagePath, e);
            failed++;
            results.push(false);
        }
    }
    return { ok: failed === 0, written, failed, results };
});

/* ITALIANO: CESTINO DI SISTEMA
   Sposta i file nel Cestino di Windows invece di cancellarli per sempre, cosi' un
   ripensamento resta sempre recuperabile. Accetto solo immagini e .txt: il canale non
   deve poter diventare un "cancella qualsiasi cosa". I file inesistenti (es. il .txt di
   una foto che non ne ha) vengono ignorati senza errore.

   ENGLISH: SYSTEM RECYCLE BIN
   Moves files to the Windows Recycle Bin instead of deleting them for good, so a change of
   mind stays recoverable. Only images and .txt files are accepted: this channel must not
   become a "delete anything" primitive. Missing files (e.g. the .txt of a photo that has
   none) are skipped without error. */
const TRASH_ALLOWED_EXT = new Set([...SIDECAR_IMAGE_EXT, '.txt']);
const TRASH_MAX_FILES = 5000;

// ITALIANO: l'esito torna adesso FILE PER FILE, in `results`, con tre valori distinti:
//   'ok'       il file e' nel Cestino di Windows, oppure non c'era gia' piu' (niente da fare)
//   'rifiutato' questo canale non puo' toccarlo: percorso di RETE scritto \\server\..., estensione
//              fuori dall'elenco ammesso, oppure Windows ha rifiutato lo spostamento su un'unita'
//              senza Cestino (lettera collegata a una condivisione di rete, chiavetta USB, scheda SD)
//              o col Cestino spento o troppo piccolo per quel file
//   'errore'   il file c'e' ma non si e' riusciti a spostarlo (bloccato, permessi)
//   Prima i tre casi erano indistinguibili: i primi due uscivano da un `continue` silenzioso e il
//   gruppo tornava {ok:true, trashed:0}, cioe' "riuscito" senza aver spostato niente. 'rifiutato'
//   NON e' un vicolo cieco: chi chiama lo tratta come "Cestino non raggiungibile". Per una foto
//   aperta con "Carica cartella" offre la cancellazione definitiva con la seconda conferma; per
//   una foto caricata una per una o trascinata (nessuna cartella aperta) dice perche' non si puo'
//   e cosa fare, invece di un "non rimossa" muto a ogni tentativo.
// ENGLISH: the outcome now comes back FILE BY FILE in `results`, with three distinct values:
//   'ok'        the file reached the Windows Recycle Bin, or was already gone (nothing to do)
//   'rifiutato' this channel cannot touch it: a NETWORK path spelled \\server\..., an extension
//               outside the allowed list, or Windows refused the move on a drive with no Recycle
//               Bin (a letter mapped to a network share, a USB stick, an SD card) or with the
//               Recycle Bin turned off or too small for that file
//   'errore'    the file is there but could not be moved (locked, permissions)
//   The three used to be indistinguishable: the first two left through a silent `continue` and the
//   batch returned {ok:true, trashed:0} - "success" having moved nothing. 'rifiutato' is NOT a dead
//   end: the caller reads it as "Recycle Bin out of reach". For a photo opened with "Load Folder"
//   it offers the permanent delete behind the second confirmation; for a photo loaded one by one
//   or dropped in (no open folder) it says why that is not possible and what to do, instead of a
//   silent "not removed" on every try.
ipcMain.handle('shell:trash-files', async (_event, filePaths) => {
    if (!Array.isArray(filePaths)) return { ok: false, trashed: 0, failed: 0, results: [] };
    let trashed = 0;
    let failed = 0;
    const results = [];
    for (const raw of filePaths.slice(0, TRASH_MAX_FILES)) {
        // ITALIANO: su una cartella di rete scritta \\server\condivisione\... non si cestina mai
        //           niente (decisione A). Pero' una foto che l'utente ha gia' cancellato da Esplora
        //           file, come gli dice il messaggio dell'app, deve poter uscire dal cestino
        //           dell'app: prima il percorso veniva scartato PRIMA di guardare se il file c'era
        //           ancora, e la risposta restava 'rifiutato' a ogni tentativo. Ora, per un percorso
        //           ammesso dai canali del .txt e con un'estensione ammessa, si guarda soltanto: file
        //           assente su una condivisione che risponde = 'ok' (niente spostato, trashed resta 0);
        //           file presente, o condivisione che non risponde = 'rifiutato' come prima.
        //           \\?\, \\.\, //host e '..' restano rifiutati senza guardare niente.
        // ENGLISH: nothing is ever trashed on a network folder spelled \\server\share\... (decision
        //          A). But a photo the user already deleted in File Explorer, as the app's message
        //          tells them to, must be able to leave the app's trash: the path used to be refused
        //          BEFORE checking whether the file was still there, so the answer stayed 'rifiutato'
        //          on every try. Now, for a path the .txt channels accept and an allowed extension, we
        //          only look: file gone on a share that answers = 'ok' (nothing moved, trashed stays
        //          0); file there, or a share that does not answer = 'rifiutato' as before.
        //          \\?\, \\.\, //host and '..' stay refused without looking at anything.
        if (!isSafeLocalPath(raw)) {
            let assente = false;
            if (isSafeSidecarPath(raw) && TRASH_ALLOWED_EXT.has(path.extname(raw).toLowerCase())) {
                try { assente = !fs.statSync(raw).isFile(); } catch (err) { assente = Boolean(err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')); }
                if (assente) {
                    try { assente = fs.statSync(path.parse(raw).root).isDirectory(); } catch (_) { assente = false; }
                }
            }
            results.push(assente ? 'ok' : 'rifiutato');
            continue;
        }
        if (!TRASH_ALLOWED_EXT.has(path.extname(raw).toLowerCase())) { results.push('rifiutato'); continue; }
        // ITALIANO: un file assente (es. il .txt di una foto senza tag) e' NORMALE: si salta e
        //           non conta come errore. Un file che ESISTE ma non si riesce a cestinare
        //           (bloccato, permessi) e' un errore vero.
        // ENGLISH: a missing file (e.g. the .txt of a photo with no tags) is NORMAL: skip it and do
        //          not count it as an error. A file that EXISTS but cannot be trashed (locked,
        //          permissions) is a real error.
        // ITALIANO: "assente" pero' solo se Windows dice che il file non c'e' (ENOENT/ENOTDIR) E la
        //           radice della sua unita' risponde, come per le cartelle di rete. Una chiavetta
        //           staccata o un'unita' di rete (Z:\) spenta davano 'ok': la foto usciva dal
        //           progetto con "spostati nel Cestino di Windows" ed era ancora nella cartella.
        //           Ora resta 'errore': la foto resta nel cestino dell'app e si puo' riprovare.
        // ENGLISH: "missing" only when Windows says the file is not there (ENOENT/ENOTDIR) AND the
        //          root of its drive answers, as for network folders. An unplugged USB stick or a
        //          network drive (Z:\) that is off answered 'ok': the photo left the project with
        //          "moved to the Windows Recycle Bin" and was still in the folder. Now it stays
        //          'errore': the photo stays in the app's trash and the user can try again.
        let exists = false;
        let assenzaCerta = true;
        try { exists = fs.statSync(raw).isFile(); } catch (err) {
            exists = false;
            assenzaCerta = Boolean(err && (err.code === 'ENOENT' || err.code === 'ENOTDIR'));
            if (assenzaCerta) {
                try { assenzaCerta = fs.statSync(path.parse(raw).root).isDirectory(); } catch (_) { assenzaCerta = false; }
            }
        }
        if (!exists && !assenzaCerta) {
            console.error('trash-files: drive not reachable', raw);
            failed++;
            results.push('errore');
            continue;
        }
        if (!exists) { results.push('ok'); continue; }
        try {
            await shell.trashItem(raw);
            trashed++;
            results.push('ok');
        } catch (e) {
            // ITALIANO: il Cestino si prova SEMPRE prima: dove non c'e', Windows rifiuta lo
            //           spostamento e non cancella niente. Solo DOPO un rifiuto si guarda perche'.
            //           Se il file e' ancora li' e il Cestino su quell'unita' non esiste, si risponde
            //           'rifiutato' (la pagina offre la seconda conferma se la cartella e' aperta, se no
            //           spiega cosa fare), altrimenti la foto resterebbe bloccata nel cestino dell'app
            //           a ogni tentativo. Due casi:
            //           - una lettera collegata a una condivisione di rete (Z:\ -> \\nas\dati): il
            //             percorso VERO lo dice Windows (per un'unita' di rete risponde \\server\...).
            //             Prima lo si guardava prima di provare, e chi ha il Cestino anche li' (una
            //             cartella utente spostata alla radice dell'unita') lo perdeva;
            //           - una chiavetta USB o una scheda SD: alla radice non c'e' $RECYCLE.BIN.
            //           Un file bloccato su un disco che il Cestino ce l'ha resta 'errore'. Un disco col
            //           Cestino spento ha comunque $RECYCLE.BIN: per quello vedi la prova qui sotto.
            // ENGLISH: the Recycle Bin is ALWAYS tried first: where there is none, Windows refuses the
            //          move and deletes nothing. Only AFTER a refusal do we look at why. If the file is
            //          still there and that drive has no Recycle Bin, we answer 'rifiutato' (the page
            //          offers the second confirmation when the folder is open, otherwise it says what to
            //          do), otherwise the photo would stay stuck in the app's trash on every try. Two
            //          cases:
            //          - a drive letter mapped to a network share (Z:\ -> \\nas\data): Windows tells the
            //            REAL path (for a network drive it answers \\server\...). It used to be checked
            //            before trying, and whoever has a Recycle Bin there too (a user folder moved to
            //            the drive's root) lost it;
            //          - a USB stick or an SD card: there is no $RECYCLE.BIN at the root.
            //          A locked file on a disk that has a Recycle Bin stays 'errore'. A disk with the
            //          Recycle Bin turned off still has $RECYCLE.BIN: for that see the check below.
            let ancoraLi = false;
            try { ancoraLi = fs.statSync(raw).isFile(); } catch (_) { ancoraLi = false; }
            let percorsoVero = raw;
            try { percorsoVero = fs.realpathSync.native(raw); } catch (_) { percorsoVero = raw; }
            percorsoVero = String(percorsoVero || raw);
            const diRete = /^[\\/]{2}/.test(percorsoVero);
            let senzaCestino = false;
            if (ancoraLi && !diRete) {
                try {
                    fs.statSync(path.join(path.parse(percorsoVero).root, '$RECYCLE.BIN'));
                } catch (err) {
                    senzaCestino = Boolean(err && (err.code === 'ENOENT' || err.code === 'ENOTDIR'));
                }
            }
            if (ancoraLi && (diRete || senzaCestino)) { results.push('rifiutato'); continue; }
            // ITALIANO: un disco col Cestino SPENTO ("non spostare i file nel Cestino"), o un file
            //           piu' grande del Cestino di quel disco: Windows rifiuta anche li', ma la cartella
            //           $RECYCLE.BIN c'e', e prima la risposta era 'errore' a ogni tentativo, senza
            //           seconda conferma: la foto non usciva mai dal cestino dell'app. Per distinguerlo
            //           da un file bloccato si prova ad aprirlo in lettura e scrittura: se un altro
            //           programma lo tiene (EBUSY, EPERM, qualsiasi errore) resta 'errore' come prima.
            //           Se si apre, nessuno lo blocca: un blocco di un attimo (antivirus, indicizzazione)
            //           si riconosce riprovando una volta il Cestino; se rifiuta di nuovo, si risponde
            //           'rifiutato' e la pagina chiede la seconda conferma, che dice che e' definitivo.
            //           Dopo l'apertura si rinomina il file su se' stesso: serve il permesso di
            //           cancellare, quindi fallisce (EBUSY) anche con un programma che lo tiene
            //           aperto lasciando leggere e scrivere ma non cancellare (Python open(), PIL);
            //           su un file libero non cambia niente. Anche quell'errore resta 'errore'.
            //           Un file con l'attributo "sola lettura" (fotocamere con la protezione, file
            //           copiati da un CD) non si apre MAI in scrittura (EPERM), anche se nessuno lo
            //           blocca: per lui si salta l'apertura e decide solo la rinomina, che riesce
            //           sui file in sola lettura e fallisce (EBUSY) se un programma lo tiene aperto.
            //           Nota: aprire un file "solo online" di OneDrive lo scarica; succede solo dopo
            //           che il Cestino lo ha gia' rifiutato.
            // ENGLISH: a disk with the Recycle Bin TURNED OFF ("don't move files to the Recycle Bin"),
            //          or a file bigger than that disk's Recycle Bin: Windows refuses there too, but the
            //          $RECYCLE.BIN folder exists, and the answer used to be 'errore' on every try, with
            //          no second confirmation: the photo never left the app's trash. To tell it from a
            //          locked file we try to open it for reading and writing: if another program holds it
            //          (EBUSY, EPERM, any error) it stays 'errore' as before. If it opens, nobody is
            //          locking it: a lock of a moment (antivirus, indexing) is caught by trying the
            //          Recycle Bin once more; if it refuses again we answer 'rifiutato' and the page asks
            //          the second confirmation, which says it is final.
            //          After the open the file is renamed onto itself: that needs delete access, so
            //          it fails (EBUSY) also when a program holds it open allowing read and write but
            //          not delete (Python open(), PIL); on a free file it changes nothing. That error
            //          stays 'errore' too.
            //          A file with the "read-only" attribute (cameras with the protect flag, files
            //          copied from a CD) NEVER opens for writing (EPERM), even when nobody locks it:
            //          for it the open is skipped and only the rename decides, which succeeds on
            //          read-only files and fails (EBUSY) when a program holds it open.
            //          Note: opening an online-only OneDrive file downloads it; this only happens after
            //          the Recycle Bin has already refused it.
            if (ancoraLi && !diRete) {
                let siApre = false;
                try {
                    const soloLettura = (fs.statSync(raw).mode & 0o200) === 0;
                    if (!soloLettura) fs.closeSync(fs.openSync(raw, 'r+'));
                    fs.renameSync(raw, raw);
                    siApre = true;
                } catch (_) { siApre = false; }
                if (siApre) {
                    try {
                        await shell.trashItem(raw);
                        trashed++;
                        results.push('ok');
                        continue;
                    } catch (_) {
                        let restaLi = false;
                        try { restaLi = fs.statSync(raw).isFile(); } catch (__) { restaLi = false; }
                        if (restaLi) { results.push('rifiutato'); continue; }
                    }
                }
            }
            // ITALIANO: NON annunciamo un successo falso: prima si ritornava sempre ok:true, cosi'
            //           una foto che il cestino NON era riuscito a spostare veniva comunque tolta dal
            //           progetto e il ripiego non partiva mai. Ora ok e' falso se qualcosa e' fallito.
            // ENGLISH: do NOT report a false success: it used to always return ok:true, so a photo the
            //          Recycle Bin FAILED to move was still dropped from the project and the fallback
            //          never ran. Now ok is false if anything failed.
            console.error('trash-files: could not trash', raw, e);
            failed++;
            results.push('errore');
        }
    }
    return { ok: failed === 0, trashed, failed, results };
});

/* ITALIANO: FUORI DAL CESTINO DI WINDOWS (l'annullamento dello svuotamento)
   Electron sa mettere un file nel Cestino ma non sa tirarlo fuori: Windows quella strada la
   espone solo alla shell. Si passa quindi da PowerShell, che parla con la shell via COM.

   Cinque cose imparate provandolo davvero, e ognuna sarebbe stata un difetto silenzioso:
   1. il nome che la shell mostra segue l'impostazione "nascondi le estensioni", quindi puo'
      arrivare senza ".txt": l'estensione vera si prende dal nome interno ($R......txt), che
      non mente mai. Cercando per nome mostrato non si ritroverebbe niente su mezzo mondo.
   2. il verbo si chiama 'undelete', NON la voce di menu "Ripristina": quella e' tradotta, e
      su un Windows tedesco o cinese cercarla per nome non troverebbe mai niente.
   3. se al posto del file e' nato un omonimo, NON si ripristina: si torna 'occupato' e lo si
      dice. Il ripristino della shell sovrascriverebbe, e questo canale esiste per NON perdere
      file, non per perderne di nuovi.
   4. nel Cestino possono esserci due voci con lo stesso percorso d'origine (un omonimo cancellato
      prima): si ripristina quella cancellata per ULTIMA, cioe' quella appena svuotata dall'app.
   5. PowerShell legge e scrive con la code page della console, non in UTF-8: senza dirglielo
      ogni percorso con una lettera accentata, cirillica o cinese tornava "non trovato".

   Il testo dello script e' una costante: i percorsi entrano da stdin come JSON, mai dentro la
   riga di comando, cosi' un nome di file con virgolette o punti e virgola non puo' diventare
   un comando. La finestra della console resta nascosta.

   ENGLISH: OUT OF THE WINDOWS RECYCLE BIN (undoing the emptying)
   Electron can put a file in the Recycle Bin but cannot take it back out: Windows exposes that
   road only to the shell. So we go through PowerShell, which talks to the shell over COM.

   Five things learned by actually trying it, each of which would have been a silent defect:
   1. the name the shell reports follows the "hide known extensions" setting, so it can arrive
      without ".txt": the real extension comes from the internal name ($R......txt), which never
      lies. Matching on the displayed name would find nothing on half the machines out there.
   2. the verb is 'undelete', NOT the menu entry "Restore": that one is translated, and on a
      German or Chinese Windows looking it up by name would never find it.
   3. if a namesake has appeared in the meantime, we do NOT restore: we return 'occupato' and
      say so. The shell's own restore would overwrite, and this channel exists so files are NOT
      lost, not so that new ones are.
   4. the Recycle Bin can hold two entries with the same original path (a namesake deleted
      earlier): the one deleted LAST is restored, i.e. the one the app has just emptied.
   5. PowerShell reads and writes with the console code page, not UTF-8: unless told otherwise,
      every path with an accented, Cyrillic or Chinese letter came back "not found".

   The script text is a constant: paths come in through stdin as JSON, never on the command
   line, so a file name containing quotes or semicolons cannot become a command. The console
   window stays hidden. */
const RESTORE_TIMEOUT_MS = 60000;
const SCRIPT_RIPRISTINO = [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    "$voluti = @()",
    "# main.cjs scrive i percorsi in UTF-8 e legge la risposta in UTF-8. Senza questa riga PowerShell",
    "# usa la code page della console (850, 1252, 932...): una lettera accentata arriva come due",
    "# caratteri sbagliati e nessun percorso non ASCII combacia col Cestino. Provato: tutto nonTrovato.",
    "# Servono tutte e due: con la sola entrata il file torna ma il percorso rimandato indietro si",
    "# rompe e main.cjs lo segna fallito. Se manca la console il catch lascia tutto come prima.",
    "try { [Console]::OutputEncoding = (New-Object System.Text.UTF8Encoding $false); [Console]::InputEncoding = (New-Object System.Text.UTF8Encoding $false) } catch {}",
    "$grezzo = [Console]::In.ReadToEnd()",
    "# ConvertFrom-Json NON sgrana l elenco: lo consegna tutto intero come un oggetto solo.",
    "# Senza questo giro $voluti diventa un elenco con dentro un elenco, il ciclo gira una",
    "# volta sola e non ripristina niente. Provato: senza, il canale torna tutto fallito.",
    "if ($grezzo) { foreach ($x in (ConvertFrom-Json $grezzo)) { $voluti += [string]$x } }",
    "$esiti = @{}",
    "foreach ($p in $voluti) { $esiti[$p.ToLowerInvariant()] = 'nonTrovato' }",
    "$shell = New-Object -ComObject Shell.Application",
    "$bin = $shell.Namespace(0xA)",
    "# PRIMA si guarda tutto il Cestino e si segna cosa serve, POI si ripristina. Ripristinare",
    "# mentre si sta ancora scorrendo l elenco lo cambia sotto i piedi: il verbo non protesta,",
    "# semplicemente non fa niente. Provato: mescolando le due fasi non torna indietro un file.",
    "$scelte = @{}",
    "# Un nome mostrato che finisce GIA con l estensione vera ha due letture: x.png con le estensioni",
    "# visibili, oppure x.png.png con le estensioni nascoste (chi rinomina in x.png da Esplora file",
    "# ottiene proprio x.png.png). Prima valeva solo la prima lettura, e x.png.png tornava nonTrovato",
    "# pur essendo nel Cestino. Ora si tengono le letture chieste dal programma; se le chiede tutte e",
    "# due (x.png e x.png.png svuotate insieme) prima si assegnano le voci senza dubbi, poi quella",
    "# dubbia prende il percorso rimasto libero, e a parita la lettura con l estensione aggiunta",
    "# (le estensioni nascoste sono l impostazione di Windows). Solo dal nome non si puo fare di piu.",
    "$candidate = @()",
    "foreach ($v in @($bin.Items())) {",
    "  $nome = $v.Name",
    "  $est = [System.IO.Path]::GetExtension($v.Path)",
    "  $nomi = @($nome)",
    "  if ($est) { if ($nome.EndsWith($est, 'OrdinalIgnoreCase')) { $nomi = @(($nome + $est), $nome) } else { $nomi = @($nome + $est) } }",
    "  # Il Cestino ha anche le voci di altri programmi. Join-Path chiede a PowerShell se l unita",
    "  # esiste: per una voce da un disco esterno che ha cambiato lettera lanciava un errore, e con",
    "  # 'Stop' lo script finiva senza risposta, ogni volta. Path.Combine non chiede niente all unita;",
    "  # una voce estranea che da errore si salta. Provato: con Join-Path tutto fallito.",
    "  $possibili = @()",
    "  try { $cart = [string]$bin.GetDetailsOf($v, 1); foreach ($n in $nomi) { $c = [System.IO.Path]::Combine($cart, $n); if ($esiti.ContainsKey($c.ToLowerInvariant())) { $possibili += $c } } } catch { continue }",
    "  if ($possibili.Count -eq 0) { continue }",
    "  $candidate += [pscustomobject]@{ voce = $v; possibili = $possibili }",
    "}",
    "$prese = @{}",
    "foreach ($c in $candidate) { if ($c.possibili.Count -eq 1) { $prese[$c.possibili[0].ToLowerInvariant()] = $true } }",
    "$ordinate = @($candidate | Where-Object { $_.possibili.Count -eq 1 }) + @($candidate | Where-Object { $_.possibili.Count -gt 1 })",
    "foreach ($c in $ordinate) {",
    "  $v = $c.voce",
    "  $orig = $c.possibili[0]",
    "  if ($c.possibili.Count -gt 1 -and $prese.ContainsKey($c.possibili[0].ToLowerInvariant()) -and -not $prese.ContainsKey($c.possibili[1].ToLowerInvariant())) { $orig = $c.possibili[1] }",
    "  $k = $orig.ToLowerInvariant()",
    "  if ($esiti[$k] -eq 'occupato') { continue }",
    "  if (Test-Path -LiteralPath $orig) { $esiti[$k] = 'occupato'; $scelte.Remove($k); continue }",
    "  # Nel Cestino possono esserci DUE voci con lo stesso percorso (un omonimo cancellato prima):",
    "  # l ordine dell elenco e casuale, e prendere la prima poteva rimettere la foto VECCHIA sotto",
    "  # la scheda di quella nuova. Si tiene la voce cancellata per ULTIMA, cioe quella che il",
    "  # programma ha appena mandato li. La data e un DateTime, non il testo tradotto della colonna;",
    "  # una voce senza data non scavalca mai una che ce l ha, e senza date si fa come prima.",
    "  $quando = $null",
    "  try { $quando = $v.ExtendedProperty('System.Recycle.DateDeleted') } catch { $quando = $null }",
    "  if ($quando -isnot [datetime]) { $quando = $null }",
    "  if ($scelte.ContainsKey($k)) {",
    "    $prima = $scelte[$k].quando",
    "    if (($null -eq $quando) -or (($null -ne $prima) -and ($prima -ge $quando))) { continue }",
    "  }",
    "  $esiti[$k] = 'inCorso'",
    "  $scelte[$k] = [pscustomobject]@{ voce = $v; orig = $orig; k = $k; quando = $quando }",
    "}",
    "$daFare = @($scelte.Values)",
    "$avviati = @()",
    "foreach ($d in $daFare) {",
    "  try {",
    "    # Split-Path non accetta -LiteralPath insieme a -Parent: protesta e il catch qui",
    "    # sotto se la mangiava, tornando un fallito senza motivo. Il metodo .NET non ha",
    "    # set di parametri e non si fa ingannare dalle parentesi quadre nei nomi.",
    "    $cart = [System.IO.Path]::GetDirectoryName($d.orig)",
    "    if (-not (Test-Path -LiteralPath $cart)) { New-Item -ItemType Directory -Path $cart -Force | Out-Null }",
    "    $d.voce.InvokeVerb('undelete')",
    "    $avviati += $d.orig",
    "  } catch { $esiti[$d.k] = 'fallito' }",
    "}",
    "# L attesa cresce col numero di file: con migliaia di file 20 secondi fissi non bastavano.",
    "$scadenza = (Get-Date).AddSeconds(20 + 0.05 * $avviati.Count)",
    "while ($avviati.Count -gt 0 -and (Get-Date) -lt $scadenza) {",
    "  Start-Sleep -Milliseconds 200",
    "  $ancora = @()",
    "  foreach ($o in $avviati) { if (Test-Path -LiteralPath $o) { $esiti[$o.ToLowerInvariant()] = 'ok' } else { $ancora += $o } }",
    "  $avviati = $ancora",
    "}",
    "foreach ($o in $avviati) { $esiti[$o.ToLowerInvariant()] = 'fallito' }",
    "$pezzi = @()",
    "foreach ($p in $voluti) { $pezzi += ([pscustomobject]@{ percorso = $p; esito = $esiti[$p.ToLowerInvariant()] } | ConvertTo-Json -Compress) }",
    "[Console]::Out.Write('[' + ($pezzi -join ',') + ']')",
].join('\n');

ipcMain.handle('shell:restore-trashed', async (_event, filePaths) => {
    const results = [];
    if (process.platform !== 'win32' || !Array.isArray(filePaths)) return { ok: false, restored: 0, results };
    const voluti = [];
    // ITALIANO: nessun tetto sul NUMERO di file per richiesta. Prima si guardavano solo i primi
    //           5000, in silenzio: per gli altri non tornava nessun esito, e la pagina li contava
    //           "non rimessi a posto" senza che nessuno li avesse cercati. Il tempo massimo (qui
    //           sotto) e l'attesa dello script crescono gia' col numero di file; spezzare la
    //           chiamata in piu' pezzi farebbe scorrere tutto il Cestino una volta per pezzo.
    // ENGLISH: no cap on the NUMBER of files per request. Only the first 5000 used to be looked at,
    //          silently: the rest got no outcome at all, and the page counted them "not put back"
    //          although nobody had looked for them. The time limit (below) and the script's wait
    //          already grow with the number of files; splitting the call into chunks would scan the
    //          whole Recycle Bin once per chunk.
    for (const raw of filePaths) {
        // ITALIANO: stesso contratto stretto degli altri canali: solo percorsi locali assoluti.
        // ENGLISH: same narrow contract as the other channels: local absolute paths only.
        if (!isSafeLocalPath(raw)) { results.push({ percorso: String(raw || ''), esito: 'rifiutato' }); continue; }
        voluti.push(raw);
    }
    if (voluti.length === 0) return { ok: false, restored: 0, results };

    // ITALIANO: quali file c'erano GIA' prima di cominciare (un omonimo): servono per dire il vero
    //           quando il tempo scade, vedi sotto. Il tempo massimo cresce col numero di file: un
    //           minuto fisso non bastava a svuotamenti di migliaia di foto.
    // ENGLISH: which files were ALREADY there before starting (a namesake): needed to tell the
    //          truth when time runs out, see below. The time limit grows with the number of files:
    //          a fixed minute was not enough for emptyings of thousands of photos.
    const giaPresenti = new Set(voluti.filter((p) => { try { return fs.existsSync(p); } catch (_) { return false; } }));
    const tempoMassimo = RESTORE_TIMEOUT_MS + 100 * voluti.length;

    const esitiPS = await new Promise((resolve) => {
        let uscito = false;
        const fine = (v) => { if (!uscito) { uscito = true; resolve(v); } };
        try {
            const psExe = process.env.SystemRoot
                ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
                : 'powershell.exe';
            // ITALIANO: -Sta serve a Shell.Application (COM vuole quell'apartment); windowsHide
            //           tiene la finestra nera fuori dallo schermo di chi usa il programma.
            // ENGLISH: -Sta is what Shell.Application needs (COM wants that apartment);
            //          windowsHide keeps the black console window off the user's screen.
            const ps = spawn(psExe, ['-NoProfile', '-NonInteractive', '-Sta', '-Command', SCRIPT_RIPRISTINO], { windowsHide: true });
            let out = '';
            // ITALIANO: allo scadere si ferma PowerShell e si aspetta che sia davvero chiuso (al
            //           massimo 5 secondi) prima di guardare il disco: un file spostato un attimo
            //           dopo il controllo tornerebbe 'fallito' pur essendo gia' al suo posto.
            // ENGLISH: when time runs out PowerShell is stopped and we wait until it has really
            //          closed (5 seconds at most) before looking at the disk: a file moved a moment
            //          after the check would come back 'fallito' while already in its place.
            let scaduto = false;
            const orologio = setTimeout(() => {
                scaduto = true;
                try { ps.kill(); } catch (_) {}
                setTimeout(() => fine(null), 5000);
            }, tempoMassimo);
            // ITALIANO: la risposta e' UTF-8 (vedi lo script): una lettera di piu' byte puo' cadere
            //           a cavallo di due pezzi, e decodificarli uno per uno la romperebbe.
            // ENGLISH: the answer is UTF-8 (see the script): a multi-byte letter can straddle two
            //          chunks, and decoding them one by one would break it.
            ps.stdout.setEncoding('utf8');
            ps.stdout.on('data', (d) => { out += String(d); });
            ps.on('error', (e) => { clearTimeout(orologio); console.error('restore-trashed: PowerShell non partito', e); fine(null); });
            ps.on('close', () => {
                clearTimeout(orologio);
                if (scaduto) { fine(null); return; }
                try { fine(JSON.parse(out.trim() || '[]')); } catch (e) { console.error('restore-trashed: risposta illeggibile', e); fine(null); }
            });
            ps.stdin.on('error', () => {});
            ps.stdin.end(JSON.stringify(voluti));
        } catch (e) {
            console.error('restore-trashed: non riuscito', e);
            fine(null);
        }
    });

    // ITALIANO: se PowerShell non ha risposto NON si inventa un esito: ogni percorso torna
    //           'fallito'. Un finto "riuscito" qui sarebbe la bugia peggiore di tutte.
    // ENGLISH: if PowerShell did not answer we do NOT invent an outcome: every path comes back
    //          as 'fallito'. A fake "success" here would be the worst lie of the lot.
    const perPercorso = new Map();
    if (Array.isArray(esitiPS)) {
        for (const e of esitiPS) {
            if (e && typeof e.percorso === 'string') perPercorso.set(e.percorso, String(e.esito || 'fallito'));
        }
    }
    // ITALIANO: un file che prima non c'era e adesso e' al suo posto E' tornato, anche se la risposta
    //           e' mancata (tempo scaduto) o lo dava ancora per 'fallito' (l'attesa dello script e'
    //           finita un attimo prima). Dirlo 'fallito' era falso: l'app lo teneva fuori dal
    //           progetto, il nuovo tentativo non lo trovava piu' nel Cestino ('nonTrovato') e il suo
    //           .txt restava li'. Un file che c'era gia' prima (un omonimo) non diventa mai 'ok'.
    // ENGLISH: a file that was not there before and is in its place now HAS come back, even when the
    //          answer was missing (time ran out) or still called it 'fallito' (the script's wait ended
    //          a moment earlier). Calling it 'fallito' was false: the app kept it out of the project,
    //          the retry no longer found it in the Recycle Bin ('nonTrovato') and its .txt stayed
    //          there. A file that was already there before (a namesake) never becomes 'ok'.
    const tornatoDavvero = (p) => { try { return !giaPresenti.has(p) && fs.existsSync(p); } catch (_) { return false; } };
    let restored = 0;
    for (const p of voluti) {
        let esito = perPercorso.get(p) || 'fallito';
        if (esito === 'fallito' && tornatoDavvero(p)) esito = 'ok';
        if (esito === 'ok') restored++;
        results.push({ percorso: p, esito });
    }
    return { ok: restored === voluti.length, restored, results };
});

/* ITALIANO: APERTURA DI UN INDIRIZZO WEB NEL BROWSER DI SISTEMA
   Serve ai link dell'app (es. il profilo GitHub sulla schermata di avvio). Accetto
   SOLO http e https: cosi' il canale non puo' essere usato per lanciare programmi o
   aprire file locali.
   ENGLISH: OPEN A WEB ADDRESS IN THE SYSTEM BROWSER
   Used by the app's links (e.g. the GitHub profile on the splash screen). Only http and
   https are accepted, so this channel cannot be used to launch programs or open local
   files. */
/* ITALIANO: CONTROLLO DELLE VERSIONI NUOVE
   L'unico collegamento a internet che il programma apre di sua iniziativa, e lo apre SOLO
   se l'utente ha risposto di si' alla domanda che gli viene fatta una volta sola: e' la
   pagina a decidere se chiamare questo canale. Di serie non lo chiama.
   Sta nel processo principale e non nella pagina per due motivi: la Content-Security-Policy
   della pagina permette solo Google (main.cjs, connect-src), e allargarla vorrebbe dire
   aprire quella porta anche a tutto il resto del codice della pagina.
   Esce solo il numero di versione: nessun dato dell'utente, nessun identificativo.
   Fallisce in silenzio - senza rete, con GitHub giu', o oltre il tempo massimo, il
   programma parte come sempre e non dice niente.

   ENGLISH: NEW VERSION CHECK. The only connection to the internet the program opens on its
   own, and it opens it ONLY when the user has said yes to a question asked once: the page
   decides whether to call this channel at all, and by default it does not.
   It lives in the main process, not in the page, for two reasons: the page's
   Content-Security-Policy only allows Google, and widening it would open that door to every
   other piece of page code too. Nothing but a version number comes back: no user data, no
   identifier. It fails silently - offline, GitHub down, or past the timeout, the program
   starts as always and says nothing. */
const UPDATE_REPO = 'xXIlRizzoXx/Images-Tag-Manager-for-LORAs';
const UPDATE_API = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;
const UPDATE_PAGE = `https://github.com/${UPDATE_REPO}/releases`;
const UPDATE_TIMEOUT_MS = 6000;
const UPDATE_MAX_BYTES = 200000;

/* ITALIANO: Confronta due numeri di versione pezzo per pezzo (1.10.0 e' piu' recente di
   1.9.0, che l'ordine alfabetico sbaglierebbe). Ignora una eventuale 'v' iniziale e tutto
   cio' che non e' una cifra, cosi' 'v1.3.0-beta' vale 1.3.0.
   ENGLISH: Compares two version numbers part by part (1.10.0 is newer than 1.9.0, which a
   string sort would get wrong). Ignores a leading 'v' and any non-digits. */
const pezziVersione = (v) => String(v || '').replace(/^v/i, '').split('.')
    .map((p) => parseInt(p, 10)).map((n) => (Number.isFinite(n) ? n : 0));

const versionePiuRecente = (candidata, attuale) => {
    const a = pezziVersione(candidata);
    const b = pezziVersione(attuale);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const x = a[i] || 0;
        const y = b[i] || 0;
        if (x !== y) return x > y;
    }
    return false;
};

ipcMain.handle('updates:check', async () => new Promise((resolve) => {
    let chiuso = false;
    const rispondi = (v) => { if (!chiuso) { chiuso = true; clearTimeout(scadenza); resolve(v); } };
    const scadenza = setTimeout(() => rispondi(null), UPDATE_TIMEOUT_MS);
    try {
        const req = net.request({ method: 'GET', url: UPDATE_API });
        // GitHub rifiuta le richieste senza User-Agent
        req.setHeader('User-Agent', 'Images-Tag-Manager-for-LORAs');
        req.setHeader('Accept', 'application/vnd.github+json');
        req.on('response', (res) => {
            if (res.statusCode !== 200) { res.resume(); rispondi(null); return; }
            let corpo = '';
            res.on('data', (c) => { if (corpo.length < UPDATE_MAX_BYTES) corpo += c.toString('utf8'); });
            res.on('end', () => {
                try {
                    const dati = JSON.parse(corpo);
                    const trovata = String(dati && dati.tag_name ? dati.tag_name : '').trim();
                    if (!trovata || !versionePiuRecente(trovata, app.getVersion())) { rispondi(null); return; }
                    rispondi({ versione: trovata.replace(/^v/i, ''), pagina: UPDATE_PAGE });
                } catch (_) { rispondi(null); }
            });
            res.on('error', () => rispondi(null));
        });
        req.on('error', () => rispondi(null));
        req.end();
    } catch (_) { rispondi(null); }
}));
// ITALIANO: SERVER MCP (vedi electron/mcp-server.src.mjs). Spento di serie; lo stato e il codice
//           segreto stanno in userData/mcp.json. Il server non ha le foto: ogni domanda di un'AI
//           esterna si gira alla finestra (canale 'mcp:request'), che risponde su 'mcp:response'.
//           Il codice del server si carica solo quando lo si accende.
// ENGLISH: MCP SERVER (see electron/mcp-server.src.mjs). Off by default; its state and secret
//          token live in userData/mcp.json. The server holds no photos: every question from an
//          external AI is forwarded to the window ('mcp:request'), which answers on
//          'mcp:response'. The server code is loaded only when it is switched on.
const MCP_PORTA = 37620;
const MCP_TIMEOUT_MS = 60000;
const getMcpPath = () => path.join(app.getPath('userData'), 'mcp.json');
const leggiMcp = () => {
    try {
        const j = JSON.parse(fs.readFileSync(getMcpPath(), 'utf8'));
        return { acceso: j.acceso === true, codice: typeof j.codice === 'string' && j.codice.length >= 32 ? j.codice : '' };
    } catch (_) {
        return { acceso: false, codice: '' };
    }
};
const scriviMcp = (dati) => {
    try {
        fs.writeFileSync(getMcpPath(), JSON.stringify({ acceso: dati.acceso === true, codice: String(dati.codice || '') }), 'utf8');
        return true;
    } catch (e) {
        console.error('[MCP] settings not saved', e);
        return false;
    }
};
const nuovoCodiceMcp = () => require('crypto').randomBytes(24).toString('base64url');
let mcpServer = null;
let mcpErrore = '';
let mcpProssimoId = 1;
const mcpInAttesa = new Map();

const chiediAllaFinestra = (strumento, argomenti) => new Promise((risolvi) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
        risolvi({ errore: 'Images Tag Manager has no open window.' });
        return;
    }
    const id = mcpProssimoId++;
    const timer = setTimeout(() => {
        mcpInAttesa.delete(id);
        risolvi({ errore: 'Images Tag Manager did not answer in time.' });
    }, MCP_TIMEOUT_MS);
    mcpInAttesa.set(id, { risolvi, timer });
    mainWindow.webContents.send('mcp:request', { id, strumento: String(strumento), argomenti: argomenti || {} });
});
ipcMain.on('mcp:response', (event, messaggio) => {
    // ITALIANO: risponde solo la finestra principale, e solo a una domanda fatta davvero.
    // ENGLISH: only the main window answers, and only to a question really asked.
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return;
    const voce = mcpInAttesa.get(messaggio && messaggio.id);
    if (!voce) return;
    clearTimeout(voce.timer);
    mcpInAttesa.delete(messaggio.id);
    voce.risolvi(messaggio.risposta && typeof messaggio.risposta === 'object' ? messaggio.risposta : { errore: 'Empty answer.' });
});
const statoMcp = () => {
    const c = leggiMcp();
    return { acceso: c.acceso, attivo: mcpServer !== null, porta: MCP_PORTA, codice: c.codice, errore: mcpErrore };
};
const fermaMcp = async () => {
    const s = mcpServer;
    mcpServer = null;
    if (s) { try { await s.chiudi(); } catch (_) { } }
    for (const voce of mcpInAttesa.values()) {
        clearTimeout(voce.timer);
        voce.risolvi({ errore: 'The MCP server was switched off.' });
    }
    mcpInAttesa.clear();
};
const avviaMcp = async () => {
    await fermaMcp();
    mcpErrore = '';
    let c = leggiMcp();
    if (!c.codice) {
        c = { ...c, codice: nuovoCodiceMcp() };
        scriviMcp(c);
    }
    try {
        const { avviaServerMcp } = require('./mcp-server.cjs');
        mcpServer = await avviaServerMcp({ porta: MCP_PORTA, codice: c.codice, chiedi: chiediAllaFinestra, versione: appVersion });
    } catch (e) {
        mcpServer = null;
        // ITALIANO: 'porta' = un altro programma usa gia' la porta; 'avvio' = qualunque altro guasto.
        // ENGLISH: 'porta' = another program already uses the port; 'avvio' = any other fault.
        mcpErrore = e && e.code === 'EADDRINUSE' ? 'porta' : 'avvio';
        console.error('[MCP] start failed', e);
    }
};
ipcMain.handle('mcp:get-status', () => statoMcp());
ipcMain.handle('mcp:set-enabled', async (_event, acceso) => {
    const c = leggiMcp();
    const nuovo = { acceso: acceso === true, codice: c.codice || nuovoCodiceMcp() };
    if (!scriviMcp(nuovo)) {
        mcpErrore = 'salvataggio';
        return { ...statoMcp(), acceso: mcpServer !== null };
    }
    if (nuovo.acceso) await avviaMcp();
    else { await fermaMcp(); mcpErrore = ''; }
    return statoMcp();
});
ipcMain.handle('mcp:new-token', async () => {
    const c = leggiMcp();
    if (!scriviMcp({ acceso: c.acceso, codice: nuovoCodiceMcp() })) {
        mcpErrore = 'salvataggio';
        return statoMcp();
    }
    if (c.acceso) await avviaMcp();
    return statoMcp();
});
app.on('will-quit', () => { fermaMcp(); });

ipcMain.handle('shell:open-external', async (_event, url) => {
    if (typeof url !== 'string') return false;
    try {
        const target = new URL(url);
        if (target.protocol !== 'http:' && target.protocol !== 'https:') return false;
        await shell.openExternal(target.href);
        return true;
    } catch (_) {
        return false;
    }
});

/* ITALIANO: PERCORSO DELLA CARTELLA SCELTA CON "CARICA CARTELLA"
   La pagina apre la cartella col selettore del browser, che di proposito NON le dice dove
   quella cartella si trovi sul disco: i file che ne escono non portano il percorso, e senza
   percorso non si puo' chiedere a Windows di cestinarli. Il percorso pero' Electron lo
   conosce, e lo passa QUI, al processo principale, quando concede il permesso di leggere e
   scrivere quella cartella. Lo intercettiamo e lo teniamo da parte per la pagina.
   Misurato il 17 agosto 2026 sull'app vera: alla PRIMA scelta arriva una "richiesta"; se si
   riapre la STESSA cartella la richiesta non arriva piu' (il permesso resta in memoria) ma
   arrivano i "controlli", che portano lo stesso percorso. Per questo si ascoltano entrambi.
   SICUREZZA: il percorso non arriva mai dalla pagina — e' il processo principale l'unica
   fonte. La finestra di registrazione resta aperta solo fra `begin-pick` e `take-picked-dir`,
   e il valore passa comunque per isSafeLocalPath e per un controllo che sia una cartella.
   ENGLISH: PATH OF THE FOLDER PICKED WITH "LOAD FOLDER"
   The page opens the folder with the browser's picker, which deliberately does NOT tell it
   where that folder lives on disk: the files it yields carry no path, and with no path there
   is no way to ask Windows to bin them. Electron does know the path, and hands it HERE, to the
   main process, when it grants read/write permission on that folder. We intercept it and keep
   it for the page.
   Measured 2026-08-17 on the real app: the FIRST pick raises a "request"; re-picking the SAME
   folder raises no request (the grant is cached) but does raise "checks", which carry the same
   path. That is why both are listened to.
   SECURITY: the path never comes from the page - the main process is the only source. The
   recording window is open only between `begin-pick` and `take-picked-dir`, and the value still
   goes through isSafeLocalPath plus a check that it really is a directory. */
let pickPending = false;
let pickedDirCandidates = [];
const PICK_MAX_CANDIDATES = 32;

const rememberPickedDir = (p) => {
    if (!pickPending) return;
    if (typeof p !== 'string' || !p) return;
    // ITALIANO: le cartelle di RETE non passano di qui, ed e' voluto: Windows non ha un Cestino
    //           per le condivisioni di rete, quindi un percorso del genere non servirebbe a
    //           niente. Restando vuoto, la pagina ricade sulla strada gia' esistente, cioe' la
    //           seconda conferma con la cancellazione definitiva, che li' e' l'unica verita'.
    //           Una cartella su una LETTERA collegata alla rete (Z:\) invece passa: per quella e'
    //           il canale del Cestino a rispondere 'rifiutato', che porta alla stessa strada.
    // ENGLISH: NETWORK folders do not get through here, deliberately: Windows has no Recycle Bin
    //          for network shares, so such a path would buy nothing. Left empty, the page falls
    //          back to the road that already exists - the second confirmation with the permanent
    //          delete - which over there is the only truthful answer.
    //          A folder on a network-MAPPED drive letter (Z:\) does get through: for that one the
    //          Recycle Bin channel answers 'rifiutato', which leads to the same road.
    if (!isSafeLocalPath(p)) return;
    try { if (!fs.statSync(p).isDirectory()) return; } catch (_) { return; }
    // ITALIANO: si RACCOLGONO tutti i candidati, non si tiene solo l'ultimo. In quella finestra
    //           arrivano anche cartelle che non c'entrano: basta che la pagina rilegga una foto di
    //           una cartella aperta prima (succede al rientro del fuoco, quando il selettore si
    //           chiude) e quel percorso arriva qui. Tenendo l'ultimo, la cartella sbagliata poteva
    //           vincere. Chi sceglie e' `take-picked-dir`, e sceglie in base ai FILE, non ai nomi.
    // ENGLISH: we COLLECT every candidate instead of keeping the last one. Folders that have nothing
    //          to do with the pick also arrive in that window: the page only has to re-read a photo
    //          from a previously opened folder (which happens on focus, as the picker closes) and
    //          that path lands here. Keeping the last one let the wrong folder win. The choosing is
    //          done by `take-picked-dir`, and it chooses on the FILES, not on names.
    if (!pickedDirCandidates.includes(p)) pickedDirCandidates.push(p);
    if (pickedDirCandidates.length > PICK_MAX_CANDIDATES) pickedDirCandidates.shift();
};

ipcMain.handle('folder:begin-pick', () => { pickPending = true; pickedDirCandidates = []; return true; });

/* ITALIANO: la pagina non chiede "dammi il percorso": porta le PROVE di cosa ha appena letto —
   per qualche file, il suo nome, la sottocartella relativa, la dimensione e la data di modifica —
   e il processo principale restituisce un percorso SOLO se una cartella candidata contiene davvero
   quei file, identici. Se nessuna combacia, o se ne combaciano due, non torna niente: meglio la
   seconda conferma che un percorso indovinato, perche' quel percorso finisce dritto nel cestino di
   Windows e cancellerebbe i file di un'ALTRA cartella.
   Il nome della cartella non decide piu' niente: in questi dataset le cartelle si chiamano quasi
   tutte uguale ("dataset", "img", "10_soggetto"), ed e' un assunto che questo programma ha gia'
   pagato caro due volte (vedi la firma del backup anti-crash e l'abbinamento dell'editor dei tag).
   La pagina non manda mai un percorso: manda nomi di file e numeri, e ogni percorso composto qui
   viene ricontrollato perche' resti dentro la cartella candidata.
   ENGLISH: the page does not ask "give me the path": it brings PROOF of what it just read - for a
   few files, the name, the relative subfolder, the size and the modification time - and the main
   process returns a path ONLY if a candidate folder really holds those files, identical. If none
   match, or if two do, it returns nothing: the second confirmation beats a guessed path, because
   that path goes straight to the Windows Recycle Bin and would delete ANOTHER folder's files.
   The folder's name no longer decides anything: in these datasets folders are nearly always named
   the same ("dataset", "img", "10_subject"), an assumption this app has already paid for twice (see
   the crash-backup signature and the tag editor's pairing). The page never sends a path: it sends
   file names and numbers, and every path composed here is re-checked to stay inside its candidate. */
ipcMain.handle('folder:take-picked-dir', (_event, proofs) => {
    const candidates = pickedDirCandidates;
    pickPending = false;
    pickedDirCandidates = [];
    if (!Array.isArray(proofs) || proofs.length === 0) return '';

    const holdsAll = (dir) => proofs.every((pr) => {
        if (!pr || typeof pr.name !== 'string' || !pr.name) return false;
        if (typeof pr.size !== 'number' || typeof pr.mtime !== 'number') return false;
        const rel = typeof pr.rel === 'string' ? pr.rel : '';
        if (pr.name.includes('/') || pr.name.includes('\\')) return false;
        if (rel.split(/[\\/]+/).includes('..')) return false;
        const full = path.join(dir, rel, pr.name);
        if (!isSafeLocalPath(full)) return false;
        if (path.relative(dir, full).startsWith('..')) return false;
        try {
            const st = fs.statSync(full);
            // ITALIANO: 2 secondi di tolleranza sulla data: certi file system la arrotondano.
            // ENGLISH: 2 seconds of slack on the timestamp: some file systems round it.
            return st.isFile() && st.size === pr.size && Math.abs(st.mtimeMs - pr.mtime) < 2000;
        } catch (_) {
            return false;
        }
    });

    const winners = candidates.filter(holdsAll);
    return winners.length === 1 ? winners[0] : '';
});

// ITALIANO: Header Content-Security-Policy applicato in produzione
// ENGLISH: Content-Security-Policy header applied in production
const applyContentSecurityPolicy = (sess) => {
    if (isDev) return; // ITALIANO: In sviluppo Vite ha bisogno di flessibilità — ENGLISH: In dev mode Vite needs flexibility
    const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https://generativelanguage.googleapis.com",
        "worker-src 'self' blob:",
        "child-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
        "frame-ancestors 'none'",
    ].join('; ');

    sess.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp],
                'X-Content-Type-Options': ['nosniff'],
            },
        });
    });
};

// ITALIANO: i soli permessi che la pagina chiede (vedi setPermissionRequestHandler).
// ENGLISH: the only permissions the page asks for (see setPermissionRequestHandler).
const PERMESSI_USATI = new Set(['fileSystem', 'clipboard-sanitized-write']);

function resolveIconPath() {
    const ico = path.join(__dirname, '../public/icon.ico');
    if (process.platform === 'win32' && fs.existsSync(ico)) return ico;
    return path.join(__dirname, '../public/logo.png');
}

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 600,
        height: 400,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            // ITALIANO: correttore ortografico SPENTO. Electron lo tiene acceso di serie, e per
            //           funzionare scarica i dizionari dai server di Google al primo avvio: era
            //           l'unico collegamento a internet che il programma faceva senza che l'utente
            //           lo avesse chiesto, in un'app che promette di lavorare offline. Qui non serve
            //           a niente: i tag non sono prosa e le sottolineature rosse sotto ogni tag
            //           erano solo rumore.
            // ENGLISH: spellchecker OFF. Electron turns it on by default and, to work, downloads its
            //          dictionaries from Google's servers on first run: it was the only internet
            //          connection the app made without the user asking for it, in an app that
            //          promises to work offline. It buys nothing here: tags are not prose, and the
            //          red squiggles under every tag were just noise.
            spellcheck: false,
        },
    });
    // ITALIANO: passo allo splash la lingua salvata (se c'e'), cosi' i suoi testi compaiono
    //           gia' tradotti. Al primissimo avvio non c'e' ancora: prima si ripiegava sull'inglese
    //           comunque, quindi su un PC italiano la schermata di avvio parlava inglese e quella
    //           subito dopo (scelta della lingua) italiano. Ora si guarda la lingua di Windows, che
    //           e' la stessa che il programma propone gia' nel selettore al primo avvio.
    // ENGLISH: pass the saved language (if any) to the splash so its text shows already translated.
    //          On the very first launch there is none: it used to fall back to English regardless, so
    //          on an Italian PC the splash spoke English and the very next screen (the language
    //          picker) spoke Italian. Now we look at Windows' own language, the same one the picker
    //          already proposes on first run.
    const uiLang = readUiLang() || systemUiLang();
    splashWindow.loadFile(path.join(__dirname, 'splash.html'), uiLang ? { query: { lang: uiLang } } : undefined);
    splashWindow.on('closed', () => { splashWindow = null; });
}

// ITALIANO: misura minima della finestra. Sotto i 1024 px di larghezza i tre riquadri in alto
//           (carica, trigger, pulsanti) vanno uno sotto l'altro e la grafica si scompone; sotto i
//           600 px di altezza la galleria quasi sparisce. Mai piu' grande dell'area utile dello
//           schermo: su un portatile piccolo con lo zoom di Windows (1366x768 al 125% = ~1093x566)
//           un minimo piu' alto farebbe uscire la finestra dai bordi.
// ENGLISH: minimum window size. Below 1024 px wide the three top panels (load, triggers, buttons)
//          stack and the layout falls apart; below 600 px tall the gallery nearly vanishes. Never
//          larger than the screen work area: on a small laptop with Windows scaling (1366x768 at
//          125% = ~1093x566) a higher minimum would push the window off the screen.
// ITALIANO: 1040 e non 1024: il minimo vale per la finestra intera, bordi compresi, e dentro la
//           pagina resta ~16 px piu' stretta: a 1024 scendeva sotto la soglia lg (visto dal vivo).
// ENGLISH: 1040 and not 1024: the minimum applies to the whole window, borders included, and the
//          page inside stays ~16 px narrower: at 1024 it fell below the lg threshold (seen live).
const FINESTRA_MIN_LARGHEZZA = 1040;
const FINESTRA_MIN_ALTEZZA = 600;
const misuraMinima = () => {
    let area = { width: FINESTRA_MIN_LARGHEZZA, height: FINESTRA_MIN_ALTEZZA };
    try { area = screen.getPrimaryDisplay().workAreaSize; } catch (_) { }
    return { minWidth: Math.min(FINESTRA_MIN_LARGHEZZA, area.width), minHeight: Math.min(FINESTRA_MIN_ALTEZZA, area.height) };
};

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        ...misuraMinima(),
        title: `Images Tag Manager for LORAs v${appVersion}`,
        show: false,
        autoHideMenuBar: true,
        icon: resolveIconPath(),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            // ITALIANO: correttore ortografico SPENTO. Electron lo tiene acceso di serie, e per
            //           funzionare scarica i dizionari dai server di Google al primo avvio: era
            //           l'unico collegamento a internet che il programma faceva senza che l'utente
            //           lo avesse chiesto, in un'app che promette di lavorare offline. Qui non serve
            //           a niente: i tag non sono prosa e le sottolineature rosse sotto ogni tag
            //           erano solo rumore.
            // ENGLISH: spellchecker OFF. Electron turns it on by default and, to work, downloads its
            //          dictionaries from Google's servers on first run: it was the only internet
            //          connection the app made without the user asking for it, in an app that
            //          promises to work offline. It buys nothing here: tags are not prose, and the
            //          red squiggles under every tag were just noise.
            spellcheck: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
            // ITALIANO: DevTools solo in sviluppo. In produzione la scorciatoia Ctrl+Shift+I e'
            //           comunque tolta col menu, quindi lasciarli attivi non serviva e allargava
            //           inutilmente la superficie: ora sono spenti nell'app distribuita.
            // ENGLISH: DevTools only in development. In production the Ctrl+Shift+I shortcut is
            //          removed with the menu anyway, so leaving them on served no purpose and only
            //          widened the surface: they are now off in the shipped app.
            devTools: isDev,
        },
    });

    /* ITALIANO: Blocca QUALSIASI navigazione fuori dall'app.
       Prima erano ammessi tutti gli URL "file:", non solo la pagina dell'app: bastava
       trascinare una foto sulla finestra e Chromium ci navigava sopra, sostituendo il
       programma con l'immagine. Con il menu disattivato non si tornava indietro: progetto,
       cestino e cronologia persi. La pagina dell'app viene caricata con loadFile, che NON
       emette will-navigate, quindi qui possiamo bloccare tutto senza effetti collaterali.
       Unica eccezione: la pagina che ricarica se stessa. Il pulsante "Ricarica" della
       schermata di errore chiama window.location.reload(), che e' una navigazione chiesta
       dalla pagina verso lo STESSO indirizzo: bloccata, nell'app installata il pulsante non
       faceva niente. Passa solo l'indirizzo identico a quello gia' caricato; un indirizzo
       malformato viene bloccato.
       ENGLISH: Block ANY navigation away from the app.
       Every "file:" URL used to be allowed, not just the app's own page: dropping a photo on
       the window made Chromium navigate to it, replacing the program with the image. With the
       menu disabled there was no way back: project, trash and undo history all lost. The app's
       page is loaded via loadFile, which does NOT emit will-navigate, so blocking everything
       here is safe.
       Only exception: the page reloading itself. The error screen's "Reload" button calls
       window.location.reload(), a navigation started by the page towards the SAME address:
       blocked, in the installed app the button did nothing. Only the address identical to the
       one already loaded goes through; a malformed address is blocked. */
    const contenutiPrincipali = mainWindow.webContents;
    contenutiPrincipali.on('will-navigate', (event, url) => {
        let paginaCorrente = '';
        try { paginaCorrente = contenutiPrincipali.getURL(); } catch (_) { paginaCorrente = ''; }
        if (paginaCorrente && url === paginaCorrente) return;
        let allowedDevHost = false;
        try { allowedDevHost = isDev && new URL(url).host === 'localhost:3000'; } catch (_) { allowedDevHost = false; }
        if (!allowedDevHost) {
            event.preventDefault();
        }
    });

    // ITALIANO: I link "_blank" non aprono nuove finestre Electron, li deleghiamo al browser di sistema
    // ENGLISH: "_blank" links do not open new Electron windows; delegate them to the system browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        try {
            const target = new URL(url);
            if (target.protocol === 'http:' || target.protocol === 'https:') {
                const { shell } = require('electron');
                shell.openExternal(url);
            }
        } catch (_) { /* ignore malformed URL */ }
        return { action: 'deny' };
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // ITALIANO: Mostra l'app e chiude lo splash. Protetto da un flag perche' puo' essere chiamato
    //           da piu' strade (pronto, errore di caricamento, timeout): deve agire una volta sola.
    // ENGLISH: Shows the app and closes the splash. Guarded by a flag because it can be called from
    //          several paths (ready, load failure, timeout): it must act only once.
    let appMostrata = false;
    const mostraApp = (maximizza) => {
        if (appMostrata) return;
        appMostrata = true;
        if (watchdog) { clearTimeout(watchdog); watchdog = null; }
        if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (maximizza) mainWindow.maximize();
            mainWindow.show();
        }
    };

    // ITALIANO: Percorso normale: quando la finestra è pronta, chiudi lo splash, massimizza
    //           (finestra piena, con barra del titolo — non a schermo intero) e mostra l'app.
    //           Il 1280x800 sopra resta la dimensione "ripristinata" quando si riduce la finestra.
    // ENGLISH: Normal path: when the window is ready, close the splash, maximize (full window with
    //          the title bar — not fullscreen) and show the app. The 1280x800 above stays as the
    //          "restored" size when the window is un-maximized.
    mainWindow.once('ready-to-show', () => mostraApp(true));

    // ITALIANO: Reti di sicurezza. Prima, se la pagina non arrivava MAI a "pronto" (renderer
    //           andato in errore, pagina che non si carica), lo splash — senza cornice e sempre
    //           in primo piano — restava per sempre e l'app era inavviabile senza Task Manager.
    //           Ora: se il caricamento fallisce, o il processo grafico muore, o passano 20
    //           secondi, mostriamo comunque la finestra (o chiudiamo lo splash) invece di
    //           lasciare l'utente bloccato.
    // ENGLISH: Safety nets. Before, if the page NEVER reached "ready" (renderer crashed, page
    //          fails to load), the frameless always-on-top splash stayed forever and the app was
    //          unlaunchable without Task Manager. Now: if the load fails, or the render process
    //          dies, or 20 seconds pass, we show the window anyway (or close the splash) instead of
    //          leaving the user stuck.
    let watchdog = setTimeout(() => mostraApp(true), 20000);
    mainWindow.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
        if (isMainFrame) {
            console.error('main window failed to load', code, desc, url);
            mostraApp(false);
        }
    });
    // ITALIANO: se il processo della pagina muore (memoria esaurita, crollo) la finestra restava
    //           bianca: niente messaggio, e in produzione niente menu, quindi niente Ctrl+R. Ora la
    //           pagina si ricarica da sola, una volta al minuto al massimo (un crollo che si ripete
    //           subito non diventa un giro infinito), e la finestra si mostra subito se non lo era
    //           ancora. Le modifiche non salvate sono nel salvataggio di emergenza: tornano
    //           riaprendo la cartella. Un'uscita normale ('clean-exit') o un processo chiuso apposta
    //           ('killed', anche alla chiusura del programma) non si ricaricano.
    //           Un secondo crollo entro il minuto non viene piu' ignorato (la finestra restava
    //           bianca per sempre): il ricaricamento si rimanda alla fine del minuto, uno solo in
    //           attesa, e si annulla se la finestra si chiude prima.
    // ENGLISH: when the page process dies (out of memory, crash) the window stayed blank: no
    //          message, and in production no menu, so no Ctrl+R. Now the page reloads by itself, at
    //          most once a minute (a crash that repeats at once does not become an endless loop),
    //          and the window is shown right away if it was not yet. Unsaved edits are in the crash
    //          backup: they come back when the folder is reopened. A normal exit ('clean-exit') or a
    //          process ended on purpose ('killed', also while the program closes) does not reload.
    //          A second crash within the minute is no longer ignored (the window stayed blank for
    //          good): the reload is delayed to the end of the minute, only one pending, and it is
    //          cancelled if the window closes first.
    let ultimoRicaricamento = 0;
    let ricaricamentoPendente = null;
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
        console.error('main window render process gone', details);
        if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
        const motivo = details && details.reason;
        if (motivo === 'clean-exit' || motivo === 'killed') return;
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const ora = Date.now();
        if (ultimoRicaricamento && ora - ultimoRicaricamento < 60000) {
            if (ricaricamentoPendente) return;
            ricaricamentoPendente = setTimeout(() => {
                ricaricamentoPendente = null;
                if (!mainWindow || mainWindow.isDestroyed()) return;
                ultimoRicaricamento = Date.now();
                mostraApp(true);
                try { mainWindow.webContents.reload(); } catch (e) { console.error('main window reload failed', e); }
            }, ultimoRicaricamento + 60000 - ora);
            return;
        }
        ultimoRicaricamento = ora;
        mostraApp(true);
        try { mainWindow.webContents.reload(); } catch (e) { console.error('main window reload failed', e); }
    });

    mainWindow.on('closed', () => {
        if (watchdog) { clearTimeout(watchdog); watchdog = null; }
        if (ricaricamentoPendente) { clearTimeout(ricaricamentoPendente); ricaricamentoPendente = null; }
        mainWindow = null;
    });
}

app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

app.whenReady().then(() => {
    applyContentSecurityPolicy(session.defaultSession);

    // ITALIANO: qui passa il percorso della cartella scelta (vedi rememberPickedDir). Si concedono
    //           SOLO i permessi che la pagina usa: le finestre di file e cartelle (fileSystem) e la
    //           copia negli appunti (clipboard-sanitized-write, i tasti "Copia" di MCP). Prima si
    //           concedeva tutto (fotocamera, microfono, posizione, notifiche...): una pagina
    //           compromessa li avrebbe avuti senza chiedere. Un permesso negato si annota.
    // ENGLISH: this is where the picked folder's path arrives (see rememberPickedDir). ONLY the
    //          permissions the page uses are granted: the file and folder dialogs (fileSystem) and
    //          copying to the clipboard (clipboard-sanitized-write, MCP's "Copy" buttons). Everything
    //          used to be granted (camera, microphone, location, notifications...): a compromised page
    //          would have had them without asking. A denied permission is logged.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
        if (permission === 'fileSystem' && details && details.isDirectory) rememberPickedDir(details.filePath);
        const concesso = PERMESSI_USATI.has(permission);
        if (!concesso) console.warn('[Permessi] negato:', permission);
        callback(concesso);
    });
    session.defaultSession.setPermissionCheckHandler((_wc, permission, _origin, details) => {
        if (permission === 'fileSystem' && details && details.isDirectory) rememberPickedDir(details.filePath);
        return PERMESSI_USATI.has(permission);
    });
    // ITALIANO: Nessuna barra dei menù di default in produzione
    // ENGLISH: No default menu bar in production
    if (!isDev) Menu.setApplicationMenu(null);

    createSplashWindow();
    createMainWindow();
    // ITALIANO: il server MCP riparte da solo se l'utente lo aveva lasciato acceso.
    // ENGLISH: the MCP server starts again by itself if the user left it on.
    if (leggiMcp().acceso) avviaMcp();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createSplashWindow();
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ITALIANO: Difesa in profondità — vietiamo qualunque tentativo di creare webview
// ENGLISH: Defense in depth — forbid any attempt to create webview tags
// ITALIANO: e per OGNI finestra (anche la schermata di avvio e quelle che un giorno si aggiungeranno)
//           niente navigazioni e niente finestre nuove: la principale ha regole sue (ricarica di se'
//           stessa, link esterni nel browser) e le imposta lei; qui resta la regola per tutte le altre.
// ENGLISH: and for EVERY window (the splash screen too, and any added one day) no navigation and no
//          new windows: the main one has its own rules (reloading itself, external links in the
//          browser) and sets them itself; the rule for all the others stays here.
app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => {
        event.preventDefault();
    });
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event) => {
        if (mainWindow && !mainWindow.isDestroyed() && contents === mainWindow.webContents) return;
        event.preventDefault();
    });
});
