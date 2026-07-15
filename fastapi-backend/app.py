from fastapi import FastAPI, File, UploadFile, Form, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import sqlite3
import psycopg2
import uuid
import cv2
import numpy as np
import urllib.request
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from typing import Optional

# Cargar variables de entorno desde .env si existe en la raíz
if os.path.exists(".env"):
    with open(".env", "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                parts = line.split("=", 1)
                if len(parts) == 2:
                    key, val = parts
                    os.environ[key.strip()] = val.strip().strip('"').strip("'")

app = FastAPI(title="Detector de Manos API")

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Montar archivos estáticos y plantillas
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Cargar el modelo MobileNet nativo de Keras (.keras)
modelo = tf.keras.models.load_model("mobilenet_manos_model.keras")

# Inicializar un dummy predict para forzar la carga del grafo en el hilo principal
try:
    _ = modelo.predict(np.zeros((1, 224, 224, 3)))
except Exception as e:
    print("Dummy predict failed, no problem:", e)

# Preprocesamiento EXACTO para MobileNet
def extract_features(image_path: str) -> np.ndarray:
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError("No se pudo leer la imagen. Usa JPG/PNG/WEBP/BMP.")
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (224, 224))   
    img_array = np.expand_dims(img, axis=0) # Shape: (1, 224, 224, 3)
    img_preprocessed = preprocess_input(img_array)
    return img_preprocessed

# --- CONFIGURACIÓN Y FUNCIONES DE BASE DE DATOS (Soporte Híbrido: SQLite y PostgreSQL/Supabase) ---
DATABASE_URL = os.environ.get("DATABASE_URL")
IS_POSTGRES = DATABASE_URL is not None
CLASS_UNSURE = "No seguro"

def get_connection():
    if IS_POSTGRES:
        return psycopg2.connect(DATABASE_URL)
    else:
        return sqlite3.connect("predictions.db")

def get_placeholder():
    return "%s" if IS_POSTGRES else "?"

def init_db():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        if IS_POSTGRES:
            print("Utilizando base de datos en la nube (PostgreSQL/Supabase)")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS predictions (
                    id VARCHAR(255) PRIMARY KEY,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    classification VARCHAR(50),
                    confidence DOUBLE PRECISION,
                    image_path TEXT,
                    is_correct INTEGER,
                    corrected_label TEXT
                )
            """)
        else:
            print("DATABASE_URL no configurada. Utilizando base de datos local (SQLite)")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS predictions (
                    id TEXT PRIMARY KEY,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    classification TEXT,
                    confidence REAL,
                    image_path TEXT,
                    is_correct INTEGER,
                    corrected_label TEXT
                )
            """)
        conn.commit()
        conn.close()
    except Exception as e:
        print("Error inicializando base de datos:", e)

# Inicializar base de datos
init_db()

def db_insert_prediction(pred_id, classification, confidence, image_path):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        p = get_placeholder()
        cursor.execute(f"""
            INSERT INTO predictions (id, classification, confidence, image_path)
            VALUES ({p}, {p}, {p}, {p})
        """, (pred_id, classification, confidence, image_path))
        conn.commit()
        conn.close()
    except Exception as e:
        print("Error insertando predicción en BD:", e)

def db_update_feedback(pred_id, is_correct, corrected_label=None):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        p = get_placeholder()
        val = 1 if is_correct else 0
        cursor.execute(f"""
            UPDATE predictions
            SET is_correct = {p}, corrected_label = {p}
            WHERE id = {p}
        """, (val, corrected_label, pred_id))
        conn.commit()
        conn.close()
    except Exception as e:
        print("Error actualizando feedback en BD:", e)

