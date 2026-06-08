#!/bin/bash
set -e

# Pacman spinner while a background process runs
pacman_spinner() {
    local pid=$1
    local spin='ᗧ ᗣ ᗤ ᗥ'
    while kill -0 "$pid" 2>/dev/null; do
        for i in $spin; do
            printf "\r[%s] Installing dependencies ... " "$i"
            sleep 0.1
        done
    done
    printf "\r[ᗧ] Installing dependencies ... done.          \n"
}

echo "qrshare – file sharing via QR code"
echo

# Run npm install in background
npm install > /dev/null 2>&1 &
pacman_spinner $!

# Build the TypeScript code
echo -n "Building ... "
npm run build > /dev/null 2>&1
echo "done."

# Create wrapper script
cat > qrshare-wrapper.sh << 'EOF'
#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$DIR/dist/index.js" "$@"
EOF
chmod +x qrshare-wrapper.sh

# Install globally (user-local)
mkdir -p "$HOME/.local/bin"
ln -sf "$(pwd)/qrshare-wrapper.sh" "$HOME/.local/bin/qrshare"

# Ensure ~/.local/bin is in PATH
if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
    echo
    echo "NOTE: Add $HOME/.local/bin to your PATH by running:"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo "Then restart your shell or source ~/.bashrc"
fi

echo
echo "Installation complete. Run 'qrshare' from anywhere."