/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: STORAGE SICURO PER SEGRETI                                      **
**  Salva valori sensibili (es. API key Gemini) nello storage cifrato di      **
**  Electron (safeStorage, basato sul keychain del sistema operativo).        **
**  In browser/dev la chiave resta solo in memoria: mai scritta in chiaro.    **
**                                                                            **
**  ENGLISH: SECURE STORAGE FOR SECRETS                                       **
**  Stores sensitive values (e.g. Gemini API key) in Electron's encrypted     **
**  storage (safeStorage, backed by the OS keychain). In browser/dev the      **
**  key stays in memory only: never written in clear text.                    **
**                                                                            **
*******************************************************************************
*******************************************************************************/

type ElectronSecureStorage = {
    get: (key: string) => Promise<string>;
    set: (key: string, value: string) => Promise<boolean>;
    delete: (key: string) => Promise<boolean>;
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
    // ITALIANO: Fuori da Electron non c'e' storage cifrato e la chiave non si scrive mai in
    //           chiaro (vedi setSecret): non c'e' niente da leggere. Un eventuale residuo in
    //           chiaro di versioni precedenti NON si usa e si toglie qui, alla lettura: senza
    //           chiave in memoria la X "togli chiave" non compare e il salvataggio non parte,
    //           quindi altrimenti restava su disco per sempre. La chiave si puo' sempre
    //           incollare di nuovo da Google AI Studio.
    // ENGLISH: Outside Electron there is no encrypted storage and the key is never written in
    //          clear text (see setSecret): there is nothing to read. Any clear-text leftover from
    //          earlier versions is NOT used and is removed here, on read: with no key in memory
    //          the "remove key" X does not show and the save never runs, so otherwise it stayed
    //          on disk forever. The key can always be pasted again from Google AI Studio.
    try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
    return '';
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
    // ITALIANO: Browser/dev (fuori da Electron non esiste storage cifrato): stessa regola di
    //           Electron, la chiave NON si scrive in chiaro. Resta solo in memoria per la
    //           sessione e si risponde false, cosi' l'app avvisa che non e' stata salvata.
    //           Togliere la chiave (valore vuoto) invece riesce. Si puliscono i residui.
    // ENGLISH: Browser/dev (no encrypted storage outside Electron): same rule as Electron, the
    //          key is NOT written in clear text. It stays in memory for the session only and we
    //          answer false, so the app warns it was not saved. Removing the key (empty value)
    //          does succeed. Clean up any leftovers.
    try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
    return !value;
};

// ITALIANO: risponde true solo se la chiave e' stata cancellata davvero. Prima non rispondeva
//           niente: se il file cifrato non si poteva riscrivere (sola lettura, bloccato da un
//           antivirus) l'app diceva "API key rimossa" e al riavvio la chiave tornava. Fuori da
//           Electron non c'e' un archivio cifrato, quindi non c'e' niente da cancellare: true.
// ENGLISH: answers true only if the key was really deleted. It used to answer nothing: if the
//          encrypted file could not be rewritten (read-only, locked by an antivirus) the app said
//          "API key removed" and on restart the key came back. Outside Electron there is no
//          encrypted store, so there is nothing to delete: true.
export const deleteSecret = async (key: string): Promise<boolean> => {
    const api = getElectronAPI();
    let cancellata = true;
    if (api && api.secureStorage) {
        cancellata = false;
        try {
            cancellata = (await api.secureStorage.delete(key)) === true;
        } catch (e) {
            console.error('secureStorage.delete failed', e);
        }
    }
    localStorage.removeItem(key);
    return cancellata;
};
