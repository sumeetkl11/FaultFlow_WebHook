# PowerShell startup script for FaultFlow
$ErrorActionPreference = "Stop"

# Navigate to script directory
Set-Location -Path $PSScriptRoot

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Starting FaultFlow Unified Development Stack" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# Check Docker and start local infrastructure if available
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "[1/3] Checking Docker daemon status..." -ForegroundColor Yellow
    try {
        docker info | Out-Null
        Write-Host "[1/3] Starting Docker services (PostgreSQL & Redis)..." -ForegroundColor Yellow
        docker compose up -d 2>$null
        if ($LASTEXITCODE -ne 0) {
            docker-compose up -d 2>$null
        }
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[1/3] Docker containers running successfully." -ForegroundColor Green
        } else {
            Write-Host "[1/3] Warning: Docker compose failed. Continuing with local/cloud env..." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[1/3] Docker daemon not running. Continuing with local/cloud env..." -ForegroundColor Yellow
    }
} else {
    Write-Host "[1/3] Docker not found in PATH. Continuing with local/cloud env..." -ForegroundColor Yellow
}

# Ensure root dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "[2/3] Installing root dependencies..." -ForegroundColor Yellow
    npm install
}

# Ensure server dependencies
if (-not (Test-Path "server/node_modules")) {
    Write-Host "[2/3] Installing server dependencies..." -ForegroundColor Yellow
    npm --prefix server install
}

# Ensure client dependencies
if (-not (Test-Path "client/node_modules")) {
    Write-Host "[2/3] Installing client dependencies..." -ForegroundColor Yellow
    npm --prefix client install
}

Write-Host "[3/3] Booting backend server (Port 4000) & Next.js frontend (Port 3000)..." -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan

# Run client and server concurrently
npm run dev
