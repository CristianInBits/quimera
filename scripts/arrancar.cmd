@echo off
rem Arranca el servidor de desarrollo de Quimera con el Node del entorno del
rem proyecto (.entorno), sin depender del Node del sistema. Al arrancar sale un
rem codigo QR: se escanea con Expo Go en el movil, en la misma wifi.
set "PATH=%~dp0..\.entorno;%PATH%"
cd /d "%~dp0.."
npx expo start %*
