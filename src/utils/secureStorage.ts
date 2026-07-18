/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: STORAGE SICURO PER SEGRETI                                      **
**  Salva valori sensibili (es. API key Gemini) nello storage cifrato di      **
**  Electron (safeStorage, basato sul keychain del sistema operativo).        **
**  In browser/dev fa fallback su localStorage.                               **
**                                                                            **
**  ENGLISH: SECURE STORAGE FOR SECRETS                                       **
**  Stores sensitive values (e.g. Gemini API key) in Electron's encrypted     **
**  storage (safeStorage, backed by the OS keychain). Falls back to           **
**  localStorage in browser/dev.                                              **
**                                                                            **
*******************************************************************************
*******************************************************************************/

type ElectronSecureStorage = {
    get: (key: string) => Promise<string>;
    set: (key: string, value: string) => Promise<boolean>;
    delete: (key: string) => Promise<boolean>;
    isAvailable: () => Promise<boolean>;
};

type ElectronAPI = {
    isElectron?: boolean;
    secureStorage?: ElectronSecureStorage;
};

const getElectronAPI = (): ElectronAPI | null => {
    if (typeof window === 'undefined') return null;
    const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
    return api && api.secureStorage ? api : null;
};

export const isElectronEnvironment = (): boolean => getElectronAPI() !== null;

export const getSecret = async (key: string): Promise<string> => {
    const api = getElectronAPI();
    if (api && api.secureStorage) {
        try {
            const value = await api.secureStorage.get(key);
            if (value) return value;
            // ITALIANO: Migrazione automatica da localStorage (eventuali residui di versioni precedenti)
            // ENGLISH: Automatic migration from localStorage (any leftover from earlier versions)
            const legacy = localStorage.getItem(key);
            if (legacy) {
                const ok = await api.secureStorage.set(key, legacy);
                if (ok) localStorage.removeItem(key);
                return legacy;
            }
            return '';
        } catch (e) {
            console.error('secureStorage.get failed, falling back to localStorage', e);
            return localStorage.getItem(key) || '';
        }
    }
    return localStorage.getItem(key) || '';
};

export const setSecret = async (key: string, value: string): Promise<boolean> => {
    const api = getElectronAPI();
    if (api && api.secureStorage) {
        try {
            const ok = await api.secureStorage.set(key, value);
            if (ok) {
                localStorage.removeItem(key);
                return true;
            }
        } catch (e) {
            console.error('secureStorage.set failed', e);
        }
        // ITALIANO: In Electron NON degradiamo mai a localStorage in chiaro: meglio nessun
        //           salvataggio che una API key leggibile in chiaro su disco. Puliamo i residui.
        // ENGLISH: In Electron we NEVER degrade to plaintext localStorage: better no save at all
        //          than an API key readable in cleartext on disk. Clean up any leftovers.
        try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
        return false;
    }
    // ITALIANO: Fallback solo browser/dev (fuori da Electron non esiste storage cifrato)
    // ENGLISH: Browser/dev-only fallback (no encrypted storage outside Electron)
    if (value) {
        localStorage.setItem(key, value);
    } else {
        localStorage.removeItem(key);
    }
    return true;
};

export const deleteSecret = async (key: string): Promise<void> => {
    const api = getElectronAPI();
    if (api && api.secureStorage) {
        try {
            await api.secureStorage.delete(key);
        } catch (e) {
            console.error('secureStorage.delete failed', e);
        }
    }
    localStorage.removeItem(key);
};
