<div align="center">
  <img src="public/logo.png" alt="Logo" width="120" height="120" />
  <h1>AI Image Tag Manager</h1>
  <p>A powerful, intuitive, and privacy-focused desktop application for managing, editing, and auto-generating tags for image datasets.</p>

  [![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg)](https://vitejs.dev/)
  [![Electron](https://img.shields.io/badge/Electron-Hardened-47848F.svg)](https://www.electronjs.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC.svg)](https://tailwindcss.com/)
</div>

---

## 📖 Overview

**Images Tag Manager for LORAs** is a fast, offline desktop tool for preparing image datasets for LoRA / Kohya_SS / Stable Diffusion training. Load folders of images, edit the associated `.txt` tag files, and ship them back to disk — no cloud services, no AI calls, no telemetry.

## ✨ Key Features

*   📂 **Folder Loading & Project Management**: Import entire folders containing images and their respective `.txt` files in one click.
*   🏷️ **Advanced Tag Management**: Add, remove, or edit tags for individual images or apply changes to multiple images at once using **Bulk Tagging**.
*   🤖 **AI Tagging & Captioning (Gemini)**: Optional integration with Google Gemini for high-quality booru-style tags and natural-language captions. Default model is **Gemini 2.5 Flash** (free tier). Bring your own API key (encrypted via OS keychain) — model selector covers Flash, Flash-Lite, 3.5 Flash and 3.1 Pro.
*   🎯 **Curated Tag Suggestions**: A built-in static library of categorized tag suggestions (poses, lighting, anatomy, hair, eyes, styles, etc.) that you can click to add. Resizable panel.
*   🌍 **Global Tag Manager**: View and manage all unique tags present in the project from a single interface. Easily add global "Trigger Words" to all images with one click.
*   📊 **Project Statistics**: Visual charts and metrics showing tag distribution, total images, tagged percentages, captioned percentages, and most used tags.
*   🔞 **NSFW Detection**: Automatic highlighting of NSFW tags with dedicated `+18` badges (heuristic, keyword-based).
*   💾 **Flexible Export Options**:
    *   Save changes back to the original folder.
    *   Export tags to a new folder.
    *   Download the entire tag set as a `.zip` archive.
*   🎨 **Modern UI/UX**: Beautiful, responsive interface with Light and Dark mode support, built with Tailwind CSS and Lucide icons.
*   🌐 **Multilingual Support**: Available in Italian, English, French, Spanish, German, Chinese, Japanese, Portuguese, and Russian.
*   🔐 **Encrypted API key storage**: when running inside Electron, your Gemini key is stored in the OS keychain (via `safeStorage`); never in plain `localStorage`, never inside the bundle.

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18 or higher) installed on your system.

### Installation

1. Clone the repository or download the source code.
2. Open your terminal in the project directory.
3. Install the dependencies:

```bash
npm install
```

### Running in Development Mode

To run the app in your browser for development or testing:

```bash
npm run dev
```

## 📦 Building the Portable App (Electron)

You can easily compile this project into a standalone, portable desktop application (.exe for Windows, .app for macOS, etc.) using Electron.

1. First, build the web assets:
```bash
npm run build
```

2. Then, package the application using Electron Builder:
```bash
npm run electron:build
```

The compiled portable executable will be available in the `release/` folder.

## 🤖 AI Tagging & Captioning (optional, Gemini)

When the AI Tools section in Settings is enabled and a valid Gemini API key is saved, the app can:

1. **Tag images** in booru style suitable for Kohya / sd-scripts LoRA training (comma-separated lowercase tags).
2. **Caption images** as a single descriptive English sentence.
3. **Apply a custom prompt** to bias either output toward your specific needs.

**Models available** (selectable in Settings):

| Model | Free tier | Notes |
|---|---|---|
| **Gemini 2.5 Flash** ⭐ default | ✅ Yes | Best price/quality, recommended |
| Gemini 2.5 Flash-Lite | ✅ Yes | Faster, slightly lower quality, ideal for large batches |
| Gemini 3.5 Flash | ⚠️ Limited | Higher quality, paid for sustained use |
| Gemini 3.1 Pro (Preview) | ❌ No | Top quality, paid only |

**Get a free API key** at [Google AI Studio](https://aistudio.google.com/app/apikey) → "Create API key".
The app verifies the key with a tiny test call before saving, then encrypts it in the OS keychain (via Electron `safeStorage`).

The "Auto-tag all" button in the toolbar paces requests at ~13 RPM to stay under the free-tier 15 RPM cap.

## 🔒 Hardening Highlights

*   Electron renderer runs with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and a minimal IPC bridge defined in `electron/preload.cjs`.
*   A strict Content-Security-Policy is applied both via `index.html` meta tag and via the production session headers in `electron/main.cjs`. The CSP `connect-src` allows only `generativelanguage.googleapis.com` (Google Gemini endpoint). Everything else is locked.
*   The Gemini API key is stored encrypted via Electron `safeStorage` (OS keychain) — never in plain `localStorage`, never inside the bundle.
*   Filenames written to disk or to ZIP archives are sanitized to prevent path traversal and reserved-name issues on Windows.
*   A React `ErrorBoundary` shows a recovery screen instead of a blank window on unexpected UI errors.

## 🛠️ Tech Stack

*   **Frontend**: React 19, TypeScript, Vite 6
*   **Styling**: Tailwind CSS 4
*   **Icons**: Lucide React
*   **Desktop Framework**: Electron (hardened), Electron Builder
*   **AI**: `@google/genai` (Gemini API)
*   **Utilities**: JSZip (archives), Recharts (statistics charts)

## 📝 License & Credits

Developed and designed by **xXIlRizzoXx**.
