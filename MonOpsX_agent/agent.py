from __future__ import annotations

import json
import os
import socket
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import psutil
except ImportError:  # pragma: no cover - handled at runtime on unprepared hosts
    psutil = None

try:
    import requests
except ImportError:  # pragma: no cover - handled at runtime on unprepared hosts
    requests = None

try:
    import docker
except ImportError:  # pragma: no cover - Docker support is optional
    docker = None


AGENT_VERSION = "1.0.0"
DEFAULT_INTERVAL_SECONDS = 30
MIN_INTERVAL_SECONDS = 5


def load_dotenv(path: str = ".env") -> None:
    env_path = Path(path)
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def get_required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def get_interval() -> int:
    raw_value = os.getenv("MONOPSX_INTERVAL_SECONDS", str(DEFAULT_INTERVAL_SECONDS)).strip()
    try:
        return max(MIN_INTERVAL_SECONDS, int(raw_value))
    except ValueError:
        return DEFAULT_INTERVAL_SECONDS


def wait_until_next_run(next_run_at: float) -> None:
    remaining = next_run_at - time.monotonic()
    if remaining > 0:
        time.sleep(remaining)


def collect_system_metrics() -> dict[str, Any]:
    if psutil is None:
        raise RuntimeError("psutil is required. Install dependencies with: pip install -r requirements.txt")

    boot_time = psutil.boot_time()
    return {
        "cpu_percent": float(psutil.cpu_percent(interval=1)),
        "memory_percent": float(psutil.virtual_memory().percent),
        "disk_percent": float(psutil.disk_usage("/").percent),
        "uptime_seconds": max(0, int(time.time() - boot_time))
    }


def get_primary_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def collect_docker_state(previous: dict[str, dict[str, Any]] | None = None) -> tuple[dict[str, Any], list[dict[str, str]], dict[str, dict[str, Any]]]:
    if docker is None:
        return {"available": False, "containers": []}, [], {}

    previous = previous or {}
    try:
        client = docker.from_env()
        containers = client.containers.list(all=True)
    except Exception:
        return {"available": False, "containers": []}, [], previous

    current: dict[str, dict[str, Any]] = {}
    events: list[dict[str, str]] = []
    payload_containers: list[dict[str, Any]] = []

    for container in containers:
        attrs = getattr(container, "attrs", {}) or {}
        state = attrs.get("State", {}) or {}
        name = getattr(container, "name", None) or getattr(container, "short_id", "container")
        image = _container_image(container)
        status = getattr(container, "status", None) or state.get("Status", "unknown")
        restart_count = int(state.get("RestartCount") or 0)
        snapshot = {
            "name": name,
            "image": image,
            "status": status,
            "restart_count": restart_count
        }

        payload_containers.append(snapshot)
        current[name] = snapshot
        old = previous.get(name)

        if old:
            if old.get("image") != image:
                events.append({
                    "type": "deployment",
                    "severity": "info",
                    "message": f"Container {name} image changed from {old.get('image')} to {image}"
                })
            if old.get("status") == "running" and status != "running":
                events.append({
                    "type": "crash",
                    "severity": "critical",
                    "message": f"Container {name} changed status from running to {status}"
                })
            if restart_count > int(old.get("restart_count") or 0):
                events.append({
                    "type": "crash",
                    "severity": "warning",
                    "message": f"Container {name} restart count increased to {restart_count}"
                })

    return {"available": True, "containers": payload_containers}, events, current


def _container_image(container: Any) -> str:
    tags = getattr(getattr(container, "image", None), "tags", None) or []
    if tags:
        return str(tags[0])
    image_id = getattr(getattr(container, "image", None), "id", None)
    return str(image_id or "unknown")


def build_payload(previous_docker_state: dict[str, dict[str, Any]] | None = None) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    docker_state, docker_events, next_docker_state = collect_docker_state(previous_docker_state)
    return {
        "agent_version": AGENT_VERSION,
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "hostname": socket.gethostname(),
        "ip": get_primary_ip(),
        "metrics": collect_system_metrics(),
        "docker": docker_state,
        "events": docker_events
    }, next_docker_state


def post_payload(api_url: str, token: str, payload: dict[str, Any], retries: int = 3) -> None:
    if requests is None:
        raise RuntimeError("requests is required. Install dependencies with: pip install -r requirements.txt")

    url = f"{api_url.rstrip('/')}/webhooks/server-metrics"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    last_error: Exception | None = None

    for attempt in range(retries):
        try:
            response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=15)
            response.raise_for_status()
            return
        except Exception as error:
            last_error = error
            time.sleep(min(2 ** attempt, 10))

    raise RuntimeError(f"Failed to post metrics after {retries} attempts") from last_error


def run_forever() -> None:
    load_dotenv()
    api_url = get_required_env("MONOPSX_API_URL")
    token = get_required_env("MONOPSX_WEBHOOK_TOKEN")
    interval = get_interval()
    docker_state: dict[str, dict[str, Any]] = {}
    next_run_at = time.monotonic()

    print(f"Intervalle d'envoi: {interval} secondes")

    while True:
        wait_until_next_run(next_run_at)
        started_at = time.monotonic()
        try:
            payload, docker_state = build_payload(docker_state)
            post_payload(api_url, token, payload)
            print(f"[{datetime.now(timezone.utc).isoformat()}] metrics sent")
        except Exception as error:
            print(f"[{datetime.now(timezone.utc).isoformat()}] metrics send failed: {error}")
        next_run_at = started_at + interval


if __name__ == "__main__":
    run_forever()
