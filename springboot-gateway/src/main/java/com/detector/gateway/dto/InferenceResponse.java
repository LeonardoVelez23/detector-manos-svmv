package com.detector.gateway.dto;

public record InferenceResponse(
        String classification,
        Double confidence,
        String message,
        String error
) {
}
