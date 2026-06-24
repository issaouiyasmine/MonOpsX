# MonOpsX Agent

Python agent that runs on a monitored server and pushes host/Docker metrics to MonOpsX.

## Install

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Create a server in MonOpsX with `POST /servers`, copy the returned `webhook_token`, and set it as `MONOPSX_WEBHOOK_TOKEN`.

## Run

```bash
python agent.py
```

The agent sends CPU, memory, disk, uptime, Docker container state, deployment changes, and crash/restart events to:

```text
POST <MONOPSX_API_URL>/webhooks/server-metrics
```

## Run Automatically On Server Boot

On an Ubuntu/Azure Linux server, install the agent as a `systemd` service:

```bash
cd MonOpsX_agent
cp .env.example .env
```

Edit `.env`:

```env
MONOPSX_API_URL=http://your-api-host:8000
MONOPSX_WEBHOOK_TOKEN=token_returned_by_post_servers
MONOPSX_INTERVAL_SECONDS=30
```

Install and enable the service:

```bash
sudo bash deploy/install-systemd.sh
sudo systemctl start monopsx-agent
```

Check status and logs:

```bash
sudo systemctl status monopsx-agent
sudo journalctl -u monopsx-agent -f
```

Useful service commands:

```bash
sudo systemctl restart monopsx-agent
sudo systemctl stop monopsx-agent
sudo systemctl disable monopsx-agent
```

The service starts after the network is online and restarts automatically if the agent crashes.

## Ollama Assistant Setup

The MonOpsX API can use Ollama to answer questions about saved server metrics. Docker Compose starts Ollama and automatically pulls the default model through the `ollama-pull` one-shot service:

```bash
docker compose up -d --build
```

The first startup can take time because `llama3.2:3b` must be downloaded into the `ollama_data` volume. Later startups reuse the downloaded model.

Check the puller logs:

```bash
docker compose logs ollama-pull
```

The API expects:

```env
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2:3b
```
