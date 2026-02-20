@echo off
setlocal

cd /d "%~dp0Web"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Node.js est introuvable dans le PATH.
  echo Installe Node.js puis relance ce fichier.
  pause
  exit /b 1
)

echo Demarrage du serveur XCE sur http://localhost:8000
echo Ferme cette fenetre pour arreter le serveur.
echo.

start "" "http://localhost:8000"
node src\server.js
