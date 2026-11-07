/* ITALIANO: IL PONTE DELL'ESTENSIONE PER CLAUDE DESKTOP
   Questo file non gira dentro il programma: finisce come server/index.js nel file .mcpb che il
   programma salva (src/utils/claudeExtension.ts) e lo avvia Claude Desktop col suo Node.js.
   Claude parla con le estensioni su stdin/stdout, il server MCP del programma parla HTTP: il ponte
   porta ogni messaggio di qua e di la'. Niente dipendenze: deve stare in un solo file.
   Se il programma e' chiuso non esce, come fa mcp-remote: resta vivo, offre uno strumento che
   spiega cosa manca e avvisa Claude appena il programma risponde.

   ENGLISH: THE BRIDGE OF THE CLAUDE DESKTOP EXTENSION
   This file does not run inside the program: it ends up as server/index.js in the .mcpb file the
   program saves (src/utils/claudeExtension.ts), and Claude Desktop starts it with its own Node.js.
   Claude talks to extensions over stdin/stdout, the program's MCP server talks HTTP: the bridge
   carries each message across. No dependencies: it has to fit in one file.
   If the program is closed it does not exit, as mcp-remote does: it stays alive, offers a tool that
   explains what is missing and tells Claude as soon as the program answers. */
'use strict';
const http = require('node:http');
const readline = require('node:readline');

const INDIRIZZO = new URL(process.env.ITM_URL || 'http://127.0.0.1:37620/images-tag-manager');
// ITALIANO: chi incolla il codice puo' portarsi dietro "Bearer " dalla configurazione a mano.
// ENGLISH: whoever pastes the token may bring "Bearer " along from the manual configuration.
const CODICE = String(process.env.ITM_TOKEN || '').trim().replace(/^Bearer\s+/i, '');
const ATTESA_RISPOSTA_MS = 120000;
const GIRO_CONTROLLO_MS = Number(process.env.ITM_CHECK_MS) || 5000;
const STRUMENTO_STATO = 'images_tag_manager_status';

const scrivi = (messaggio) => process.stdout.write(JSON.stringify(messaggio) + '\n');

// ITALIANO: una richiesta al programma: risolve sempre, con { stato, corpo } o con { guasto }.
//           `controllo`: la prova del ponte stesso, che il programma non conta come contatto di
//           un'AI (altrimenti il semaforino diventerebbe verde da solo).
// ENGLISH: one request to the program: it always resolves, with { stato, corpo } or { guasto }.
//          `controllo`: the bridge's own check, which the program does not count as an AI's
//          contact (otherwise the light would turn green by itself).
const chiama = (messaggio, controllo = false) => new Promise((risolvi) => {
    const corpo = Buffer.from(JSON.stringify(messaggio));
    let richiesta;
    // ITALIANO: un codice incollato con caratteri che un'intestazione non accetta fa lanciare
    //           http.request subito: senza questa presa Claude non avrebbe nessuna risposta.
    // ENGLISH: a token pasted with characters a header does not accept makes http.request throw at
    //          once: without this catch Claude would get no answer at all.
    try {
        richiesta = http.request({
            hostname: INDIRIZZO.hostname, port: INDIRIZZO.port, path: INDIRIZZO.pathname, method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json, text/event-stream',
                Authorization: `Bearer ${CODICE}`,
                'Content-Length': corpo.length,
                ...(controllo ? { 'X-ITM-Check': '1' } : {}),
            },
        }, (risposta) => {
            const pezzi = [];
            risposta.on('data', (pezzo) => pezzi.push(pezzo));
            risposta.on('end', () => risolvi({ stato: risposta.statusCode, corpo: Buffer.concat(pezzi).toString('utf8') }));
            risposta.on('error', (e) => risolvi({ guasto: e.message }));
        });
    } catch (e) {
        risolvi({ guasto: e.message, codiceRotto: e.code === 'ERR_INVALID_CHAR' });
        return;
    }
    richiesta.setTimeout(ATTESA_RISPOSTA_MS, () => richiesta.destroy(new Error('timeout')));
    richiesta.on('error', (e) => risolvi({ guasto: e.message }));
    richiesta.end(corpo);
});

// ITALIANO: il testo e' in inglese perche' lo legge l'AI, che poi lo dice nella lingua di chi usa Claude.
// ENGLISH: the text is in English because the AI reads it, then says it in the language of the Claude user.
const spiegazione = (esito) => {
    if (esito.codiceRotto) return 'The secret token pasted in Claude contains characters a token cannot have. Ask the user to copy it again from Images Tag Manager for LORAs (Settings, MCP server) and paste it in Claude: Settings, Extensions, Images Tag Manager for LORAs, Configure.';
    if (esito.stato === 401) return 'The secret token is wrong or old. Ask the user to copy it from Images Tag Manager for LORAs (Settings, MCP server) and paste it in Claude: Settings, Extensions, Images Tag Manager for LORAs, Configure.';
    if (esito.guasto !== undefined) return `Images Tag Manager for LORAs does not answer at ${INDIRIZZO.href}. Ask the user to open the program and switch on the MCP server in its Settings.`;
    return `Images Tag Manager for LORAs answered with error ${esito.stato}. Ask the user to close and reopen the program.`;
};

