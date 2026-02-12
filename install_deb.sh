#!/bin/bash

# Find the .deb file in the release directory
DEB_FILE=$(find src-tauri/target/release/bundle/deb -name "*.deb" | head -n 1)

if [ -z "$DEB_FILE" ]; then
  echo "Error: No .deb package found in src-tauri/target/release/bundle/deb"
  echo "Please ensure you have built the project with 'npm run tauri build'"
  exit 1
fi

echo "Found package: $DEB_FILE"
echo "Installing..."

# Install the package
if sudo dpkg -i "$DEB_FILE"; then
    echo "Installation successful!"
else
    echo "Installation failed. Attempting to fix missing dependencies..."
    if sudo apt-get install -f -y; then
        echo "Dependencies installed and package configured successfully!"
    else
        echo "Failed to install dependencies. Please check the error messages above."
        exit 1
    fi
fi
