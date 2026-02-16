#!/bin/bash

# Exit on error
set -e

# Usage check
if [ -z "$1" ]; then
    echo "Usage: ./scripts/publish.sh <new_version>"
    echo "Example: ./scripts/publish.sh 1.0.1"
    exit 1
fi

NEW_VERSION="$1"

# Check if git is clean
if [[ -n $(git status -s) ]]; then
    echo "Error: Git working directory is not clean. Please commit or stash changes first."
    exit 1
fi

echo "🚀 Starting release process for version $NEW_VERSION..."

# 1. Update version in files
echo "📝 Updating version in configuration files..."
node scripts/set_version.js "$NEW_VERSION"

# 2. Update Cargo.lock
echo "🦀 Updating Cargo.lock..."
cd src-tauri
cargo check # This triggers Cargo.lock update
cd ..

# 3. Commit changes (including Cargo.lock)
echo "💾 Committing changes..."
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: release v$NEW_VERSION"

# 4. Create Git tag
echo "🏷️  Creating git tag v$NEW_VERSION..."
git tag "v$NEW_VERSION"

# 5. Push changes and tag
echo "⬆️  Pushing changes and tag to origin..."
read -p "Ready to push to origin? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted. Changes committed and tagged locally."
    exit 0
fi

# Get current branch name
CURRENT_BRANCH=$(git branch --show-current)

if [ -z "$CURRENT_BRANCH" ]; then
    echo "Error: Could not determine current branch."
    exit 1
fi

git push origin "$CURRENT_BRANCH"
git push origin "v$NEW_VERSION"

echo "✅ Done! GitHub Actions will now build and release v$NEW_VERSION."
