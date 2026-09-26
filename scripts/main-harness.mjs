/* ITALIANO: BANCO DI PROVA DEL PROCESSO PRINCIPALE (electron/main.cjs), SENZA ELECTRON
   Carica il main.cjs VERO con al posto di 'electron' un finto che non apre niente: whenReady non
   arriva mai (quindi nessuna finestra), la rete non c'e', e shell.trashItem si limita ad annotare
   il percorso (il Cestino di Windows non viene mai toccato). I gestori registrati con
   ipcMain.handle restano a disposizione: le prove li chiamano come farebbe la pagina.
   Anche 'child_process' e' filtrato: l'unico programma che main.cjs puo' lanciare qui e' lo script
   PowerShell del ripristino, con le due righe che aprono il Cestino VERO sostituite da un Cestino
   finto fatto di file in una cartella temporanea. Se quelle due righe non si trovano, lo script
   non parte affatto (e la prova fallisce) invece di lanciare quello vero.
   Non e' una prova: run-tests.mjs lancia solo i file test-*.mjs.

   ENGLISH: TEST BENCH FOR THE MAIN PROCESS (electron/main.cjs), WITHOUT ELECTRON
   Loads the REAL main.cjs with a fake in place of 'electron' that opens nothing: whenReady never
   fires (so no window), there is no network, and shell.trashItem only records the path (the Windows
   Recycle Bin is never touched). The handlers registered through ipcMain.handle are kept: tests call
   them the way the page would.
   'child_process' is filtered too: the only program main.cjs may start here is the restore
   PowerShell script, with the two lines that open the REAL Recycle Bin replaced by a fake bin made
   of files in a temporary folder. If those two lines cannot be found, the script does not start at
   all (and the test fails) instead of the real one running.
   Not a test: run-tests.mjs only runs test-*.mjs files. */

import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ITALIANO: le due righe dello script che aprono il Cestino vero, e il Cestino finto che le
//           sostituisce. Il finto legge le sue voci da ITM_CESTINO_FINTO (JSON): nome mostrato,
//           percorso interno ($R...), cartella d'origine, file da rimettere a posto, giorni
//           trascorsi dalla cancellazione (null = data non disponibile).
// ENGLISH: the two script lines that open the real Recycle Bin, and the fake bin replacing them.
//          The fake reads its entries from ITM_CESTINO_FINTO (JSON): displayed name, internal path
//          ($R...), original folder, file to put back, days since deletion (null = no date).
const RIGHE_COM = ['$shell = New-Object -ComObject Shell.Application', '$bin = $shell.Namespace(0xA)'];
const CESTINO_FINTO = [
    '$vociFinte = @()',
    'foreach ($f in (ConvertFrom-Json $env:ITM_CESTINO_FINTO)) {',
    '  $v = [pscustomobject]@{ Name = [string]$f.nome; Path = [string]$f.interno; cartella = [string]$f.cartella; origine = [string]$f.origine; giorni = $f.giorni }',
    "  $v | Add-Member -MemberType ScriptMethod -Name InvokeVerb -Value { param($verbo) if ($verbo -eq 'undelete') { Move-Item -LiteralPath $this.Path -Destination $this.origine } }",
    "  $v | Add-Member -MemberType ScriptMethod -Name ExtendedProperty -Value { param($nome) if ($nome -eq 'System.Recycle.DateDeleted' -and $null -ne $this.giorni) { return (Get-Date).AddDays(-[double]$this.giorni) }; return $null }",
    '  $vociFinte += $v',
    '}',
    '$bin = [pscustomobject]@{ voci = $vociFinte }',
    '$bin | Add-Member -MemberType ScriptMethod -Name Items -Value { return $this.voci }',
    "$bin | Add-Member -MemberType ScriptMethod -Name GetDetailsOf -Value { param($v, $i) if ($i -eq 1) { return $v.cartella }; return '' }",
];

const sostituisciCestino = (script) => {
    const righe = String(script).split('\n');
    const i = righe.indexOf(RIGHE_COM[0]);
    if (i < 0 || righe[i + 1] !== RIGHE_COM[1]) {
        throw new Error('main-harness: the real Recycle Bin lines are no longer in the script; not starting it');
    }
    righe.splice(i, 2, ...CESTINO_FINTO);
    return righe.join('\n');
};

