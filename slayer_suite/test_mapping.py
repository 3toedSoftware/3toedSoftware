import subprocess
import webbrowser
import time
import os

# Start HTTP server
server = subprocess.Popen(['python', '-m', 'http.server', '8000'], cwd=os.path.dirname(__file__))

# Wait for server to start
time.sleep(2)

# Open browser
webbrowser.open('http://localhost:8000/apps/mapping_slayer/mapping_slayer.html')

print("Server started. Press Ctrl+C to stop.")

try:
    server.wait()
except KeyboardInterrupt:
    server.terminate()
    print("\nServer stopped.")