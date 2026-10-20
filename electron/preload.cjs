/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: PONTE SICURO TRA APP E SISTEMA (PRELOAD)                        **
**  Espone via contextBridge SOLO ciò che serve al renderer:                  **
**   - versione app                                                           **
**   - storage cifrato (safeStorage) per la API key Gemini                    **
**   - lettura dei soli file .txt "gemelli" delle immagini scelte             **
**                                                                            **
**  ENGLISH: SECURE APP-TO-SYSTEM BRIDGE (PRELOAD)                            **
**  Exposes via contextBridge ONLY what the renderer needs:                   **
**   - app version                                                            **
**   - encrypted storage (safeStorage) for the Gemini API key                 **
**   - reading only the sidecar .txt files of the picked images               **
**                                                                            **
*******************************************************************************
*******************************************************************************/
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    getAppVersion: () => ipcRenderer.invoke('app:get-version'),
    // ITALIANO: salva la lingua scelta in un file, cosi' la schermata di avvio (finestra a parte)
    //           puo' mostrare i suoi testi tradotti gia' al lancio successivo
    // ENGLISH: persists the chosen language to a file, so the splash screen (a separate window) can
    //          show its text translated already on the next launch
    persistLang: (lang) => ipcRenderer.invoke('app:persist-lang', String(lang || '')),
    // ITALIANO: copia su file del backup anti-crash (vedi src/utils/backupFile.ts): solo testo, un file fisso.
    // ENGLISH: file copy of the crash backup (see src/utils/backupFile.ts): text only, one fixed file.
    readCrashBackup: () => ipcRenderer.invoke('backup:read'),
    writeCrashBackup: (valore) => ipcRenderer.invoke('backup:write', typeof valore === 'string' ? valore : null),
    secureStorage: {
        get: (key) => ipcRenderer.invoke('secure-storage:get', String(key)),
        set: (key, value) => ipcRenderer.invoke('secure-storage:set', String(key), String(value ?? '')),
        delete: (key) => ipcRenderer.invoke('secure-storage:delete', String(key)),
    },
    // ITALIANO: percorso su disco di un file scelto dall'utente (da Electron 32 al posto di File.path)
    // ENGLISH: on-disk path of a file the user picked (replaces File.path since Electron 32)
    getPathForFile: (file) => {
        try { return webUtils.getPathForFile(file) || ''; } catch (_) { return ''; }
    },
    // ITALIANO: legge i .txt con lo stesso nome accanto alle immagini scelte
    // ENGLISH: reads the same-named .txt files sitting next to the picked images
    readSidecarTags: (paths) => ipcRenderer.invoke('images:read-sidecar-tags', paths),
    // ITALIANO: scrive il .txt accanto alle immagini scelte (salvataggio vero delle foto caricate
    //           come file singoli), tornando l'esito reale per ogni file
    // ENGLISH: writes the .txt next to the picked images (real save for photos loaded as individual
    //          files), returning the real per-file outcome
    writeSidecarTags: (items) => ipcRenderer.invoke('images:write-sidecar-tags', items),
    // ITALIANO: sposta immagini e .txt nel Cestino di Windows (recuperabili), non li cancella
    // ENGLISH: moves images and .txt files to the Windows Recycle Bin (recoverable), not a hard delete
    trashFiles: (paths) => ipcRenderer.invoke('shell:trash-files', paths),
    // ITALIANO: rimette al loro posto i file finiti nel Cestino di Windows (annulla lo svuotamento)
    // ENGLISH: puts files that reached the Windows Recycle Bin back where they were (undo the empty)
    restoreTrashed: (paths) => ipcRenderer.invoke('shell:restore-trashed', paths),
    // ITALIANO: nessun percorso attraversa il ponte in entrata: la pagina dice solo "sto per far
    //           scegliere una cartella" e poi "dammi quello che hai visto". Il percorso lo conosce
    //           e lo valida il processo principale.
    // ENGLISH: no path crosses the bridge inbound: the page only says "a folder pick is starting"
    //          and then "hand me what you saw". The path is known and validated by the main process.
    beginFolderPick: () => ipcRenderer.invoke('folder:begin-pick'),
    takePickedFolderPath: (proofs) => ipcRenderer.invoke('folder:take-picked-dir', proofs),
    // ITALIANO: apre un indirizzo web nel browser di sistema (solo http/https)
    // ENGLISH: opens a web address in the system browser (http/https only)
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', String(url)),

    // ITALIANO: Chiede a GitHub se e' uscita una versione nuova. Restituisce null quando
    //           non c'e' niente di nuovo, quando non c'e' rete, o quando l'utente non ha
    //           acconsentito (in quel caso la pagina non chiama proprio).
    // ENGLISH: Asks GitHub whether a newer version exists. Returns null when there is
    //          nothing new, when there is no network, or when the user never agreed (in
    //          which case the page does not call at all).
    checkForUpdate: () => ipcRenderer.invoke('updates:check'),

    // ITALIANO: server MCP per le AI esterne. La pagina riceve le domande del server (onRequest)
    //           e risponde (respond); ipcRenderer non passa mai intero alla pagina.
    // ENGLISH: MCP server for external AIs. The page receives the server's questions (onRequest)
    //          and answers them (respond); ipcRenderer is never handed to the page whole.
    mcp: {
        getStatus: () => ipcRenderer.invoke('mcp:get-status'),
        setEnabled: (acceso) => ipcRenderer.invoke('mcp:set-enabled', acceso === true),
        newToken: () => ipcRenderer.invoke('mcp:new-token'),
        onRequest: (cb) => {
            const ascolta = (_event, richiesta) => { if (typeof cb === 'function') cb(richiesta); };
            ipcRenderer.on('mcp:request', ascolta);
            return () => ipcRenderer.removeListener('mcp:request', ascolta);
        },
        respond: (id, risposta) => ipcRenderer.send('mcp:response', { id, risposta }),
    },
});
