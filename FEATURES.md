# 🦊 Foxy - Project Status & Roadmap

## 🛠️ Infrastructure & Build (Development)

### Technology Stack
- **Framework**: Tauri v2 (Rust Backend + WebView Frontend).
- **Frontend**: TypeScript, Vite.
- **Input Handling**: Custom Rust binary (`foxy-input-helper`) for low-level input tracking.

### Build Implementation
- **Current Status**: Manual builds via `cargo tauri build`.
- **Packaging**: Supports standard Tauri targets (Deb/AppImage for Linux).

---

## 🌟 Implemented Features

### Core Character System
- **Interactive Companion**: A 3D-style 2D character (default: Fox) resides on your screen.
- **State Management**:
  - **Idle**: The default resting state.
  - **Clicked**: Reacts to user clicks with a unique animation/image.
  - **Listening**: Visually indicates when it is waiting for user input.
  - **Talking**: animated state when replying to the user.
- **Drag & Drop**: Draggable character window (smartly distinguishes between clicks and drags).
- **Click-Through Support**: The window allows clicking through transparent areas to interactions with windows behind it.

### Chat & Interaction
- **Chat Interface**: Floating input field and speech bubbles for communication.
- **Reactions**: Randomized text reactions when clicked (e.g., "Oh! I felt that! 😊").
- **Global Shortcuts**:
  - `Toggle Chat`: Setup to trigger chat via keyboard shortcut.
  - `Toggle Drag`: Mode switching logic.

### Settings & Customization
- **Theme Engine**: Support for different character themes (loaded from `themes/{theme_name}`).
- **Configuration Persistence**: Saves user preferences (API keys, selected model, theme) using a backend configuration system.

---

## 🚀 Next Steps (Roadmap)

### 1. Enhanced States & Animation
- [ ] **Walking State**: Implement walking animations where the character moves across the bottom of the screen or wanders.
- [ ] **Sleeping/Dormant**: A low-energy state when not interacted with for a long time.
- [ ] **Emotions**: Sad, Happy, Confused states based on the context of the conversation.

### 2. Screensaver Mode ("Wander Mode")
- [ ] **Full-Screen Canvas**: Option to take over the screen with a black/transparent background.
- [ ] **Wandering Logic**: The character roams freely around the screen bounds.
- [ ] **Privacy Focus**: Black out the background content for privacy while the "screensaver" is active.

### 3. Accessibility & Voice
- [ ] **Text-to-Speech (TTS)**: The fox speaks its responses aloud using synthesized voice.
- [ ] **Speech-to-Text (STT)**: Allow the user to speak to the fox via microphone instead of typing.
- [ ] **Voice Trigger ("Summon")**: 
  - Run in a hidden/tray mode.
  - Listen for a wake word (e.g., "Hey Foxy") to appear on screen.

### Future Improvements
- [ ] **State Machine System**: Refactor character logic to use a formal state machine for better state management and transitions.
- [ ] **More Character Models**: Add more diversity.
- [ ] **Voice Interaction**: Text-to-speech and Speech-to-text.r can interact with (Backpack, Ball).

### 5. Deployment & Release
- [ ] **CI/CD Pipeline**: Automated GitHub Actions to build releases for all platforms on push.
- [ ] **Auto-Update**: Functionality for the app to download and apply updates automatically.
- [ ] **Signed Binaries**: Code signing for Windows/macOS to avoid security warnings.


---

## 🔮 Future Ideas & "Nice to Haves"

### Smart System Integration
- **System Reactivity**:
  - *High CPU Usage*: Character wipes sweat from brow or looks tired.
  - *Music Playing*: Character bobs head to the beat.
  - *Low Battery*: Character moves slower or looks sleepy.
  - *Notifications*: Character points to the notification area or holds up a sign.

### Companion Features
- **Tamagotchi-style Needs**: Optional hygiene/hunger system (can be toggled off for a purely assistant experience).
- **Mini-Games**: Play Rock-Paper-Scissors or Tic-Tac-Toe directly in the speech bubble.
- **Daily Briefing**: Pops up in the morning with weather/calendar summary.

### Visual Polish
- **Seasonal Themes**: Automatic hats or accessories based on date (Santa hat in Dec, Pumpkin in Oct).
- **Shadows & Lighting**: Drop shadows that respect screen position for more depth. - **Done**

### 🐛 Known Issues / Bugs
- [x] **Dismiss Button State**: Clicking the 'X' on the chat bubble hides the bubble but leaves the character in a `Listening` state. **(Fixed)**
