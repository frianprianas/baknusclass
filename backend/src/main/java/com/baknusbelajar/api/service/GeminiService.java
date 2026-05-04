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

    public String getCurrentKey(boolean forceConfig) {
        if (!forceConfig) {
            String userKey = appSettingService.getSettingValue("ai_api_key", "");
            if (!userKey.trim().isEmpty()) {
                log.info("Using AI API Key from Database Setting 'ai_api_key'");
                return userKey.trim();
            }
        }

        List<String> actualKeys = getActualKeys();
        if (actualKeys.isEmpty()) {
            log.error("No Gemini API keys found. Configuration: {}", apiKeys);
            throw new RuntimeException("No Gemini API keys configured");
        }
        int index = Math.abs(keyIndex.get()) % actualKeys.size();
        log.info("Using System Config AI API Key (index: {} of {})", index, actualKeys.size());
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

    private String buildPrompt(String question, String answerKey, String studentAnswer) {
        boolean hasAnswerKey = answerKey != null && !answerKey.trim().isEmpty() && !answerKey.trim().equals("-");

        if (hasAnswerKey) {
            return String.format(
                    "Anda adalah asisten guru profesional. Tugas Anda adalah menilai jawaban essay siswa berdasarkan Kunci Jawaban yang diberikan.\n\n"
                            + "Pertanyaan: %s\n" +
                            "Kunci Jawaban: %s\n" +
                            "Jawaban Siswa: %s\n\n" +
                            "Berikan penilaian dalam format JSON mentah sebagai berikut:\n" +
                            "{\n" +
                            "  \"skor\": (angka 0-100),\n" +
                            "  \"alasan\": \"(penjelasan singkat mengapa siswa mendapat skor tersebut, merujuk pada kunci jawaban)\"\n" +
                            "}\n" +
                            "Kembalikan HANYA JSON tersebut.",
                    question, answerKey, studentAnswer);
        } else {
            return String.format(
                    "Anda adalah asisten guru profesional. Tugas Anda adalah menilai jawaban essay siswa. "
                            + "Tidak ada kunci jawaban yang disediakan, sehingga penilaian harus dilakukan secara kontekstual "
                            + "berdasarkan relevansi, kelengkapan, kelogisan, dan kualitas jawaban siswa terhadap pertanyaan yang diberikan.\n\n"
                            + "Pertanyaan: %s\n" +
                            "Jawaban Siswa: %s\n\n" +
                            "Berikan penilaian dalam format JSON mentah sebagai berikut:\n" +
                            "{\n" +
                            "  \"skor\": (angka 0-100),\n" +
                            "  \"alasan\": \"(penjelasan singkat mengapa siswa mendapat skor tersebut berdasarkan kualitas dan relevansi jawaban)\"\n" +
                            "}\n" +
                            "Kembalikan HANYA JSON tersebut.",
                    question, studentAnswer);
        }
    }

    public Mono<String> scoreEssay(String question, String answerKey, String studentAnswer) {
        String prompt = buildPrompt(question, answerKey, studentAnswer);

        String priority = appSettingService.getSettingValue("ai_priority_provider", "gemini");

        if (priority.equalsIgnoreCase("gemini")) {
            return doScoreGemini(prompt, question, answerKey, studentAnswer);
        } else {
            return doScoreFallback(prompt, question, answerKey, studentAnswer, true);
        }
    }

    public Mono<String> scoreEssayDirect(String question, String answerKey, String studentAnswer) {
        String prompt = buildPrompt(question, answerKey, studentAnswer);
        return doScoreGemini(prompt, question, answerKey, studentAnswer);
    }

    private Mono<String> doScoreGemini(String prompt, String question, String answerKey, String studentAnswer) {
        return callGemini(prompt)
                .onErrorResume(geminiError -> {
                    String msg = geminiError.getMessage() != null ? geminiError.getMessage() : "";
                    if (msg.contains("400") && msg.contains("API key not valid")) {
                        log.warn("User AI API Key is invalid. Retrying with System Config Keys...");
                        return callGemini(prompt).contextWrite(ctx -> ctx.put("useConfigOnly", true));
                    }
                    return Mono.error(geminiError);
                })
                .retryWhen(reactor.util.retry.Retry.max(2).filter(throwable -> {
                    rotateKey();
                    log.warn("Gemini API call failed. Rotating key and retrying... Error: {}", throwable.getMessage());
                    return true;
                }))
                .onErrorResume(finalError -> {
                    log.error("Gemini Error Final: {}. Attempting fallback to other services...",
                            finalError.getMessage());
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

    public Mono<String> callGemini(String prompt) {
        return Mono.deferContextual(ctx -> {
            boolean useConfigOnly = ctx.getOrDefault("useConfigOnly", false);
            log.info("callGemini Debug: useConfigOnly={}", useConfigOnly);
            String apiKey = getCurrentKey(useConfigOnly);
            String userModel = appSettingService.getSettingValue("ai_model", "");
            String activeModel = (userModel != null && !userModel.trim().isEmpty()) ? userModel : model;

            if (userModel != null && !userModel.trim().isEmpty()) {
                log.info("Using Gemini Model from Database: {}", activeModel);
            } else {
                log.info("Using Gemini Model from Config (YML): {}", activeModel);
            }

            // Use v1 for stable models
            String url = "https://generativelanguage.googleapis.com/v1/models/" + activeModel
                    + ":generateContent?key="
                    + apiKey;

            log.info("Gemini Full URL: {}", url.replace(apiKey, "REDACTED"));

            String maskedApiKey = apiKey.substring(0, 5) + "..." + apiKey.substring(apiKey.length() - 4);
            log.info("Calling Gemini API with model: {} and key: {}", activeModel, maskedApiKey);
            log.debug("Prompt segment: {}...", prompt.length() > 50 ? prompt.substring(0, 50) : prompt);

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

                            String text = parts.get(0).get("text");
                            if (text == null || text.trim().isEmpty()) {
                                throw new RuntimeException("AI memberikan jawaban kosong");
                            }
                            return text.trim();
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

    public Mono<String> analyzeForum(String topicTitle, String topicContent, String commentsTranscript) {
        String prompt = String.format(
                "Anda adalah asisten AI pendidikan yang cerdas. Tugas Anda adalah meringkas hasil diskusi forum dan menganalisis kontribusi siswa.\n\n"
                        + "Topik Diskusi: %s\n" +
                        "Isi Topik: %s\n" +
                        "Daftar Komentar (Transkrip):\n%s\n\n" +
                        "Berikan analisis dalam format JSON mentah sebagai berikut:\n" +
                        "{\n" +
                        "  \"ringkasan\": \"(ringkasan padat dan jelas tentang apa yang didiskusikan dan apa kesimpulannya)\",\n"
                        +
                        "  \"userPalingAktif\": [\n" +
                        "    { \"nama\": \"(nama siswa)\", \"jumlahPesan\": (angka pesan) }\n" +
                        "  ],\n" +
                        "  \"kontributorTerbaik\": [\n" +
                        "    { \"nama\": \"(nama siswa)\", \"alasan\": \"(alasan mengapa dia dipilih sebagai kontributor terbaik, misalnya karena memberikan jawaban yang benar, pendapat yang solutif, dsb)\" }\n"
                        +
                        "  ]\n" +
                        "}\n" +
                        "Amati dengan seksama mana jawaban yang benar atau pendapat yang paling berbobot. HANYA kembalikan JSON mentah tersebut.",
                topicTitle, topicContent, commentsTranscript);

        String priority = appSettingService.getSettingValue("ai_priority_provider", "gemini");

        if (priority.equalsIgnoreCase("gemini")) {
            return callGemini(prompt)
                    .onErrorResume(e -> {
                        if (fallbackAiService.isAvailable()) {
                            return fallbackAiService.analyzeForum(topicTitle, topicContent, commentsTranscript);
                        }
                        return Mono.error(e);
                    });
        } else {
            if (fallbackAiService.isAvailable()) {
                return fallbackAiService.analyzeForum(topicTitle, topicContent, commentsTranscript);
            } else {
                return callGemini(prompt);
            }
        }
    }
}
