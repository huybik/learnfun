"""Start both the FastAPI server and Vite dev server."""

import subprocess
import signal
import sys
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
CLIENT_DIR = os.path.join(ROOT, "client")
SERVER_DIR = os.path.join(ROOT, "server")

procs: list[subprocess.Popen] = []


def cleanup(*_):
    for p in procs:
        p.terminate()
    for p in procs:
        p.wait()
    sys.exit(0)


signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

# Start FastAPI server
procs.append(subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "server.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
    cwd=SERVER_DIR,
))

# Start Vite dev server
procs.append(subprocess.Popen(
    ["npm", "run", "dev"],
    cwd=CLIENT_DIR,
))

print("Server: http://localhost:8000")
print("Client: http://localhost:5173")

# Wait for any process to exit
try:
    while True:
        for p in procs:
            ret = p.poll()
            if ret is not None:
                print(f"Process {p.args} exited with code {ret}")
                cleanup()
        signal.pause()
except AttributeError:
    # signal.pause() not available on Windows
    for p in procs:
        p.wait()
