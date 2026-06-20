#!/usr/bin/env bash
set -euo pipefail

AGENT_USER="${AGENT_USER:-monopsx-agent}"
INSTALL_DIR="${INSTALL_DIR:-/opt/monopsx-agent}"
SERVICE_NAME="${SERVICE_NAME:-monopsx-agent}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash deploy/install-systemd.sh"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required. Install it first, for example: sudo apt install python3 python3-venv"
  exit 1
fi

if ! id "${AGENT_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "${AGENT_USER}"
fi

mkdir -p "${INSTALL_DIR}"
cp "${SOURCE_DIR}/agent.py" "${INSTALL_DIR}/agent.py"
cp "${SOURCE_DIR}/requirements.txt" "${INSTALL_DIR}/requirements.txt"

if [[ -f "${SOURCE_DIR}/.env" ]]; then
  cp "${SOURCE_DIR}/.env" "${INSTALL_DIR}/.env"
elif [[ ! -f "${INSTALL_DIR}/.env" ]]; then
  cp "${SOURCE_DIR}/.env.example" "${INSTALL_DIR}/.env"
fi

python3 -m venv "${INSTALL_DIR}/.venv"
"${INSTALL_DIR}/.venv/bin/pip" install --upgrade pip
"${INSTALL_DIR}/.venv/bin/pip" install -r "${INSTALL_DIR}/requirements.txt"

cp "${SCRIPT_DIR}/monopsx-agent.service" "/etc/systemd/system/${SERVICE_NAME}.service"

if getent group docker >/dev/null 2>&1; then
  usermod -aG docker "${AGENT_USER}" || true
fi

chown -R "${AGENT_USER}:${AGENT_USER}" "${INSTALL_DIR}"
chmod 600 "${INSTALL_DIR}/.env"

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"

echo "Installed ${SERVICE_NAME}."
echo "Edit ${INSTALL_DIR}/.env with MONOPSX_API_URL and MONOPSX_WEBHOOK_TOKEN before starting."
echo "Start with: sudo systemctl start ${SERVICE_NAME}"
echo "Logs: sudo journalctl -u ${SERVICE_NAME} -f"
