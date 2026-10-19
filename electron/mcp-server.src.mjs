/******************************************************************************
**  ITALIANO: SERVER MCP DEL PROGRAMMA                                        **
**  Permette a un'AI esterna (Claude Code, Claude Desktop, Cursor...) di      **
**  vedere le foto aperte e di cambiarne i tag, come al posto di Gemini.      **
**  Regole, decise dal proprietario il 15/10/2026:                                   **
**   - spento di serie: parte solo se lo si accende nelle Impostazioni;       **
**   - ascolta SOLO su 127.0.0.1 (mai sulla rete) e chiede un codice segreto; **
**   - l'AI cambia i tag solo NEL PROGRAMMA: sul disco si scrive solo quando  **
**     l'utente preme "Salva Modifiche". Non esiste uno strumento per salvare.**
**  Questo file si impacchetta con esbuild in electron/mcp-server.cjs         **
**  (npm run build:mcp): il processo principale non porta node_modules.       **
**                                                                            **
**  ENGLISH: THE PROGRAM'S MCP SERVER                                         **
**  Lets an external AI (Claude Code, Claude Desktop, Cursor...) see the open **
**  photos and change their tags, as an alternative to Gemini. Rules (owner,  **
**  15/10/2026): off by default; listens ONLY on 127.0.0.1 with a secret      **
**  token; the AI changes tags only IN THE PROGRAM, the disk is written only  **
**  when the user presses "Save Changes" - there is no save tool. Bundled by  **
**  esbuild into electron/mcp-server.cjs (npm run build:mcp).                 **
******************************************************************************/
import http from 'node:http';
import crypto from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

const CORPO_MAX = 1024 * 1024;
export const PERCORSO_MCP = '/images-tag-manager';
const TAG = z.string().min(1).max(200);

