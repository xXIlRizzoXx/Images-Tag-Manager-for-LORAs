/*
 * ITALIANO: crea la COPERTINA del progetto (docs/img/cover.png), quella che si vede in
 *   cima alla pagina di presentazione su GitHub: sfondo viola, logo, titolo e la finestra
 *   del programma inclinata in prospettiva. Va lanciata DOPO make-readme-shots.mjs,
 *   perche' usa uno degli screenshot come "schermo" del programma.
 *
 * ENGLISH: builds the project COVER (docs/img/cover.png) shown at the top of the GitHub
 *   page: violet background, logo, title and the app window tilted in perspective. Run it
 *   AFTER make-readme-shots.mjs, since it uses one of those screenshots as the app screen.
 *
 *   npx electron scripts/make-cover.mjs
 */
import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'img', 'cover.jpg');
const W = 1600;
const H = 800;

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const SCHERMO = path.join(ROOT, 'docs', 'img', argOf('shot', '01-gallery.png'));
const VERSIONE = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const dataUrl = (file, mime) => 'data:' + mime + ';base64,' + fs.readFileSync(file).toString('base64');

const html = () => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body {
    background: #1a0b3d;
    font-family: system-ui, 'Segoe UI', Roboto, sans-serif;
    color: #fff; position: relative;
  }
  .sfondo {
    position: absolute; inset: 0;
    background:
      radial-gradient(1100px 700px at 12% 8%, rgba(139,92,246,.42), transparent 62%),
      radial-gradient(900px 620px at 88% 92%, rgba(217,70,239,.26), transparent 60%),
      radial-gradient(700px 500px at 70% 12%, rgba(59,130,246,.18), transparent 60%),
      linear-gradient(135deg, #2e1065 0%, #1e1b4b 55%, #150c33 100%);
  }
  .griglia {
    position: absolute; inset: 0; opacity: .07;
    background-image: linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px);
    background-size: 46px 46px;
    mask-image: radial-gradient(900px 600px at 20% 30%, #000 0%, transparent 75%);
  }
  .testo { position: absolute; left: 84px; top: 50%; transform: translateY(-50%); width: 700px; z-index: 5; }
  .marchio { display: flex; align-items: center; gap: 18px; margin-bottom: 30px; }
  .marchio img { width: 76px; height: 76px; filter: drop-shadow(0 8px 26px rgba(167,139,250,.6)); }
  .marchio span {
    font-size: 15px; letter-spacing: .26em; text-transform: uppercase;
    color: #c4b5fd; font-weight: 700;
  }
  h1 {
    font-size: 68px; line-height: 1.02; font-weight: 800; letter-spacing: -.025em;
    background: linear-gradient(100deg, #ffffff 12%, #e9d5ff 52%, #a5b4fc 96%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  h1 .riga2 { display: block; }
  p.sotto {
    margin-top: 24px; font-size: 22px; line-height: 1.5; color: #cfc6f5; max-width: 590px;
  }
  .pillole { margin-top: 34px; display: flex; flex-wrap: wrap; gap: 10px; max-width: 600px; }
  .pillole span {
    font-size: 14.5px; font-weight: 600; color: #ede9fe;
    border: 1px solid rgba(196,181,253,.34); background: rgba(255,255,255,.07);
    padding: 8px 15px; border-radius: 999px; backdrop-filter: blur(4px);
  }
  .versione { margin-top: 30px; font-size: 13.5px; letter-spacing: .16em; text-transform: uppercase; color: #a78bfa; font-weight: 700; }

  .scena { position: absolute; right: -150px; top: 50%; transform: translateY(-50%); perspective: 1900px; z-index: 1; }
  .finestra {
    width: 980px; border-radius: 18px; overflow: hidden;
    transform: rotateY(-17deg) rotateX(5deg) rotateZ(-1.6deg);
    box-shadow: 0 60px 120px -30px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.1);
    background: #0f0a24;
  }
  .finestra img { display: block; width: 100%; }
  .velo {
    position: absolute; inset: 0; z-index: 2; pointer-events: none;
    background: linear-gradient(90deg, rgba(26,11,61,1) 0%, rgba(26,11,61,.97) 28%, rgba(26,11,61,.55) 42%, rgba(26,11,61,0) 54%);
  }
</style></head><body>
  <div class="sfondo"></div>
  <div class="griglia"></div>
  <div class="scena"><div class="finestra"><img src="${dataUrl(SCHERMO, 'image/png')}"></div></div>
  <div class="velo"></div>
  <div class="testo">
    <div class="marchio">
      <img src="${dataUrl(path.join(ROOT, 'public', 'logo.png'), 'image/png')}">
      <span>Windows desktop app</span>
    </div>
    <h1>Images Tag Manager<span class="riga2">for LORAs</span></h1>
    <p class="sotto">Load a folder, edit the <code>.txt</code> tags of every image and write them straight back to disk. Built for LoRA / Kohya_SS dataset prep.</p>
    <div class="pillole">
      <span>Offline by default</span><span>No telemetry</span><span>9 languages</span>
      <span>Bulk tagging</span><span>Optional Gemini AI</span>
    </div>
    <div class="versione">Free &amp; open source</div>
  </div>
</body></html>`;

app.whenReady().then(async () => {
    const file = path.join(app.getPath('temp'), 'itm-cover.html');
    fs.writeFileSync(file, html(), 'utf8');
    const win = new BrowserWindow({ width: W, height: H, useContentSize: true, show: false, backgroundColor: '#1a0b3d' });
    await win.loadFile(file);
    await new Promise(r => setTimeout(r, 1400));
    const img = await win.webContents.capturePage();
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, img.toJPEG(92)); // jpeg: la pagina pesa un quarto / a quarter of the page weight
    console.log('->', path.relative(ROOT, OUT), img.getSize().width + 'x' + img.getSize().height);
    app.quit();
});
app.on('window-all-closed', () => app.quit());
