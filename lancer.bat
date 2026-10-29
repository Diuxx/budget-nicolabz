@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 ou plus est necessaire : https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\@11ty\eleventy" (
  echo Installation des dependances...
  call npm install
  if errorlevel 1 (
    echo Installation impossible. Verifiez la connexion internet.
    pause
    exit /b 1
  )
)
echo Tableau de bord : http://localhost:8081
call npm run dev
pause
