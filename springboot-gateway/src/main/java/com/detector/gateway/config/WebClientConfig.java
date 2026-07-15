package com.detector.gateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Bean
    public WebClient pythonWebClient(
            @Value("${python.inference.base-url:http://localhost:5000}") String pythonBaseUrl
    ) {
        return WebClient.builder()
                .baseUrl(pythonBaseUrl)
                .build();
    }
}
