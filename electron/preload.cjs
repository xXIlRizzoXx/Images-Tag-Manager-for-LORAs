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
    secureStorage: {
        get: (key) => ipcRenderer.invoke('secure-storage:get', String(key)),
        set: (key, value) => ipcRenderer.invoke('secure-storage:set', String(key), String(value ?? '')),
        delete: (key) => ipcRenderer.invoke('secure-storage:delete', String(key)),
        isAvailable: () => ipcRenderer.invoke('secure-storage:available'),
    },
    // ITALIANO: percorso su disco di un file scelto dall'utente (da Electron 32 al posto di File.path)
    // ENGLISH: on-disk path of a file the user picked (replaces File.path since Electron 32)
    getPathForFile: (file) => {
        try { return webUtils.getPathForFile(file) || ''; } catch (_) { return ''; }
    },
    // ITALIANO: legge i .txt con lo stesso nome accanto alle immagini scelte
    // ENGLISH: reads the same-named .txt files sitting next to the picked images
    readSidecarTags: (paths) => ipcRenderer.invoke('images:read-sidecar-tags', paths),
    // ITALIANO: sposta immagini e .txt nel Cestino di Windows (recuperabili), non li cancella
    // ENGLISH: moves images and .txt files to the Windows Recycle Bin (recoverable), not a hard delete
    trashFiles: (paths) => ipcRenderer.invoke('shell:trash-files', paths),
    // ITALIANO: apre un indirizzo web nel browser di sistema (solo http/https)
    // ENGLISH: opens a web address in the system browser (http/https only)
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', String(url)),
});
