# Ableton Metrolink - Setup Instructions

## Prerequisites

Before running Ableton Metrolink, make sure you have the following installed on your Windows 10/11 computer:

1. **Python 3.8 or newer**
   - Download from: https://www.python.org/downloads/
   - During installation, check "Add Python to PATH"

2. **Node.js**
   - Download from: https://nodejs.org/
   - The LTS (Long Term Support) version is recommended

3. **loopMIDI**
   - Download from: https://www.tobias-erichsen.de/software/loopmidi.html
   - Create at least one MIDI port in loopMIDI

4. **Ableton Live**
   - Make sure Ableton Live is installed and properly configured

## Installation & Running

### Option 1: Simple Start (Recommended)

1. Extract the Ableton Metrolink files to a folder on your computer
2. Start loopMIDI and make sure at least one MIDI port is created
3. Double-click the `start_metrolink.bat` file
4. Open your web browser and go to: http://localhost:8001

The batch file will:
- Check if all prerequisites are installed
- Install necessary Python and Node.js dependencies
- Start all required servers
- Open a web interface

### Option 2: Manual Setup

If you prefer to set up and run the components manually:

1. Install Python dependencies:
   ```
   pip install asyncio websockets python-rtmidi
   ```

2. Install Node.js dependencies:
   ```
   npm install
   ```

3. Start the Python MIDI server:
   ```
   python server.py
   ```

4. Start the Node.js Link server:
   ```
   node server.js
   ```

5. Start a web server for the interface:
   ```
   python -m http.server 8001
   ```

6. Open your web browser and go to: http://localhost:8001

## Troubleshooting

### MIDI Connection Issues
- Make sure loopMIDI is running and has at least one port created
- Check that no other applications are using the loopMIDI port
- Restart loopMIDI if necessary

### Server Connection Issues
- Check if any of the required ports (8001, 8765) are already in use
- Make sure your firewall is not blocking the connections
- Try restarting the application

### Python or Node.js Errors
- Make sure you have the correct versions installed
- Try reinstalling the dependencies manually:
  ```
  pip install asyncio websockets python-rtmidi
  npm install
  ```

## Connecting with Ableton Live

1. In Ableton Live, go to Preferences > Link/MIDI
2. Enable Link and make sure it's active
3. In the MIDI Ports section, enable the loopMIDI port for both Input and Output
4. Set "Track" and "Sync" to ON for the loopMIDI port

Now Ableton Live should be connected to Ableton Metrolink, and you can control transport and receive tempo information through the web interface.