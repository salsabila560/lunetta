#!/usr/bin/env bash
# Installs pinned contract dependencies into ./lib (run once after cloning).
set -euo pipefail
cd "$(dirname "$0")"
forge install --no-git foundry-rs/forge-std@v1.9.4 chiru-labs/ERC721A@v4.3.0 OpenZeppelin/openzeppelin-contracts@v5.1.0
# forge names the ERC721A folder "ERC721A"; remappings expect lowercase
if [ -d lib/ERC721A ] && [ ! -d lib/erc721a ]; then mv lib/ERC721A lib/erc721a; fi
echo "Dependencies installed."