const riuscita = (esito) => esito.guasto === undefined && esito.stato >= 200 && esito.stato < 300;
// ITALIANO: "il programma non c'e'": non risponde, il codice e' sbagliato o lui stesso si e' guastato.
//           Gli altri errori (400, 403, 404...) sono risposte vere e passano a Claude come sono.
// ENGLISH: "the program is not there": it does not answer, the token is wrong or it broke itself.
//          The other errors (400, 403, 404...) are real answers and reach Claude as they are.
const assente = (esito) => esito.guasto !== undefined || esito.stato === 401 || esito.stato >= 500;

// ITALIANO: dopo un guasto si riprova ogni pochi secondi; quando il programma risponde, Claude rilegge
//           gli strumenti e lo strumento di stato lascia il posto a quelli veri.
// ENGLISH: after a failure it tries again every few seconds; when the program answers, Claude reads the
//          tools again and the status tool makes way for the real ones.
let controllo = null;
const tieniDOcchio = () => {
    if (controllo) return;
    controllo = setInterval(async () => {
        if (!riuscita(await chiama({ jsonrpc: '2.0', id: 'itm-check', method: 'ping' }, true)) || !controllo) return;
        clearInterval(controllo);
        controllo = null;
        scrivi({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' });
    }, GIRO_CONTROLLO_MS);
    controllo.unref();
};

// ITALIANO: la risposta quando il programma non c'e', per i metodi che Claude non deve veder fallire.
// ENGLISH: the answer when the program is not there, for the methods Claude must not see failing.
const rispostaSenzaProgramma = (messaggio, esito) => {
    const { id, method, params } = messaggio;
    if (method === 'initialize') {
        return { jsonrpc: '2.0', id, result: {
            protocolVersion: params && params.protocolVersion,
            capabilities: { tools: { listChanged: true } },
            serverInfo: { name: 'images-tag-manager', version: '0' },
        } };
    }
    if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
    if (method === 'tools/list') {
        return { jsonrpc: '2.0', id, result: { tools: [{
            name: STRUMENTO_STATO,
            description: 'Images Tag Manager for LORAs is not connected. Call this tool to find out why, and tell the user what to do.',
            inputSchema: { type: 'object', properties: {} },
        }] } };
    }
    if (method === 'tools/call') {
        return { jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: spiegazione(esito) }] } };
    }
    return { jsonrpc: '2.0', id, error: { code: -32000, message: spiegazione(esito) } };
};

const gestisci = async (messaggio) => {
    const esito = await chiama(messaggio);
    const attesaRisposta = messaggio.id !== undefined && messaggio.id !== null;
    if (assente(esito)) {
        // ITALIANO: un codice illeggibile non si aggiusta da solo: inutile riprovare.
        // ENGLISH: an unreadable token does not fix itself: no point trying again.
        if (!esito.codiceRotto) tieniDOcchio();
        if (attesaRisposta) scrivi(rispostaSenzaProgramma(messaggio, esito));
        return;
    }
    if (!attesaRisposta) return;
    let risposta = null;
    try { risposta = esito.corpo ? JSON.parse(esito.corpo) : null; } catch (_) { }
    // ITALIANO: un errore vero del programma (400, 403, 404...): Claude lo riceve sempre, con l'id
    //           della sua domanda (il server lo manda con "id": null) e con cosa fare. Anche senza
    //           corpo: altrimenti Claude aspetterebbe fino al suo limite.
    // ENGLISH: a real error from the program (400, 403, 404...): Claude always gets it, with its
    //          question's id (the server sends it with "id": null) and what to do. Even without a
    //          body: otherwise Claude would wait until its own limit.
    if (!riuscita(esito)) {
        const motivo = (risposta && risposta.error && risposta.error.message) || `HTTP ${esito.stato}`;
        scrivi({ jsonrpc: '2.0', id: messaggio.id, error: { code: (risposta && risposta.error && risposta.error.code) || -32603,
            message: `Images Tag Manager for LORAs refused the request (${motivo}). Ask the user to save the Claude extension again from the program's MCP settings and install it again.` } });
        return;
    }
    if (!risposta) {
        scrivi({ jsonrpc: '2.0', id: messaggio.id, error: { code: -32603, message: 'The program sent an answer that cannot be read.' } });
        return;
    }
    // ITALIANO: senza questa promessa Claude ignorerebbe l'avviso degli strumenti cambiati.
    // ENGLISH: without this promise Claude would ignore the changed tools notice.
    if (messaggio.method === 'initialize' && risposta.result && risposta.result.capabilities) {
        risposta.result.capabilities.tools = { ...risposta.result.capabilities.tools, listChanged: true };
    }
    scrivi(risposta);
};

readline.createInterface({ input: process.stdin }).on('line', (riga) => {
    if (!riga.trim()) return;
    let messaggio;
    try { messaggio = JSON.parse(riga); } catch (_) {
        scrivi({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        return;
    }
    gestisci(messaggio).catch((e) => console.error('[bridge]', e));
}).on('close', () => process.exit(0));