def db_get_stats():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Total predicciones
        cursor.execute("SELECT COUNT(*) FROM predictions")
        total = cursor.fetchone()[0]
        
        # Conteo por clases
        cursor.execute("SELECT COUNT(*) FROM predictions WHERE classification = 'Abierta'")
        open_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM predictions WHERE classification = 'Cerrada'")
        closed_count = cursor.fetchone()[0]
        
        p = get_placeholder()
        cursor.execute(f"SELECT COUNT(*) FROM predictions WHERE classification = {p}", (CLASS_UNSURE,))
        indet_count = cursor.fetchone()[0]
        
        # Precisión
        cursor.execute("SELECT COUNT(*) FROM predictions WHERE is_correct IS NOT NULL")
        verified_total = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM predictions WHERE is_correct = 1")
        correct_total = cursor.fetchone()[0]
        
        accuracy = 0
        if verified_total > 0:
            accuracy = round((correct_total / verified_total) * 100)
            
        conn.close()
        
        return {
            "total": total,
            "accuracy": f"{accuracy}%",
            "class_counts": {
                "Abierta": open_count,
                "Cerrada": closed_count,
                "No seguro": indet_count
            }
        }
    except Exception as e:
        print("Error calculando estadísticas de BD:", e)
        return {
            "total": 0,
            "accuracy": "0%",
            "class_counts": {"Abierta": 0, "Cerrada": 0, "No seguro": 0}
        }

# --- RUTAS DE FASTAPI ---

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/stats")
def stats():
    return db_get_stats()

class FeedbackRequest(BaseModel):
    id: str
    is_correct: bool
    corrected_label: Optional[str] = None

@app.post("/feedback")
def feedback(data: FeedbackRequest):
    try:
        db_update_feedback(data.id, data.is_correct, data.corrected_label)
        return {"status": "success", "message": "Feedback registrado"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/predict")
async def predict(
    image: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None)
):
    pred_id = str(uuid.uuid4())
    path = None
    
    # 1. Comprobar si se envió una URL o archivo
    try:
        # Comprobar si se envió una URL
        if image_url and image_url.strip() != "":
            url_str = image_url.strip()
            # Añadir headers para simular un navegador real
            req = urllib.request.Request(
                url_str, 
                data=None, 
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            )
            ext = os.path.splitext(url_str)[1].lower()
            if ext not in [".jpg", ".jpeg", ".png", ".webp", ".bmp"]:
                ext = ".jpg"
            filename = f"{uuid.uuid4().hex}{ext}"
            path = os.path.join(UPLOAD_FOLDER, filename)
            with urllib.request.urlopen(req, timeout=10) as response, open(path, 'wb') as out_file:
                out_file.write(response.read())
        
        # Comprobar si se envió un archivo local
        elif image and image.filename.strip() != "":
            ext = os.path.splitext(image.filename)[1].lower()
            if ext not in [".jpg", ".jpeg", ".png", ".webp", ".bmp"]:
                return JSONResponse(status_code=400, content={"error": "Formato no soportado. Usa JPG/PNG/WEBP/BMP."})
            filename = f"{uuid.uuid4().hex}{ext}"
            path = os.path.join(UPLOAD_FOLDER, filename)
            contents = await image.read()
            with open(path, "wb") as f:
                f.write(contents)
        else:
            return JSONResponse(status_code=400, content={"error": "No se envió ninguna imagen ni URL."})
            
    except Exception as e:
        print("ERROR OBTENIENDO IMAGEN:", e)
        return JSONResponse(status_code=400, content={"error": "No se pudo obtener la imagen correctamente."})

    # 2. Hacer la inferencia del modelo
    try:
        img_preprocessed = extract_features(path)
        proba = modelo.predict(img_preprocessed)[0] # Shape: (2,)
        
        idx = int(np.argmax(proba))
        conf = float(np.max(proba))
        classification = "Abierta" if idx == 0 else "Cerrada"
        
        # Umbral de confianza
        threshold = 0.60
        if conf < threshold:
            classification = CLASS_UNSURE
            db_insert_prediction(pred_id, classification, conf, path)
            return {
                "id": pred_id,
                "classification": classification,
                "confidence": conf,
                "message": "Toma otra foto con mejor luz y fondo simple."
            }

        db_insert_prediction(pred_id, classification, conf, path)
        return {
            "id": pred_id,
            "classification": classification,
            "confidence": conf
        }

    except Exception as e:
        print("ERROR EN /predict:", e)
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)
