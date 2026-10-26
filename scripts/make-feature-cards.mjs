/*
 * ITALIANO: costruisce le SCHEDE DELLE FUNZIONI per la pagina di presentazione: una
 *   immagine per ogni funzione, con lo stesso stile della copertina (sfondo viola,
 *   titolo, elenco puntato) e lo screenshot del programma inclinato in prospettiva,
 *   una volta a destra e una volta a sinistra. Va lanciata DOPO make-readme-shots.mjs.
 *
 * ENGLISH: builds the FEATURE CARDS for the project page: one image per feature, styled
 *   like the cover (violet background, title, bullet list) with the app screenshot tilted
 *   in perspective, alternating right and left. Run it AFTER make-readme-shots.mjs.
 *
 *   npx electron scripts/make-feature-cards.mjs [--only 19,18]
 */
import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = path.join(ROOT, 'docs', 'img');
const OUT_DIR = path.join(ROOT, 'docs', 'img', 'features');
const W = 1600;
const H = 720;

const sleep = ms => new Promise(r => setTimeout(r, ms));
// ITALIANO: --only 19,18 rifa solo le schede il cui nome comincia cosi'; il lato (destra o sinistra)
//   resta quello della posizione nell'elenco, quindi una scheda nuova in mezzo sposta quelle dopo.
// ENGLISH: --only 19,18 redoes only the cards whose name starts like that; the side (right or left)
//   stays the one of the position in the list, so a new card in the middle shifts the ones after it.
const argv = process.argv.slice(2);
const iOnly = argv.indexOf('--only');
const ONLY = iOnly >= 0 && argv[iOnly + 1] ? argv[iOnly + 1].split(',').map(s => s.trim()).filter(Boolean) : [];
const dataUrl = file => 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');

