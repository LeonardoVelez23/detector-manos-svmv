from flask import Flask, render_template, request, jsonify
import os
import sqlite3
import psycopg2
import uuid
import pickle
import cv2
import numpy as np
import urllib.request
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:4200", "http://127.0.0.1:4200"]}})  # nosec
app.config["UPLOAD_FOLDER"] = "uploads"
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

# Cargar el modelo MobileNet nativo de Keras (.keras)
modelo = tf.keras.models.load_model("mobilenet_manos_model.keras")

# Inicializar un dummy predict para forzar la carga del grafo en el hilo principal
try:
    _ = modelo.predict(np.zeros((1, 224, 224, 3)))
except Exception as e:
    print("Dummy predict failed, no problem:", e)


# Preprocesamiento EXACTO para MobileNet
def extract_features(image_path: str) -> np.ndarray:
    # 1. Leer imagen en color BGR
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError("No se pudo leer la imagen. Usa JPG/PNG/WEBP/BMP.")

    # 2. Convertir BGR a RGB
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # 3. Redimensionar a (224, 224) para MobileNet
    img = cv2.resize(img, (224, 224))

    # 4. Preprocesamiento específico de MobileNetV2 (-1 a 1)
    img_array = np.expand_dims(img, axis=0)  # Shape: (1, 224, 224, 3)
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
            "class_counts": {"Abierta": 0, "Cerrada": 0, CLASS_UNSURE: 0}
        }

# --- RUTAS DE FLASK ---

@app.route("/", methods=["GET"])
def home():
    return render_template("index.html")

@app.route("/stats", methods=["GET"])
def stats():
    stats_data = db_get_stats()
    return jsonify(stats_data)

@app.route("/feedback", methods=["POST"])
def feedback():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Petición JSON vacía"}), 400
            
        pred_id = data.get("id")
        is_correct = data.get("is_correct")
        corrected_label = data.get("corrected_label")
        
        if not pred_id:
            return jsonify({"error": "Falta el ID de predicción"}), 400
            
        db_update_feedback(pred_id, is_correct, corrected_label)
        return jsonify({"status": "success", "message": "Feedback registrado"})
    except Exception as e:
        print("Error en /feedback:", e)
        return jsonify({"error": str(e)}), 500

@app.route("/predict", methods=["POST"])
def predict():
    pred_id = str(uuid.uuid4())
    
    # 1. Comprobar si se envió una URL o archivo
    try:
        # Comprobar si se envió una URL
        if "image_url" in request.form and request.form["image_url"].strip() != "":
            image_url = request.form["image_url"].strip()
            # Añadir headers para simular un navegador real
            req = urllib.request.Request(
                image_url,
                data=None,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                },
            )
            ext = os.path.splitext(image_url)[1].lower()
            if ext not in [".jpg", ".jpeg", ".png", ".webp", ".bmp"]:
                ext = ".jpg"
            filename = f"{uuid.uuid4().hex}{ext}"
            path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            with urllib.request.urlopen(req, timeout=10) as response, open(path, 'wb') as out_file:
                data = response.read()
                out_file.write(data)
        
        # Comprobar si se envió un archivo local
        elif "image" in request.files and request.files["image"].filename.strip() != "":
            file = request.files["image"]
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in [".jpg", ".jpeg", ".png", ".webp", ".bmp"]:
                return jsonify({"error": "Formato no soportado. Usa JPG/PNG/WEBP/BMP."}), 400
            filename = f"{uuid.uuid4().hex}{ext}"
            path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            file.save(path)
        else:
            return jsonify({"error": "No se envió ninguna imagen ni URL."}), 400
            
    except Exception as e:
        print("ERROR OBTENIENDO IMAGEN:", e)
        return jsonify({"error": "No se pudo obtener la imagen correctamente."}), 400

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
            return jsonify({
                "id": pred_id,
                "classification": classification,
                "confidence": conf,
                "message": "Toma otra foto con mejor luz y fondo simple."
            })

        db_insert_prediction(pred_id, classification, conf, path)
        return jsonify({
            "id": pred_id,
            "classification": classification,
            "confidence": conf
        })

    try:
        result = predict_from_path(path)
        return jsonify(result)
    except Exception as e:
        print("ERROR EN /predict:", e)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
