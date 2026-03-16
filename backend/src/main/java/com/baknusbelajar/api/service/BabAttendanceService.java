package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.materi.BabAttendanceDTO;
import com.baknusbelajar.api.entity.Bab;
import com.baknusbelajar.api.entity.BabAttendance;
import com.baknusbelajar.api.entity.Siswa;
import com.baknusbelajar.api.repository.BabAttendanceRepository;
import com.baknusbelajar.api.repository.BabRepository;
import com.baknusbelajar.api.repository.SiswaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BabAttendanceService {

    private final BabAttendanceRepository attendanceRepository;
    private final BabRepository babRepository;
    private final SiswaRepository siswaRepository;
    private final BaknusDriveService driveService;

    @Transactional
    public BabAttendanceDTO markAttendance(Long babId) {
        String username = org.springframework.security.core.context.SecurityContextHolder.getContext()
                .getAuthentication().getName();
        Siswa siswa = siswaRepository.findByUserUsername(username)
                .orElseThrow(() -> new RuntimeException("Logged in user is not a student"));
        Long siswaId = siswa.getId();

        if (attendanceRepository.existsByBabIdAndSiswaId(babId, siswaId)) {
            BabAttendance existing = attendanceRepository.findByBabIdAndSiswaId(babId, siswaId).get();
            return convertToDTO(existing);
        }

        Bab bab = babRepository.findById(babId)
                .orElseThrow(() -> new RuntimeException("Bab not found"));

        BabAttendance attendance = BabAttendance.builder()
                .bab(bab)
                .siswa(siswa)
                .attendedAt(LocalDateTime.now())
                .build();

        BabAttendance saved = attendanceRepository.save(attendance);

        // Auto-sync to BaknusDrive
        try {
            syncAttendanceToDrive(babId);
        } catch (Exception e) {
            log.error("Failed to sync attendance to Drive: {}", e.getMessage());
        }

        return convertToDTO(saved);
    }

    public List<BabAttendanceDTO> getAttendanceByBab(Long babId) {
        return attendanceRepository.findByBabId(babId).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public boolean hasStudentAttended(Long babId) {
        String username = org.springframework.security.core.context.SecurityContextHolder.getContext()
                .getAuthentication().getName();
        Siswa siswa = siswaRepository.findByUserUsername(username)
                .orElse(null);
        if (siswa == null)
            return false;
        return attendanceRepository.existsByBabIdAndSiswaId(babId, siswa.getId());
    }

    public void syncAttendanceToDrive(Long babId) {
        Bab bab = babRepository.findById(babId)
                .orElseThrow(() -> new RuntimeException("Bab not found"));
        List<BabAttendance> attendances = attendanceRepository.findByBabId(babId);

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Kehadiran");

            // Header Style
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // Create Header
            Row headerRow = sheet.createRow(0);
            String[] headers = { "No", "Nama Lengkap", "Kelas", "Tanggal Presensi" };
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // Fill Data
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
            int rowIdx = 1;
            for (BabAttendance att : attendances) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(rowIdx - 1);
                row.createCell(1).setCellValue(att.getSiswa().getNamaLengkap());
                row.createCell(2).setCellValue(att.getSiswa().getKelas().getNamaKelas());
                row.createCell(3).setCellValue(att.getAttendedAt().format(formatter));
            }

            // Auto-size columns
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(bos);
            byte[] bytes = bos.toByteArray();

            String teacherEmail = bab.getGuruMapel().getGuru().getUser().getEmail();
            String subjectName = bab.getGuruMapel().getMapel().getNamaMapel();
            String className = bab.getGuruMapel().getKelas().getNamaKelas();
            String fileName = bab.getNamaBab().replaceAll("[^a-zA-Z0-9.-]", "_") + "_kehadiran.xlsx";

            driveService.uploadMateriBytes(teacherEmail, subjectName, className, bytes, fileName);
            log.info("Attendance for Bab '{}' synced to Drive as '{}'", bab.getNamaBab(), fileName);

        } catch (IOException e) {
            log.error("Error generating Excel for attendance: {}", e.getMessage());
            throw new RuntimeException("Failed to generate Excel", e);
        }
    }

    private BabAttendanceDTO convertToDTO(BabAttendance att) {
        return BabAttendanceDTO.builder()
                .id(att.getId())
                .babId(att.getBab().getId())
                .siswaId(att.getSiswa().getId())
                .namaSiswa(att.getSiswa().getNamaLengkap())
                .kelas(att.getSiswa().getKelas().getNamaKelas())
                .attendedAt(att.getAttendedAt())
                .build();
    }
}