// ITALIANO: il confronto del codice non dipende da quante lettere sono giuste (niente indizi dai tempi).
// ENGLISH: the token comparison does not depend on how many characters match (no timing hints).
const stessoCodice = (a, b) => {
    const x = Buffer.from(String(a || ''));
    const y = Buffer.from(String(b || ''));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// ITALIANO: una pagina web aperta nel browser non deve poter parlare col server (attacco "DNS
//           rebinding"): si accettano solo Host 127.0.0.1/localhost sulla porta giusta, e un
//           Origin solo se e' locale anche lui.
// ENGLISH: a web page open in the browser must not be able to talk to the server ("DNS
//          rebinding"): only Host 127.0.0.1/localhost on the right port is accepted, and an
//          Origin only if it is local as well.
export const richiestaLocale = (headers, porta) => {
    const host = String(headers.host || '').toLowerCase();
    if (host !== `127.0.0.1:${porta}` && host !== `localhost:${porta}`) return false;
    const origin = headers.origin;
    if (origin === undefined || origin === 'null') return true;
    return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(String(origin));
};

const testo = (dati) => ({ content: [{ type: 'text', text: typeof dati === 'string' ? dati : JSON.stringify(dati, null, 2) }] });
const errore = (messaggio) => ({ content: [{ type: 'text', text: String(messaggio) }], isError: true });

// ITALIANO: gli strumenti. `chiedi(strumento, argomenti)` gira la domanda al programma (la
//           finestra), che ha le foto e i tag in memoria, e ne restituisce la risposta.
// ENGLISH: the tools. `chiedi(tool, args)` forwards the question to the program (the window),
//          which holds photos and tags in memory, and returns its answer.
export const creaServerMcp = (chiedi, versione) => {
    const server = new McpServer({ name: 'images-tag-manager', version: String(versione || '0.0.0') });
    const passa = (strumento) => async (argomenti) => {
        try {
            const r = await chiedi(strumento, argomenti || {});
            if (r && r.errore) return errore(r.errore);
            if (r && r.immagine) {
                return { content: [
                    { type: 'image', data: r.immagine.data, mimeType: r.immagine.mimeType },
                    { type: 'text', text: JSON.stringify(r.info || {}, null, 2) },
                ] };
            }
            return testo(r && r.risultato !== undefined ? r.risultato : r);
        } catch (e) {
            return errore(e && e.message ? e.message : e);
        }
    };
    const NOTA = ' Changes stay in the program only: nothing is written to disk until the user presses "Save Changes".';

    server.registerTool('list_photos', {
        title: 'List photos',
        description: 'Lists the photos open in Images Tag Manager (trashed ones excluded) with their id, file name, folder, current tags and whether they have unsaved changes. A photo marked txt_unreadable has a .txt that could not be read when it was opened: "Save Changes" does not write it. Optional filters: tags that must all be present, or only photos without tags. With tags or untagged_only the list is computed again at every call from the current tags: a photo whose tags you change leaves it only if it no longer matches the filter, so changing tags while you page through it makes you skip or repeat photos. To work through a long list, first read all its pages without changing anything (advance offset by the number of photos returned, and stop when a page comes back empty or offset reaches total), note the ids, and only then change the tags of those ids.',
        inputSchema: {
            tags: z.array(TAG).max(20).optional().describe('Only photos that have ALL these tags (case-insensitive).'),
            untagged_only: z.boolean().optional().describe('Only photos with no tags. Photos you tag leave this list, photos you leave untagged stay in it: read all its pages and note the ids before you start tagging.'),
            offset: z.number().int().min(0).optional().describe('Skip this many photos of the list. To read the next page, advance it by the number of photos returned; stop when a page comes back empty. With tags or untagged_only read all the pages before you change any tags, because the list is computed again at every call.'),
            limit: z.number().int().min(1).max(500).optional().describe('Default 100.'),
        },
        annotations: { readOnlyHint: true },
    }, passa('list_photos'));

    server.registerTool('get_photo', {
        title: 'Get photo',
        description: 'Returns one photo as an image (resized to at most 1024 px, JPEG, with its hidden metadata such as GPS removed) together with its current tags.',
        inputSchema: { id: z.string().min(1).max(500) },
        annotations: { readOnlyHint: true },
    }, passa('get_photo'));

    server.registerTool('list_project_tags', {
        title: 'List project tags',
        description: 'Lists every tag used by the open photos with how many photos use it, plus the trigger words that the program always keeps first.',
        inputSchema: {},
        annotations: { readOnlyHint: true },
    }, passa('list_project_tags'));

    server.registerTool('set_tags', {
        title: 'Set tags',
        description: 'Replaces all the tags of one photo. Trigger words are kept and put first automatically; duplicates differing only in case are merged.' + NOTA,
        inputSchema: { id: z.string().min(1).max(500), tags: z.array(TAG).max(300) },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    }, passa('set_tags'));

    server.registerTool('add_tags', {
        title: 'Add tags',
        description: 'Adds tags to one or more photos, keeping the tags they already have.' + NOTA,
        inputSchema: { ids: z.array(z.string().min(1).max(500)).min(1).max(5000), tags: z.array(TAG).min(1).max(100) },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    }, passa('add_tags'));

    server.registerTool('remove_tags', {
        title: 'Remove tags',
        description: 'Removes tags (case-insensitive) from one or more photos. Trigger words cannot be removed this way.' + NOTA,
        inputSchema: { ids: z.array(z.string().min(1).max(500)).min(1).max(5000), tags: z.array(TAG).min(1).max(100) },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    }, passa('remove_tags'));

    return server;
};

// ITALIANO: oltre 1 MB il resto si legge senza tenerlo, e poi si risponde 413: chiudere la
//           connessione a meta' lasciava il client senza nessuna risposta.
// ENGLISH: past 1 MB the rest is read without keeping it, then 413 is answered: closing the
//          connection halfway left the client with no answer at all.
const leggiCorpo = (req) => new Promise((risolvi, rifiuta) => {
    let dimensione = 0;
    const pezzi = [];
    req.on('data', (p) => {
        dimensione += p.length;
        if (dimensione <= CORPO_MAX) pezzi.push(p);
    });
    req.on('end', () => {
        if (dimensione > CORPO_MAX) { rifiuta(Object.assign(new Error('Payload too large'), { codice: 413 })); return; }
        try { risolvi(pezzi.length ? JSON.parse(Buffer.concat(pezzi).toString('utf8')) : undefined); }
        catch (_) { rifiuta(Object.assign(new Error('JSON non valido'), { codice: 400 })); }
    });
    req.on('error', rifiuta);
});

const rispondi = (res, codice, messaggio) => {
    if (res.headersSent) return;
    res.writeHead(codice, { 'Content-Type': 'application/json' });
    res.write(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: messaggio }, id: null }));
    res.end();
};

