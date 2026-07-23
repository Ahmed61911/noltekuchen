# monitoring/

Config for the optional observability stack in `docker-compose.monitoring.yml`
(Grafana + Loki + Promtail + Prometheus + postgres-exporter). Not started by
default:

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

- `promtail-config.yml` — Docker service-discovery scrape config; tails every
  container's logs via the Docker socket and ships them to Loki, labeled by
  compose service name.
- `prometheus.yml` — scrapes `postgres-exporter` for Postgres stats.
- `grafana/provisioning/datasources/` — auto-registers Loki + Prometheus in
  Grafana on startup.
- `grafana/provisioning/dashboards/` — drop dashboard JSON files here to have
  Grafana auto-load them under the "Nolte" folder; none are bundled yet.

Grafana: http://\<host\>:3001, login `admin` / `${GRAFANA_ADMIN_PASSWORD:-admin}`
— change the password on first login. Don't expose this port on the public
internet without extra protection (nginx vhost + auth, or an SSH tunnel).

`postgres-exporter` connects as the `postgres` superuser for simplicity. For
a tighter setup, create a dedicated read-only monitoring role instead.
