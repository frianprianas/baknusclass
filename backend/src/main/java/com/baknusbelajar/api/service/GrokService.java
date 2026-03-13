package com.baknusbelajar.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

/**
 * Fallback AI service that supports both OpenAI and Grok (xAI) APIs.
 * Both use the same OpenAI-compatible chat completions format.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GrokService {

    private final WebClient webClient;
    private final AppSettingService appSettingService;

    @Value("${fallback-ai.api-key:}")
    private String apiKey;

    @Value("${fallback-ai.model:gpt-4o-mini}")
    private String model;

    @Value("${fallback-ai.base-url:https://api.openai.com/v1}")
    private String baseUrl;

    @Value("${fallback-ai.provider:openai}")
    private String provider;

    public boolean isAvailable() {
        String userKey = appSettingService.getSettingValue("ai_api_key", "");
        if (!userKey.trim().isEmpty())
            return true;
        return apiKey != null && !apiKey.trim().isEmpty();
    }

    public Mono<String> scoreEssay(String question, String answerKey, String studentAnswer) {
        String prompt = String.format(
                "Anda adalah asisten guru profesional. Tugas Anda adalah menilai jawaban essay siswa berdasarkan Kunci Jawaban yang diberikan.\n\n"
                        + "Pertanyaan: %s\n" +
                        "Kunci Jawaban: %s\n" +
                        "Jawaban Siswa: %s\n\n" +
                        "Berikan penilaian dalam format JSON mentah sebagai berikut:\n" +
                        "{\n" +
                        "  \"skor\": (angka 0-100),\n" +
                        "  \"alasan\": \"(penjelasan singkat mengapa siswa mendapat skor tersebut)\"\n" +
                        "}\n" +
                        "Kembalikan HANYA JSON tersebut.",
                question, answerKey, studentAnswer);

        return callApi(prompt);
    }

    @SuppressWarnings("unchecked")
    private Mono<String> callApi(String prompt) {
        if (!isAvailable()) {
            return Mono.error(new RuntimeException("Fallback AI (" + provider + ") API key not configured"));
        }

        // Check for user settings
        String userKey = appSettingService.getSettingValue("ai_api_key", "");
        String userProvider = appSettingService.getSettingValue("ai_priority_provider", provider);
        String userModel = appSettingService.getSettingValue("ai_model", model);

        String activeKey = (userKey == null || userKey.trim().isEmpty()) ? apiKey : userKey;

        // If we got here from Gemini falling back, we should check what's configured in
        // settings
        // If nothing special in settings, use the YML defaults (provider, model,
        // baseUrl)
        String activeProvider = (userProvider == null || userProvider.equalsIgnoreCase("gemini")) ? provider
                : userProvider;
        String activeModel = (userModel == null || userModel.trim().isEmpty()) ? model : userModel;
        String activeBaseUrl = baseUrl;

        if (activeProvider.equalsIgnoreCase("openai")) {
            activeBaseUrl = "https://api.openai.com/v1";
        } else if (activeProvider.equalsIgnoreCase("grok")) {
            activeBaseUrl = "https://api.x.ai/v1";
        }

        String url = activeBaseUrl + "/chat/completions";

        Map<String, Object> body = Map.of(
                "model", activeModel,
                "messages", List.of(
                        Map.of("role", "user", "content", prompt)),
                "temperature", 0.3);

        log.info("Calling fallback AI provider: {} with model: {}", activeProvider, activeModel);

        return webClient.post()
                .uri(url)
                .header("Authorization", "Bearer " + activeKey)
                .header("Content-Type", "application/json")
                .header("User-Agent",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .bodyValue(body)
                .retrieve()
                .onStatus(status -> status.isError(), response -> {
                    return response.bodyToMono(String.class)
                            .flatMap(errorBody -> {
                                log.error("Fallback AI Provider API Error Body: {}", errorBody);
                                return Mono.error(new RuntimeException(
                                        "Fallback AI returned " + response.statusCode() + ": " + errorBody));
                            });
                })
                .bodyToMono(Map.class)
                .map(response -> {
                    try {
                        List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
                        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                        String content = ((String) message.get("content")).trim();
                        log.info("Fallback AI ({}) response received successfully", provider);
                        return content;
                    } catch (Exception e) {
                        log.error("Error parsing {} response: {}", provider, response, e);
                        throw new RuntimeException("Failed to parse " + provider + " AI response: " + e.getMessage());
                    }
                })
                .onErrorResume(e -> {
                    log.error("{} API error: {}", provider, e.getMessage());
                    return Mono.error(e);
                });
    }
}
