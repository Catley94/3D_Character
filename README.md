# AI Character Assistant 🦊

A cute, interactive AI companion that lives on your desktop. Foxy (or your custom character) floats above your windows, reacts to your clicks, and chats with you using Google's Gemini AI.

## 🌟 Features

- **Always on Top**: Floats over other windows.
- **Click-Through**: Only interactive parts (character, chat bubble) capture mouse events; the rest lets you click through to your work.
- **Interactive**: Reacts to clicks, drag-and-drop, and conversations.
- **AI Powered**: Integrated with Google Gemini for personality-driven chat.
- **Customizable**: Change themes, names, and personality traits.

## 🛠️ Usage
    
### Prerequisites
- **Linux Users**: You must be in the `input` group to allow the helper to read mouse events.
    ```bash
    sudo usermod -a -G input $USER
    # You must LOG OUT and LOG IN again for this to take effect!
    ```

### Shortcuts
- **`Meta + Shift + F`** (Super+Shift+F): **Toggle Chat**. Show/Hide the chat window.
- **`Meta + Shift + D`** (Super+Shift+D): **Toggle Drag Mode**. 
    - **ON**: Window becomes opaque and clickable everywhere. You can drag Foxy to a new spot.
    - **OFF**: Window becomes "ghostly" again (clicks pass through except on Foxy).

1.  **Install Dependencies**:
    ```bash
    npm install
    ```



3.  **Run in Dev Mode**:
    ```bash
    npm run dev
    ```
    *(Note: This automatically builds and spawns the Rust input helper)*
## 🐧 Linux / Wayland Compatibility

To achieve the "Click-Through" transparency effect and global cursor tracking on Wayland, this app uses a custom Rust helper binary.

### The Problem
- **Wayland Security**: Apps cannot see the global cursor position or detect shortcuts when they are not focused.
- **Click-Through**: Electron's `setIgnoreMouseEvents` is reliable for click-through, but we need to know *when* to disable it (i.e., when the mouse is over Foxy).

### The Solution: `foxy-input-helper`
We built a small Rust binary (`/foxy-input-helper`) that:
1.  Reads raw input events from `/dev/input/event*` and `/dev/input/mice`.
2.  Tracks the **Global Cursor Position** (even on Wayland!).
3.  Detects global **Shortcuts** (`Meta+Shift+F`, `Meta+Shift+D`).
4.  Streams this data to the Electron app via JSON.

This allows Foxy to look at your cursor and react to you, no matter what window you are using! 🚀

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
