# AI Character Assistant 🦊

A cute, interactive AI companion that lives on your desktop. Foxy (or your custom character) floats above your windows, reacts to your clicks, and chats with you using Google's Gemini AI.

## 🌟 Features

- **Always on Top**: Floats over other windows.
- **Click-Through**: Only interactive parts (character, chat bubble) capture mouse events; the rest lets you click through to your work.
- **Interactive**: Reacts to clicks, drag-and-drop, and conversations.
- **AI Powered**: Integrated with Google Gemini for personality-driven chat.
- **Customizable**: Change themes, names, and personality traits.

## 🛠️ Usage

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
## 🐧 Linux / Wayland Compatibility Note

To achieve the "Click-Through" transparency effect on Linux (specifically Wayland and some X11 compositors), this app uses a specific **Polling Strategy** ("The Radar").

### The Problem
Standard Electron `setIgnoreMouseEvents(true, { forward: true })` is unreliable on Linux.
- The browser often thinks the mouse "Left the Window" immediately when transparency is enabled.
- Mouse events stop firing, making it impossible to "wake up" the window when the user hovers back over the character.

### The Solution: "Radar" Polling
We implement a manual mouse tracker in `interactions.ts` that:
1.  Polls the Global Cursor Position via IPC (`getCursorScreenPoint`) every 100ms.
2.  Polls the Window Bounds via IPC.
3.  Calculates if the mouse is visually inside the Character's bounding box.
4.  Manually toggles `setIgnoreMouseEvents(false)` (Capture) or `true` (Pass-Through).

**Note:** This polling is lightweight but essential for Linux functionality.

## 🛠️ Development Mode**:
    ```bash
    npm run dev
    ```
3.  **Build for Production**:
    ```bash
    npm run build
    ```

### Initial Setup
1.  Click the **Backpack Icon** 🎒 (appears on hover) to open Settings.
2.  Enter your **Google Gemini API Key**.
3.  Click **Save**. Foxy is now ready to chat!

## 🏗️ Architecture

The project is built with **Electron**, **TypeScript**, and **Vite**. It follows a modular architecture separating the Main (Node.js/Electron) and Renderer (UI) processes.

### File Structure

```
src/
├── main/                 # Main Process (Node.js)
│   ├── main.ts           # Entry Point & Lifecycle
│   ├── ipc-handlers.ts   # IPC Event Registry
│   ├── managers/         # Logic Controllers
│   │   ├── window-manager.ts  # Window creation & config
│   │   └── tray-manager.ts    # System Tray
│   └── services/         # External Services
│       ├── gemini.ts     # AI Logic
│       └── config-store.ts    # File System Persistence
│
└── renderer/             # Renderer Process (Web/UI)
    ├── app.ts            # Entry Point
    └── modules/          # Feature Modules
        ├── character.ts  # Visuals, Dragging, Animations
        ├── chat.ts       # Chat Bubble & Input Logic
        ├── interactions.ts # Click-through logic
        ├── settings.ts   # Settings Panel UI
        └── store.ts      # Shared State
```

## 🧠 Event Flow Deep Dive

One of the most complex features is the **Click-Through** mechanism. Here is how a click travels from your mouse to the application functions.

### The "Click-Through" Challenge
By default, an Electron window is rectangular. If we make it transparent, you can see through it, but you can't *click* through the empty space to the window behind it. We solved this using `setIgnoreMouseEvents`.

### 1. The Mouse Move (OS Level)
As you move your mouse over the window, the OS fires events.

### 2. The Renderer Detection (`src/renderer/modules/interactions.ts`)
We listen to `mousemove` on the `window` object.
```typescript
window.addEventListener('mousemove', (e) => {
    const element = document.elementFromPoint(e.clientX, e.clientY);
    // ... logic checks if element is "Interactive" ...
});
```

### 3. The Decision
- **If hovering Foxy/Chat**: We call `window.electronAPI.setIgnoreMouseEvents(false)`.
    - Result: The window **captures** future clicks. You can drag Foxy or type.
- **If hovering Empty Space**: We call `window.electronAPI.setIgnoreMouseEvents(true, { forward: true })`.
    - Result: The window becomes "ghostly". Clicks pass right through to your desktop wallpaper or other apps.

### 4. The IPC Bridge (`src/main/ipc-handlers.ts`)
The command travels from Renderer -> Main Process via Inter-Process Communication (IPC).
```typescript
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    // Tells the native OS window handle to update its hit-test behavior
    win.setIgnoreMouseEvents(ignore, options);
});
```

### 5. The User Click
When you finally click:
- If `ignore: false` (Foxy): HTML `click` event fires in `character.ts` -> `handleCharacterClick()` -> AI Chat starts.
- If `ignore: true` (Empty): The OS sends the click to whatever is *behind* Foxy.

---

## 💻 Developer Guide

### Key Commands
- **Logs**: In Dev mode, frontend `console.log` is piped to your terminal. Look for `[Renderer]` tags.
- **Debug Mode**: Go to Settings -> Enable Debug Mode to see borders around elements.

### Adding a New Feature
1.  **Frontend**: Create a new file in `src/renderer/modules/`.
2.  **State**: Add any shared state to `store.ts`.
3.  **Init**: Initialize your module in `src/renderer/app.ts`.
4.  **Backend**: If you need Node.js access (files, system), add a handler in `src/main/ipc-handlers.ts`.
