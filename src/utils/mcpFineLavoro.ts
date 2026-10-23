/******************************************************************************
**  ITALIANO: LAVORO DI UN'AI ESTERNA (SERVER MCP): QUANDO LAVORA, QUANDO     **
**  HA FINITO                                                                 **
**  Un'AI collegata via MCP non dice mai "comincio" o "ho finito": fa tante   **
**  chiamate separate (legge, guarda le foto, cambia i tag). Qui:             **
**   - sta lavorando dall'arrivo della prima chiamata finche', con nessuna    **
**     chiamata in corso, resta in silenzio per MCP_SILENZIO_MS               **
**     (`attivita(true)` / `attivita(false)`, per il semaforo in alto);       **
**   - ha finito quando, dopo aver cambiato almeno un tag, resta in silenzio  **
**     cosi': allora si chiama `fatto` una volta (suono e avviso). Le sole    **
**     letture, senza modifiche, non chiamano mai `fatto`.                    **
**  Il silenzio si conta solo senza chiamate in corso: una foto lenta da      **
**  leggere non fa finire il lavoro a meta'. 30 secondi perche' un'AI che     **
**  ragiona puo' tacere a lungo fra una chiamata e l'altra.                   **
**                                                                            **
**  ENGLISH: AN EXTERNAL AI'S WORK (MCP SERVER): WHEN IT WORKS, WHEN IT IS    **
**  DONE                                                                      **
**  An AI connected through MCP never says "starting" or "done": it makes     **
**  many separate calls (reads, looks at photos, changes tags). Here:         **
**   - it is working from the arrival of the first call until, with no call   **
**     in progress, it stays silent for MCP_SILENZIO_MS (`attivita(true)` /   **
**     `attivita(false)`, for the light at the top);                          **
**   - it is done when, after changing at least one tag, it stays silent      **
**     like that: then `fatto` is called once (sound and notice). Reads       **
**     alone, with no changes, never call `fatto`.                            **
**  Silence counts only with no call in progress: a photo slow to read does   **
**  not end the work halfway. 30 seconds because an AI that reasons may stay  **
**  quiet for a long time between two calls.                                  **
******************************************************************************/

export const MCP_SILENZIO_MS = 30000;

type Orologio = {
    imposta: (fn: () => void, ms: number) => unknown;
    annulla: (id: unknown) => void;
};

const orologioVero: Orologio = {
    imposta: (fn, ms) => setTimeout(fn, ms),
    annulla: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

type Opzioni = {
    attivita?: (lavora: boolean) => void;
    silenzioMs?: number;
    orologio?: Orologio;
};

export const creaFineLavoroMcp = (fatto: () => void, { attivita, silenzioMs = MCP_SILENZIO_MS, orologio = orologioVero }: Opzioni = {}) => {
    let cambiato = false;
    let lavora = false;
    let inVolo = 0;
    // ITALIANO: ferma() apre un giro nuovo: una risposta di una chiamata arrivata prima non conta piu'.
    // ENGLISH: ferma() opens a new round: an answer to a call that arrived before no longer counts.
    let giro = 0;
    let attesa: unknown = null;
    const fermaAttesa = () => {
        if (attesa !== null) orologio.annulla(attesa);
        attesa = null;
    };
    const smetti = () => {
        if (!lavora) return;
        lavora = false;
        attivita?.(false);
    };
    return {
        // ITALIANO: all'arrivo di ogni richiesta MCP: l'AI lavora, e finche' la risposta non parte
        //           il silenzio non si conta.
        // ENGLISH: on the arrival of every MCP request: the AI is working, and until the answer
        //          leaves silence is not counted.
        // ITALIANO: restituisce il giro, da ripassare a fine().
        // ENGLISH: returns the round, to pass back to fine().
        inizio(): number {
            inVolo++;
            fermaAttesa();
            if (!lavora) { lavora = true; attivita?.(true); }
            return giro;
        },
        // ITALIANO: quando la risposta parte, con `true` se ha cambiato dei tag e il giro di inizio().
        //           Con nessun'altra chiamata in corso comincia il silenzio.
        // ENGLISH: when the answer leaves, with `true` if it changed some tags and the round from
        //          inizio(). With no other call in progress the silence starts.
        fine(haCambiato: boolean, delGiro: number) {
            if (delGiro !== giro) return;
            inVolo = Math.max(0, inVolo - 1);
            if (haCambiato) cambiato = true;
            if (inVolo > 0) return;
            fermaAttesa();
            attesa = orologio.imposta(() => {
                attesa = null;
                smetti();
                if (!cambiato) return;
                cambiato = false;
                fatto();
            }, silenzioMs);
        },
        // ITALIANO: annulla tutto senza suonare (finestra chiusa, server spento).
        // ENGLISH: cancels everything without sounding (window closed, server switched off).
        ferma() {
            fermaAttesa();
            cambiato = false;
            inVolo = 0;
            giro++;
            smetti();
        },
    };
};
