package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.exam.NilaiPraktekDTO;
import com.baknusbelajar.api.entity.*;
import com.baknusbelajar.api.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class NilaiPraktekService {

    private final NilaiPraktekRepository nilaiPraktekRepository;
    private final UjianMapelRepository ujianMapelRepository;
    private final SiswaRepository siswaRepository;
    private final BaknusDriveService baknusDriveService;

    public List<NilaiPraktekDTO> getNilaiByUjian(Long ujianMapelId) {
        UjianMapel ujian = ujianMapelRepository.findById(ujianMapelId)
                .orElseThrow(() -> new RuntimeException("Ujian not found"));

        List<Siswa> allSiswa = siswaRepository.findAll().stream()
                .filter(s -> s.getKelas() != null && s.getKelas().equals(ujian.getGuruMapel().getKelas()))
                .collect(Collectors.toList());

        List<NilaiPraktek> existingNilai = nilaiPraktekRepository.findByUjianMapelId(ujianMapelId);

        return allSiswa.stream().map(s -> {
            Optional<NilaiPraktek> n = existingNilai.stream()
                    .filter(val -> val.getSiswa().getId().equals(s.getId()))
                    .findFirst();

            return NilaiPraktekDTO.builder()
                    .id(n.map(NilaiPraktek::getId).orElse(null))
                    .ujianMapelId(ujianMapelId)
                    .siswaId(s.getId())
                    .namaSiswa(s.getNamaLengkap())
                    .nisn(s.getNisn())
                    .nilai(n.map(NilaiPraktek::getNilai).orElse(0))
                    .build();
        }).collect(Collectors.toList());
    }

    @Transactional
    public void saveNilaiBatch(List<NilaiPraktekDTO> dtos) {
        if (dtos.isEmpty())
            return;

        Long ujianId = dtos.get(0).getUjianMapelId();
        UjianMapel ujian = ujianMapelRepository.findById(ujianId)
                .orElseThrow(() -> new RuntimeException("Ujian not found"));

        for (NilaiPraktekDTO dto : dtos) {
            NilaiPraktek entity = nilaiPraktekRepository
                    .findByUjianMapelIdAndSiswaId(ujianId, dto.getSiswaId())
                    .orElseGet(() -> NilaiPraktek.builder()
                            .ujianMapel(ujian)
                            .siswa(siswaRepository.findById(dto.getSiswaId()).orElseThrow())
                            .build());

            entity.setNilai(dto.getNilai());
            nilaiPraktekRepository.save(entity);
        }

        // Sync to Drive
        syncToDrive(ujian);
    }

    private void syncToDrive(UjianMapel ujian) {
        List<NilaiPraktek> allNilai = nilaiPraktekRepository.findByUjianMapelId(ujian.getId());
        String eventName = ujian.getEventUjian().getNamaEvent();
        String subjectName = ujian.getGuruMapel().getMapel().getNamaMapel();
        String className = ujian.getGuruMapel().getKelas() != null ? ujian.getGuruMapel().getKelas().getNamaKelas()
                : "UnknownClass";

        String fileName = "Nilai_Praktek_" + subjectName.replaceAll("\\s+", "_") + "_"
                + className.replaceAll("\\s+", "_") + ".xlsx";

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Nilai Praktek");

            // Header Style
            CellStyle headerStyle = workbook.createCellStyle();
            Font font = workbook.createFont();
            font.setBold(true);
            headerStyle.setFont(font);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderBottom(BorderStyle.THIN);

            // Create Header
            Row headerRow = sheet.createRow(0);
            String[] columns = { "No", "NISN", "Nama Siswa", "Nilai (1-100)" };
            for (int i = 0; i < columns.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(columns[i]);
                cell.setCellStyle(headerStyle);
            }

            // Data
            int rowIdx = 1;
            for (NilaiPraktek n : allNilai) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(rowIdx - 1);
                row.createCell(1).setCellValue(n.getSiswa().getNisn());
                row.createCell(2).setCellValue(n.getSiswa().getNamaLengkap());
                row.createCell(3).setCellValue(n.getNilai());
            }

            for (int i = 0; i < columns.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(bos);
            byte[] bytes = bos.toByteArray();

            // Upload to BaknusDrive
            baknusDriveService.uploadFileBytes(eventName, subjectName, bytes, fileName);
            log.info("Successfully synced Nilai Praktek to Drive: {}", fileName);

        } catch (IOException e) {
            log.error("Error generating Excel for Nilai Praktek: {}", e.getMessage());
        }
    }
}
