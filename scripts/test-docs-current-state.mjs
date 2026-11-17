/* ITALIANO: PROVA CHE DUE DOCUMENTI DICANO LO STATO VERO
   - README: la parte "Where your data lives" deve dire che disinstallare (o cancellare la versione
     portable) non toglie la cartella dei dati, cosa ci resta e come toglierla.
   - STATO-SVILUPPO.md: niente "non ancora costruita" per la 2.0.3, niente velo del trascinamento
     fra i traguardi da fare (chiuso, vedi test-drop-overlay-esc.mjs), e i file finali sono tre
     (package.json fa installer, portable .exe e portable .zip).
   Uso: node scripts/test-docs-current-state.mjs

   ENGLISH: TEST THAT TWO DOCUMENTS TELL THE CURRENT STATE
   - README: "Where your data lives" must say that uninstalling (or deleting the portable copy)
     does not remove the data folder, what stays there and how to remove it.
   - STATO-SVILUPPO.md: no "not built yet" for 2.0.3, no drop-overlay item among the to-do
     milestones (closed, see test-drop-overlay-esc.mjs), and three final files (package.json
     builds installer, portable .exe and portable .zip).
   Usage: node scripts/test-docs-current-state.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let problems = 0;
let checks = 0;
function check(ok, msg) {
  checks++;
  if (!ok) { problems++; console.log('PROBLEMA: ' + msg); }
}

// README
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const start = readme.indexOf('### Where your data lives');
check(start >= 0, 'README: manca la sezione "Where your data lives"');
const end = readme.indexOf('\n---', start);
const section = readme.slice(start, end < 0 ? undefined : end);
check(/uninstall/i.test(section), 'README: la sezione dei dati non parla della disinstallazione');
check(/portable/i.test(section) && /delet/i.test(section), 'README: la sezione dei dati non parla della versione portable cancellata');
check(/AI key/i.test(section) && /token/i.test(section) && /backup/i.test(section),
  'README: la sezione dei dati non dice che restano la chiave AI, il token MCP e il backup');
check(/%APPDATA%\\images-tag-manager/.test(section), 'README: la sezione dei dati non nomina la cartella');

// STATO-SVILUPPO.md (tracciato da git)
const statoPath = join(root, 'STATO-SVILUPPO.md');
check(existsSync(statoPath), 'STATO-SVILUPPO.md mancante');
if (existsSync(statoPath)) {
  const stato = readFileSync(statoPath, 'utf8');
  const versionLine = stato.split(/\r?\n/).find((l) => l.startsWith('**Versione attuale:**')) ?? '';
  check(!/non ancora costruita/.test(versionLine), 'STATO: la 2.0.3 risulta "non ancora costruita"');
  const todoStart = stato.indexOf('## ⏳ Traguardi da fare');
  const todoEnd = stato.indexOf('\n---', todoStart);
  const todo = stato.slice(todoStart, todoEnd < 0 ? undefined : todoEnd);
  check(todoStart >= 0, 'STATO: manca la tabella dei traguardi da fare');
  check(!/velo del trascinamento/i.test(todo), 'STATO: il velo del trascinamento e\' ancora fra i traguardi da fare');
  check(/Tradurre il dizionario dei tag/.test(todo), 'STATO: la voce vicina (dizionario) deve restare fra i da fare');
  check(!/due file finali/.test(stato), 'STATO: dice ancora "i due file finali"');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const targets = (pkg.build?.win?.target ?? []).map((t) => (typeof t === 'string' ? t : t.target));
  check(targets.length === 3 ? /tre file finali/.test(stato) : true, `STATO: i file finali sono ${targets.length} (${targets.join(', ')})`);
}

if (problems) {
  console.log(`PROBLEMI: ${problems} (${checks} controlli)`);
  process.exit(1);
}
console.log(`OK: ${checks} controlli`);
