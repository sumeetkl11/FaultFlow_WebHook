#!/usr/bin/env bash
set -e

# Resolve repository root directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "==================================================="
echo "  Starting FaultFlow Unified Development Stack"
echo "==================================================="

# Check Docker and start local infrastructure if available
if command -v docker >/dev/null 2>&1; then
    echo "[1/3] Checking Docker daemon status..."
    if docker info >/dev/null 2>&1; then
        echo "[1/3] Starting Docker services (PostgreSQL & Redis)..."
        if docker compose version >/dev/null 2>&1; then
            docker compose up -d || echo "[1/3] Warning: docker compose up failed. Continuing..."
        elif command -v docker-compose >/dev/null 2>&1; then
            docker-compose up -d || echo "[1/3] Warning: docker-compose up failed. Continuing..."
        fi
    else
        echo "[1/3] Docker daemon is not running. Continuing with local/cloud env..."
    fi
else
    echo "[1/3] Docker not found in PATH. Continuing with local/cloud env..."
fi

# Ensure root dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "[2/3] Installing root dependencies..."
    npm install
fi

# Ensure server dependencies are installed
if [ ! -d "server/node_modules" ]; then
    echo "[2/3] Installing server dependencies..."
    npm --prefix server install
fi

# Ensure client dependencies are installed
if [ ! -d "client/node_modules" ]; then
    echo "[2/3] Installing client dependencies..."
    npm --prefix client install
fi

echo "[3/3] Booting backend server (Port 4000) & Next.js frontend (Port 3000)..."
echo "==================================================="

# Run client and server concurrently
npm run dev
