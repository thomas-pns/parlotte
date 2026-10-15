@echo off
title Parlotte (serveur)
cd /d "%~dp0server"
set "NODE=%LOCALAPPDATA%\pi-node\current\node.exe"
if not exist "%NODE%" set "NODE=node"
"%NODE%" server.js
pause
