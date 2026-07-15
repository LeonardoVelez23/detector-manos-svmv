# Opción A: Angular + Java + microservicio Python (modelo `.p`)

Este proyecto puede funcionar como **microservicio de inferencia en Python** para que un backend en Java (Spring Boot) actúe como gateway/API principal.

## Flujo propuesto

1. Angular sube imagen al backend Java.
2. Java reenvía `multipart/form-data` al endpoint Python:
   - `POST /api/v1/inference/predict`
3. Python responde JSON con:
   - `classification`
   - `confidence`
   - opcionalmente `message` cuando la confianza es baja.
4. Java devuelve respuesta normalizada al frontend.

## Endpoints disponibles en Python

- `GET /health`
- `POST /api/v1/inference/predict`
- `POST /predict` (compatibilidad con frontend actual)

## Contrato de request (Python)

`multipart/form-data` con una de estas opciones:

- `image`: archivo local (`.jpg`, `.jpeg`, `.png`, `.webp`, `.bmp`)
- `image_url`: URL de una imagen

## Contrato de response (ejemplo)

```json
{
  "classification": "Abierta",
  "confidence": 0.94
}
```

Caso de baja confianza:

```json
{
  "classification": "No seguro",
  "confidence": 0.55,
  "message": "Toma otra foto con mejor luz y fondo simple."
}
```

## Siguiente paso sugerido

En Java, crear un cliente HTTP (WebClient/RestTemplate) que llame a `POST /api/v1/inference/predict` y centralizar autenticación, auditoría y rate limiting en Java.

## Implementación inicial incluida en este repositorio

- `springboot-gateway/`: gateway Java (Spring Boot) con endpoint `POST /api/predict` que reenvía al microservicio Python.
- `angular-frontend/`: frontend Angular base que consume el gateway en `http://localhost:8080/api/predict`.
