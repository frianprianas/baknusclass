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
 * Fallback AI service that supports OpenAI, Grok (xAI), and Mistral AI APIs.
 * All use the same OpenAI-compatible chat completions format.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FallbackAiService {

    private final WebClient webClient;
    private final AppSettingService appSettingService;
    private final java.util.concurrent.atomic.AtomicInteger keyIndex = new java.util.concurrent.atomic.AtomicInteger(0);

    @Value("${fallback-ai.keys:}")
    private List<String> apiKeys;

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
        return !getActualKeys().isEmpty();
    }

    private String getCurrentKey() {
        String userKey = appSettingService.getSettingValue("ai_api_key", "");
        if (!userKey.trim().isEmpty()) {
            return userKey.trim();
        }
        List<String> actualKeys = getActualKeys();
        if (actualKeys.isEmpty()) {
            throw new RuntimeException("No Fallback AI keys configured");
        }
        int index = Math.abs(keyIndex.get()) % actualKeys.size();
        return actualKeys.get(index);
    }

    private List<String> getActualKeys() {
        if (apiKeys == null || apiKeys.isEmpty()) {
            return List.of();
        }
        java.util.List<String> actualKeys = new java.util.ArrayList<>();
        for (String key : apiKeys) {
            for (String splitKey : key.split(",")) {
                if (!splitKey.trim().isEmpty()) {
                    actualKeys.add(splitKey.trim());
                }
            }
        }
        return actualKeys;
    }

    public void rotateKey() {
        keyIndex.incrementAndGet();
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
        return Mono.defer(() -> {
            if (!isAvailable()) {
                return Mono.error(new RuntimeException("Fallback AI (" + provider + ") API key not configured"));
            }

            // Check for user settings
            String userProvider = appSettingService.getSettingValue("ai_priority_provider", provider);
            String userModel = appSettingService.getSettingValue("ai_model", model);

            String activeKey = getCurrentKey();

            // If we got here from Gemini falling back, we should check what's configured in
            // settings
            String activeProvider = (userProvider == null || userProvider.equalsIgnoreCase("gemini")) ? provider
                    : userProvider;
            String activeModel = userModel;
            String activeBaseUrl = baseUrl;

            if (activeProvider.equalsIgnoreCase("openai")) {
                activeBaseUrl = "https://api.openai.com/v1";
                if (activeModel == null || activeModel.trim().isEmpty())
                    activeModel = "gpt-4o-mini";
            } else if (activeProvider.equalsIgnoreCase("grok")) {
                activeBaseUrl = "https://api.x.ai/v1";
                if (activeModel == null || activeModel.trim().isEmpty())
                    activeModel = "grok-beta";
            } else if (activeProvider.equalsIgnoreCase("mistral") || activeProvider.equalsIgnoreCase("mistral ai")) {
                activeBaseUrl = "https://api.mistral.ai/v1";
                if (activeModel == null || activeModel.trim().isEmpty())
                    activeModel = "mistral-large-latest";
            }

            if (activeModel == null || activeModel.trim().isEmpty()) {
                activeModel = model;
            }

            String url = activeBaseUrl + "/chat/completions";

            java.util.Map<String, Object> body = new java.util.HashMap<>();
            body.put("model", activeModel);
            body.put("messages", java.util.List.of(
                    java.util.Map.of("role", "user", "content", prompt)));
            body.put("temperature", 0.3);

            log.info("Calling fallback AI provider: {} with model: {} via URL: {}", activeProvider, activeModel, url);

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
                            log.info("Fallback AI ({}) response received successfully", activeProvider);
                            return content;
                        } catch (Exception e) {
                            log.error("Error parsing {} response: {}", activeProvider, response, e);
                            throw new RuntimeException(
                                    "Failed to parse " + activeProvider + " AI response: " + e.getMessage());
                        }
                    });
        })
                .retryWhen(reactor.util.retry.Retry.max(1).filter(throwable -> {
                    rotateKey();
                    log.warn("Fallback AI API call failed. Rotating key and retrying... Error: {}",
                            throwable.getMessage());
                    return true;
                }))
                .onErrorResume(e -> {
                    log.error("Fallback AI error: {}", e.getMessage());
                    return Mono.error(e);
                });
    }
}
