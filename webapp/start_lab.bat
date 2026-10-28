@echo off
rem Starts the WCN Virtual Lab and opens it in the browser
cd /d "%~dp0"
start "" http://localhost:8000
python server.py %*
