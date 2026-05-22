/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: PONTE SICURO TRA APP E SISTEMA (PRELOAD)                        **
**  Espone via contextBridge SOLO ciò che serve al renderer:                  **
**   - versione app                                                           **
**   - storage cifrato (safeStorage) per la API key Gemini                    **
**                                                                            **
**  ENGLISH: SECURE APP-TO-SYSTEM BRIDGE (PRELOAD)                            **
**  Exposes via contextBridge ONLY what the renderer needs:                   **
**   - app version                                                            **
**   - encrypted storage (safeStorage) for the Gemini API key                 **
**                                                                            **
*******************************************************************************
*******************************************************************************/
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    getAppVersion: () => ipcRenderer.invoke('app:get-version'),
    secureStorage: {
        get: (key) => ipcRenderer.invoke('secure-storage:get', String(key)),
        set: (key, value) => ipcRenderer.invoke('secure-storage:set', String(key), String(value ?? '')),
        delete: (key) => ipcRenderer.invoke('secure-storage:delete', String(key)),
        isAvailable: () => ipcRenderer.invoke('secure-storage:available'),
    },
});
