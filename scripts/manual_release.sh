#!/bin/bash

# Exit on error
set -e

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed."
    echo "Please install it from https://cli.github.com/ and run 'gh auth login'."
    exit 1
fi

# Check authentication status
if ! gh auth status &> /dev/null; then
    echo "Error: You are not logged in to GitHub CLI."
    echo "Please run 'gh auth login' to authenticate."
    exit 1
fi

echo "🚀 Starting manual release process..."

# Build the project
echo "📦 Building the application..."
npm run tauri build

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"

# Ask user if they want to proceed with this version
read -p "Create release for tag $TAG? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Define paths to artifacts
# Note: Adjust these paths if your output directory is different
# === EARLIER PART OF SCRIPT REMAINS (Up to line 36) ===
# We are replacing the artifact discovery and upload section entirely

# Initialize empty array for assets
ASSETS=()

# --- Linux Artifacts ---
DEB_FILE=$(find src-tauri/target/release/bundle/deb -name "*.deb" 2>/dev/null | head -n 1)
RPM_FILE=$(find src-tauri/target/release/bundle/rpm -name "*.rpm" 2>/dev/null | head -n 1)
APPIMAGE_FILE=$(find src-tauri/target/release/bundle/appimage -name "*.AppImage" 2>/dev/null | head -n 1)

if [ -n "$DEB_FILE" ]; then ASSETS+=("$DEB_FILE"); fi
if [ -n "$RPM_FILE" ]; then ASSETS+=("$RPM_FILE"); fi
if [ -n "$APPIMAGE_FILE" ]; then ASSETS+=("$APPIMAGE_FILE"); fi

# --- Windows Artifacts ---
# Windows paths likely contain .exe (NSIS) and .msi
EXE_FILE=$(find src-tauri/target/release/bundle/nsis -name "*.exe" 2>/dev/null | head -n 1)
MSI_FILE=$(find src-tauri/target/release/bundle/msi -name "*.msi" 2>/dev/null | head -n 1)

if [ -n "$EXE_FILE" ]; then ASSETS+=("$EXE_FILE"); fi
if [ -n "$MSI_FILE" ]; then ASSETS+=("$MSI_FILE"); fi

# --- macOS Artifacts (Just in case) ---
DMG_FILE=$(find src-tauri/target/release/bundle/dmg -name "*.dmg" 2>/dev/null | head -n 1)
if [ -n "$DMG_FILE" ]; then ASSETS+=("$DMG_FILE"); fi

# Check if we found anything
if [ ${#ASSETS[@]} -eq 0 ]; then
    echo "Error: No release artifacts found in src-tauri/target/release/bundle/"
    echo "Make sure the build completed successfully."
    exit 1
fi

echo "Found artifacts to upload:"
for f in "${ASSETS[@]}"; do
    echo "- $f"
done

# Check if release already exists
if gh release view "$TAG" &> /dev/null; then
    echo "⚠️  Release $TAG already exists."
    read -p "Do you want to upload these files to the existing release? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then exit 0; fi
    
    echo "⬆️  Uploading to existing release $TAG..."
    gh release upload "$TAG" "${ASSETS[@]}" --clobber
else
    echo "⬆️  Creating new release $TAG and uploading assets..."
    gh release create "$TAG" "${ASSETS[@]}" \
        --title "Release $TAG" \
        --generate-notes
fi


echo "✅ Release $TAG created successfully!"
