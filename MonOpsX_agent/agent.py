from __future__ import annotations

import argparse
import importlib
import json
import os
import platform
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


AGENT_VERSION = "1.0.0"
DEFAULT_API_URL = "http://localhost:8000"
DEFAULT_INTERVAL_SECONDS = 30
MIN_INTERVAL_SECONDS = 5
REQUIRED_MODULES = ("psutil", "requests", "docker")

psutil = None
requests = None
docker = None


def import_optional_modules() -> None:
    global psutil, requests, docker

    for module_name in REQUIRED_MODULES:
        try:
            module = importlib.import_module(module_name)
        except ImportError:  # pragma: no cover - depends on host installation
            module = None
        globals()[module_name] = module


import_optional_modules()


def parse_cli_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Agent de surveillance MonOpsX")
    parser.add_argument("--token", help="Token du serveur MonOpsX")
    parser.add_argument("--api-url", help="URL de l'API MonOpsX")
    parser.add_argument("--interval", help="Intervalle d'envoi en secondes")
    return parser.parse_args(argv)


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


def get_config_value(name: str, cli_value: str | None = None, default: str | None = None) -> str:
    if cli_value and cli_value.strip():
        return cli_value.strip()
    value = os.getenv(name, "").strip()
    if value:
        return value
    if default is not None:
        return default
    return get_required_env(name)


def get_missing_dependencies() -> list[str]:
    missing = []
    if psutil is None:
        missing.append("psutil")
    if requests is None:
        missing.append("requests")
    if docker is None:
        missing.append("docker")
    return missing


def install_requirements_if_needed() -> None:
    missing = get_missing_dependencies()
    if not missing:
        return

    agent_dir = Path(__file__).resolve().parent
    requirements_path = agent_dir / "requirements.txt"
    manual_command = f"{sys.executable} -m pip install -r {requirements_path}"

    if not requirements_path.exists():
        raise RuntimeError(
            "Dependances manquantes: "
            f"{', '.join(missing)}. Fichier requirements.txt introuvable. "
            f"Lancez manuellement: {manual_command}"
        )

    print(f"Dependances manquantes: {', '.join(missing)}")
    print("Installation des dependances de l'agent...")

    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "-r", str(requirements_path)],
            cwd=str(agent_dir),
        )
    except Exception as error:
        raise RuntimeError(
            "Impossible d'installer automatiquement les dependances. "
            f"Lancez manuellement: {manual_command}"
        ) from error

    import_optional_modules()
    missing_after_install = get_missing_dependencies()
    if missing_after_install:
        raise RuntimeError(
            "Installation terminee, mais certaines dependances restent indisponibles: "
            f"{', '.join(missing_after_install)}. Lancez manuellement: {manual_command}"
        )


def get_interval(cli_value: str | None = None) -> int:
    raw_value = (cli_value or os.getenv("MONOPSX_INTERVAL_SECONDS", str(DEFAULT_INTERVAL_SECONDS))).strip()
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
        raise RuntimeError("psutil est requis. Lancez: python -m pip install -r requirements.txt")

    boot_time = psutil.boot_time()
    try:
        load_average_1m = float(psutil.getloadavg()[0])
    except (AttributeError, OSError):
        load_average_1m = None

    return {
        "cpu_percent": float(psutil.cpu_percent(interval=1)),
        "memory_percent": float(psutil.virtual_memory().percent),
        "disk_percent": float(psutil.disk_usage("/").percent),
        "load_average_1m": load_average_1m,
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
        image_attrs = getattr(getattr(container, "image", None), "attrs", {}) or {}
        last_build_at = _docker_datetime(image_attrs.get("Created"))
        started_at = _docker_datetime(state.get("StartedAt"))
        snapshot = {
            "name": name,
            "image": image,
            "status": status,
            "restart_count": restart_count,
            "last_build_at": last_build_at,
            "started_at": started_at,
            "uptime_seconds": _container_uptime_seconds(status, started_at)
        }

        payload_containers.append(snapshot)
        current[name] = snapshot
        old = previous.get(name)

        if old:
            if old.get("image") != image:
                events.append({
                    "type": "deployment",
                    "severity": "info",
                    "message": f"L'image du conteneur {name} est passée de {old.get('image')} à {image}"
                })
            if old.get("status") == "running" and status != "running":
                events.append({
                    "type": "crash",
                    "severity": "critical",
                    "message": f"Le conteneur {name} est passé de l'état running à {status}"
                })
            if restart_count > int(old.get("restart_count") or 0):
                events.append({
                    "type": "crash",
                    "severity": "warning",
                    "message": f"Le nombre de redémarrages du conteneur {name} est passé à {restart_count}"
                })

    return {"available": True, "containers": payload_containers}, events, current


def _container_image(container: Any) -> str:
    tags = getattr(getattr(container, "image", None), "tags", None) or []
    if tags:
        return str(tags[0])
    image_id = getattr(getattr(container, "image", None), "id", None)
    return str(image_id or "unknown")


def _docker_datetime(value: Any) -> str | None:
    if not value:
        return None

    text = str(value)
    if text.startswith("0001-01-01"):
        return None

    if "." in text:
        prefix, suffix = text.split(".", 1)
        digits = []
        rest = ""
        for character in suffix:
            if character.isdigit() and not rest:
                digits.append(character)
            else:
                rest += character
        text = f"{prefix}.{''.join(digits)[:6]}{rest}"

    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc).isoformat()


