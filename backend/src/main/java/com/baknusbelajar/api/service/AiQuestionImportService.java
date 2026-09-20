package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.exam.DraftSoalDTO;
import com.baknusbelajar.api.entity.SoalEssay;
import com.baknusbelajar.api.entity.SoalPG;
import com.baknusbelajar.api.entity.UjianMapel;
import com.baknusbelajar.api.repository.SoalEssayRepository;
import com.baknusbelajar.api.repository.SoalPGRepository;
import com.baknusbelajar.api.repository.UjianMapelRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiQuestionImportService {

    private final UjianMapelRepository ujianMapelRepository;
    private final SoalPGRepository soalPGRepository;
    private final SoalEssayRepository soalEssayRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${aivene.api.key:isk-osSJSB8LQ4ytRuRkKMX1B3Vj1dUoJBubnpcpTR0m}")
    private String aiveneApiKey;

    @Value("${aivene.model:gemini-2.5-flash}")
    private String aiveneModel;

    @Value("${aivene.api.url:https://api.aivene.com/v1/chat/completions}")
    private String aiveneApiUrl;

    public String extractTextFromDocx(InputStream inputStream) {
        StringBuilder sb = new StringBuilder();
        try (XWPFDocument doc = new XWPFDocument(inputStream)) {
            // Read paragraphs
            for (XWPFParagraph p : doc.getParagraphs()) {
                String text = p.getText();
                if (text != null && !text.trim().isEmpty()) {
                    sb.append(text).append("\n");
                }
            }
            // Read tables
            for (XWPFTable table : doc.getTables()) {
                for (XWPFTableRow row : table.getRows()) {
                    List<String> cells = new ArrayList<>();
                    for (XWPFTableCell cell : row.getTableCells()) {
                        cells.add(cell.getText().trim());
                    }
                    sb.append(String.join(" | ", cells)).append("\n");
                }
            }
        } catch (Exception e) {
            log.error("Error reading docx stream: ", e);
            throw new RuntimeException("Gagal membaca file Word (.docx): " + e.getMessage());
        }
        return sb.toString();
    }

    public List<DraftSoalDTO> extractQuestions(MultipartFile file, String rawText) {
        String documentText = "";
        if (file != null && !file.isEmpty()) {
            try {
                documentText = extractTextFromDocx(file.getInputStream());
            } catch (Exception e) {
                log.error("Error extracting file: ", e);
                throw new RuntimeException("Gagal memproses file Word: " + e.getMessage());
            }
        }

        if (documentText.trim().isEmpty() && rawText != null && !rawText.trim().isEmpty()) {
            documentText = rawText.trim();
        }

        if (documentText.trim().isEmpty()) {
            throw new IllegalArgumentException("Naskah soal kosong. Mohon unggah file .docx atau tempel teks soal.");
        }

        String prompt = buildAiExtractionPrompt(documentText);
        log.info("[Aivene AI] Extracting questions from document text (Length: {} chars)", documentText.length());

        String aiResponse = callAiveneChatCompletions(prompt);
        if (aiResponse == null || aiResponse.trim().isEmpty()) {
            throw new RuntimeException("AI Aivene tidak memberikan respon ekstraksi.");
        }

        return parseAiResponseToDrafts(aiResponse);
    }

    private String callAiveneChatCompletions(String prompt) {
        String activeKey = (aiveneApiKey != null && !aiveneApiKey.trim().isEmpty())
                ? aiveneApiKey.trim()
                : "isk-osSJSB8LQ4ytRuRkKMX1B3Vj1dUoJBubnpcpTR0m";
        String activeModel = (aiveneModel != null && !aiveneModel.trim().isEmpty())
                ? aiveneModel.trim()
                : "gemini-2.5-flash";
        String apiUrl = (aiveneApiUrl != null && !aiveneApiUrl.trim().isEmpty())
                ? aiveneApiUrl.trim()
                : "https://api.aivene.com/v1/chat/completions";

        log.info("[Aivene AI] Connecting to {} with model: {} and key: {}...", apiUrl, activeModel,
                activeKey.length() > 8 ? activeKey.substring(0, 7) + "..." : "***");

        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(30))
                    .build();

            Map<String, Object> requestPayload = Map.of(
                    "model", activeModel,
                    "messages", List.of(
                            Map.of("role", "user", "content", prompt)
                    )
            );

            String requestBodyJson = objectMapper.writeValueAsString(requestPayload);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + activeKey)
                    .timeout(Duration.ofMinutes(3))
                    .POST(HttpRequest.BodyPublishers.ofString(requestBodyJson, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (response.statusCode() != 200) {
                log.error("[Aivene AI] HTTP Error {}: {}", response.statusCode(), response.body());
                throw new RuntimeException("Aivene API returned HTTP " + response.statusCode() + ": " + response.body());
            }

            JsonNode rootNode = objectMapper.readTree(response.body());
            JsonNode choices = rootNode.path("choices");
            if (!choices.isArray() || choices.isEmpty()) {
                log.error("[Aivene AI] No choices in response: {}", response.body());
                throw new RuntimeException("Respon Aivene tidak memuat pilihan jawaban (choices kosong).");
            }

            String content = choices.get(0).path("message").path("content").asText();
            if (content == null || content.trim().isEmpty()) {
                throw new RuntimeException("AI Aivene memberikan konten jawaban kosong.");
            }

            log.info("[Aivene AI] Extraction response received successfully ({} chars)", content.length());
            return content.trim();

        } catch (Exception e) {
            log.error("[Aivene AI] Communication error: ", e);
            throw new RuntimeException("Gagal menghubungi layanan AI Aivene: " + e.getMessage(), e);
        }
    }

    private String buildAiExtractionPrompt(String documentText) {
        return "Anda adalah asisten AI profesional untuk sistem CBT Ujian Sekolah (BaknusClass).\n"
                + "Tugas Anda adalah membaca dan menganalisis naskah bank soal berikut ini, lalu menguraikannya (ekstraksi) ke dalam format JSON array yang rapi dan terstruktur.\n\n"
                + "Format tipe soal yang harus dideteksi:\n"
                + "1. PG_BIASA: Pilihan Ganda dengan 1 kunci jawaban.\n"
                + "   - pilihanA, pilihanB, pilihanC, pilihanD, pilihanE (jika 4 opsi, pilihanE diisi '-')\n"
                + "   - kunciJawaban: huruf tunggal kapital (misal: 'A', 'B', 'C', 'D', 'E')\n"
                + "2. PG_KOMPLEKS: Pilihan Ganda lebih dari 1 kunci jawaban benar.\n"
                + "   - kunciJawaban: huruf kapital dipisah koma (misal: 'A,C' atau 'B,D,E')\n"
                + "3. BENAR_SALAH: Soal Benar / Salah tunggal.\n"
                + "   - pilihanA: 'Benar', pilihanB: 'Salah', pilihanC: '-', pilihanD: '-', pilihanE: '-'\n"
                + "   - kunciJawaban: 'A' jika Benar, 'B' jika Salah\n"
                + "4. BS_MAJEMUK: Tabel Benar / Salah (matriks butir pernyataan).\n"
                + "   - pilihanA: Teks butir pernyataan 1\n"
                + "   - pilihanB: Teks butir pernyataan 2\n"
                + "   - pilihanC: Teks butir pernyataan 3 (atau '-' jika tidak ada)\n"
                + "   - pilihanD: Teks butir pernyataan 4 (atau '-' jika tidak ada)\n"
                + "   - pilihanE: Teks butir pernyataan 5 (atau '-' jika tidak ada)\n"
                + "   - kunciJawaban: status kunci masing-masing butir (huruf B untuk Benar, S untuk Salah, dipisah koma. Contoh: 'B,S,B' atau 'B,B,S,B')\n"
                + "5. ESSAY: Soal Uraian / Essay.\n"
                + "   - kunciJawaban: Kunci jawaban atau pedoman penskoran essay\n"
                + "   - pilihanA sampai E diisi '-'\n\n"
                + "Instruksi Penting:\n"
                + "1. Pisahkan setiap nomor soal dengan rapi.\n"
                + "2. Jika ada teks bacaan/stimulus yang berlaku untuk beberapa nomor soal, sertakan teks bacaan tersebut di awal teks pertanyaan nomor bersangkutan agar utuh.\n"
                + "3. Deteksi kunci jawaban jika terdapat tanda bold, garis bawah, centang, atau lampiran kunci jawaban di naskah. Jika tidak ada kunci, berikan estimasi terbaik atau default 'A'.\n"
                + "4. Berikan bobotNilai default 2.0 (atau sesuaikan jika tertulis skor pada soal).\n"
                + "5. Berikan output HANYA berupa JSON Array valid murni tanpa markdown triple backticks atau penjelasan lainnya.\n\n"
                + "Format JSON yang wajib diikuti:\n"
                + "[\n"
                + "  {\n"
                + "    \"nomor\": 1,\n"
                + "    \"tipeSoal\": \"PG_BIASA\",\n"
                + "    \"pertanyaan\": \"Teks pertanyaan lengkap...\",\n"
                + "    \"pilihanA\": \"Teks opsi A\",\n"
                + "    \"pilihanB\": \"Teks opsi B\",\n"
                + "    \"pilihanC\": \"Teks opsi C\",\n"
                + "    \"pilihanD\": \"Teks opsi D\",\n"
                + "    \"pilihanE\": \"Teks opsi E\",\n"
                + "    \"kunciJawaban\": \"A\",\n"
                + "    \"bobotNilai\": 2.0\n"
                + "  }\n"
                + "]\n\n"
                + "Naskah Soal:\n---\n"
                + documentText
                + "\n---";
    }

    private List<DraftSoalDTO> parseAiResponseToDrafts(String aiResponse) {
        String cleanJson = aiResponse.trim();
        String backticks = "" + (char)96 + (char)96 + (char)96;
        if (cleanJson.startsWith(backticks + "json")) {
            cleanJson = cleanJson.substring(7);
        } else if (cleanJson.startsWith(backticks)) {
            cleanJson = cleanJson.substring(3);
        }
        if (cleanJson.endsWith(backticks)) {
            cleanJson = cleanJson.substring(0, cleanJson.length() - 3);
        }
        cleanJson = cleanJson.trim();

        // If wrapped in object e.g. { "soal": [...] }
        if (cleanJson.startsWith("{") && cleanJson.contains("[")) {
            int arrayStart = cleanJson.indexOf("[");
            int arrayEnd = cleanJson.lastIndexOf("]");
            if (arrayStart != -1 && arrayEnd != -1) {
                cleanJson = cleanJson.substring(arrayStart, arrayEnd + 1);
            }
        }

        try {
            List<DraftSoalDTO> list = objectMapper.readValue(cleanJson, new TypeReference<List<DraftSoalDTO>>() {});
            // Normalize items
            int num = 1;
            for (DraftSoalDTO d : list) {
                if (d.getNomor() == null) d.setNomor(num);
                if (d.getBobotNilai() == null || d.getBobotNilai() <= 0) d.setBobotNilai(2.0);
                if (d.getTipeSoal() == null || d.getTipeSoal().isEmpty()) d.setTipeSoal("PG_BIASA");
                if (d.getPilihanA() == null) d.setPilihanA("-");
                if (d.getPilihanB() == null) d.setPilihanB("-");
                if (d.getPilihanC() == null) d.setPilihanC("-");
                if (d.getPilihanD() == null) d.setPilihanD("-");
                if (d.getPilihanE() == null) d.setPilihanE("-");
                if (d.getKunciJawaban() == null) d.setKunciJawaban("A");
                num++;
            }
            return list;
        } catch (Exception e) {
            log.error("Failed to parse AI JSON response: {}. Error: {}", cleanJson, e.getMessage());
            throw new RuntimeException("Gagal menguraikan hasil JSON AI: " + e.getMessage());
        }
    }

    @Transactional
    @CacheEvict(value = "soalPGCache", allEntries = true)
    public int saveBatchQuestions(Long ujianId, List<DraftSoalDTO> draftList) {
        UjianMapel ujian = ujianMapelRepository.findById(ujianId)
                .orElseThrow(() -> new RuntimeException("Ujian tidak ditemukan dengan ID: " + ujianId));

        if (draftList == null || draftList.isEmpty()) {
            return 0;
        }

        int count = 0;
        List<SoalPG> pgList = new ArrayList<>();
        List<SoalEssay> essayList = new ArrayList<>();

        for (DraftSoalDTO d : draftList) {
            if (d.getPertanyaan() == null || d.getPertanyaan().trim().isEmpty()) {
                continue;
            }

            if ("ESSAY".equalsIgnoreCase(d.getTipeSoal())) {
                SoalEssay se = new SoalEssay();
                se.setUjianMapel(ujian);
                se.setPertanyaan(d.getPertanyaan().trim());
                se.setKunciJawaban(d.getKunciJawaban() != null && !d.getKunciJawaban().trim().isEmpty() ? d.getKunciJawaban().trim() : "-");
                se.setBobotNilai(d.getBobotNilai() != null && d.getBobotNilai() > 0 ? d.getBobotNilai() : 10.0);
                essayList.add(se);
            } else {
                SoalPG pg = new SoalPG();
                pg.setUjianMapel(ujian);
                pg.setPertanyaan(d.getPertanyaan().trim());
                String tipe = (d.getTipeSoal() != null && !d.getTipeSoal().trim().isEmpty()) ? d.getTipeSoal().trim().toUpperCase() : "PG_BIASA";
                String pilA = (d.getPilihanA() != null && !d.getPilihanA().trim().isEmpty()) ? d.getPilihanA().trim() : "-";
                String pilB = (d.getPilihanB() != null && !d.getPilihanB().trim().isEmpty()) ? d.getPilihanB().trim() : "-";
                String pilC = (d.getPilihanC() != null && !d.getPilihanC().trim().isEmpty()) ? d.getPilihanC().trim() : "-";
                String pilD = (d.getPilihanD() != null && !d.getPilihanD().trim().isEmpty()) ? d.getPilihanD().trim() : "-";
                String pilE = (d.getPilihanE() != null && !d.getPilihanE().trim().isEmpty()) ? d.getPilihanE().trim() : "-";
                if ("BENAR_SALAH".equalsIgnoreCase(tipe)) {
                    if (pilA.equals("-")) pilA = "Benar";
                    if (pilB.equals("-")) pilB = "Salah";
                }
                pg.setTipeSoal(tipe);
                pg.setPilihanA(pilA);
                pg.setPilihanB(pilB);
                pg.setPilihanC(pilC);
                pg.setPilihanD(pilD);
                pg.setPilihanE(pilE);
                pg.setKunciJawaban(d.getKunciJawaban() != null && !d.getKunciJawaban().trim().isEmpty() ? d.getKunciJawaban().trim() : "A");
                pg.setBobotNilai(d.getBobotNilai() != null && d.getBobotNilai() > 0 ? d.getBobotNilai() : 2.0);
                pgList.add(pg);
            }
            count++;
        }

        if (!pgList.isEmpty()) {
            soalPGRepository.saveAll(pgList);
        }
        if (!essayList.isEmpty()) {
            soalEssayRepository.saveAll(essayList);
        }

        log.info("Successfully batch saved {} questions ({} PG, {} Essay) for ujianId={}",
                count, pgList.size(), essayList.size(), ujianId);
        return count;
    }
}
