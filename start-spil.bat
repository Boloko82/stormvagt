@echo off
chcp 65001 >nul
rem Dobbeltklik for at starte Stormvagt paa denne pc. Spil derefter paa http://localhost:3000
title Stormvagt server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto nonode

if exist "node_modules\ws\package.json" goto run
echo Spillet gøres klar første gang. Det kræver internet og tager et øjeblik...
call npm install
if errorlevel 1 goto installfailed

:run
echo.
echo Stormvagt starter. Din browser åbner om et øjeblik.
echo Venner på samme wifi kan deltage på en af disse adresser:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do for /f "tokens=* delims= " %%b in ("%%a") do echo     http://%%b:3000
echo.
echo Lad dette vindue være åbent, mens I spiller. Luk det for at stoppe spillet.
echo.
start "" /min cmd /c "ping -n 3 127.0.0.1 >nul & start http://localhost:3000"
call npm start
echo.
echo Spilserveren stoppede. Står der "EADDRINUSE" ovenfor, kører spillet allerede i et andet vindue.
pause
exit /b

:nonode
echo Node.js er ikke installeret endnu.
echo Hent "LTS"-versionen fra https://nodejs.org , installer den, og dobbeltklik så på denne fil igen.
pause
exit /b 1

:installfailed
echo Klargøringen mislykkedes. Tjek din internetforbindelse, og prøv igen.
pause
exit /b 1
