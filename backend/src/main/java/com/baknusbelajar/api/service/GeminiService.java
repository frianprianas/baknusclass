package com.baknusbelajar.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class GeminiService {

    private final WebClient webClient;
    private final FallbackAiService fallbackAiService;
    private final AppSettingService appSettingService;
    private final AtomicInteger keyIndex = new AtomicInteger(0);

    @Value("${gemini.keys:}")
    private List<String> apiKeys;

    @Value("${gemini.model:gemini-1.5-flash}")
    private String model;

    public String getCurrentKey() {
        // Check for user-configured key in database first
        String userKey = appSettingService.getSettingValue("ai_api_key", "");
        if (!userKey.trim().isEmpty()) {
            log.info("Using AI API Key from Database Setting 'ai_api_key'");
            return userKey.trim();
        }

        List<String> actualKeys = getActualKeys();
        if (actualKeys.isEmpty()) {
            log.error("No Gemini API keys found. Configuration: {}", apiKeys);
            throw new RuntimeException("No Gemini API keys configured");
        }
        int index = Math.abs(keyIndex.get()) % actualKeys.size();
        log.info("Using AI API Key index: {} of total keys: {}", index, actualKeys.size());
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

        String priority = appSettingService.getSettingValue("ai_priority_provider", "gemini");

        if (priority.equalsIgnoreCase("gemini")) {
            return doScoreGemini(prompt, question, answerKey, studentAnswer);
        } else {
            return doScoreFallback(prompt, question, answerKey, studentAnswer, true);
        }
    }

    private Mono<String> doScoreGemini(String prompt, String question, String answerKey, String studentAnswer) {
        return callGemini(prompt)
                .retryWhen(reactor.util.retry.Retry.max(2).filter(throwable -> {
                    rotateKey();
                    log.warn("Gemini API call failed. Rotating key and retrying... Error: {}", throwable.getMessage());
                    return true;
                }))
                .onErrorResume(geminiError -> {
                    log.warn("Gemini exhausted. Error: {}. Attempting fallback to other services...",
                            geminiError.getMessage());
                    return doScoreFallback(prompt, question, answerKey, studentAnswer, false);
                });
    }

    private Mono<String> doScoreFallback(String prompt, String question, String answerKey, String studentAnswer,
            boolean tryGeminiNext) {
        if (fallbackAiService.isAvailable()) {
            return fallbackAiService.scoreEssay(question, answerKey, studentAnswer)
                    .doOnSuccess(r -> log.info("Fallback AI succeeded!"))
                    .onErrorResume(error -> {
                        if (tryGeminiNext) {
                            log.warn("Fallback AI failed. Trying Gemini...");
                            return doScoreGemini(prompt, question, answerKey, studentAnswer);
                        }
                        return Mono.error(new RuntimeException("Semua layanan AI gagal. " + error.getMessage()));
                    });
        } else if (tryGeminiNext) {
            return doScoreGemini(prompt, question, answerKey, studentAnswer);
        } else {
            return Mono.error(new RuntimeException("Layanan AI tidak tersedia atau konfigurasi salah."));
        }
    }

    private Mono<String> callGemini(String prompt) {
        return Mono.defer(() -> {
            String apiKey = getCurrentKey();
            String userModel = appSettingService.getSettingValue("ai_model", "");
            String activeModel = (userModel != null && !userModel.trim().isEmpty()) ? userModel : model;

            if (userModel != null && !userModel.trim().isEmpty()) {
                log.info("Using Gemini Model from Database: {}", activeModel);
            } else {
                log.info("Using Gemini Model from Config (YML): {}", activeModel);
            }

            // Use v1beta as it is required for gemini-2.5-flash and other newer models in
            // this region
            String url = "https://generativelanguage.googleapis.com/v1beta/models/" + activeModel
                    + ":generateContent?key="
                    + apiKey;

            String maskedUrl = url.replace(apiKey,
                    apiKey.substring(0, 5) + "..." + apiKey.substring(apiKey.length() - 4));
            log.info("Calling Gemini API: {}", maskedUrl);

            Map<String, Object> body = Map.of(
                    "contents", List.of(
                            Map.of("parts", List.of(
                                    Map.of("text", prompt)))));

            return webClient.post()
                    .uri(url)
                    .bodyValue(body)
                    .retrieve()
                    .onStatus(status -> status.isError(), response -> {
                        return response.bodyToMono(String.class)
                                .flatMap(errorBody -> {
                                    log.error("Gemini API Error Body: {}", errorBody);
                                    return Mono.error(new RuntimeException(
                                            "Gemini returned " + response.statusCode() + ": " + errorBody));
                                });
                    })
                    .bodyToMono(Map.class)
                    .map(response -> {
                        try {
                            log.debug("Gemini response: {}", response);
                            @SuppressWarnings("unchecked")
                            List<Map<String, Object>> candidates = (List<Map<String, Object>>) response
                                    .get("candidates");

                            if (candidates == null || candidates.isEmpty()) {
                                log.error("Gemini returned no candidates. Possible safety filter block. Response: {}",
                                        response);
                                throw new RuntimeException(
                                        "AI tidak memberikan jawaban (kemungkinan terfilter oleh sistem keamanan AI)");
                            }

                            Map<String, Object> firstCandidate = candidates.get(0);
                            String finishReason = (String) firstCandidate.get("finishReason");

                            if (finishReason != null && !finishReason.equals("STOP")
                                    && !finishReason.equals("MAX_TOKENS")) {
                                log.warn("Gemini finish reason: {}", finishReason);
                                if (finishReason.equals("SAFETY")) {
                                    throw new RuntimeException("Konten diblokir oleh filter keamanan AI");
                                }
                            }

                            @SuppressWarnings("unchecked")
                            Map<String, Object> content = (Map<String, Object>) firstCandidate.get("content");
                            if (content == null || !content.containsKey("parts")) {
                                throw new RuntimeException("Format konten dari AI tidak sesuai");
                            }

                            @SuppressWarnings("unchecked")
                            List<Map<String, String>> parts = (List<Map<String, String>>) content.get("parts");
                            if (parts == null || parts.isEmpty()) {
                                throw new RuntimeException("Konten AI kosong");
                            }

                            return parts.get(0).get("text").trim();
                        } catch (RuntimeException re) {
                            throw re;
                        } catch (Exception e) {
                            log.error("Error parsing Gemini response", e);
                            throw new RuntimeException("Gagal memproses jawaban AI: " + e.getMessage());
                        }
                    });
        })
                .onErrorResume(e -> {
                    log.error("Gemini API error (Key rotated?): {}", e.getMessage());
                    return Mono.error(e);
                });
    }
}
