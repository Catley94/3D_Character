#!/bin/bash

# Find the .AppImage file in the release directory
APPIMAGE_FILE=$(find src-tauri/target/release/bundle/appimage -name "*.AppImage" | head -n 1)

if [ -z "$APPIMAGE_FILE" ]; then
  echo "Error: No AppImage found in src-tauri/target/release/bundle/appimage"
  echo "Please ensure you have built the project with 'npm run tauri build'"
  exit 1
fi

echo "Found AppImage: $APPIMAGE_FILE"

# Make it executable if it isn't already
if [ ! -x "$APPIMAGE_FILE" ]; then
    echo "Making AppImage executable..."
    chmod +x "$APPIMAGE_FILE"
fi

echo "Launching AppImage..."
"$APPIMAGE_FILE"
