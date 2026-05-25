#!/usr/bin/env python3
"""
AutoMetrics - Script de tráfico sintético
Genera requests automáticos a la API para poblar métricas en Prometheus/Grafana
"""

import urllib.request
import urllib.error
import json
import time
import random
import threading

BASE_URL = "http://localhost:3000"

ENDPOINTS_GET = [
    "/",
    "/api/servicios",
    "/api/autos",
    "/api/citas",
    "/api/stats",
    "/api/lento",
]

NUEVAS_CITAS = [
    {"auto_id": 1, "servicio_id": 1, "notas": "Cliente frecuente"},
    {"auto_id": 2, "servicio_id": 3, "notas": "Urgente"},
    {"auto_id": 3, "servicio_id": 2, "notas": "Primera vez"},
]

def get(endpoint):
    url = BASE_URL + endpoint
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.getcode()
            print(f"  GET {endpoint} → {status}")
            return status
    except urllib.error.HTTPError as e:
        print(f"  GET {endpoint} → {e.code}")
        return e.code
    except Exception as e:
        print(f"  GET {endpoint} → ERROR: {e}")
        return None

def post_cita(data):
    url = BASE_URL + "/api/citas"
    try:
        body = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.getcode()
            print(f"  POST /api/citas → {status}")
            return status
    except urllib.error.HTTPError as e:
        print(f"  POST /api/citas → {e.code}")
        return e.code
    except Exception as e:
        print(f"  POST /api/citas → ERROR: {e}")
        return None

def rafaga_normal(n=5):
    """Simula tráfico normal: endpoints aleatorios"""
    for _ in range(n):
        endpoint = random.choice(ENDPOINTS_GET)
        get(endpoint)
        time.sleep(random.uniform(0.1, 0.5))

def rafaga_pesada(n=10):
    """Simula pico de carga: muchos requests rápidos"""
    threads = []
    for _ in range(n):
        endpoint = random.choice(["/api/servicios", "/api/citas", "/api/stats"])
        t = threading.Thread(target=get, args=(endpoint,))
        threads.append(t)
        t.start()
    for t in threads:
        t.join()

def ciclo_citas():
    """Crea citas nuevas periódicamente"""
    cita = random.choice(NUEVAS_CITAS)
    post_cita(cita)

def main():
    print("=" * 50)
    print("  AutoMetrics - Generador de tráfico sintético")
    print("=" * 50)
    print(f"  Target: {BASE_URL}")
    print("  Ctrl+C para detener\n")

    # Esperar a que la API esté lista
    print("Esperando que la API esté disponible...")
    for i in range(10):
        try:
            urllib.request.urlopen(BASE_URL + "/", timeout=3)
            print("API lista!\n")
            break
        except:
            print(f"  Intento {i+1}/10...")
            time.sleep(3)

    ciclo = 0
    while True:
        ciclo += 1
        print(f"── Ciclo {ciclo} ──────────────────────────────")

        # Tráfico normal
        print("  [Normal]")
        rafaga_normal(random.randint(3, 8))

        # Cada 3 ciclos: pico de carga
        if ciclo % 3 == 0:
            print("  [Pico de carga]")
            rafaga_pesada(random.randint(8, 15))

        # Cada 4 ciclos: crear citas
        if ciclo % 4 == 0:
            print("  [Nueva cita]")
            ciclo_citas()

        # Pausa entre ciclos
        pausa = random.uniform(2, 5)
        print(f"  Pausa {pausa:.1f}s...")
        time.sleep(pausa)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nGenerador detenido.")
