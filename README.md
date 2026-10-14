<div align="center">
  <img src="docs/img/cover.jpg" alt="Images Tag Manager for LORAs — a Windows desktop app to prepare tagged image datasets for LoRA training" width="100%" />

  <br /><br />

  [![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-0078D6.svg)](#-download)
  [![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg)](https://vitejs.dev/)
  [![Electron](https://img.shields.io/badge/Electron-Hardened-47848F.svg)](https://www.electronjs.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC.svg)](https://tailwindcss.com/)
</div>

---

## 📖 What it is

**Images Tag Manager for LORAs** is a desktop tool for preparing image datasets for **LoRA / Kohya_SS / Stable Diffusion** training.

You point it at a folder, it reads every image together with its `.txt` tag file, and it lets you edit those tags — one photo at a time or hundreds at once — then writes them straight back to disk in the same format.

It runs entirely on your machine and sends **no telemetry**. Cloud AI tagging is **optional and off by default**: images reach Google only if you switch the AI on and supply your own API key.

---

## ✨ What it does

<img src="docs/img/features/01-gallery.jpg" alt="The gallery: your whole dataset on one screen, every image next to its own tags" width="100%" />

<img src="docs/img/features/02-import.jpg" alt="Import: the app counts images and .txt files and shows a summary before importing anything" width="100%" />

<img src="docs/img/features/03-bulk-tagging.jpg" alt="Bulk tagging: tag hundreds of images at once, with a legend explaining each tag pill" width="100%" />

<img src="docs/img/features/04-tag-search.jpg" alt="Tag search: type one or more tags and the gallery keeps only the images that carry them" width="100%" />

<img src="docs/img/features/05-suggested-tags.jpg" alt="Suggested tags: twenty-seven categories of ready-made tags, about a thousand of them" width="100%" />

<img src="docs/img/features/06-trigger-words.jpg" alt="Trigger words: one word typed once lands in front of the tag list of every image" width="100%" />

<img src="docs/img/features/07-project-tags.jpg" alt="Project tags: the whole vocabulary of the project in one list, exportable as JSON or TXT" width="100%" />

<img src="docs/img/features/08-lightbox.jpg" alt="Full-screen viewer: the photo at full quality with every tag of the project one click away" width="100%" />

<img src="docs/img/features/09-tag-editor.jpg" alt="Tag file editor: open, create and rewrite any .txt or .json tag file" width="100%" />

<img src="docs/img/features/10-statistics.jpg" alt="Statistics: six metrics, category pie chart, top 10 tags and a searchable list of every tag" width="100%" />

<img src="docs/img/features/11-views.jpg" alt="Two views: square crops or the whole frame, with zoom and sorting" width="100%" />

<img src="docs/img/features/12-ai.jpg" alt="Optional AI: Gemini writes the first draft, off by default, with your own encrypted API key" width="100%" />

<img src="docs/img/features/13-trash.jpg" alt="Trash: removed photos are recoverable and files go to the Windows Recycle Bin" width="100%" />

<img src="docs/img/features/14-light-theme.jpg" alt="Light and dark theme, chosen by hand rather than following Windows" width="100%" />

<img src="docs/img/features/15-languages.jpg" alt="Nine languages, installer included" width="100%" />

Plus: NSFW `+18` badges, ZIP / JSON / TXT export, copy & paste tags between photos, undo & redo, tag names translated on hover, and a crash-recovery backup that survives a power cut.

---

## 📥 Download

Grab the latest **portable** or **installer** build from the [Releases](../../releases) page. No Node.js, no setup — the portable one just runs.

> The build is **not code-signed** (a certificate costs hundreds of euros a year), so Windows SmartScreen may say *"unknown publisher"*. That is expected: click **More info → Run anyway**. The installer explains this on its welcome page.

### Where your data lives

Settings, cache and logs go to `%APPDATA%\images-tag-manager` — never next to the executable, in both the portable and the installed version. **Your images and `.txt` files are never copied there**: they stay where they are, and are only rewritten when you press Save.

---

## 🤖 About the AI

The AI is **optional and off by default** — with it off, none of your images or tags ever leave your computer.

If you want it, get a free key at [Google AI Studio](https://aistudio.google.com/app/apikey) and paste it into Settings. The app checks the key works before saving it, then keeps it **encrypted in the Windows keychain**. Only the images you actually ask it to tag are sent, and you can stop a batch halfway.

The model is picked for you: on **Automatic** the app uses the newest model of Google's free line, tries it before switching and tells you when it changes. To do that, with the AI on it checks Google's list of models at startup, once a day. Prefer one model? Choose it in Settings and it stays fixed. The default pace (14 requests a minute) stays inside Google's free tier; the Speed slider can go faster if your key allows more.

---

## 🔒 Privacy

*   **No telemetry, no accounts, no auto-update.** The app can tell you when a new version is out, but only if you want it to: it asks you once, the check stays off unless you say yes, and then at startup it reads only the latest version number from GitHub.
*   **Only two addresses are ever contacted**: Google, and only with the AI switched on; GitHub, and only if you said yes to the version check. The app's window can reach nothing but Google, and the version check is the only other connection the program makes.
*   **Your API key is never stored in clear text** and is not inside the download.
*   **Your files stay yours**: images and `.txt` are read where they are and rewritten only when you save. **Move to Trash** only sets a photo aside in the app's own trash: its files stay in your folder. They go to the Windows Recycle Bin when you press **Empty Trash** (or **Delete from Disk** on a single photo in the trash), and **Undo the emptying** puts the last emptying back while the project is still open and the Recycle Bin still has the files. Network folders have no Recycle Bin, and sometimes the app cannot tell where a file sits on disk: then it asks a second time, says the removal is final, and only deletes if you confirm.

---

## 🤝 Ideas, and a hand with the languages

This app was built by one person, around one way of working. If yours is different, that is worth hearing — **[tell us what would help](../../issues/new?template=idea.yml)**. Half-formed ideas are fine; describing what slows you down is more useful than describing a solution.

### The translations need native speakers

The interface speaks nine languages, but only **Italian and English were written by someone who actually speaks them**. The other seven are honest attempts, and attempts have accents: a word that is technically right but sounds wrong, a sentence too long for its button, a tone that lands oddly.

If something reads badly in your language, **[say so here](../../issues/new?template=translation.yml)** — what it says now, what it should say. You do not need to know how to program, and a single sentence is a perfectly good contribution.

One part is deliberately still untranslated: the **dictionary of ~1050 suggested tags** and its 27 category names exist only in Italian and English. Machine-translating a thousand tags would produce plausible nonsense, so it has been left alone until real speakers can look at it. If you are willing to take on a slice of it in French, Spanish, German, Chinese, Japanese, Portuguese or Russian, open an issue and say which language — even a hundred tags is progress.

Bugs go **[here](../../issues/new?template=bug.yml)**. If tag files were ever changed or lost without being asked to, that one jumps the queue.

---

## 📝 Credits

Developed and designed by **xXIlRizzoXx**. Released under the [MIT License](LICENSE).

<div align="center">
  <br />
  <img src="docs/img/flag-it.svg" alt="Italy" width="40" />
  <br />
  <sub><b>Made in Italy</b> &nbsp;·&nbsp; built with the help of <a href="https://claude.com/claude-code">Claude Code</a></sub>
  <br /><br />
</div>

The screenshots on this page show a sample dataset used only to illustrate the interface; the characters depicted belong to their respective rights holders.
