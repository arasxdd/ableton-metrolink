@echo off
echo Ableton Metrolink Launcher
echo ========================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed or not in PATH.
    echo Please install Python 3.8 or newer from https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if loopMIDI is running
tasklist /FI "IMAGENAME eq loopMIDI.exe" 2>NUL | find /I /N "loopMIDI.exe">NUL
if %errorlevel% neq 0 (
    echo loopMIDI is not running.
    echo Please start loopMIDI before running this application.
    pause
    exit /b 1
)

echo Installing Python dependencies...
pip install asyncio websockets python-rtmidi

echo Installing Node.js dependencies...
npm install

echo.
echo Starting servers...
echo.

REM Start Python server in a new window
start "Ableton Metrolink - MIDI Server" cmd /c "python server.py"

REM Start Node.js server in a new window
start "Ableton Metrolink - Link Server" cmd /c "node server.js"

REM Start a simple HTTP server for the web interface
start "Ableton Metrolink - Web Server" cmd /c "python -m http.server 8001"

echo.
echo Servers started successfully!
echo.
echo Web interface available at: http://localhost:8001
echo.
echo Press any key to stop all servers and exit...
pause

REM Kill all servers when user presses a key
taskkill /FI "WINDOWTITLE eq Ableton Metrolink - MIDI Server*" /F
taskkill /FI "WINDOWTITLE eq Ableton Metrolink - Link Server*" /F
taskkill /FI "WINDOWTITLE eq Ableton Metrolink - Web Server*" /F

echo All servers stopped.
pause