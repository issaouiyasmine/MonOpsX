# Agent MonOpsX

Agent Python à installer sur une machine surveillée. Il envoie les informations système, les métriques, les événements Docker et les alertes vers l'API MonOpsX.

L'agent reste compatible avec :

```text
POST <MONOPSX_API_URL>/webhooks/server-metrics
```

Variables principales :

```env
MONOPSX_API_URL=http://localhost:8000
MONOPSX_WEBHOOK_TOKEN=token_du_serveur
MONOPSX_INTERVAL_SECONDS=30
```

Le token peut aussi être fourni sans modifier `.env` :

```bash
python agent.py --token token_du_serveur
```

En local, cette commande suffit si l'API tourne sur `http://localhost:8000`.
Au premier lancement, l'agent installe automatiquement les dépendances manquantes depuis `requirements.txt`.

Vous pouvez aussi préciser l'URL de l'API et l'intervalle :

```bash
python agent.py --api-url https://api.votre-domaine.com --token token_du_serveur --interval 30
```

Si l'installation automatique échoue, installez les dépendances manuellement :

```bash
python -m pip install -r requirements.txt
```

Au démarrage, l'agent affiche l'intervalle réellement utilisé, par exemple :

```text
Intervalle d'envoi: 30 secondes
```

## Comportement En Cas De Crash

- Si un conteneur ou une application surveillée tombe, l'agent continue de tourner et envoie un événement `crash`.
- Si toute la machine surveillée tombe, l'agent tombe avec elle et ne peut plus envoyer de métriques.
- Dans ce cas, l'API marque le serveur `Hors ligne` après 90 secondes sans métriques.

## Tester L'agent En Local Sur Windows

1. Démarrer l'API et MongoDB depuis la racine du projet :

```powershell
docker compose up
```

2. Se connecter à l'API pour récupérer un `access_token` :

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:8000/login -ContentType "application/json" -Body '{"email":"admin@example.com","password":"VotreMotDePasse#2026"}'
```

3. Créer un serveur et copier son token :

```powershell
$server = Invoke-RestMethod -Method Post -Uri http://localhost:8000/servers -Headers @{Authorization="Bearer $($login.access_token)"} -ContentType "application/json" -Body '{"name":"Machine locale","hostname":"localhost","ip":"127.0.0.1"}'
$server.webhook_token
```

Vous pouvez aussi créer le serveur depuis l'application dans `Serveurs > Ajouter un serveur`.

4. Lancer l'agent :

```powershell
cd MonOpsX_agent
python agent.py --token le_token_du_serveur
```

L'agent utilise `http://localhost:8000` par défaut et installe automatiquement les dépendances manquantes.

5. En cas d'échec de l'installation automatique, installez les dépendances puis relancez :

```powershell
python -m pip install -r requirements.txt
python agent.py --token le_token_du_serveur
```

6. Si l'API n'utilise pas l'URL locale par défaut, précisez son URL :

```powershell
python agent.py --api-url http://localhost:8000 --token le_token_du_serveur
```

La console doit afficher que les métriques sont envoyées. Ouvrez ensuite la page `Serveurs` dans l'application pour vérifier l'activité du serveur.

## Déploiement Sur Serveur Linux

1. Copier le dossier `MonOpsX_agent` sur le serveur.
2. Installer Python et les dépendances :

```bash
cd MonOpsX_agent
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

3. Modifier `.env` avec l'URL publique de l'API et le token du serveur :

```env
MONOPSX_API_URL=https://api.votre-domaine.com
MONOPSX_WEBHOOK_TOKEN=token_du_serveur
MONOPSX_INTERVAL_SECONDS=30
```

4. Installer le service systemd :

```bash
sudo bash deploy/install-systemd.sh
sudo systemctl start monopsx-agent
```

5. Vérifier l'état et les journaux :

```bash
sudo systemctl status monopsx-agent
sudo journalctl -u monopsx-agent -f
```

Commandes utiles :

```bash
sudo systemctl restart monopsx-agent
sudo systemctl stop monopsx-agent
sudo systemctl disable monopsx-agent
```

## Déploiement Sur Serveur Windows

1. Installer Python.
2. Préparer l'agent :

```powershell
cd MonOpsX_agent
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

3. Modifier `.env` :

```env
MONOPSX_API_URL=https://api.votre-domaine.com
MONOPSX_WEBHOOK_TOKEN=token_du_serveur
MONOPSX_INTERVAL_SECONDS=30
```

4. Valider manuellement :

```powershell
python agent.py --token token_du_serveur
```

5. Pour le démarrage automatique, utilisez le Planificateur de tâches Windows ou NSSM avec la commande :

```powershell
python agent.py --token token_du_serveur
```

## Plusieurs Instances

Une machine ou instance surveillée doit correspondre à un serveur MonOpsX et à un token dédié.
Si vous avez plusieurs instances, créez un serveur séparé dans l'application pour chacune, puis lancez chaque agent avec son propre token.

## Grafana

Docker Compose démarre Grafana sur :

```text
http://localhost:3000
```

Les identifiants locaux viennent des variables `GRAFANA_ADMIN_USER` et `GRAFANA_ADMIN_PASSWORD`.

En déploiement, utilisez HTTPS et configurez des dashboards Grafana avec :

- un tableau global pour tous les serveurs ;
- un tableau par serveur filtré par `server_id`, `hostname` ou `ip`.

Le frontend lit les URL des dashboards depuis `MonOpsX_app/.env` avec `EXPO_PUBLIC_GRAFANA_GLOBAL_DASHBOARDS` et `EXPO_PUBLIC_GRAFANA_SERVER_DASHBOARDS`.
