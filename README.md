# AI Character Assistant 🦊

A cute, interactive AI companion that lives on your desktop. Foxy (or your custom character) floats above your windows, reacts to your clicks, and chats with you using Google's Gemini AI.

## 🌟 Features

- **Always on Top**: Floats over other windows.
- **Click-Through**: Only interactive parts (character, chat bubble) capture mouse events; the rest lets you click through to your work.
- **Interactive**: Reacts to clicks, drag-and-drop, and conversations.
- **AI Powered**: Integrated with Google Gemini for personality-driven chat.
- **Customizable**: Change themes, names, and personality traits.
- **Linux Native**: Direct integration with Linux input subsystems for global cursor tracking and shortcuts, even on Wayland.

## 🛠️ Usage
    
### Prerequisites
- **Linux Users**: You must be in the `input` group to allow the app to read mouse events.
    ```bash
    sudo usermod -a -G input $USER
    # You must LOG OUT and LOG IN again for this to take effect!
    ```

### Shortcuts
- **`Meta + Shift + F`** (Super+Shift+F): **Toggle Chat**. Show/Hide the chat window.
- **`Meta + Shift + D`** (Super+Shift+D): **Toggle Drag Mode**. 
    - **ON**: Window becomes opaque and clickable everywhere. You can drag Foxy to a new spot.
    - **OFF**: Window becomes "ghostly" again (clicks pass through except on Foxy).

### Installation & Development
1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run in Dev Mode**:
    ```bash
    npm run dev
    ```

3.  **Build for Production**:
    ```bash
    npm run tauri:build
    ```
    *(Note: This generates installable `.deb` and `.AppImage` files in `src-tauri/target/release/bundle/`)*

## 🐧 Linux / Wayland Compatibility

To achieve global cursor tracking and shortcuts on Wayland, this app integrates directly with the Linux input subsystem.

### The Problem
- **Wayland Security**: Apps cannot see the global cursor position or detect shortcuts when they are not focused.
- **Click-Through**: Standard windowing APIs often fail to provide reliable global tracking for overlay apps.

### The Solution: Rust Backend
We integrated raw input reading directly into the Tauri Rust backend:
1.  Reads raw input events from `/dev/input/event*` and `/dev/input/mice`.
2.  Tracks the **Global Cursor Position** (even on Wayland!).
3.  Detects global **Shortcuts** (`Meta+Shift+F`, `Meta+Shift+D`).
4.  Emits events directly to the frontend.

## 🏗️ Architecture

The project is built with **Tauri**, **TypeScript**, and **Vite**.

### File Structure

```
├── src-tauri/            # Rust Backend (Tauri)
│   ├── src/main.rs       # App logic, input reader, & IPC
│   └── tauri.conf.json   # App configuration
│
└── src/renderer/         # Frontend Process (Web/UI)
    ├── app.ts            # Entry Point
    └── modules/          # Feature Modules
        ├── character.ts  # Visuals, Dragging, Animations
        ├── chat.ts       # Chat Bubble & Input Logic
        ├── interactions.ts # Click-through logic
        ├── settings.ts   # Settings Panel UI
        └── store.ts      # Shared State
```

## 🧠 Event Flow Deep Dive

### 1. Raw Input (Rust)
The Rust background thread polls `/dev/input/` for events. When a mouse move or shortcut is detected, it calculates the new state.

### 2. Event Emission
The backend emits a `cursor-pos` or `shortcut` event via Tauri's event system.

### 3. Frontend Reaction
The frontend listens for these events:
- **`cursor-pos`**: Used for eye-tracking and interaction logic.
- **`shortcut`**: Triggers actions like toggling chat or drag mode.

---

## 💻 Developer Guide

### Key Commands
- **Logs**: In Dev mode, check your terminal for both Rust and TypeScript logs.
- **Debug Mode**: Go to Settings -> Enable Debug Mode to see borders around elements.

### Initial Setup
1.  Click the **Backpack Icon** 🎒 (appears on hover) to open Settings.
2.  Enter your **Google Gemini API Key**.
3.  Click **Save**. Foxy is now ready to chat!
