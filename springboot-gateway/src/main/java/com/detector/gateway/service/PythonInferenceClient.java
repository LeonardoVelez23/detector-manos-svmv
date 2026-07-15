package com.detector.gateway.service;

import com.detector.gateway.dto.InferenceResponse;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

@Service
public class PythonInferenceClient {

    private final WebClient pythonWebClient;

    public PythonInferenceClient(WebClient pythonWebClient) {
        this.pythonWebClient = pythonWebClient;
    }

    public InferenceResponse predict(MultipartFile image, String imageUrl) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

        if (image != null && !image.isEmpty()) {
            try {
                ByteArrayResource resource = new NamedByteArrayResource(
                        image.getBytes(),
                        image.getOriginalFilename() == null ? "upload.jpg" : image.getOriginalFilename()
                );
                body.add("image", resource);
            } catch (Exception e) {
                return new InferenceResponse(null, null, null, "No se pudo leer el archivo en gateway.");
            }
        } else if (imageUrl != null && !imageUrl.isBlank()) {
            body.add("image_url", imageUrl);
        } else {
            return new InferenceResponse(null, null, null, "Debes enviar image o image_url.");
        }

        return pythonWebClient.post()
                .uri("/api/v1/inference/predict")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(body))
                .retrieve()
                .bodyToMono(InferenceResponse.class)
                .onErrorReturn(new InferenceResponse(null, null, null, "Error llamando al microservicio Python."))
                .block();
    }

    private static final class NamedByteArrayResource extends ByteArrayResource {

        private final String filename;

        private NamedByteArrayResource(byte[] byteArray, String filename) {
            super(byteArray);
            this.filename = filename;
        }

        @Override
        public String getFilename() {
            return filename;
        }
    }
}
