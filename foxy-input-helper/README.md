# Foxy Input Helper 🦊🦀

A lightweight Rust helper for the Foxy AI Character Assistant that provides global input tracking on Wayland.

## Why This Exists

On Wayland, applications cannot access:
- Global cursor position (only get position within their own window)
- Global keyboard shortcuts (unless they're the compositor)

This helper bypasses those restrictions by reading directly from Linux input devices (`/dev/input/event*`), which gives us raw access to all mouse and keyboard events.

## Requirements

### 1. Input Group Membership

You must be in the `input` group to read from input devices:

```bash
sudo usermod -a -G input $USER
# Then log out and back in
```

### 2. Rust Toolchain

Install Rust if you haven't: https://rustup.rs/

## Building

```bash
cd foxy-input-helper
cargo build --release
```

The binary will be at `target/release/foxy-input-helper`

## Usage

Run standalone to test:

```bash
./target/release/foxy-input-helper
```

Move your mouse and press keys - you'll see JSON output like:

```json
{"type":"ready","mice_count":1,"keyboards_count":1,"screen_width":1920,"screen_height":1080}
{"type":"cursor","x":960,"y":540}
{"type":"cursor","x":965,"y":542}
{"type":"shortcut","name":"toggle_chat"}
{"type":"click","button":"left","x":965,"y":542}
{"type":"heartbeat"}
```

## How It Works

1. **Device Discovery**: Scans `/dev/input/` for event devices
2. **Classification**: Identifies mice (have REL_X/REL_Y) and keyboards (have letter keys)
3. **Event Loop**: Uses `poll()` to efficiently wait for events from multiple devices
4. **Cursor Tracking**: Accumulates relative mouse movements to track global position
5. **Shortcut Detection**: Tracks modifier keys and detects configured combos
6. **JSON Output**: Streams events to stdout for Electron to consume

## Configured Shortcuts

| Combo | Event Name | Purpose |
|-------|------------|---------|
| Meta+Shift+F | `toggle_chat` | Toggle Foxy's chat interface |

## Integration with Electron

The main Foxy app spawns this as a child process and reads JSON lines from stdout. See `src/main/services/cursor-monitor.ts` for the integration code.

## Troubleshooting

### "Permission denied" errors

Make sure you're in the input group:
```bash
groups  # Should show 'input' in the list
```

If not, add yourself and log out/in:
```bash
sudo usermod -a -G input $USER
```

### No devices found

Check that you have input devices:
```bash
ls -la /dev/input/event*
```

### Screen size detection

If cursor bounds are wrong, you can set screen size via environment:
```bash
SCREEN_WIDTH=1920 SCREEN_HEIGHT=1080 ./target/release/foxy-input-helper
```
