# AutoMetrics 🚗📊

Sistema de monitoreo y observabilidad para una lavadero de autos (detailing), implementado con **Prometheus**, **Grafana**, **PostgreSQL** y **Docker**.

**Estudiante:** Carlos Muñoz  
**Materia:** Herramientas y Visualización de Datos  
**Universidad:** Fundación Universitaria Los Libertadores

---

## Stack tecnológico

| Componente | Tecnología |
|---|---|
| API REST | Node.js + Express |
| Base de datos | PostgreSQL 15 |
| Métricas | Prometheus + prom-client |
| Visualización | Grafana |
| Contenedores | Docker + docker-compose |

---

## Estructura del proyecto

```
autometrics/
├── docker-compose.yml
├── README.md
├── api/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── init.sql
├── prometheus/
│   └── prometheus.yml
├── grafana/
│   └── provisioning/
│       ├── datasources/
│       │   └── prometheus.yml
│       └── dashboards/
│           ├── dashboard.yml
│           └── autometrics.json
└── scripts/
    ├── generate_traffic.py
    └── generate_traffic.sh
```

---

## Endpoints de la API

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/` | Estado y descripción de la API |
| GET | `/api/servicios` | Lista de servicios del lavadero |
| GET | `/api/autos` | Autos registrados |
| GET | `/api/citas` | Citas con detalle de auto y servicio |
| POST | `/api/citas` | Crear nueva cita |
| GET | `/api/stats` | Estadísticas generales (negocio) |
| GET | `/api/lento` | Endpoint simulando procesamiento pesado (1-3s) |
| GET | `/metrics` | Métricas en formato Prometheus |

### Ejemplo POST /api/citas
```json
{
  "auto_id": 1,
  "servicio_id": 2,
  "notas": "Cliente frecuente"
}
```

---

## Métricas implementadas

| Métrica | Tipo | Descripción |
|---|---|---|
| `http_requests_total` | Counter | Total de requests por endpoint, método y status |
| `http_request_duration_seconds` | Histogram | Latencia de cada request |
| `http_requests_active` | Gauge | Requests procesándose en este momento |
| `autometrics_citas_total` | Counter | Citas creadas |
| `autometrics_citas_por_estado` | Gauge | Citas agrupadas por estado |

---

## Cómo ejecutar

### 1. Iniciar todos los servicios
```bash
docker-compose up -d
```

### 2. Verificar que están corriendo
```bash
docker-compose ps
```

### 3. Acceder a los servicios
- **API:** http://localhost:3000
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3001 (usuario: `admin`, contraseña: `admin`)

### 4. Generar tráfico sintético
```bash
# Python (recomendado)
python scripts/generate_traffic.py

# Bash
bash scripts/generate_traffic.sh
```

### 5. Detener
```bash
docker-compose down

# Detener y eliminar volúmenes (reset completo)
docker-compose down -v
```

---

## Queries PromQL útiles

```promql
# Requests por segundo por endpoint
sum(rate(http_requests_total[1m])) by (endpoint)

# Latencia promedio
rate(http_request_duration_seconds_sum[1m]) / rate(http_request_duration_seconds_count[1m])

# Latencia p95
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint))

# Tasa de errores
sum(rate(http_requests_total{status=~"4..|5.."}[1m])) / sum(rate(http_requests_total[1m])) * 100

# Total requests
sum(http_requests_total)
```

---

## Dashboard de Grafana

El dashboard **AutoMetrics Dashboard** se carga automáticamente con 7 paneles:

1. Throughput - Requests por segundo
2. Latencia promedio por endpoint
3. Requests activos (gauge)
4. Total de requests
5. Tasa de errores
6. Latencia p95 por endpoint
7. Citas por estado (métricas de negocio)

---

## Puntos bonus implementados

- Métricas personalizadas de negocio (`autometrics_citas_*`)
- Histogramas con percentiles (p95)
- Dashboard con 7 paneles (mínimo requerido: 3)
- Dashboard provisionado automáticamente (no requiere configuración manual)
- PostgreSQL como base de datos real
- 7 endpoints en la API (mínimo requerido: 3)