// ITALIANO: avvia il server. Risponde con { porta, chiudi } oppure rifiuta (es. porta occupata).
//           Modalita' "senza sessione": ogni richiesta ha il suo server e il suo trasporto.
// ENGLISH: starts the server. Resolves with { porta, chiudi } or rejects (e.g. port in use).
//          "Stateless" mode: every request gets its own server and transport.
export const avviaServerMcp = ({ porta, codice, chiedi, versione }) => new Promise((risolvi, rifiuta) => {
    const httpServer = http.createServer(async (req, res) => {
        try {
            const percorso = String(req.url || '').split('?')[0];
            // ITALIANO: l'indirizzo NON contiene "mcp": l'antivirus Avast intercetta il traffico locale
            //           sugli indirizzi con "mcp" e lo riscrive male (dichiara "chunked" senza dividere il
            //           corpo), e i client rifiutano la risposta. Visto il 15/10/2026 sul PC del proprietario.
            // ENGLISH: the path does NOT contain "mcp": the Avast antivirus intercepts local traffic on
            //          paths with "mcp" and rewrites it wrongly (declares "chunked" without chunking the
            //          body), and clients reject the response. Seen on 15/10/2026 on the owner's PC.
            if (percorso !== PERCORSO_MCP) return rispondi(res, 404, 'Not found');
            const portaVera = httpServer.address() && httpServer.address().port;
            if (!richiestaLocale(req.headers, portaVera)) return rispondi(res, 403, 'Forbidden');
            const autorizzazione = String(req.headers.authorization || '');
            if (!autorizzazione.startsWith('Bearer ') || !stessoCodice(autorizzazione.slice(7), codice)) {
                res.setHeader('WWW-Authenticate', 'Bearer');
                return rispondi(res, 401, 'Unauthorized');
            }
            if (req.method !== 'POST') return rispondi(res, 405, 'Method not allowed');
            const corpo = await leggiCorpo(req);
            // ITALIANO: il trasporto "web standard" della libreria, con la risposta scritta qui. Il
            //           convertitore Node incluso nella libreria, una volta impacchettato, dichiarava
            //           "chunked" senza dividere il corpo, e i client rifiutavano la risposta.
            // ENGLISH: the library's "web standard" transport, with the response written here. The
            //          library's bundled Node adapter declared "chunked" without chunking the body,
            //          and clients rejected the response.
            const server = creaServerMcp(chiedi, versione);
            const trasporto = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
            try {
                await server.connect(trasporto);
                const intestazioni = new Headers();
                for (const [nome, valore] of Object.entries(req.headers)) {
                    if (valore === undefined || ['host', 'content-length', 'connection', 'transfer-encoding'].includes(nome)) continue;
                    intestazioni.set(nome, Array.isArray(valore) ? valore.join(', ') : String(valore));
                }
                const richiesta = new Request(`http://127.0.0.1:${portaVera}${PERCORSO_MCP}`, { method: 'POST', headers: intestazioni, body: JSON.stringify(corpo ?? null) });
                const risposta = await trasporto.handleRequest(richiesta, { parsedBody: corpo });
                const contenuto = Buffer.from(await risposta.arrayBuffer());
                const uscita = {};
                risposta.headers.forEach((valore, nome) => {
                    if (!['content-length', 'transfer-encoding', 'connection'].includes(nome)) uscita[nome] = valore;
                });
                // ITALIANO: risposta a blocchi ("chunked"), SENZA lunghezza dichiarata: Avast riscrive le
                //           risposte MCP con la lunghezza e le rompe (vedi sopra); quelle a blocchi le
                //           lascia passare intatte. Provato il 15/10/2026 sul PC del proprietario.
                // ENGLISH: chunked response, WITHOUT a declared length: Avast rewrites MCP responses that
                //          carry a length and breaks them (see above); chunked ones pass untouched.
                res.writeHead(risposta.status, uscita);
                if (contenuto.length > 0) res.write(contenuto);
                res.end();
            } finally {
                trasporto.close().catch(() => {});
                server.close().catch(() => {});
            }
        } catch (e) {
            rispondi(res, e && e.codice ? e.codice : 500, e && e.codice ? e.message : 'Internal error');
        }
    });
    httpServer.on('error', rifiuta);
    httpServer.listen(porta, '127.0.0.1', () => {
        httpServer.off('error', rifiuta);
        httpServer.on('error', (e) => console.error('[MCP] server error', e));
        risolvi({
            porta: httpServer.address().port,
            chiudi: () => new Promise((fatto) => { httpServer.closeAllConnections?.(); httpServer.close(() => fatto()); }),
        });
    });
});
