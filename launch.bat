@echo off
title DataLens Launcher
echo ===================================================
echo                 DataLens Launcher
echo ===================================================
echo.

echo [1/3] Launching FastAPI Backend (Port 8000)...
start "DataLens Backend" cmd /k "cd backend && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

echo [2/3] Launching React Vite Frontend (Port 5173)...
start "DataLens Frontend" cmd /k "cd frontend && npm run dev"

echo [3/3] Opening browser in 4 seconds...
timeout /t 4 /nobreak >nul
start http://localhost:5173

echo.
echo ===================================================
echo  DataLens is running!
echo  - Backend: http://localhost:8000
echo  - Frontend: http://localhost:5173
echo ===================================================
echo.
pause
