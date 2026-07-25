/*
 * ITALIANO: copertina per CIVITAI.
 *   Su Civitai la scheda del modello e' VERTICALE e ritaglia la PARTE CENTRALE dell'immagine
 *   caricata. Percio' logo e nome stanno esattamente al centro, dentro una "zona sicura" alta
 *   quanto l'immagine e larga quanto il ritaglio: aprendo l'immagine si vede tutta, nella griglia
 *   si vede la colonna centrale, e in tutti e due i casi si legge il nome.
 *   Il programma salva DUE file: la copertina intera e il ritaglio verticale, per controllare
 *   con gli occhi che la scheda venga bene prima di caricarla.
 *
 * ENGLISH: cover for CIVITAI.
 *   A Civitai model card is VERTICAL and crops the CENTRE of the uploaded image. So the logo and
 *   the name sit exactly in the middle, inside a "safe area" as tall as the image and as wide as
 *   the crop: opened, the whole picture shows; in the grid, the central column shows; either way
 *   the name reads. It writes TWO files, the full cover and the vertical crop, so the card can be
 *   checked by eye before uploading.
 *
 *   npx electron scripts/make-cover-civitai.mjs
 */
import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG = path.join(ROOT, 'docs', 'img');

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const W = parseInt(argOf('w', '1600'), 10);
const H = parseInt(argOf('h', '900'), 10);
// ITALIANO: proporzione della scheda su Civitai (in piedi, circa 2:3)
// ENGLISH: aspect of a Civitai card (standing, roughly 2:3)
const RAPPORTO = 2 / 3;
const CROP_W = Math.round(H * RAPPORTO);
const CROP_X = Math.round((W - CROP_W) / 2);

const SINISTRA = path.join(IMG, argOf('left', '01-gallery.png'));
const DESTRA = path.join(IMG, argOf('right', '04-lightbox.png'));

const dataUrl = file => 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');

const html = () => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body { background: #1a0b3d; color: #fff; font-family: system-ui, 'Segoe UI', Roboto, sans-serif; position: relative; }

  .sfondo {
    position: absolute; inset: 0;
    background:
      radial-gradient(820px 820px at 50% 30%, rgba(139,92,246,.52), transparent 64%),
      radial-gradient(700px 620px at 6% 92%, rgba(217,70,239,.24), transparent 62%),
      radial-gradient(700px 620px at 94% 92%, rgba(59,130,246,.20), transparent 62%),
      linear-gradient(168deg, #34107a 0%, #24145c 48%, #140b30 100%);
  }
  .griglia {
    position: absolute; inset: 0; opacity: .06;
    background-image: linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px);
    background-size: 52px 52px;
    mask-image: radial-gradient(760px 760px at 50% 42%, #000 0%, transparent 78%);
  }

  /* ITALIANO: le due finestre ai lati: si vedono ad immagine aperta, spariscono nel ritaglio. */
  /* ENGLISH: the two windows on the sides: visible in the full image, gone in the crop. */
  .ala { position: absolute; top: 50%; perspective: 1800px; z-index: 1; }
  .ala.sx { left: -230px; transform: translateY(-50%); }
  .ala.dx { right: -230px; transform: translateY(-50%); }
  .ala img {
    display: block; width: 760px; border-radius: 16px;
    box-shadow: 0 50px 100px -30px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.09);
  }
  .ala.sx img { transform: rotateY(20deg) rotateZ(-2deg); }
  .ala.dx img { transform: rotateY(-20deg) rotateZ(2deg); }

  /* ITALIANO: il velo spegne i lati verso il centro, cosi' il nome resta il protagonista. */
  /* ENGLISH: the veil fades the sides towards the middle, so the name stays the hero. */
  .velo {
    position: absolute; inset: 0; z-index: 2;
    background: radial-gradient(${Math.round(CROP_W * 0.95)}px ${Math.round(H * 0.85)}px at 50% 50%,
      rgba(26,11,61,.97) 0%, rgba(26,11,61,.93) 42%, rgba(26,11,61,.55) 72%, rgba(26,11,61,.25) 100%);
  }

  .centro {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: ${CROP_W - 60}px; z-index: 4; text-align: center;
    display: flex; flex-direction: column; align-items: center;
  }
  .centro img.logo {
    width: 220px; height: 220px;
    filter: drop-shadow(0 24px 62px rgba(167,139,250,.75));
    margin-bottom: 30px;
  }
  h1 {
    font-size: 60px; line-height: 1.02; font-weight: 800; letter-spacing: -.03em;
    background: linear-gradient(100deg, #ffffff 8%, #ede9fe 48%, #a5b4fc 96%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  h1 span { display: block; }
  .filo {
    width: 190px; height: 3px; border-radius: 3px; margin: 26px 0 22px;
    background: linear-gradient(90deg, transparent, #a78bfa, transparent);
    box-shadow: 0 0 22px rgba(167,139,250,.9);
  }
  .frase { font-size: 19px; line-height: 1.5; color: #d5cdf5; }
  .etichetta {
    margin-top: 24px; font-size: 13px; letter-spacing: .3em; text-transform: uppercase;
    color: #c4b5fd; font-weight: 700;
  }
</style></head><body>
  <div class="sfondo"></div>
  <div class="griglia"></div>
  <div class="ala sx"><img src="${dataUrl(SINISTRA)}"></div>
  <div class="ala dx"><img src="${dataUrl(DESTRA)}"></div>
  <div class="velo"></div>
  <div class="centro">
    <img class="logo" src="${dataUrl(path.join(ROOT, 'public', 'logo.png'))}">
    <h1>Images<span>Tag Manager</span><span>for LORAs</span></h1>
    <div class="filo"></div>
    <p class="frase">Tag a LoRA dataset without leaving your computer</p>
    <div class="etichetta">Free &middot; Windows &middot; Offline</div>
  </div>
</body></html>`;

app.whenReady().then(async () => {
    const file = path.join(app.getPath('temp'), 'itm-cover-civitai.html');
    fs.writeFileSync(file, html(), 'utf8');
    const win = new BrowserWindow({ width: W, height: H, useContentSize: true, show: false, backgroundColor: '#1a0b3d' });
    await win.loadFile(file);
    await new Promise(r => setTimeout(r, 1500));

    const intera = await win.webContents.capturePage();
    const fIntera = path.join(IMG, 'civitai-cover.jpg');
    fs.writeFileSync(fIntera, intera.toJPEG(93));
    console.log('->', path.relative(ROOT, fIntera), intera.getSize().width + 'x' + intera.getSize().height);

    // ITALIANO: lo stesso fotogramma, ritagliato come fara' la scheda di Civitai.
    // ENGLISH: the same frame, cropped the way the Civitai card will crop it.
    const ritaglio = await win.webContents.capturePage({ x: CROP_X, y: 0, width: CROP_W, height: H });
    const fRitaglio = path.join(IMG, 'civitai-cover-anteprima.jpg');
    fs.writeFileSync(fRitaglio, ritaglio.toJPEG(93));
    console.log('->', path.relative(ROOT, fRitaglio), ritaglio.getSize().width + 'x' + ritaglio.getSize().height, '(come si vedra nella griglia)');

    app.quit();
});
app.on('window-all-closed', () => app.quit());
