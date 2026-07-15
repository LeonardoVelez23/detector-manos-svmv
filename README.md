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

### Paso 1: Levantar el Backend (Python FastAPI)
Abre la primera terminal en la raíz del proyecto y ejecuta:

```bash
# 1. Entrar al directorio del backend
cd fastapi-backend

# 2. Crear el entorno virtual con Python 3.12
python3.12 -m venv venv

# 3. Activar el entorno virtual
source venv/bin/activate

# 4. Actualizar pip e instalar dependencias
pip install --upgrade pip
pip install fastapi uvicorn python-multipart jinja2 opencv-python-headless numpy tensorflow scikit-learn psycopg2-binary

# 5. Iniciar la API con Uvicorn
uvicorn app:app --reload --port 5000
```
El servidor backend estará escuchando en **`http://localhost:5000/`**. Para ver la documentación Swagger interactiva, accede a **`http://localhost:5000/docs`**.

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
* **SQLite (Local por defecto):** Si ejecutas la aplicación sin configurar variables de entorno, se creará un archivo `predictions.db` dentro de `fastapi-backend/` para guardar localmente las estadísticas y el feedback.
* **PostgreSQL (Supabase en la nube):** 
  1. Copia la plantilla de variables de entorno:
     ```bash
     cd fastapi-backend
     cp .env.example .env
     ```
  2. Abre el archivo `.env` y coloca tu contraseña de base de datos de Supabase en la cadena de conexión.
  3. Al ejecutar la aplicación con `uvicorn`, detectará automáticamente la variable `DATABASE_URL` y creará/migrará la tabla en Supabase.

---

## Mapeo del Modelo
El modelo utiliza la arquitectura **MobileNetV2** preentrenada y cargada nativamente (`mobilenet_manos_model.keras`). Las clases de salida son:
- `0`: Mano Abierta
- `1`: Mano Cerrada
- Confianza `< 60%`: Indeterminado / No seguro (solicita tomar otra foto con mejor luz).
