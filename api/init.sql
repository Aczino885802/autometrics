-- AutoMetrics - Base de datos inicial

CREATE TABLE IF NOT EXISTS servicios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    duracion_min INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS autos (
    id SERIAL PRIMARY KEY,
    placa VARCHAR(20) NOT NULL UNIQUE,
    marca VARCHAR(50),
    modelo VARCHAR(50),
    color VARCHAR(30),
    propietario VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS citas (
    id SERIAL PRIMARY KEY,
    auto_id INTEGER REFERENCES autos(id),
    servicio_id INTEGER REFERENCES servicios(id),
    fecha TIMESTAMP DEFAULT NOW(),
    estado VARCHAR(20) DEFAULT 'pendiente',
    notas TEXT
);

-- Datos de ejemplo
INSERT INTO servicios (nombre, descripcion, precio, duracion_min) VALUES
    ('Lavado básico', 'Lavado exterior con agua y jabón', 25000, 30),
    ('Lavado premium', 'Lavado exterior + interior completo', 55000, 60),
    ('Detailing completo', 'Pulida, encerada y detailing interior', 150000, 180),
    ('Lavado de motor', 'Limpieza profunda del motor', 40000, 45),
    ('Aspirado interior', 'Aspirado completo del habitáculo', 20000, 20)
ON CONFLICT DO NOTHING;

INSERT INTO autos (placa, marca, modelo, color, propietario) VALUES
    ('ABC123', 'Toyota', 'Corolla', 'Blanco', 'Carlos Muñoz'),
    ('XYZ789', 'Mazda', 'CX-5', 'Negro', 'Ana García'),
    ('DEF456', 'Chevrolet', 'Spark', 'Rojo', 'Luis Torres')
ON CONFLICT DO NOTHING;

INSERT INTO citas (auto_id, servicio_id, estado) VALUES
    (1, 2, 'completada'),
    (2, 3, 'en_proceso'),
    (3, 1, 'pendiente')
ON CONFLICT DO NOTHING;
