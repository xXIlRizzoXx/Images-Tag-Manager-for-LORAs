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
const { app, BrowserWindow, ipcMain, net, safeStorage, session, Menu, shell } = require('electron');
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

// ITALIANO: Storage cifrato per la API key Gemini, basato sul keychain del SO
// ENGLISH: Encrypted storage for the Gemini API key, backed by the OS keychain
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
//           file fuori da dove l'utente ha davvero puntato.
// ENGLISH: Paths come from the renderer (derived from the user's picked files): they are always
//          LOCAL, ABSOLUTE paths. As defense in depth I reject everything else — UNC network paths
//          (\\server\share), device paths (\\?\...) and any ".." traversal segment — so these
//          channels cannot be steered into reading/writing/trashing files outside what the user
//          actually pointed at.
const isSafeLocalPath = (p) => {
    if (typeof p !== 'string' || !p) return false;
    if (/^[\\/]{2}/.test(p)) return false;        // UNC / device / //host
    if (!path.isAbsolute(p)) return false;
    if (p.split(/[\\/]+/).includes('..')) return false;
    return true;
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
const SIDECAR_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.jfif', '.jpe', '.pjpeg', '.pjp', '.png', '.webp', '.gif', '.bmp', '.avif', '.tif', '.tiff']);

ipcMain.handle('images:read-sidecar-tags', (_event, imagePaths) => {
    if (!Array.isArray(imagePaths)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of imagePaths) {
        if (!isSafeLocalPath(raw)) continue;
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

            const txtStat = fs.statSync(txtPath);
            if (!txtStat.isFile() || txtStat.size > SIDECAR_MAX_BYTES) continue;
            // ITALIANO: torno anche la cartella del .txt: cosi' il rinnovo lato app puo' abbinare
            //           ogni testo alla SUA immagine anche se due foto scelte hanno lo stesso nome
            //           ma stanno in cartelle diverse.
            // ENGLISH: also return the .txt's folder: this lets the app pair each text with ITS
            //          image even when two picked photos share a name but sit in different folders.
            out.push({ name: base + '.txt', content: fs.readFileSync(txtPath, 'utf8'), dir: path.dirname(txtPath) });
        } catch (_) {
            // ITALIANO: nessun .txt accanto a questa immagine: e' normale, si prosegue
            // ENGLISH: no .txt next to this image: that is normal, carry on
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
            if (!isSafeLocalPath(imagePath) || !SIDECAR_IMAGE_EXT.has(path.extname(imagePath).toLowerCase())) { failed++; results.push(false); continue; }
            if (Buffer.byteLength(content, 'utf8') > WRITE_MAX_BYTES) { failed++; results.push(false); continue; }
            const imgStat = fs.statSync(imagePath);
            if (!imgStat.isFile()) { failed++; results.push(false); continue; }
            const base = path.basename(imagePath, path.extname(imagePath));
            const txtPath = path.join(path.dirname(imagePath), base + '.txt');
            if (path.extname(txtPath).toLowerCase() !== '.txt') { failed++; results.push(false); continue; }
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
//   'rifiutato' questo canale non puo' toccarlo: percorso di RETE, scritto \\server\... o con una
//              lettera di unita' collegata (il Cestino di Windows non esiste per le condivisioni
//              di rete) oppure estensione fuori dall'elenco ammesso
//   'errore'   il file c'e' ma non si e' riusciti a spostarlo (bloccato, permessi)
//   Prima i tre casi erano indistinguibili: i primi due uscivano da un `continue` silenzioso e il
//   gruppo tornava {ok:true, trashed:0}, cioe' "riuscito" senza aver spostato niente. 'rifiutato'
//   NON e' un vicolo cieco: chi chiama lo tratta come "Cestino non raggiungibile" e offre la
//   cancellazione definitiva con la seconda conferma, altrimenti una foto su una cartella di rete
//   resterebbe per sempre nel cestino dell'app senza modo di toglierla.
// ENGLISH: the outcome now comes back FILE BY FILE in `results`, with three distinct values:
//   'ok'        the file reached the Windows Recycle Bin, or was already gone (nothing to do)
//   'rifiutato' this channel cannot touch it: a NETWORK path, spelled \\server\... or through a
//               mapped drive letter (Windows has no Recycle Bin for network shares) or an
//               extension outside the allowed list
//   'errore'    the file is there but could not be moved (locked, permissions)
//   The three used to be indistinguishable: the first two left through a silent `continue` and the
//   batch returned {ok:true, trashed:0} - "success" having moved nothing. 'rifiutato' is NOT a dead
//   end: the caller reads it as "Recycle Bin out of reach" and offers the permanent delete behind
//   the second confirmation, otherwise a photo on a network folder would sit in the app's trash
//   forever with no way to remove it.
ipcMain.handle('shell:trash-files', async (_event, filePaths) => {
    if (!Array.isArray(filePaths)) return { ok: false, trashed: 0, failed: 0, results: [] };
    let trashed = 0;
    let failed = 0;
    const results = [];
    for (const raw of filePaths.slice(0, TRASH_MAX_FILES)) {
        if (!isSafeLocalPath(raw)) { results.push('rifiutato'); continue; }
        if (!TRASH_ALLOWED_EXT.has(path.extname(raw).toLowerCase())) { results.push('rifiutato'); continue; }
        // ITALIANO: un file assente (es. il .txt di una foto senza tag) e' NORMALE: si salta e
        //           non conta come errore. Un file che ESISTE ma non si riesce a cestinare
        //           (bloccato, permessi) e' un errore vero.
        // ENGLISH: a missing file (e.g. the .txt of a photo with no tags) is NORMAL: skip it and do
        //          not count it as an error. A file that EXISTS but cannot be trashed (locked,
        //          permissions) is a real error.
        let exists = false;
        try { exists = fs.statSync(raw).isFile(); } catch (_) { exists = false; }
        if (!exists) { results.push('ok'); continue; }
        // ITALIANO: una lettera di unita' collegata a una condivisione di rete (Z:\ -> \\nas\dati)
        //           sembra un disco locale e passava il controllo qui sopra, ma il Cestino non c'e'
        //           nemmeno li': Windows rifiutava lo spostamento e la foto restava bloccata nel
        //           cestino dell'app, senza mai arrivare alla seconda conferma. Il percorso VERO lo
        //           dice Windows (per un'unita' di rete risponde \\server\...): se e' di rete si
        //           risponde 'rifiutato', come per \\server\... scritto per esteso. Se non si
        //           riesce a leggerlo, o non e' di rete, si fa come prima.
        // ENGLISH: a drive letter mapped to a network share (Z:\ -> \\nas\data) looks like a local
        //          disk and got past the check above, but there is no Recycle Bin there either:
        //          Windows refused the move and the photo stayed stuck in the app's trash, never
        //          reaching the second confirmation. Windows tells the REAL path (for a network
        //          drive it answers \\server\...): if it is a network one we answer 'rifiutato', as
        //          for a \\server\... path spelled out. If it cannot be read, or is not a network
        //          one, we do as before.
        let percorsoVero = raw;
        try { percorsoVero = fs.realpathSync.native(raw); } catch (_) { percorsoVero = raw; }
        if (/^[\\/]{2}/.test(String(percorsoVero || ''))) { results.push('rifiutato'); continue; }
        try {
            await shell.trashItem(raw);
            trashed++;
            results.push('ok');
        } catch (e) {
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
const RESTORE_MAX_FILES = 5000;
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
    "foreach ($v in @($bin.Items())) {",
    "  $nome = $v.Name",
    "  $est = [System.IO.Path]::GetExtension($v.Path)",
    "  if ($est -and -not $nome.EndsWith($est, 'OrdinalIgnoreCase')) { $nome = $nome + $est }",
    "  $orig = Join-Path ($bin.GetDetailsOf($v, 1)) $nome",
    "  $k = $orig.ToLowerInvariant()",
    "  if (-not $esiti.ContainsKey($k)) { continue }",
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
    "$scadenza = (Get-Date).AddSeconds(20)",
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
    for (const raw of filePaths.slice(0, RESTORE_MAX_FILES)) {
        // ITALIANO: stesso contratto stretto degli altri canali: solo percorsi locali assoluti.
        // ENGLISH: same narrow contract as the other channels: local absolute paths only.
        if (!isSafeLocalPath(raw)) { results.push({ percorso: String(raw || ''), esito: 'rifiutato' }); continue; }
        voluti.push(raw);
    }
    if (voluti.length === 0) return { ok: false, restored: 0, results };

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
            const orologio = setTimeout(() => { try { ps.kill(); } catch (_) {} fine(null); }, RESTORE_TIMEOUT_MS);
            // ITALIANO: la risposta e' UTF-8 (vedi lo script): una lettera di piu' byte puo' cadere
            //           a cavallo di due pezzi, e decodificarli uno per uno la romperebbe.
            // ENGLISH: the answer is UTF-8 (see the script): a multi-byte letter can straddle two
            //          chunks, and decoding them one by one would break it.
            ps.stdout.setEncoding('utf8');
            ps.stdout.on('data', (d) => { out += String(d); });
            ps.on('error', (e) => { clearTimeout(orologio); console.error('restore-trashed: PowerShell non partito', e); fine(null); });
            ps.on('close', () => {
                clearTimeout(orologio);
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
    let restored = 0;
    for (const p of voluti) {
        const esito = perPercorso.get(p) || 'fallito';
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

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
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
       ENGLISH: Block ANY navigation away from the app.
       Every "file:" URL used to be allowed, not just the app's own page: dropping a photo on
       the window made Chromium navigate to it, replacing the program with the image. With the
       menu disabled there was no way back: project, trash and undo history all lost. The app's
       page is loaded via loadFile, which does NOT emit will-navigate, so blocking everything
       here is safe. */
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const target = new URL(url);
        const allowedDevHost = isDev && target.host === 'localhost:3000';
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
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
        console.error('main window render process gone', details);
        if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    });

    mainWindow.on('closed', () => {
        if (watchdog) { clearTimeout(watchdog); watchdog = null; }
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

    // ITALIANO: qui passa il percorso della cartella scelta (vedi rememberPickedDir). Concedere
    //           sempre il permesso riproduce ESATTAMENTE il comportamento di prima: senza handler
    //           registrato Electron concede da solo. Questo non e' il posto per stringere i
    //           permessi — sarebbe un cambiamento a se', da provare a parte.
    // ENGLISH: this is where the picked folder's path arrives (see rememberPickedDir). Always
    //          granting reproduces EXACTLY the previous behaviour: with no handler registered
    //          Electron grants by itself. This is not the place to tighten permissions - that
    //          would be a separate change, to be tested on its own.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
        if (permission === 'fileSystem' && details && details.isDirectory) rememberPickedDir(details.filePath);
        callback(true);
    });
    session.defaultSession.setPermissionCheckHandler((_wc, permission, _origin, details) => {
        if (permission === 'fileSystem' && details && details.isDirectory) rememberPickedDir(details.filePath);
        return true;
    });
    // ITALIANO: Nessuna barra dei menù di default in produzione
    // ENGLISH: No default menu bar in production
    if (!isDev) Menu.setApplicationMenu(null);

    createSplashWindow();
    createMainWindow();

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
app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => {
        event.preventDefault();
    });
});