def _container_uptime_seconds(status: str, started_at: str | None) -> int | None:
    if status != "running" or not started_at:
        return None

    try:
        started = datetime.fromisoformat(started_at)
    except ValueError:
        return None

    return max(0, int((datetime.now(timezone.utc) - started).total_seconds()))


def build_payload(previous_docker_state: dict[str, dict[str, Any]] | None = None) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    docker_state, docker_events, next_docker_state = collect_docker_state(previous_docker_state)
    return {
        "agent_version": AGENT_VERSION,
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "hostname": socket.gethostname(),
        "ip": get_primary_ip(),
        "operating_system": platform.platform(),
        "metrics": collect_system_metrics(),
        "docker": docker_state,
        "events": docker_events
    }, next_docker_state


def post_payload(api_url: str, token: str, payload: dict[str, Any], retries: int = 3) -> None:
    if requests is None:
        raise RuntimeError("requests est requis. Lancez: python -m pip install -r requirements.txt")

    url = f"{api_url.rstrip('/')}/webhooks/server-metrics"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    last_error: Exception | None = None

    for attempt in range(retries):
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=15)
            response.raise_for_status()
            return
        except Exception as error:
            last_error = error
            time.sleep(min(2 ** attempt, 10))

    raise RuntimeError(
        f"Echec d'envoi des metriques vers {url} apres {retries} tentatives: "
        f"{format_request_error(last_error)}"
    ) from last_error


def format_request_error(error: Exception | None) -> str:
    if error is None:
        return "erreur inconnue"

    response = getattr(error, "response", None)
    if response is not None:
        body = (getattr(response, "text", "") or "").strip()
        if len(body) > 500:
            body = f"{body[:500]}..."
        if body:
            return f"HTTP {response.status_code} - {body}"
        return f"HTTP {response.status_code}"

    request = getattr(error, "request", None)
    if request is not None:
        return f"erreur reseau: {error}"

    return str(error)


def run_forever(argv: list[str] | None = None) -> None:
    args = parse_cli_args(argv)
    install_requirements_if_needed()
    load_dotenv()
    api_url = get_config_value("MONOPSX_API_URL", args.api_url, DEFAULT_API_URL)
    token = get_config_value("MONOPSX_WEBHOOK_TOKEN", args.token)
    interval = get_interval(args.interval)
    docker_state: dict[str, dict[str, Any]] = {}
    next_run_at = time.monotonic()

    print(f"API MonOpsX: {api_url.rstrip('/')}")
    print(f"Intervalle d'envoi: {interval} secondes")

    while True:
        wait_until_next_run(next_run_at)
        started_at = time.monotonic()
        try:
            payload, docker_state = build_payload(docker_state)
            post_payload(api_url, token, payload)
            print(f"[{datetime.now(timezone.utc).isoformat()}] métriques envoyées")
        except Exception as error:
            print(f"[{datetime.now(timezone.utc).isoformat()}] échec d'envoi des métriques: {error}")
        next_run_at = started_at + interval


if __name__ == "__main__":
    run_forever()
