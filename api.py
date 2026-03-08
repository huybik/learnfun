"""Start both the FastAPI server and Vite dev server."""

import subprocess
import signal
import socket
import sys
import os
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
CLIENT_DIR = os.path.join(ROOT, "client")
SERVER_DIR = os.path.join(ROOT, "server")

DOCKER_SERVICES = ["postgres", "redis", "livekit"]
SHUTDOWN_GRACE_SECONDS = 8.0
FORCE_KILL_SECONDS = 2.0

procs: list[subprocess.Popen] = []
_shutting_down = False


def cleanup(*_):
    global _shutting_down
    if _shutting_down:
        return
    _shutting_down = True

    # Signal whole process groups so uvicorn reloader / npm child processes exit too.
    for p in procs:
        if p.poll() is not None:
            continue
        try:
            if os.name == "nt":
                p.terminate()
            else:
                os.killpg(p.pid, signal.SIGTERM)
        except ProcessLookupError:
            continue
        except Exception:
            p.terminate()

    deadline = time.time() + SHUTDOWN_GRACE_SECONDS
    for p in procs:
        if p.poll() is not None:
            continue
        timeout = max(0.0, deadline - time.time())
        if timeout == 0.0:
            break
        try:
            p.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            pass

    for p in procs:
        if p.poll() is not None:
            continue
        try:
            if os.name == "nt":
                p.kill()
            else:
                os.killpg(p.pid, signal.SIGKILL)
        except ProcessLookupError:
            continue
        except Exception:
            p.kill()

    hard_deadline = time.time() + FORCE_KILL_SECONDS
    for p in procs:
        if p.poll() is not None:
            continue
        timeout = max(0.0, hard_deadline - time.time())
        if timeout == 0.0:
            break
        try:
            p.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            pass

    sys.exit(0)


signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)


def ensure_docker():
    """Build and start Docker infra services if not already running."""
    # Check if Docker daemon is running, start it if not
    try:
        subprocess.run(
            ["docker", "info"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Docker is not running. Starting Docker Desktop...")
        subprocess.run(["open", "-a", "Docker"], check=True)
        # Wait for Docker daemon to be ready
        import time
        for _ in range(30):
            time.sleep(2)
            if subprocess.run(
                ["docker", "info"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            ).returncode == 0:
                print("Docker is ready.")
                break
        else:
            print("Docker failed to start within 60s.")
            sys.exit(1)

    # Check if all infra containers are running
    try:
        result = subprocess.run(
            ["docker", "compose", "ps", "--status", "running", "--format", "{{.Service}}"],
            capture_output=True, text=True, cwd=ROOT,
        )
        running = set(result.stdout.strip().splitlines())
    except (subprocess.CalledProcessError, FileNotFoundError):
        running = set()

    missing = [s for s in DOCKER_SERVICES if s not in running]
    if missing:
        print(f"Starting Docker services: {', '.join(missing)}")
        subprocess.run(
            ["docker", "compose", "up", "-d", "--build"] + missing,
            cwd=ROOT, check=True,
        )
    else:
        print("Docker services already running.")


ensure_docker()


def find_free_port(start: int, host: str = "0.0.0.0") -> int:
    """Return start if available, otherwise the next free port."""
    port = start
    while port < start + 100:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex((host, port)) != 0:
                return port
        port += 1
    print(f"No free port found in range {start}-{port}")
    sys.exit(1)


server_port = find_free_port(8000)
client_port = find_free_port(5173)

# Start FastAPI server
procs.append(subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "server.main:app", "--reload", "--host", "0.0.0.0", "--port", str(server_port)],
    cwd=SERVER_DIR,
    start_new_session=True,
))

# Start Vite dev server with server port passed via env
client_env = {**os.environ, "VITE_SERVER_PORT": str(server_port)}
procs.append(subprocess.Popen(
    ["npm", "run", "dev", "--", "--port", str(client_port)],
    cwd=CLIENT_DIR,
    env=client_env,
    start_new_session=True,
))

print(f"Server: http://localhost:{server_port}")
print(f"Client: http://localhost:{client_port}")

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
