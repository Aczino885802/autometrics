const express = require('express');
const { Pool } = require('pg');
const promClient = require('prom-client');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Conexión a Postgres ───────────────────────────────────────────────────
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'autometrics',
  password: process.env.DB_PASSWORD || 'autometrics123',
  database: process.env.DB_NAME || 'autometrics',
});

// ─── Métricas Prometheus ───────────────────────────────────────────────────
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Contador de requests por endpoint y método
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total de requests HTTP',
  labelNames: ['method', 'endpoint', 'status'],
  registers: [register],
});

// Histograma de latencia
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de requests HTTP en segundos',
  labelNames: ['method', 'endpoint'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

// Gauge de requests activos
const httpRequestsActive = new promClient.Gauge({
  name: 'http_requests_active',
  help: 'Requests activos en este momento',
  registers: [register],
});

// Contadores de negocio
const citasTotal = new promClient.Counter({
  name: 'autometrics_citas_total',
  help: 'Total de citas creadas',
  labelNames: ['estado'],
  registers: [register],
});

const citasPorEstado = new promClient.Gauge({
  name: 'autometrics_citas_por_estado',
  help: 'Citas agrupadas por estado actual',
  labelNames: ['estado'],
  registers: [register],
});

// ─── Middleware de métricas ────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path === '/metrics') return next();

  httpRequestsActive.inc();
  const end = httpRequestDuration.startTimer({ method: req.method, endpoint: req.path });

  res.on('finish', () => {
    httpRequestsTotal.inc({ method: req.method, endpoint: req.path, status: res.statusCode });
    end();
    httpRequestsActive.dec();
  });

  next();
});

// ─── Endpoints ────────────────────────────────────────────────────────────

// GET / - Estado de la API
app.get('/', (req, res) => {
  res.json({
    app: 'AutoMetrics API',
    version: '1.0.0',
    descripcion: 'Sistema de monitoreo para lavadero de autos',
    endpoints: ['GET /', 'GET /api/servicios', 'GET /api/autos', 'GET /api/citas', 'POST /api/citas', 'GET /api/stats', 'GET /api/lento', 'GET /metrics'],
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// GET /api/servicios - Lista de servicios disponibles
app.get('/api/servicios', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM servicios ORDER BY precio ASC');
    res.json({ ok: true, data: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/autos - Lista de autos registrados
app.get('/api/autos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM autos ORDER BY id ASC');
    res.json({ ok: true, data: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/citas - Lista de citas con detalle
app.get('/api/citas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, a.placa, a.marca, a.modelo, a.propietario,
             s.nombre as servicio, s.precio, c.estado, c.fecha, c.notas
      FROM citas c
      JOIN autos a ON a.id = c.auto_id
      JOIN servicios s ON s.id = c.servicio_id
      ORDER BY c.fecha DESC
    `);

    // Actualizar gauge por estado
    const estados = ['pendiente', 'en_proceso', 'completada', 'cancelada'];
    for (const estado of estados) {
      const count = result.rows.filter(r => r.estado === estado).length;
      citasPorEstado.set({ estado }, count);
    }

    res.json({ ok: true, data: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/citas - Crear nueva cita
app.post('/api/citas', async (req, res) => {
  const { auto_id, servicio_id, notas } = req.body;

  if (!auto_id || !servicio_id) {
    return res.status(400).json({ ok: false, error: 'auto_id y servicio_id son requeridos' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO citas (auto_id, servicio_id, notas) VALUES ($1, $2, $3) RETURNING *',
      [auto_id, servicio_id, notas || null]
    );
    citasTotal.inc({ estado: 'pendiente' });
    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/stats - Estadísticas generales (para dashboard)
app.get('/api/stats', async (req, res) => {
  try {
    const [servicios, autos, citas, ingresos] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM servicios'),
      pool.query('SELECT COUNT(*) as total FROM autos'),
      pool.query('SELECT estado, COUNT(*) as total FROM citas GROUP BY estado'),
      pool.query(`
        SELECT COALESCE(SUM(s.precio), 0) as total
        FROM citas c JOIN servicios s ON s.id = c.servicio_id
        WHERE c.estado = 'completada'
      `),
    ]);

    res.json({
      ok: true,
      data: {
        total_servicios: parseInt(servicios.rows[0].total),
        total_autos: parseInt(autos.rows[0].total),
        citas_por_estado: citas.rows,
        ingresos_completados: parseFloat(ingresos.rows[0].total),
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/citas/:id - Actualizar estado de una cita
app.put('/api/citas/:id', async (req, res) => {
  const { id } = req.params;
  const { estado, notas } = req.body;

  const estadosValidos = ['pendiente', 'en_proceso', 'completada', 'cancelada'];
  if (estado && !estadosValidos.includes(estado)) {
    return res.status(400).json({ ok: false, error: `Estado inválido. Valores permitidos: ${estadosValidos.join(', ')}` });
  }

  try {
    const result = await pool.query(
      'UPDATE citas SET estado = COALESCE($1, estado), notas = COALESCE($2, notas) WHERE id = $3 RETURNING *',
      [estado || null, notas || null, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Cita no encontrada' });
    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/citas/:id - Eliminar una cita
app.delete('/api/citas/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM citas WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Cita no encontrada' });
    res.json({ ok: true, mensaje: `Cita ${id} eliminada`, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/autos/:id - Actualizar datos de un auto
app.put('/api/autos/:id', async (req, res) => {
  const { id } = req.params;
  const { marca, modelo, color, propietario } = req.body;

  try {
    const result = await pool.query(
      `UPDATE autos SET
        marca = COALESCE($1, marca),
        modelo = COALESCE($2, modelo),
        color = COALESCE($3, color),
        propietario = COALESCE($4, propietario)
       WHERE id = $5 RETURNING *`,
      [marca || null, modelo || null, color || null, propietario || null, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Auto no encontrado' });
    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/autos/:id - Eliminar un auto
app.delete('/api/autos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM citas WHERE auto_id = $1', [id]);
    const result = await pool.query('DELETE FROM autos WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).json({ ok: false, error: 'Auto no encontrado' });
    res.json({ ok: true, mensaje: `Auto ${id} eliminado`, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/lento - Endpoint que simula procesamiento pesado
app.get('/api/lento', async (req, res) => {
  const delay = Math.floor(Math.random() * 2000) + 1000; // 1-3 seg
  await new Promise(resolve => setTimeout(resolve, delay));

  res.json({
    ok: true,
    mensaje: 'Procesamiento pesado completado',
    tiempo_ms: delay,
    timestamp: new Date().toISOString(),
  });
});

// GET /metrics - Métricas para Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ─── Iniciar servidor ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`AutoMetrics API corriendo en puerto ${PORT}`);
  console.log(`Métricas disponibles en http://localhost:${PORT}/metrics`);
});