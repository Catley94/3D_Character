#!/bin/bash

# Function to detect the distribution
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo $ID
    else
        echo "unknown"
    fi
}

DISTRO=$(detect_distro)

echo "Detected distribution: $DISTRO"
echo "Installing Tauri dependencies..."

case $DISTRO in
    ubuntu|debian|pop|mint|kali|elementary)
        echo "Running apt-get..."
        sudo apt-get update
        if ! sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev; then
            echo "4.1 installation failed, preventing exit and trying 4.0..."
            sudo apt-get install -y libwebkit2gtk-4.0-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
        fi
        ;;
    fedora)
        echo "Running dnf..."
        sudo dnf check-update
        sudo dnf groupinstall "Development Tools"
        sudo dnf install -y webkit2gtk3-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel
        ;;
    arch|manjaro|endeavouros)
        echo "Running pacman..."
        sudo pacman -Syu --noconfirm
        sudo pacman -S --noconfirm webkit2gtk base-devel curl wget file openssl appmenu-gtk-module gtk3 libappindicator-gtk3 librsvg
        ;;
    *)
        echo "Unsupported distribution: $DISTRO"
        echo "Please manually install: webkit2gtk, build-essential/base-devel, curl, wget, file, ssl-dev, gtk3, appindicator"
        exit 1
        ;;
esac

echo "Dependencies installed successfully!"
