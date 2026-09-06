@echo off
setlocal enabledelayedexpansion

:: Navigate to repo root using relative script directory
cd /d "%~dp0"

echo ===================================================
echo   Starting FaultFlow Unified Development Stack
echo ===================================================

:: Check Docker and start local infrastructure if available
where docker >nul 2>nul
if %errorlevel% equ 0 (
    echo [1/3] Checking Docker daemon status...
    docker info >nul 2>nul
    if %errorlevel% equ 0 (
        echo [1/3] Starting Docker services (PostgreSQL & Redis)...
        docker compose up -d 2>nul || docker-compose up -d 2>nul
        if %errorlevel% equ 0 (
            echo [1/3] Docker containers running successfully.
        ) else (
            echo [1/3] Warning: Docker compose up failed. Continuing with local/cloud env...
        )
    ) else (
        echo [1/3] Docker daemon is not running. Continuing with local/cloud env...
    )
) else (
    echo [1/3] Docker not found in PATH. Continuing with local/cloud env...
)

:: Ensure root dependencies are installed
if not exist "node_modules" (
    echo [2/3] Installing root dependencies...
    call npm install
)

:: Ensure server dependencies are installed
if not exist "server\node_modules" (
    echo [2/3] Installing server dependencies...
    call npm --prefix server install
)

:: Ensure client dependencies are installed
if not exist "client\node_modules" (
    echo [2/3] Installing client dependencies...
    call npm --prefix client install
)

echo [3/3] Booting backend server (Port 4000) & Next.js frontend (Port 3000)...
echo ===================================================

:: Run client and server concurrently
call npm run dev
