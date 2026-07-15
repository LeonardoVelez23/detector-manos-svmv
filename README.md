# Detector de Manos (Rama `model2`)

Este proyecto es una aplicación web interactiva para la detección y clasificación del estado de las manos (Abierta o Cerrada) utilizando inteligencia artificial.

La arquitectura en esta rama se compone de:
1. **Backend (API de Inferencia):** Construido en Python con **Flask**, utilizando **TensorFlow/Keras** para ejecutar inferencias con el modelo **MobileNetV2** nativo (`.keras`).
2. **Frontend:** Una interfaz de usuario moderna de una sola página construida con **Angular 19** y estilizada mediante **Bootstrap 5** (Diseño Premium en Modo Oscuro).

---

## Características de la Rama
- **Conexión Directa:** El frontend en Angular se conecta directamente a la API de Flask en el puerto `5000` (sin intermediación de un Gateway).
- **Arrastrar y Soltar (Drag & Drop):** Permite subir archivos de imagen locales arrastrándolos directamente a la interfaz.
- **Predicción desde URL:** Puedes ingresar enlaces directos de imágenes de internet.
- **Cámara Web en Tiempo Real:** Permite encender tu webcam y tomar una foto en vivo para analizarla al instante.
- **Historial y Estadísticas de BD:** Muestra la tasa de precisión de la IA y el desglose de conteos directamente desde la base de datos de manera persistente.
- **Sistema de Feedback:** Los usuarios pueden calificar (Sí/No) si la predicción fue acertada y enviar correcciones en caliente que se registran de forma permanente.

---

## Requisitos de Instalación

### 1. Sistema Operativo y Gestores
- Python 3.12 (Recomendado para asegurar compatibilidad de TensorFlow).
- Node.js (v20 o v22) y NPM (v10+).

---

## Instrucciones de Inicio Rápido

Sigue estos pasos en dos terminales separadas para iniciar la aplicación:

### Paso 1: Levantar el Backend (Python Flask)
Abre la primera terminal en la raíz del proyecto y ejecuta:

```bash
# 1. Crear el entorno virtual con Python 3.12
python3.12 -m venv venv

# 2. Activar el entorno virtual
source venv/bin/activate

# 3. Actualizar pip e instalar dependencias
pip install --upgrade pip
pip install flask flask-cors opencv-python-headless numpy tensorflow scikit-learn psycopg2-binary

# 4. Iniciar la API
python app.py
```
El servidor backend estará escuchando en **`http://localhost:5000/`**.

### Paso 2: Levantar el Frontend (Angular)
Abre una segunda terminal en la raíz del proyecto y ejecuta:

```bash
# 1. Entrar al directorio del frontend
cd angular-frontend

# 2. Instalar dependencias npm
npm install

# 3. Levantar el servidor de desarrollo
npm run start
```

El servidor frontend estará disponible en **`http://localhost:4200/`** y abrirá tu navegador automáticamente.

---

## Base de Datos (Persistencia Híbrida)

El backend soporta de forma automática dos bases de datos:
* **SQLite (Local por defecto):** Si ejecutas la aplicación de forma normal sin configuraciones previas, se creará un archivo `predictions.db` en la raíz para guardar localmente las estadísticas y el feedback.
* **PostgreSQL (Supabase en la nube):** Para desplegar la base de datos en Supabase, simplemente expón la variable de entorno `DATABASE_URL` con tu connection string de Supabase antes de iniciar la aplicación:
  ```bash
  export DATABASE_URL="postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
  python app.py
  ```
  El servidor detectará la variable y creará/migrará automáticamente las tablas en Supabase.

---

## Mapeo del Modelo
El modelo utiliza la arquitectura **MobileNetV2** preentrenada y cargada nativamente (`mobilenet_manos_model.keras`). Las clases de salida son:
- `0`: Mano Abierta
- `1`: Mano Cerrada
- Confianza `< 60%`: Indeterminado / No seguro (solicita tomar otra foto con mejor luz).
