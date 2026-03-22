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

    @Value("${fallback-ai.model:mistral-large-latest}")
    private String model;

    @Value("${fallback-ai.base-url:https://api.mistral.ai/v1}")
    private String baseUrl;

    @Value("${fallback-ai.provider:mistral}")
    private String provider;

    public boolean isAvailable() {
        String userKey = appSettingService.getSettingValue("ai_api_key", "");
        if (!userKey.trim().isEmpty())
            return true;
        return !getActualKeys().isEmpty();
    }

    private String getCurrentKey(boolean forceConfig) {
        if (!forceConfig) {
            String userKey = appSettingService.getSettingValue("ai_api_key", "");
            if (!userKey.trim().isEmpty()) {
                return userKey.trim();
            }
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
    public Mono<String> callApi(String prompt) {
        return Mono.deferContextual(context -> {
            if (!isAvailable()) {
                return Mono.error(new RuntimeException("Fallback AI (" + provider + ") API key not configured"));
            }

            // Check for user settings
            String userProvider = appSettingService.getSettingValue("ai_priority_provider", provider);
            String userModel = appSettingService.getSettingValue("ai_model", model);

            boolean useConfigOnly = context.getOrDefault("useConfigOnly", false);
            String activeKey = getCurrentKey(useConfigOnly);

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
                .onErrorResume(e -> {
                    String msg = e.getMessage() != null ? e.getMessage() : "";
                    if (msg.contains("401") || msg.contains("403")) {
                        log.warn("User Fallback AI Key is unauthorized/invalid. Retrying with System Config Keys...");
                        return callApi(prompt).contextWrite(ctx -> ctx.put("useConfigOnly", true));
                    }
                    return Mono.error(e);
                })
                .retryWhen(reactor.util.retry.Retry.max(1).filter(throwable -> {
                    rotateKey();
                    log.warn("Fallback AI API call failed. Rotating key and retrying... Error: {}",
                            throwable.getMessage());
                    return true;
                }));
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

        return callApi(prompt);
    }

    /**
     * Generates a personalized academic recommendation for a student.
     * 
     * @param namaSiswa     student's name
     * @param hasilPerMapel map of subject name -> score (0-100)
     */
    public Mono<String> saranNilaiSiswa(String namaSiswa, java.util.Map<String, Double> hasilPerMapel) {
        StringBuilder sb = new StringBuilder();
        sb.append("Anda adalah BaknusAI, asisten akademik cerdas untuk platform BaknusBelajar.\n");
        sb.append(
                "Tugas Anda adalah memberikan saran pembelajaran yang personal, empatik, dan memotivasi kepada siswa berdasarkan nilai ujian mereka.\n\n");
        sb.append("Nama Siswa: ").append(namaSiswa).append("\n");
        sb.append("Hasil Ujian:\n");
        for (var entry : hasilPerMapel.entrySet()) {
            sb.append("- Mata Pelajaran ").append(entry.getKey()).append(": ").append(entry.getValue())
                    .append(" / 100\n");
        }
        sb.append(
                "\nBerikan saran secara personal dan spesifik per mata pelajaran dalam Bahasa Indonesia yang sopan dan memotivasi. ");
        sb.append("Format respons:\n");
        sb.append("- Awali dengan sapaan hangat kepada siswa.\n");
        sb.append(
                "- Untuk SETIAP mata pelajaran, tulis satu paragraf berisi evaluasi dan saran peningkatan spesifik. ");
        sb.append("  Jika nilai >= 75, berikan apresiasi dan tantangan untuk mempertahankan. ");
        sb.append("  Jika nilai < 75, berikan saran konkret untuk meningkatkan kompetensi.\n");
        sb.append("- Akhiri dengan kalimat penyemangat yang general.\n");
        sb.append("- Panjang total: 150-300 kata. JANGAN gunakan format JSON. Tulis langsung sebagai teks saja.");

        return callApi(sb.toString());
    }

    /**
     * Deep personalized recommendation using full Q&A context per subject.
     */
    public Mono<String> saranNilaiSiswaMendalam(String namaSiswa,
            java.util.List<com.baknusbelajar.api.controller.exam.SaranNilaiController.HasilMapel> hasilPerMapel) {

        StringBuilder sb = new StringBuilder();
        sb.append("Anda adalah BaknusAI, asisten akademik cerdas dan empatik untuk platform BaknusBelajar.\n");
        sb.append(
                "Tugas Anda adalah memberikan evaluasi mendalam dan saran pembelajaran yang PERSONAL kepada siswa,\n");
        sb.append("bukan hanya berdasarkan nilai akhir, melainkan dari ISI JAWABAN siswa itu sendiri.\n\n");
        sb.append("Nama Siswa: ").append(namaSiswa).append("\n\n");

        for (var mapel : hasilPerMapel) {
            sb.append("=== MATA PELAJARAN: ").append(mapel.getNamaMapel())
                    .append(" (Nilai Akhir: ").append(mapel.getNilaiAkhir()).append("/100) ===\n");

            var daftar = mapel.getDaftarJawaban();
            if (daftar != null) {
                for (int i = 0; i < daftar.size(); i++) {
                    var item = daftar.get(i);
                    sb.append("Soal ").append(i + 1).append(": ").append(item.getSoal()).append("\n");
                    sb.append("Jawaban Siswa: ").append(item.getJawabSiswa()).append("\n");
                    if (item.getSkor() != null) {
                        sb.append("Skor: ").append(item.getSkor()).append(" / ").append(item.getBobotMaksimal())
                                .append("\n");
                    } else {
                        sb.append("Skor: Belum dinilai\n");
                    }
                    sb.append("\n");
                }
            }
        }

        sb.append("\n--- INSTRUKSI ---\n");
        sb.append("Tulis saran singkat (total maksimal 120 kata) dalam Bahasa Indonesia yang hangat dan langsung.\n");
        sb.append(
                "Format: Satu kalimat sapaan > satu kalimat evaluasi singkat per mapel (sebutkan satu kekuatan & satu kelemahan spesifik dari jawaban) > satu kalimat penutup motivasi.\n");
        sb.append("Gunakan nama siswa. JANGAN bertele-tele. Langsung ke intinya.");

        return callApi(sb.toString());
    }
}
