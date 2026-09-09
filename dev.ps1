param(
    [switch]$NoDocker = $false
)

# PowerShell startup script for FaultFlow
$ErrorActionPreference = "Continue"

# Navigate to script directory
Set-Location -Path $PSScriptRoot

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Starting FaultFlow Unified Development Stack" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# Clean up any lingering processes on ports 4000 and 3000
$ports = @(4000, 3000)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($p in $pids) {
            if ($p -gt 0) {
                Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

# Check Docker and start local infrastructure if requested
if ($NoDocker) {
    Write-Host "[1/3] Skipping Docker (-NoDocker specified). Using Cloud/Neon/Upstash env..." -ForegroundColor Yellow
} elseif (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "[1/3] Checking Docker daemon status..." -ForegroundColor Yellow
    try {
        docker info | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[1/3] Starting Docker services (PostgreSQL & Redis)..." -ForegroundColor Yellow
            docker compose up -d
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[1/3] Docker containers running successfully." -ForegroundColor Green
            } else {
                Write-Host "[1/3] Docker pull failed or timed out. Continuing with configured Cloud env (Neon & Upstash)..." -ForegroundColor Yellow
            }
        } else {
            Write-Host "[1/3] Docker daemon not running. Continuing with Cloud env..." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[1/3] Docker daemon not running. Continuing with Cloud env..." -ForegroundColor Yellow
    }
} else {
    Write-Host "[1/3] Docker not found in PATH. Continuing with Cloud env..." -ForegroundColor Yellow
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
