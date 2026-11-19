/* ITALIANO: PROVA DELL'ESTENSIONE PER CLAUDE DESKTOP (FILE .MCPB) E DELLA GUIDA A MANO
   Claude Desktop installa un'estensione trascinando un file .mcpb nella pagina Estensioni. Il
   programma salva quel file (src/utils/claudeExtension.ts): un manifest e il ponte
   electron/claude-bridge.cjs, che Claude avvia col suo Node.js e che porta i messaggi da stdin/stdout
   al server MCP del programma. Prima l'unica strada era la configurazione a mano con mcp-remote, che
   vuole Node.js, si rompe se il file di Claude viene incollato per intero e, a programma chiuso, esce.
   Si controlla: il file .mcpb ha il manifest giusto e NON contiene il codice segreto; il ponte,
   parlando col server vero, si presenta, elenca gli strumenti veri e li usa (togliendo "Bearer "
   incollato per errore); con un codice sbagliato o col programma chiuso non esce, offre lo strumento
   che spiega cosa fare e, quando il programma si riapre, avvisa Claude; i testi della guida ci sono
   in nove lingue, con i nomi dei menu di Claude, e la finestra li mostra.
   Uso:  node scripts/test-claude-extension.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CLAUDE DESKTOP EXTENSION (.MCPB FILE) AND OF THE MANUAL GUIDE
   Claude Desktop installs an extension when a .mcpb file is dragged onto its Extensions page. The
   program saves that file (src/utils/claudeExtension.ts): a manifest and the bridge
   electron/claude-bridge.cjs, which Claude starts with its own Node.js and which carries messages
   from stdin/stdout to the program's MCP server. Before, the only way was the manual configuration
   with mcp-remote, which needs Node.js, breaks when Claude's file is pasted over whole and, with the
   program closed, exits.
   Checked: the .mcpb file has the right manifest and does NOT contain the secret token; the bridge,
   talking to the real server, introduces itself, lists the real tools and uses them (dropping a
   "Bearer " pasted by mistake); with a wrong token or the program closed it does not exit, offers the
   tool that explains what to do and, when the program opens again, tells Claude; the guide's texts
   exist in nine languages, with Claude's menu names, and the window shows them.
   Usage:  node scripts/test-claude-extension.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const require = createRequire(import.meta.url);
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (f) => fs.readFileSync(path.join(radice, f), 'utf8').replace(/\r\n/g, '\n');
const PONTE = path.join(radice, 'electron/claude-bridge.cjs');
const CODICE = 'k'.repeat(32);

const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-estensione-'));
const ponti = [];
const server = [];
let codiceUscita = 1;

// ITALIANO: un ponte acceso, con chi legge le sue righe e chi aspetta un messaggio preciso.
// ENGLISH: a running bridge, with a reader of its lines and a waiter for a given message.
const avviaPonte = (indirizzo, codice) => {
    const figlio = spawn(process.execPath, [PONTE], {
        env: { ...process.env, ITM_URL: indirizzo, ITM_TOKEN: codice, ITM_CHECK_MS: '150' },
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    ponti.push(figlio);
    const arrivati = [];
    const attese = [];
    let resto = '';
    figlio.stdout.on('data', (pezzo) => {
        resto += pezzo.toString('utf8');
        let a;
        while ((a = resto.indexOf('\n')) >= 0) {
            const riga = resto.slice(0, a);
            resto = resto.slice(a + 1);
            const messaggio = JSON.parse(riga);
            arrivati.push(messaggio);
            for (const attesa of [...attese]) if (attesa.vale(messaggio)) { attese.splice(attese.indexOf(attesa), 1); attesa.risolvi(messaggio); }
        }
    });
    const aspetta = (vale, ms = 4000) => new Promise((risolvi) => {
        const gia = arrivati.find(vale);
        if (gia) return risolvi(gia);
        const attesa = { vale, risolvi };
        attese.push(attesa);
        setTimeout(() => { if (attese.includes(attesa)) { attese.splice(attese.indexOf(attesa), 1); risolvi(null); } }, ms);
    });
    let prossimo = 1;
    const chiedi = async (method, params) => {
        const id = prossimo++;
        figlio.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
        return aspetta((m) => m.id === id);
    };
    const manda = (testo) => figlio.stdin.write(testo + '\n');
    return { figlio, arrivati, aspetta, chiedi, manda };
};

const presentati = { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'prova', version: '1.0.0' } };

try {
    console.log('\n--- il file .mcpb ---');
    const pacchettoUtil = path.join(cartella, 'claudeExtension.mjs');
    await esbuild.build({
        entryPoints: [path.join(radice, 'src/utils/claudeExtension.ts')],
        outfile: pacchettoUtil, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
        plugins: [{ name: 'raw', setup(b) {
            b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?raw$/, '')), namespace: 'raw' }));
            b.onLoad({ filter: /.*/, namespace: 'raw' }, (a) => ({ contents: fs.readFileSync(a.path, 'utf8'), loader: 'text' }));
        } }],
    });
    const { creaEstensioneClaude, NOME_FILE_ESTENSIONE } = await import('file://' + pacchettoUtil.replace(/\\/g, '/'));
    const JSZip = require('jszip');
    const indirizzoProva = 'http://127.0.0.1:37620/images-tag-manager';
    const zip = await JSZip.loadAsync(await creaEstensioneClaude('2.0.3', indirizzoProva));
    const nomi = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
    dice('il nome del file finisce in .mcpb', true, NOME_FILE_ESTENSIONE.endsWith('.mcpb'));
    dice('dentro ci sono solo il manifest (alla radice) e il ponte', ['manifest.json', 'server/index.js'], nomi);
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    dice('manifest: campi obbligatori della specifica', [true, true, true, true, true, true],
        ['manifest_version', 'name', 'version', 'description', 'author', 'server'].map((k) => k === 'author' ? !!manifest.author?.name : !!manifest[k]));
    // ITALIANO: la versione dello schema la controlla una volta a mano «mcpb validate» (le prove non lo
    //           possono lanciare): qui si tiene ferma, altrimenti un valore cambiato passerebbe inosservato.
    // ENGLISH: the schema version is checked once by hand with "mcpb validate" (tests cannot run it): it is
    //          pinned here, otherwise a changed value would go unnoticed.
    dice('manifest: versione dello schema 0.3', '0.3', manifest.manifest_version);
    dice('manifest: strumenti dati dal server e piattaforme', [true, ['win32', 'darwin', 'linux']], [manifest.tools_generated, manifest.compatibility?.platforms]);
    dice('manifest: versione del programma', '2.0.3', manifest.version);
    dice('manifest: server node con il ponte come punto di partenza', ['node', 'server/index.js', 'node', ['${__dirname}/server/index.js']],
        [manifest.server.type, manifest.server.entry_point, manifest.server.mcp_config.command, manifest.server.mcp_config.args]);
    dice('manifest: indirizzo nel file, codice chiesto da Claude', { ITM_URL: indirizzoProva, ITM_TOKEN: '${user_config.token}' }, manifest.server.mcp_config.env);
    dice('manifest: il codice e\' un campo segreto e obbligatorio', ['string', true, true],
        [manifest.user_config.token.type, manifest.user_config.token.sensitive, manifest.user_config.token.required]);
    const ponteNelFile = await zip.file('server/index.js').async('string');
    dice('il ponte nel file e\' quello del repository', fs.readFileSync(PONTE, 'utf8'), ponteNelFile);
    dice('nel file non c\'e\' nessun codice o "Bearer" scritto', false, /Bearer [A-Za-z0-9]{8,}|codice:|"token":\s*"[A-Za-z0-9]{8,}/.test(JSON.stringify(manifest) + ponteNelFile.replace(/Bearer \$\{CODICE\}/, '')));

    console.log('\n--- il ponte col server vero e il codice giusto ---');
    const pacchettoServer = path.join(cartella, 'mcp-server.cjs');
    await esbuild.build({
        entryPoints: [path.join(radice, 'electron/mcp-server.src.mjs')],
        outfile: pacchettoServer, bundle: true, platform: 'node', format: 'cjs', target: 'node20', logLevel: 'silent',
    });
    const { avviaServerMcp } = require(pacchettoServer);
    const domande = [];
    let contatti = 0;
    const chiediAlProgramma = async (strumento, argomenti) => { domande.push(strumento); return { risultato: strumento === 'list_photos' ? { total: 1, photos: [{ id: 'f1', name: 'uno.png', tags: ['3d'] }] } : [] }; };
    const acceso = await avviaServerMcp({ porta: 0, codice: CODICE, chiedi: chiediAlProgramma, versione: '2.0.3', contatto: () => { contatti++; } });
    server.push(acceso);
    const indirizzo = `http://127.0.0.1:${acceso.porta}/images-tag-manager`;
    const buono = avviaPonte(indirizzo, `Bearer ${CODICE}`);
    const inizio = await buono.chiedi('initialize', presentati);
    dice('si presenta col nome e la versione del programma', ['images-tag-manager', '2.0.3'], [inizio?.result?.serverInfo?.name, inizio?.result?.serverInfo?.version]);
    dice('promette di avvisare quando gli strumenti cambiano', true, inizio?.result?.capabilities?.tools?.listChanged);
    buono.manda(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }));
    const elenco = await buono.chiedi('tools/list', {});
    const strumenti = (elenco?.result?.tools || []).map((s) => s.name);
    dice('elenca gli strumenti veri, senza quello di stato', [true, true, false],
        [strumenti.includes('list_photos'), strumenti.includes('add_tags'), strumenti.includes('images_tag_manager_status')]);
    dice('porta le descrizioni vere degli strumenti (la nota sulle virgole)', true, /comma/.test((elenco?.result?.tools || []).find((x) => x.name === 'add_tags')?.description || ''));
    const foto = await buono.chiedi('tools/call', { name: 'list_photos', arguments: {} });
    dice('usa uno strumento: la domanda arriva al programma e la risposta torna', [true, true],
        [domande.includes('list_photos'), JSON.stringify(foto?.result || {}).includes('uno.png')]);
    dice('col codice giusto le richieste contano come contatto (semaforino verde)', true, contatti > 0);
    const primaDellaNotifica = buono.arrivati.length;
    buono.manda(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 99 } }));
    await new Promise((r) => setTimeout(r, 400));
    dice('una notifica di Claude non riceve nessuna risposta', primaDellaNotifica, buono.arrivati.length);
    const [primo, secondo] = await Promise.all([buono.chiedi('tools/call', { name: 'list_photos', arguments: {} }), buono.chiedi('tools/list', {})]);
    dice('due domande insieme: ognuna ha la sua risposta, con il suo id', [true, true],
        [JSON.stringify(primo?.result || {}).includes('uno.png'), Array.isArray(secondo?.result?.tools)]);
    buono.manda('{non e\' json');
    const rotto = await buono.aspetta((m) => m.error?.code === -32700);
    dice('una riga illeggibile riceve l\'errore di lettura, e il ponte resta vivo', [true, null], [!!rotto, buono.figlio.exitCode]);
    // ITALIANO: una chat rimasta con il solo strumento di stato lo richiama a programma aperto: il server
    //           vero non lo conosce, quindi risponde il ponte (prima: «Tool ... not found» con isError).
    // ENGLISH: a chat left with only the status tool calls it with the program open: the real server
    //          does not know it, so the bridge answers (before: "Tool ... not found" with isError).
    const statoAperto = await buono.chiedi('tools/call', { name: 'images_tag_manager_status', arguments: {} });
    dice('programma aperto: lo strumento di stato dice "collegato", senza errore, e nomina la chat nuova', [undefined, true, true, false],
        [statoAperto?.result?.isError, /is connected now/.test(statoAperto?.result?.content?.[0]?.text || ''), /new chat/.test(statoAperto?.result?.content?.[0]?.text || ''), /not found/.test(JSON.stringify(statoAperto || {}))]);
    dice('lo strumento di stato non arriva al programma', false, domande.includes('images_tag_manager_status'));

    console.log('\n--- il ponte con un codice sbagliato ---');
    const contattiPrima = contatti;
    const sbagliato = avviaPonte(indirizzo, 'x'.repeat(32));
    const inizioSbagliato = await sbagliato.chiedi('initialize', presentati);
    dice('si presenta lo stesso, cosi\' Claude non segna l\'estensione come guasta', true, !!inizioSbagliato?.result?.capabilities);
    const elencoSbagliato = await sbagliato.chiedi('tools/list', {});
    dice('offre solo lo strumento di stato', ['images_tag_manager_status'], (elencoSbagliato?.result?.tools || []).map((s) => s.name));
    const statoSbagliato = await sbagliato.chiedi('tools/call', { name: 'images_tag_manager_status', arguments: {} });
    dice('lo strumento di stato spiega che il codice e\' sbagliato e dove cambiarlo', [true, true, true],
        [statoSbagliato?.result?.isError, /token is wrong/.test(statoSbagliato?.result?.content?.[0]?.text || ''), /Extensions/.test(statoSbagliato?.result?.content?.[0]?.text || '')]);
    dice('il codice sbagliato non accende il semaforino', contattiPrima, contatti);
    dice('il ponte resta vivo', null, sbagliato.figlio.exitCode);

    console.log('\n--- errori veri del programma e codice illeggibile ---');
    const strada = avviaPonte(indirizzo.replace('/images-tag-manager', '/sbagliato'), CODICE);
    const nonTrovato = await strada.chiedi('tools/list', {});
    dice('un errore vero del programma (404) arriva a Claude, con l\'id della domanda e cosa fare', [true, true, true],
        [/Not found/.test(nonTrovato?.error?.message || ''), /save the Claude extension again/.test(nonTrovato?.error?.message || ''), nonTrovato?.id === 1]);
    await new Promise((r) => setTimeout(r, 600));
    dice('e non fa partire i controlli ne\' l\'avviso degli strumenti cambiati', 0, strada.arrivati.filter((m) => m.method).length);
    // ITALIANO: un intermediario (un antivirus) che risponde con un errore SENZA corpo.
    // ENGLISH: a middleman (an antivirus) answering with an error WITHOUT a body.
    const muto = http.createServer((req, res) => { req.resume(); req.on('end', () => { res.writeHead(418); res.end(); }); });
    await new Promise((r) => muto.listen(0, '127.0.0.1', r));
    const versoMuto = avviaPonte(`http://127.0.0.1:${muto.address().port}/images-tag-manager`, CODICE);
    const rispostaMuta = await versoMuto.chiedi('tools/list', {});
    muto.close();
    dice('un errore senza corpo riceve comunque una risposta, con l\'id della domanda', [true, true], [rispostaMuta?.id === 1, /HTTP 418/.test(rispostaMuta?.error?.message || '')]);
    const rotto2 = avviaPonte(indirizzo, 'abc\u2603def');
    const inizioRotto = await rotto2.chiedi('initialize', presentati);
    dice('codice con caratteri non validi: Claude riceve comunque la presentazione', true, !!inizioRotto?.result?.capabilities);
    const statoRotto = await rotto2.chiedi('tools/call', { name: 'images_tag_manager_status', arguments: {} });
    dice('e lo strumento di stato dice di incollare di nuovo il codice', true, /characters a token cannot have/.test(statoRotto?.result?.content?.[0]?.text || ''));

    console.log('\n--- il ponte col programma chiuso, poi riaperto ---');
    const portaLibera = acceso.porta;
    await acceso.chiudi();
    server.splice(server.indexOf(acceso), 1);
    const solo = avviaPonte(indirizzo, CODICE);
    const inizioSolo = await solo.chiedi('initialize', presentati);
    dice('a programma chiuso si presenta lo stesso, con la stessa versione del protocollo', ['2025-06-18', true],
        [inizioSolo?.result?.protocolVersion, inizioSolo?.result?.capabilities?.tools?.listChanged]);
    const elencoSolo = await solo.chiedi('tools/list', {});
    dice('a programma chiuso offre lo strumento di stato', ['images_tag_manager_status'], (elencoSolo?.result?.tools || []).map((s) => s.name));
    const statoSolo = await solo.chiedi('tools/call', { name: 'list_photos', arguments: {} });
    dice('chiamare uno strumento dice di aprire il programma e accendere il server', [true, true],
        [statoSolo?.result?.isError, /open the program and switch on the MCP server/.test(statoSolo?.result?.content?.[0]?.text || '')]);
    const pingSolo = await solo.chiedi('ping', {});
    dice('risponde al ping anche senza programma', {}, pingSolo?.result);
    dice('il ponte non esce (mcp-remote invece usciva)', null, solo.figlio.exitCode);
    let contattiRiaperto = 0;
    const riaperto = await avviaServerMcp({ porta: portaLibera, codice: CODICE, chiedi: chiediAlProgramma, versione: '2.0.3', contatto: () => { contattiRiaperto++; } });
    server.push(riaperto);
    const avviso = await solo.aspetta((m) => m.method === 'notifications/tools/list_changed', 5000);
    dice('quando il programma si riapre, avvisa Claude che gli strumenti sono cambiati', true, !!avviso);
    dice('il controllo del ponte non accende il semaforino da solo', 0, contattiRiaperto);
    const elencoDopo = await solo.chiedi('tools/list', {});
    dice('e da li\' elenca gli strumenti veri', true, (elencoDopo?.result?.tools || []).some((s) => s.name === 'list_photos'));
    const contattiPrimaDelloStato = contattiRiaperto;
    const statoDopo = await solo.chiedi('tools/call', { name: 'images_tag_manager_status', arguments: {} });
    dice('riaperto: lo strumento di stato dice "collegato", senza errore, e nomina la chat nuova', [undefined, true, true],
        [statoDopo?.result?.isError, /is connected now/.test(statoDopo?.result?.content?.[0]?.text || ''), /new chat/.test(statoDopo?.result?.content?.[0]?.text || '')]);
    dice('e il suo controllo non conta come contatto di un\'AI', contattiPrimaDelloStato, contattiRiaperto);
    const avvisi = solo.arrivati.filter((m) => m.method === 'notifications/tools/list_changed').length;
    await new Promise((r) => setTimeout(r, 500));
    dice('l\'avviso parte una volta sola', avvisi, solo.arrivati.filter((m) => m.method === 'notifications/tools/list_changed').length);

    console.log('\n--- la guida nella finestra e i testi ---');
    const app = leggi('src/App.tsx');
    dice('il pulsante della guida sta fra i dati MCP (Impostazioni e finestrella)', true, /data-mcp-guida-claude onClick=\{\(\) => setAiuto\('claudeDesktop'\)\}/.test(app));
    dice('la finestra di spiegazione mostra la guida', true, app.includes("{aiuto === 'claudeDesktop' && guidaClaude()}"));
    dice('la guida ha il pulsante che salva il file e quello che copia la voce', [true, true],
        [/data-mcp-salva-estensione onClick=\{salvaEstensioneClaude\}/.test(app), /data-mcp-copia-voce onClick=\{\(\) => copiaMcp\(voceMcpDesktop\(\)\)\}/.test(app)]);
    const da = app.indexOf('    const indirizzoMcp = ');
    const a = app.indexOf('    const salvaEstensioneClaude = ');
    const corpoVoce = (await esbuild.transform(`export default (mcpStato) => {\n${app.slice(da, a)}\n    return voceMcpDesktop();\n};`, { loader: 'ts', format: 'esm' })).code;
    const voceDi = (await import('data:text/javascript;base64,' + Buffer.from(corpoVoce).toString('base64'))).default;
    const voce = voceDi({ porta: 37620, codice: CODICE });
    dice('la voce copiata e\' la sola voce del server', ['images-tag-manager'], Object.keys(JSON.parse('{' + voce + '}')));
    const fileClaude = { mcpServers: { altro: { command: 'x' } }, preferences: { tema: 'scuro' } };
    const testoClaude = JSON.stringify(fileClaude, null, 2);
    const conVoce = testoClaude.replace('"mcpServers": {', '"mcpServers": {\n' + voce + ',');
    const letto = JSON.parse(conVoce);
    dice('incollata come dice la guida, il file di Claude resta valido e tiene il resto', [['images-tag-manager', 'altro'], 'scuro'],
        [Object.keys(letto.mcpServers), letto.preferences.tema]);
    const senzaServer = JSON.stringify({ preferences: { tema: 'scuro' } }, null, 2).replace('{', '{\n"mcpServers": {\n' + voce + '\n},');
    dice('in un file senza "mcpServers", seguendo la guida, resta valido', ['images-tag-manager'], Object.keys(JSON.parse(senzaServer).mcpServers));
    const uscita = await esbuild.build({ entryPoints: [path.join(radice, 'src/constants.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    const { translations } = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
    const CHIAVI = ['mcpClaudeGuide', 'mcpClaudeExtTitle', 'mcpClaudeExt1', 'mcpClaudeExtSave', 'mcpClaudeExt2', 'mcpClaudeExt3', 'mcpClaudeExt4',
        'mcpClaudeManTitle', 'mcpClaudeMan1', 'mcpClaudeMan2', 'mcpClaudeManCopy', 'mcpClaudeMan3', 'mcpClaudeConnectorNote', 'mcpClaudeSaved'];
    // ITALIANO: i nomi dei menu come li scrive Claude in quella lingua (cinese e russo: Claude e' in inglese).
    // ENGLISH: the menu names as Claude writes them in that language (Chinese and Russian: Claude is in English).
    const MENU = {
        it: ['Estensioni', 'Sviluppatore', 'Modifica configurazione', 'Aggiungi connettore personalizzato'],
        en: ['Extensions', 'Developer', 'Edit config', 'Add custom connector'],
        fr: ['Extensions', 'Développeur', 'Modifier la configuration', 'Ajouter un connecteur personnalisé'],
        es: ['Extensiones', 'Desarrollador', 'Editar configuración', 'Agregar conector personalizado'],
        de: ['Erweiterungen', 'Entwickler', 'Konfiguration bearbeiten', 'Benutzerdefinierten Konnektor hinzufügen'],
        zh: ['Extensions', 'Developer', 'Edit config', 'Add custom connector'],
        ja: ['拡張機能', '開発者', '設定を編集', 'カスタムコネクタを追加'],
        pt: ['Extensões', 'Desenvolvedor', 'Editar configuração', 'Adicionar conector personalizado'],
        ru: ['Extensions', 'Developer', 'Edit config', 'Add custom connector'],
    };
    for (const [l, menu] of Object.entries(MENU)) {
        const tr = translations[l] || {};
        dice(`[${l}] tutti i testi della guida ci sono`, [], CHIAVI.filter((k) => !String(tr[k] || '').trim()));
        dice(`[${l}] nessun segno di formattazione nei testi`, [], CHIAVI.filter((k) => /\*\*|`|\]\(/.test(tr[k] || '')));
        const tutto = CHIAVI.map((k) => tr[k]).join(' ');
        dice(`[${l}] i menu di Claude con i loro nomi veri`, [], menu.filter((m) => !tutto.includes(m)));
        // ITALIANO: Claude installa l'estensione spenta (visto dal vivo il 07/11/2026): il passo 2 dice di accenderla.
        // ENGLISH: Claude installs the extension switched off (seen live on 07/11/2026): step 2 says to turn it on.
        dice(`[${l}] il passo 2 dice di accendere l'interruttore dell'estensione`, true, (tr.mcpClaudeExt2 || '').includes({"it":"interruttore","en":"switch","fr":"interrupteur","es":"interruptor","de":"Schalter","zh":"开关","ja":"スイッチ","pt":"interruptor","ru":"переключатель"}[l]));
        if (l === 'zh' || l === 'ja') dice(`[${l}] nessuno spazio dopo il punto fermo`, [], CHIAVI.concat('mcpDesktopNote').filter((k) => /。 /.test(tr[k] || '')));
        dice(`[${l}] la nota su Node.js dice che l'estensione non ne ha bisogno`, true, /Node\.js/.test(tr.mcpClaudeExt4 || '') && (tr.mcpDesktopNote || '').split('Node.js').length > 2);
    }
    codiceUscita = esito();
} catch (e) {
    console.error(e);
    codiceUscita = 1;
} finally {
    for (const p of ponti) { try { p.kill(); } catch (_) { } }
    for (const s of server) { try { await s.chiudi(); } catch (_) { } }
    fs.rmSync(cartella, { recursive: true, force: true });
}
process.exit(codiceUscita);
