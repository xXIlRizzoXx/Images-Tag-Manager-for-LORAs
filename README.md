<div align="center">
  <img src="public/logo.png" alt="Logo" width="120" height="120" />
  <h1>AI Image Tag Manager</h1>
  <p>A powerful, intuitive, and privacy-focused desktop application for managing, editing, and auto-generating tags for image datasets.</p>

  [![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg)](https://vitejs.dev/)
  [![Electron](https://img.shields.io/badge/Electron-Ready-47848F.svg)](https://www.electronjs.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC.svg)](https://tailwindcss.com/)
  [![Gemini API](https://img.shields.io/badge/AI-Google_Gemini-orange.svg)](https://ai.google.dev/)
</div>

---

## 📖 Overview

**AI Image Tag Manager** is the ultimate tool for preparing image datasets for AI model training (e.g., LoRA, Kohya_SS, Stable Diffusion) or simply organizing large galleries. It allows you to load folders of images, edit their associated `.txt` tag files, and even use AI to automatically caption and tag them.

## ✨ Key Features

*   📂 **Folder Loading & Project Management**: Import entire folders containing images and their respective `.txt` files. Save and load your project state (`.json`) to resume work later.
*   🏷️ **Advanced Tag Management**: Add, remove, or edit tags for individual images or apply changes to multiple images at once using **Bulk Tagging**.
*   🤖 **AI Auto-Tagging (Gemini API)**: Automatically generate highly accurate descriptive tags and captions for your images using Google's Gemini Vision models. Works on single images or the entire project simultaneously.
*   🌍 **Global Tag Manager**: View and manage all unique tags present in the project from a single interface. Easily add global "Trigger Words" to all images with one click.
*   📊 **Project Statistics**: Visual charts and metrics showing tag distribution, total images, captioned percentages, and most used tags.
*   🔞 **NSFW Detection**: Automatic highlighting of NSFW tags with dedicated `+18` badges.
*   💾 **Flexible Export Options**: 
    *   Export all tags to a new folder.
    *   Download the entire project (images + tags) as a `.zip` archive.
*   🎨 **Modern UI/UX**: Beautiful, responsive interface with Light and Dark mode support, built with Tailwind CSS and Lucide icons.
*   🌐 **Multilingual Support**: Available in English, Italian, Chinese, Japanese, Portuguese, and Russian.

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

## ⚙️ Configuration

### AI Auto-Tagging (Gemini)
To use the AI auto-tagging features, you will need a free Google Gemini API Key.
1. Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Open the app, go to **Settings** (gear icon), and paste your API key.
3. Select your preferred Gemini model and customize the prompt if needed.

## 🛠️ Tech Stack

*   **Frontend**: React 18, TypeScript, Vite
*   **Styling**: Tailwind CSS, Framer Motion
*   **Icons**: Lucide React
*   **Desktop Framework**: Electron, Electron Builder
*   **AI Integration**: `@google/genai` (Gemini API)
*   **Utilities**: JSZip, FileSaver.js, Recharts (Statistics)

## 📝 License & Credits

Developed and designed by **xXIlRizzoXx**.
