#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# --- 1. Common Setup ---
# Install Puppeteer without downloading its bundled Chromium
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install puppeteer

# Update apt list and install common fonts and libraries required by both browsers
echo "INFO: Installing common fonts and libraries..."
apt-get update
apt-get install -y \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends

# --- 2. Install Browser Based on Architecture ---
ARCH=$(dpkg --print-architecture)
echo "INFO: Detected architecture: $ARCH"

if [ "$ARCH" = "amd64" ]; then
    # For amd64 (x86_64) architecture, install Google Chrome
    echo "INFO: Installing Google Chrome for amd64..."
    apt-get install -y wget gnupg
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list
    apt-get update
    apt-get install -y google-chrome-stable --no-install-recommends
    BROWSER_EXEC="google-chrome-stable"

elif [ "$ARCH" = "arm64" ]; then
    # For arm64 architecture, install Chromium
    # Google Chrome is not available for arm64, so we install the open-source version, Chromium
    echo "INFO: Installing Chromium for arm64..."
    apt-get install -y chromium --no-install-recommends
    BROWSER_EXEC="chromium"

else
    echo "ERROR: Unsupported architecture: $ARCH" >&2
    exit 1
fi

# --- 3. Cleanup and Verification ---
# Clean up apt cache to reduce image size
echo "INFO: Cleaning up apt cache..."
rm -rf /var/lib/apt/lists/*

# Find the path of the installed browser executable
chrome_path=$(which "$BROWSER_EXEC")

# Verify if the browser was installed successfully and move the executable
if [ -n "$chrome_path" ]; then
    echo "INFO: Browser executable found at: $chrome_path"
    
    # --- START: MODIFICATION ---
    # On arm64, rename 'chromium' to 'google-chrome-stable' for compatibility with the JS code.
    # On amd64, this just moves 'google-chrome-stable' to the current directory.
    mv "$chrome_path" ./google-chrome-stable
    echo "INFO: Moved executable to ./google-chrome-stable"
    # --- END: MODIFICATION ---

else
    echo "ERROR: Browser executable '$BROWSER_EXEC' not found in PATH." >&2
    exit 1
fi

echo "✅ Setup complete. The browser executable is now available at ./google-chrome-stable"