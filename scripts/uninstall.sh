#!/bin/bash
# Uninstall script for AI Character Assistant
# Removes the app and all user data/cache

echo "🦊 Uninstalling AI Character Assistant..."

# Remove the deb package
if dpkg -l | grep -q ai-character-assistant; then
    echo "Removing installed package..."
    sudo dpkg -r ai-character-assistant
else
    echo "Package not installed via dpkg"
fi

# Remove user config and cache
CONFIG_DIR="$HOME/.config/ai-character-assistant"
CACHE_DIR="$HOME/.cache/ai-character-assistant"

if [ -d "$CONFIG_DIR" ]; then
    echo "Removing config directory: $CONFIG_DIR"
    rm -rf "$CONFIG_DIR"
fi

if [ -d "$CACHE_DIR" ]; then
    echo "Removing cache directory: $CACHE_DIR"
    rm -rf "$CACHE_DIR"
fi

# Also check for Electron's default cache location
ELECTRON_CACHE="$HOME/.config/AI Character Assistant"
if [ -d "$ELECTRON_CACHE" ]; then
    echo "Removing Electron cache: $ELECTRON_CACHE"
    rm -rf "$ELECTRON_CACHE"
fi

echo "✅ Cleanup complete!"