/* ITALIANO: carica electron/main.cjs una volta (un processo per file di prova, come fa run-tests).
   Restituisce i gestori, l'elenco dei percorsi passati a shell.trashItem, le chiamate a spawn e
   impostaCestino(voci) per decidere cosa contiene il Cestino finto alla prossima chiamata.
   ENGLISH: loads electron/main.cjs once (one process per test file, as run-tests does).
   Returns the handlers, the list of paths handed to shell.trashItem, the spawn calls, and
   impostaCestino(entries) to decide what the fake bin holds on the next call. */
export const caricaMain = () => {
    const handlers = new Map();
    const cestinati = [];
    const lanci = [];
    let vociCestino = [];
    const vietato = (cosa) => () => { throw new Error(`main-harness: ${cosa} is not allowed in tests`); };

    const electronFinto = {
        app: {
            isPackaged: true,
            getLocale: () => 'en-US',
            getVersion: () => '0.0.0',
            // ITALIANO: una cartella che non esiste: nessuna prova deve leggere o scrivere userData.
            // ENGLISH: a folder that does not exist: no test may read or write userData.
            getPath: () => path.join(os.tmpdir(), 'itm-test-userdata-missing'),
            requestSingleInstanceLock: () => true,
            quit() {},
            on() {},
            whenReady: () => new Promise(() => {}),
        },
        BrowserWindow: class { constructor() { throw new Error('main-harness: no window in tests'); } static getAllWindows() { return []; } },
        ipcMain: { handle: (canale, fn) => handlers.set(canale, fn), on() {} },
        net: { request: vietato('the network') },
        safeStorage: { isEncryptionAvailable: () => false, encryptString: vietato('safeStorage'), decryptString: vietato('safeStorage') },
        session: { defaultSession: {} },
        Menu: { setApplicationMenu() {} },
        shell: {
            trashItem: async (p) => { cestinati.push(p); },
            openExternal: vietato('opening addresses'),
        },
    };

    const cpVero = require('node:child_process');
    const cpFinto = {
        ...cpVero,
        spawn: (exe, args, opzioni) => {
            const i = Array.isArray(args) ? args.indexOf('-Command') : -1;
            if (i < 0) throw new Error('main-harness: spawn without -Command is not allowed');
            const nuoviArgs = [...args];
            nuoviArgs[i + 1] = sostituisciCestino(args[i + 1]);
            lanci.push({ exe, opzioni: { ...(opzioni || {}) } });
            return cpVero.spawn(exe, nuoviArgs, { ...(opzioni || {}), env: { ...process.env, ITM_CESTINO_FINTO: JSON.stringify(vociCestino) } });
        },
    };

    const caricaOriginale = Module._load;
    Module._load = function (richiesta, ...resto) {
        if (richiesta === 'electron') return electronFinto;
        if (richiesta === 'child_process' || richiesta === 'node:child_process') return cpFinto;
        return caricaOriginale.call(this, richiesta, ...resto);
    };
    try {
        require(path.join(radice, 'electron', 'main.cjs'));
    } finally {
        Module._load = caricaOriginale;
    }
    return { handlers, cestinati, lanci, impostaCestino: (voci) => { vociCestino = voci; } };
};

// ITALIANO: piccolo contatore di controlli, uguale nello stile a quello di test-ai-models.mjs.
// ENGLISH: small check counter, same style as the one in test-ai-models.mjs.
export const creaControlli = () => {
    let guai = 0, fatti = 0;
    const dice = (cosa, atteso, avuto) => {
        fatti++;
        const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
        if (!ok) guai++;
        console.log('  ' + (ok ? 'OK  ' : 'NO  ') + cosa + (ok ? '' : `\n        atteso: ${JSON.stringify(atteso)}\n        avuto:  ${JSON.stringify(avuto)}`));
    };
    const esito = () => {
        console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
        return guai === 0 ? 0 : 1;
    };
    return { dice, esito };
};
