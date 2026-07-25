# Contributing

Short version: **open an issue**. You do not need to write code to be useful here.

## The three things that help most

**1. Tell us what is missing.** The app was shaped by one person's dataset workflow. If yours needs something else, [say what slows you down](../../issues/new?template=idea.yml) — the situation matters more than the solution you have in mind.

**2. Fix our languages.** The interface exists in nine languages, but only Italian and English were written by native speakers. If a sentence in yours reads wrong, [tell us what it says and what it should say](../../issues/new?template=translation.yml). One sentence is a real contribution.

**3. Take a slice of the tag dictionary.** The ~1050 suggested tags and their 27 category names are translated only into Italian and English. They were deliberately *not* machine-translated: a thousand plausible-but-wrong tags would be worse than none. If you speak French, Spanish, German, Chinese, Japanese, Portuguese or Russian and want to take even a hundred of them, open an issue saying which language.

## If you do want to write code

The app is React 19 + TypeScript on Vite, wrapped in a hardened Electron shell.

```bash
npm install
npm run dev          # in the browser, fastest loop
npm run electron:dev # as the real desktop app
npm run lint         # tsc --noEmit, must be clean
```

Three things to know before touching anything:

*   **Losing someone's `.txt` tag files silently is the worst outcome this project has.** Any change to saving, importing or deleting deserves paranoia. Deletion goes to the Windows Recycle Bin, never straight to nothing.
*   **All interface strings live in `src/constants.ts`**, in one object with nine language keys. The `t` object is typed, so a missing key is a compile error — every language must gain the key at the same time. Tag suggestions live in `src/constants/tagSuggestions.ts`.
*   **App data belongs in `%APPDATA%\images-tag-manager`**, never next to the executable. The Gemini key is stored through Electron's `safeStorage`, never in plain text, and the Content-Security-Policy allows exactly one outbound host.

The images in the README are generated, not hand-made — see `scripts/make-readme-shots.mjs`, `scripts/make-cover.mjs` and `scripts/make-feature-cards.mjs`.
