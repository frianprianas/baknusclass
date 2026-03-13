package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.exam.JawabanSiswaDTO;
import com.baknusbelajar.api.entity.JawabanSiswa;
import com.baknusbelajar.api.entity.Siswa;
import com.baknusbelajar.api.entity.SoalEssay;
import com.baknusbelajar.api.repository.JawabanSiswaRepository;
import com.baknusbelajar.api.repository.SiswaRepository;
import com.baknusbelajar.api.repository.SoalEssayRepository;
import com.baknusbelajar.api.repository.SiswaUjianStatusRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class JawabanSiswaService {

    private final JawabanSiswaRepository jawabanSiswaRepository;
    private final SoalEssayRepository soalEssayRepository;
    private final SiswaRepository siswaRepository;
    private final GeminiService geminiService;
    private final ObjectMapper objectMapper;
    private final SiswaUjianStatusRepository siswaUjianStatusRepository;

    public List<JawabanSiswaDTO> getJawabanBySoal(Long soalId) {
        return jawabanSiswaRepository.findBySoalEssayId(soalId).stream()
                .map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<JawabanSiswaDTO> getJawabanBySiswa(Long siswaId) {
        return jawabanSiswaRepository.findBySiswaId(siswaId).stream()
                .map(this::mapToDTO).collect(Collectors.toList());
    }

    public List<JawabanSiswaDTO> getJawabanByUjian(Long ujianId) {
        List<JawabanSiswaDTO> responses = jawabanSiswaRepository.findBySoalEssay_UjianMapel_Id(ujianId).stream()
                .map(this::mapToDTO).collect(Collectors.toList());

        // Attach timing data
        responses.forEach(dto -> {
            if (dto.getSiswaId() != null) {
                siswaUjianStatusRepository.findBySiswaIdAndUjianMapelId(dto.getSiswaId(), ujianId)
                        .ifPresent(status -> {
                            dto.setWaktuMulaiUjian(status.getWaktuMulaiSiswa());
                            dto.setWaktuSelesaiUjian(status.getWaktuSelesai());
                            dto.setStatusSelesaiUjian(status.getStatusSelesai());
                        });
            }
        });

        return responses;
    }

    public JawabanSiswaDTO submitJawaban(JawabanSiswaDTO dto) {
        SoalEssay soal = soalEssayRepository.findById(dto.getSoalId())
                .orElseThrow(() -> new RuntimeException("Soal not found"));
        Siswa siswa = siswaRepository.findById(dto.getSiswaId())
                .orElseThrow(() -> new RuntimeException("Siswa not found"));

        JawabanSiswa entity = jawabanSiswaRepository.findBySiswaIdAndSoalEssayId(dto.getSiswaId(), dto.getSoalId())
                .orElse(new JawabanSiswa());

        entity.setSoalEssay(soal);
        entity.setSiswa(siswa);
        entity.setTeksJawaban(dto.getTeksJawaban());
        if (dto.getRaguRagu() != null) {
            entity.setRaguRagu(dto.getRaguRagu());
        }

        return mapToDTO(jawabanSiswaRepository.save(entity));
    }

    public JawabanSiswaDTO processAiScoringSync(Long jawabanId) {
        JawabanSiswa jawaban = jawabanSiswaRepository.findById(jawabanId)
                .orElseThrow(() -> new RuntimeException("Jawaban not found"));

        SoalEssay soal = jawaban.getSoalEssay();

        String aiResponse = null;
        try {
            aiResponse = geminiService
                    .scoreEssay(soal.getPertanyaan(), soal.getKunciJawaban(), jawaban.getTeksJawaban())
                    .block(); // Wait for AI Result

            if (aiResponse == null) {
                throw new RuntimeException("AI tidak memberikan respon (NULL)");
            }

            String cleanResponse = aiResponse;
            if (aiResponse.contains("```json")) {
                cleanResponse = aiResponse.substring(aiResponse.indexOf("```json") + 7);
                if (cleanResponse.contains("```")) {
                    cleanResponse = cleanResponse.substring(0, cleanResponse.indexOf("```"));
                }
            } else if (aiResponse.contains("```")) {
                cleanResponse = aiResponse.substring(aiResponse.indexOf("```") + 3);
                if (cleanResponse.contains("```")) {
                    cleanResponse = cleanResponse.substring(0, cleanResponse.indexOf("```"));
                }
            }

            cleanResponse = cleanResponse.trim();

            // If still not starting with {, try to find the first {
            if (!cleanResponse.startsWith("{") && cleanResponse.contains("{")) {
                cleanResponse = cleanResponse.substring(cleanResponse.indexOf("{"));
                if (cleanResponse.contains("}")) {
                    cleanResponse = cleanResponse.substring(0, cleanResponse.lastIndexOf("}") + 1);
                }
            }

            JsonNode root = objectMapper.readTree(cleanResponse);
            double skor = 0;
            if (root.has("skor")) {
                skor = root.get("skor").asDouble();
            } else if (root.has("score")) {
                skor = root.get("score").asDouble();
            }

            String alasan = "";
            if (root.has("alasan")) {
                alasan = root.get("alasan").asText();
            } else if (root.has("reason")) {
                alasan = root.get("reason").asText();
            }

            log.info("Synchronous AI Scoring completed for ID: {}, Skor: {}", jawabanId, skor);
            return updateNilai(jawabanId, skor, alasan, null);
        } catch (Exception e) {
            log.error("Failed to process synchronous AI scoring for ID: {}. AI Response was: {}", jawabanId, aiResponse,
                    e);
            String errorMessage = e.getMessage() != null ? e.getMessage() : e.toString();
            throw new RuntimeException("Gagal menganalisis jawaban: " + errorMessage);
        }
    }

    public JawabanSiswaDTO updateNilai(Long id, Double skorAi, String alasanAi, Double skorGuru) {
        JawabanSiswa entity = jawabanSiswaRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Jawaban not found"));

        if (skorAi != null)
            entity.setSkorAi(skorAi);
        if (alasanAi != null)
            entity.setAlasanAi(alasanAi);
        if (skorGuru != null)
            entity.setSkorFinalGuru(skorGuru);

        return mapToDTO(jawabanSiswaRepository.save(entity));
    }

    private JawabanSiswaDTO mapToDTO(JawabanSiswa entity) {
        JawabanSiswaDTO dto = new JawabanSiswaDTO();
        dto.setId(entity.getId());
        dto.setTeksJawaban(entity.getTeksJawaban());
        dto.setSkorAi(entity.getSkorAi());
        dto.setAlasanAi(entity.getAlasanAi());
        dto.setSkorFinalGuru(entity.getSkorFinalGuru());
        dto.setRaguRagu(entity.getRaguRagu());

        if (entity.getSiswa() != null) {
            dto.setSiswaId(entity.getSiswa().getId());
            dto.setNamaSiswa(entity.getSiswa().getNamaLengkap());

            String email = entity.getSiswa().getUser() != null ? entity.getSiswa().getUser().getEmail() : null;
            if (email != null && email.contains("@")) {
                dto.setNisn(email.substring(0, email.indexOf("@")));
            } else {
                dto.setNisn(entity.getSiswa().getNisn());
            }

            if (entity.getSiswa().getKelas() != null) {
                dto.setNamaKelas(entity.getSiswa().getKelas().getNamaKelas());
            } else {
                dto.setNamaKelas("Tanpa Kelas");
            }
        }

        if (entity.getSoalEssay() != null) {
            dto.setSoalId(entity.getSoalEssay().getId());
        }

        return dto;
    }
}
