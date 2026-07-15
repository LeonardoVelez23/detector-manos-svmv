package com.detector.gateway.controller;

import com.detector.gateway.dto.InferenceResponse;
import com.detector.gateway.service.PythonInferenceClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class InferenceController {

    private final PythonInferenceClient pythonInferenceClient;

    public InferenceController(PythonInferenceClient pythonInferenceClient) {
        this.pythonInferenceClient = pythonInferenceClient;
    }

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok().body(java.util.Map.of("status", "ok", "service", "springboot-gateway"));
    }

    @PostMapping("/predict")
    public ResponseEntity<InferenceResponse> predict(
            @RequestParam(value = "image", required = false) MultipartFile image,
            @RequestParam(value = "image_url", required = false) String imageUrl
    ) {
        InferenceResponse response = pythonInferenceClient.predict(image, imageUrl);

        if (response == null) {
            return ResponseEntity.internalServerError()
                    .body(new InferenceResponse(null, null, null, "Respuesta vacía del microservicio Python."));
        }

        if (response.error() != null) {
            return ResponseEntity.badRequest().body(response);
        }

        return ResponseEntity.ok(response);
    }
}