// ---------------------------------------------------------------------------
// Le funzioni da presentare, nell'ordine in cui compariranno nel README.
// The features to present, in the order they will appear in the README.
// ---------------------------------------------------------------------------
const SCHEDE = [
    {
        file: '01-gallery.png', nome: '01-gallery',
        occhiello: 'The gallery',
        titolo: 'Your whole dataset,<br>one screen',
        testo: 'Point it at a folder and every image shows up next to its own tags, ready to edit.',
        punti: ['Each photo keeps its own .txt file', 'Zoom, sorting and tag counter', 'Subfolders supported'],
    },
    {
        file: '14-import-summary.png', nome: '02-import',
        occhiello: 'Import',
        titolo: 'It tells you what<br>it found first',
        testo: 'Pick a folder or simply drag the images in. Before touching anything, it counts what it has.',
        punti: ['Images paired with their .txt automatically', 'Says how many are still untagged', 'Nothing is imported until you confirm'],
    },
    {
        file: '02-bulk-tagging.png', nome: '03-bulk-tagging',
        occhiello: 'Bulk tagging',
        titolo: 'Tag hundreds of<br>images at once',
        testo: 'Pick the photos, mark the tags and press Confirm: they land on all of them at once.',
        punti: ['Select all, invert, or click to extend', 'The legend tells you what each pill will do', 'Delete the selected photos in one move'],
    },
    {
        file: '03-tag-search.png', nome: '04-tag-search',
        occhiello: 'Tag search',
        titolo: 'Find exactly the<br>photos you mean',
        testo: 'Type one or more tags and the gallery keeps only the images that carry them.',
        punti: ['Several tags at once, separated by commas', '"Select all" then works on the filtered set', 'Clear the box to get everything back'],
    },
    {
        file: '11-suggested-tags.png', nome: '05-suggested-tags',
        occhiello: 'Suggested tags',
        titolo: 'A tag library,<br>always at hand',
        testo: 'Twenty-seven categories of ready-made tags: framing, poses, lighting, anatomy, hair, styles.',
        punti: ['Around a thousand curated tags', 'Open only the categories you need', 'The panel can be resized'],
    },
    {
        file: '15-trigger-words.png', nome: '06-trigger-words',
        occhiello: 'Trigger words',
        titolo: 'One word on<br>every image',
        testo: 'The words your LoRA has to learn are typed once and land in front of every tag list.',
        punti: ['Added to the whole project in one go', 'Removed exactly the same way', 'They stay first inside the .txt'],
    },
    {
        file: '12-project-tags.png', nome: '07-project-tags',
        occhiello: 'Project tags',
        titolo: 'Every tag you use,<br>in one list',
        testo: 'See the whole vocabulary of the project, tidy it up, and carry it over to the next dataset.',
        punti: ['Export and import as JSON or TXT', 'Clean out the tags nobody uses', 'Remove a tag from every photo at once'],
    },
    {
        file: '04-lightbox.png', nome: '08-lightbox',
        occhiello: 'Full-screen viewer',
        titolo: 'Look closely before<br>you tag',
        testo: 'The photo opens at full quality, with every tag of the project one click away.',
        punti: ['Arrow keys to move through the set', 'Tags of this image and of the project, apart', 'Save that single .txt without leaving'],
    },
    {
        file: '05-tag-editor.png', nome: '09-tag-editor',
        occhiello: 'Tag file editor',
        titolo: 'Open any .txt<br>and rewrite it',
        testo: 'A proper editor for tag files, whether they belong to the project or not.',
        punti: ['Reads and writes .txt and .json', 'Pours in every tag of the project', 'The file stays open until you close it'],
    },
    {
        file: '06-statistics.png', nome: '10-statistics',
        occhiello: 'Statistics',
        titolo: 'Know what your<br>dataset contains',
        testo: 'Six numbers, two charts and the full list of tags with how often each one is used.',
        punti: ['Untagged images spotted at a glance', 'Top 10 tags and category split', 'Searchable, sortable list of every tag'],
    },
    {
        file: '13-original-view.png', nome: '11-views',
        occhiello: 'Two views',
        titolo: 'Square crops or<br>the whole frame',
        testo: 'The grid can crop every thumbnail into a square, or show each image at its real proportions.',
        punti: ['Switch at any moment', 'Zoom from a contact sheet to a few big cards', 'Sort by name or by file date'],
    },
    {
        file: '07-ai-settings.png', nome: '12-ai',
        occhiello: 'Optional AI',
        titolo: 'Let Gemini write<br>the first draft', badge: 'BETA',
        testo: 'Turn it on only if you want to. Your key stays encrypted with Windows data protection.',
        punti: ['Off by default: nothing leaves your PC', 'Bring your own Google Gemini key', 'Automatic picks the newest free model'],
    },
    {
        file: '16-ai-models.png', nome: '16-ai-models',
        occhiello: 'Model test',
        titolo: 'Which models does<br>your key really get?', badge: 'BETA',
        testo: 'One click tries the latest three Gemini versions with a tiny image and sorts them in the model menu.',
        punti: ['Usable, paid, no access, or retry later', 'Free on the free tier, and you can stop it halfway', 'Tucked under Advanced with the tagging options'],
    },
    {
        file: '17-mcp.png', nome: '17-mcp',
        occhiello: 'MCP server',
        titolo: 'Tag with the AI<br>you already use', badge: 'BETA',
        testo: 'Claude Code, Claude Desktop, Cursor or any MCP client can look at the open photos and change their tags.',
        punti: ['Off by default, reachable only from this computer', 'Secret token, replaced with one click', 'It never saves: you press Save Changes'],
    },
    {
        file: '19-mcp-light.png', nome: '19-mcp-light',
        occhiello: 'MCP light',
        titolo: 'See the AI work,<br>hear when it is done', badge: 'BETA',
        testo: 'With the MCP server on, a light next to Trash shows what it is doing, and a chime tells you when the AI has finished changing tags.',
        punti: ['Green listening, yellow working, red if it did not start', 'Click it for the address, token and setups to copy', 'Changed tags, then 30 s of quiet: chime and notice'],
    },
    {
        file: '18-help.png', nome: '18-help',
        occhiello: 'Help where you need it',
        titolo: 'A "?" next to<br>every section',
        testo: 'Settings stay short: the longer explanations open in a window only when you ask for them.',
        punti: ['Closes with Esc, Close or a click outside', 'Opens by itself the first time you switch MCP on', 'In all nine languages'],
    },
    {
        file: '09-trash.png', nome: '13-trash',
        occhiello: 'Trash',
        titolo: 'Nothing disappears<br>by accident',
        testo: 'Removed photos wait in the trash, and on disk they go to the Windows Recycle Bin.',
        punti: ['Restore one photo or all of them', 'The .txt follows its image', 'Files are touched only when you empty it'],
    },
    {
        file: '08-light-theme.png', nome: '14-light-theme',
        occhiello: 'Light and dark',
        titolo: 'Same tool,<br>your light',
        testo: 'A switch changes the whole interface, and it obeys you rather than Windows.',
        punti: ['Light and dark, chosen by hand', 'Interface sounds can be turned off', 'The choice is remembered'],
    },
    {
        file: '10-languages.png', nome: '15-languages',
        occhiello: 'Languages',
        titolo: 'Nine languages,<br>installer included',
        testo: 'Italian, English, French, Spanish, German, Chinese, Japanese, Portuguese and Russian.',
        punti: ['Asked once, changed whenever you like', 'The installer speaks them too', 'No internet needed for the flags'],
    },
];

