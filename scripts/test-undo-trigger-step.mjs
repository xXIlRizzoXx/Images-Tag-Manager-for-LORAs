/* ITALIANO: PROVA DI CTRL+Z SU UNA TRIGGER CHE LE FOTO HANNO GIA'
   Riaprendo un dataset salvato, le foto hanno gia' la trigger in testa al .txt, ma il riquadro
   delle trigger e' vuoto (non si ricorda). Scrivendola nel riquadro le foto non cambiano: cambia
   solo il riquadro. Ctrl+Z e Ctrl+Shift+Z rimettono anche il riquadro di ogni passo, ma la regola
   che salta i passi "uguali" guardava solo le foto: quel passo risultava uguale al precedente, e
   un Ctrl+Z disfaceva anche la modifica di prima (o niente), mentre Ctrl+Shift+Z non riportava
   piu' la trigger. Si eseguono le funzioni VERE di src/App.tsx (scripts/undo-harness.mjs).
   Uso:  node scripts/test-undo-trigger-step.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF CTRL+Z ON A TRIGGER THE PHOTOS ALREADY HAVE
   Reopening a saved dataset, the photos already have the trigger at the start of the .txt, but
   the trigger box is empty (it is not remembered). Typing it in the box changes no photo: only the
   box changes. Ctrl+Z and Ctrl+Shift+Z also put back each step's box, but the rule that skips
   "equal" steps only looked at the photos: that step counted as equal to the one before, and one
   Ctrl+Z also undid the previous edit (or nothing), while Ctrl+Shift+Z never brought the trigger
   back. The REAL functions of src/App.tsx are run (scripts/undo-harness.mjs). */

import { creaApp, foto } from './undo-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

const app = creaApp([foto('A', ['ohwx', 'a']), foto('B', ['ohwx', 'b'])]);
app.importa();
await app.attendi();
app.modifica(prev => prev.map(i => (i.id === 'B' ? { ...i, tags: [...i.tags, 'nuovo'] } : i)));
await app.attendi();
app.render().handleGlobalTagsChange(['ohwx']);
await app.attendi();
const tagB = () => app.fotoCon('B')?.tags;

console.log('\n--- modifica B, poi scrivi nel riquadro una trigger che tutte le foto hanno gia\' ---');
dice('premessa: il riquadro mostra ohwx e B ha la modifica', [['ohwx'], ['ohwx', 'b', 'nuovo']], [app.stato.globalTriggers, tagB()]);

app.render().handleUndo();
await app.attendi();
dice('UN Ctrl+Z toglie solo la trigger dal riquadro: la modifica di B resta', [[], ['ohwx', 'b', 'nuovo']], [app.stato.globalTriggers, tagB()]);

app.render().handleRedo();
await app.attendi();
dice('Ctrl+Shift+Z riporta la trigger nel riquadro', [['ohwx'], ['ohwx', 'b', 'nuovo']], [app.stato.globalTriggers, tagB()]);

app.render().handleUndo();
await app.attendi();
app.render().handleUndo();
await app.attendi();
dice('il secondo Ctrl+Z disfa la modifica di B', ['ohwx', 'b'], tagB());

process.exit(esito());
