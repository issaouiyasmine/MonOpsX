export interface GrafanaDashboard {
  id: string;
  title: string;
  url: string;
}

export interface GrafanaConfig {
  dashboards: GrafanaDashboard[];
  errors: string[];
  configured: boolean;
}

export interface GrafanaServerContext {
  accountId?: string;
  serverId: string;
  serverName?: string;
  hostname?: string;
  ip?: string;
}

const absoluteUrlPattern = /^https?:\/\//i;

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function appendEmbedParams(url: URL) {
  if (!url.searchParams.has("theme")) {
    url.searchParams.set("theme", "dark");
  }

  let value = url.toString();
  if (!/[?&]kiosk(?:[=&]|$)/.test(value)) {
    value = `${value}${value.includes("?") ? "&" : "?"}kiosk`;
  }

  return value;
}

function resolveDashboardUrl(path: string, baseUrl: string | undefined) {
  const trimmedPath = path.trim();

  if (absoluteUrlPattern.test(trimmedPath)) {
    return appendEmbedParams(new URL(trimmedPath));
  }

  if (!baseUrl?.trim()) {
    throw new Error("Les URL relatives des tableaux de bord nécessitent EXPO_PUBLIC_GRAFANA_BASE_URL.");
  }

  return appendEmbedParams(new URL(trimmedPath.replace(/^\//, ""), withTrailingSlash(baseUrl.trim())));
}

function interpolateServerTemplate(value: string, server: GrafanaServerContext, encodeValues: boolean) {
  const replacements: Record<string, string> = {
    accountId: server.accountId ?? "",
    serverId: server.serverId,
    serverName: server.serverName ?? "",
    hostname: server.hostname ?? "",
    ip: server.ip ?? "",
  };

  return value.replace(/\{(accountId|serverId|serverName|hostname|ip)\}/g, (_, key: keyof typeof replacements) => {
    const replacement = replacements[key];
    return encodeValues ? encodeURIComponent(replacement) : replacement;
  });
}

function parseGrafanaDashboards(
  rawDashboards: string | undefined,
  baseUrl: string | undefined,
  server?: GrafanaServerContext
): GrafanaConfig {
  rawDashboards = rawDashboards?.trim();

  if (!rawDashboards) {
    return { dashboards: [], errors: [], configured: false };
  }

  const errors: string[] = [];
  const dashboards = rawDashboards
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [rawTitle, ...rawUrlParts] = entry.split("|");
      const title = rawTitle?.trim();
      const dashboardPath = rawUrlParts.join("|").trim();

      if (!title || !dashboardPath) {
        errors.push(`L'entrée Grafana ${index + 1} doit utiliser le format "Titre|URL".`);
        return null;
      }

      try {
        const resolvedTitle = server ? interpolateServerTemplate(title, server, false) : title;
        const resolvedPath = server ? interpolateServerTemplate(dashboardPath, server, true) : dashboardPath;
        return {
          id: `${index}-${resolvedTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          title: resolvedTitle,
          url: resolveDashboardUrl(resolvedPath, baseUrl),
        };
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `L'entrée Grafana ${index + 1} est invalide.`);
        return null;
      }
    })
    .filter((dashboard): dashboard is GrafanaDashboard => Boolean(dashboard));

  return { dashboards, errors, configured: true };
}

export function getGlobalGrafanaConfig(accountId?: string): GrafanaConfig {
  return parseGrafanaDashboards(
    process.env.EXPO_PUBLIC_GRAFANA_GLOBAL_DASHBOARDS ?? process.env.EXPO_PUBLIC_GRAFANA_DASHBOARDS,
    process.env.EXPO_PUBLIC_GRAFANA_BASE_URL?.replace(/\/$/, ""),
    { accountId, serverId: "" }
  );
}

export function getServerGrafanaConfig(server: GrafanaServerContext): GrafanaConfig {
  return parseGrafanaDashboards(
    process.env.EXPO_PUBLIC_GRAFANA_SERVER_DASHBOARDS,
    process.env.EXPO_PUBLIC_GRAFANA_BASE_URL?.replace(/\/$/, ""),
    server
  );
}
