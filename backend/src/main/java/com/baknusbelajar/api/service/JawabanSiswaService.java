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
import com.baknusbelajar.api.repository.UjianMapelRepository;
import com.baknusbelajar.api.entity.UjianMapel;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import java.io.ByteArrayOutputStream;

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
    private final UjianMapelRepository ujianMapelRepository;
    private final BaknusDriveService baknusDriveService;

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

            if (aiResponse == null || aiResponse.trim().isEmpty()) {
                throw new RuntimeException("AI tidak memberikan respon (NULL atau Kosong)");
            }

            log.debug("AI Raw Response: {}", aiResponse);
            String cleanResponse = aiResponse.trim();

            // Extract JSON from markdown
            if (cleanResponse.contains("```json")) {
                cleanResponse = cleanResponse.substring(cleanResponse.indexOf("```json") + 7);
                if (cleanResponse.contains("```")) {
                    cleanResponse = cleanResponse.substring(0, cleanResponse.indexOf("```"));
                }
            } else if (cleanResponse.contains("```")) {
                cleanResponse = cleanResponse.substring(cleanResponse.indexOf("```") + 3);
                if (cleanResponse.contains("```")) {
                    cleanResponse = cleanResponse.substring(0, cleanResponse.indexOf("```"));
                }
            }
            cleanResponse = cleanResponse.trim();

            if (!cleanResponse.startsWith("{") && cleanResponse.contains("{")) {
                cleanResponse = cleanResponse.substring(cleanResponse.indexOf("{"));
                if (cleanResponse.contains("}")) {
                    cleanResponse = cleanResponse.substring(0, cleanResponse.lastIndexOf("}") + 1);
                }
            }

            try {
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
            } catch (Exception jsonEx) {
                log.error("JSON Parsing failed. Cleaned response: {}", cleanResponse);
                throw new RuntimeException("Format jawaban dari AI tidak valid (Bukan JSON). Respon: " +
                        (cleanResponse.length() > 50 ? cleanResponse.substring(0, 50) + "..." : cleanResponse));
            }
        } catch (Exception e) {
            log.error("Failed to process synchronous AI scoring for ID: {}. Error: {}", jawabanId, e.getMessage(), e);
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

    public void syncToBaknusDrive(Long ujianId) {
        UjianMapel ujian = ujianMapelRepository.findById(ujianId)
                .orElseThrow(() -> new RuntimeException("Ujian not found"));

        List<JawabanSiswa> jawabanList = jawabanSiswaRepository.findBySoalEssay_UjianMapel_Id(ujianId);

        String eventName = ujian.getEventUjian().getNamaEvent();
        String subjectName = ujian.getGuruMapel().getMapel().getNamaMapel();
        String className = ujian.getGuruMapel().getKelas() != null ? ujian.getGuruMapel().getKelas().getNamaKelas()
                : "Gabungan";

        byte[] excelBytes = generateExcelReport(jawabanList, subjectName, className);
        String fileName = "Rekap_Nilai_AI_" + subjectName.replace(" ", "_") + "_" + className.replace(" ", "_")
                + ".xlsx";

        baknusDriveService.uploadFileBytes(eventName, subjectName, excelBytes, fileName);
    }

    private byte[] generateExcelReport(List<JawabanSiswa> jawabanList, String subjectName, String className) {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Rekap Nilai AI");

            // Header Style
            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFillForegroundColor(IndexedColors.BLUE_GREY.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            Font font = workbook.createFont();
            font.setColor(IndexedColors.WHITE.getIndex());
            font.setBold(true);
            headerStyle.setFont(font);

            // Headers
            Row headerRow = sheet.createRow(0);
            String[] columns = { "No", "NISN", "Nama Siswa", "Kelas", "Pertanyaan", "Jawaban Siswa", "Skor AI",
                    "Alasan AI", "Skor Guru" };
            for (int i = 0; i < columns.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(columns[i]);
                cell.setCellStyle(headerStyle);
            }

            // Data
            int rowIdx = 1;
            for (JawabanSiswa j : jawabanList) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(rowIdx - 1);

                String nisn = "";
                if (j.getSiswa() != null && j.getSiswa().getUser() != null) {
                    String email = j.getSiswa().getUser().getEmail();
                    nisn = (email != null && email.contains("@")) ? email.substring(0, email.indexOf("@"))
                            : j.getSiswa().getNisn();
                }

                row.createCell(1).setCellValue(nisn);
                row.createCell(2).setCellValue(j.getSiswa() != null ? j.getSiswa().getNamaLengkap() : "-");
                row.createCell(3).setCellValue(className);
                row.createCell(4).setCellValue(j.getSoalEssay() != null ? j.getSoalEssay().getPertanyaan() : "-");
                row.createCell(5).setCellValue(j.getTeksJawaban());
                row.createCell(6).setCellValue(j.getSkorAi() != null ? j.getSkorAi() : 0.0);
                row.createCell(7).setCellValue(j.getAlasanAi() != null ? j.getAlasanAi() : "-");
                row.createCell(8).setCellValue(j.getSkorFinalGuru() != null ? j.getSkorFinalGuru() : 0.0);
            }

            for (int i = 0; i < columns.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Error generating Excel report", e);
            throw new RuntimeException("Gagal generate excel: " + e.getMessage());
        }
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