// ITALIANO: la finestra si vede INTERA e dritta (niente prospettiva: qui conta leggere
//   quello che c'e' dentro). Testo e immagine si scambiano di lato ad ogni scheda.
// ENGLISH: the window is shown WHOLE and straight (no perspective: here what matters is
//   reading what is inside). Text and image swap sides on every card.
const html = (s, destra) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body { background: #1a0b3d; font-family: system-ui, 'Segoe UI', Roboto, sans-serif; color: #fff; }
  .sfondo {
    position: absolute; inset: 0;
    background:
      radial-gradient(1000px 640px at ${destra ? '8%' : '92%'} 4%, rgba(139,92,246,.40), transparent 62%),
      radial-gradient(860px 580px at ${destra ? '94%' : '6%'} 96%, rgba(217,70,239,.22), transparent 60%),
      linear-gradient(${destra ? '135deg' : '225deg'}, #2e1065 0%, #1e1b4b 55%, #150c33 100%);
  }
  .griglia {
    position: absolute; inset: 0; opacity: .06;
    background-image: linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px);
    background-size: 46px 46px;
    mask-image: radial-gradient(820px 560px at ${destra ? '16%' : '84%'} 34%, #000 0%, transparent 75%);
  }
  .riga {
    position: relative; z-index: 2; height: 100%;
    display: flex; align-items: center; gap: 62px; padding: 0 72px;
    flex-direction: ${destra ? 'row' : 'row-reverse'};
  }
  .testo { width: 520px; flex: none; ${destra ? '' : 'text-align: right;'} }
  .occhiello {
    font-size: 13px; letter-spacing: .26em; text-transform: uppercase; color: #c4b5fd;
    font-weight: 700; margin-bottom: 16px;
  }
  h2 {
    font-size: 44px; line-height: 1.1; font-weight: 800; letter-spacing: -.022em;
    background: linear-gradient(100deg, #ffffff 10%, #ede9fe 50%, #b3bcfa 95%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  p.sotto { margin-top: 20px; font-size: 19px; line-height: 1.55; color: #cfc6f5; }
  ul { margin-top: 24px; list-style: none; display: flex; flex-direction: column; gap: 10px; }
  li {
    font-size: 16px; color: #e5defb; display: flex; align-items: center; gap: 11px;
    ${destra ? '' : 'flex-direction: row-reverse;'}
  }
  li b { width: 7px; height: 7px; border-radius: 999px; background: #a78bfa; box-shadow: 0 0 10px #a78bfa; flex: none; }
  .beta {
    display: inline-block; vertical-align: 12px; margin-left: 16px;
    font-size: 15px; font-weight: 800; letter-spacing: .14em;
    background: linear-gradient(180deg, #fde047, #f59e0b);
    -webkit-text-fill-color: #3b2503; color: #3b2503;
    padding: 5px 12px; border-radius: 8px;
    box-shadow: 0 6px 18px -4px rgba(245,158,11,.75);
  }

  .finestra {
    flex: 1; border-radius: 14px; overflow: hidden; background: #0f0a24;
    box-shadow: 0 34px 72px -22px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.12);
  }
  .finestra img { display: block; width: 100%; }
</style></head><body>
  <div class="sfondo"></div>
  <div class="griglia"></div>
  <div class="riga">
    <div class="testo">
      <div class="occhiello">${s.occhiello}</div>
      <h2>${s.titolo}${s.badge ? '<span class="beta">' + s.badge + '</span>' : ''}</h2>
      <p class="sotto">${s.testo}</p>
      <ul>${s.punti.map(p => `<li><b></b>${p}</li>`).join('')}</ul>
    </div>
    <div class="finestra"><img src="${dataUrl(path.join(IMG_DIR, s.file))}"></div>
  </div>
</body></html>`;

app.whenReady().then(async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const win = new BrowserWindow({ width: W, height: H, useContentSize: true, show: false, backgroundColor: '#1a0b3d' });
    const tmp = path.join(app.getPath('temp'), 'itm-feature.html');
    for (let i = 0; i < SCHEDE.length; i++) {
        const s = SCHEDE[i];
        if (ONLY.length && !ONLY.some(o => s.nome.startsWith(o))) continue;
        if (!fs.existsSync(path.join(IMG_DIR, s.file))) { console.log('  manca', s.file); continue; }
        fs.writeFileSync(tmp, html(s, i % 2 === 0), 'utf8');
        await win.loadFile(tmp);
        await sleep(1100);
        const img = await win.webContents.capturePage();
        const out = path.join(OUT_DIR, s.nome + '.jpg');
        fs.writeFileSync(out, img.toJPEG(92));
        console.log('->', path.relative(ROOT, out));
    }
    app.quit();
});
app.on('window-all-closed', () => app.quit());
