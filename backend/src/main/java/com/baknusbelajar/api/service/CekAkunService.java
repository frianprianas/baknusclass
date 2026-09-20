package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.user.CekAkunResponseDTO;
import com.baknusbelajar.api.dto.user.CekAkunRowResultDTO;
import com.baknusbelajar.api.entity.Kelas;
import com.baknusbelajar.api.entity.Siswa;
import com.baknusbelajar.api.repository.KelasRepository;
import com.baknusbelajar.api.repository.SiswaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CekAkunService {

    private final SiswaRepository siswaRepository;
    private final KelasRepository kelasRepository;

    public byte[] generateTemplate() {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Template Cek Akun");

            // Header styling
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerFont.setFontHeightInPoints((short) 11);

            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // Border styling
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);

            Row headerRow = sheet.createRow(0);
            headerRow.setHeightInPoints(26);

            String[] columns = {"NIS/NISN", "Nama Siswa", "Kelas"};
            for (int i = 0; i < columns.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(columns[i]);
                cell.setCellStyle(headerStyle);
            }

            // Sample data style
            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderTop(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);

            String[][] sampleData = {
                    {"0081234567", "Ahmad Dani Fauzan", "X RPL 1"},
                    {"0087654321", "Siti Nurhaliza", "XI TKJ 2"},
                    {"0091122334", "Budi Pratama", "XII DKV 1"}
            };

            for (int r = 0; r < sampleData.length; r++) {
                Row row = sheet.createRow(r + 1);
                for (int c = 0; c < sampleData[r].length; c++) {
                    Cell cell = row.createCell(c);
                    cell.setCellValue(sampleData[r][c]);
                    cell.setCellStyle(dataStyle);
                }
            }

            sheet.setColumnWidth(0, 20 * 256);
            sheet.setColumnWidth(1, 35 * 256);
            sheet.setColumnWidth(2, 22 * 256);

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Failed to generate Cek Akun template: ", e);
            throw new RuntimeException("Gagal membuat template Excel: " + e.getMessage());
        }
    }

    public CekAkunResponseDTO verifyExcel(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File Excel tidak boleh kosong.");
        }

        try (InputStream in = file.getInputStream(); Workbook workbook = new XSSFWorkbook(in)) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                throw new IllegalArgumentException("Sheet Excel tidak ditemukan.");
            }

            // Find header row (check row 0 or 1)
            int headerRowIndex = 0;
            int colNisn = -1;
            int colNama = -1;
            int colKelas = -1;

            for (int r = 0; r <= Math.min(5, sheet.getLastRowNum()); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                for (int c = 0; c < row.getLastCellNum(); c++) {
                    Cell cell = row.getCell(c);
                    if (cell == null) continue;
                    String val = getCellValueAsString(cell).trim().toLowerCase();
                    if (val.contains("nis") || val.contains("nisn") || val.contains("nomor induk")) {
                        colNisn = c;
                    } else if (val.contains("nama")) {
                        colNama = c;
                    } else if (val.contains("kelas") || val.contains("rombel")) {
                        colKelas = c;
                    }
                }
                if (colNisn != -1 || colNama != -1) {
                    headerRowIndex = r;
                    break;
                }
            }

            // Fallback column positions if headers not named standardly
            if (colNisn == -1) colNisn = 0;
            if (colNama == -1) colNama = 1;
            if (colKelas == -1) colKelas = 2;

            log.info("Parsed Excel headers at row {}: colNisn={}, colNama={}, colKelas={}",
                    headerRowIndex, colNisn, colNama, colKelas);

            // Fast In-Memory Database Lookups
            List<Siswa> allSiswa = siswaRepository.findAllWithUserAndKelas();
            List<Kelas> allKelas = kelasRepository.findAll();

            Map<String, Siswa> siswaByNisn = new HashMap<>();
            Map<String, Siswa> siswaByUsername = new HashMap<>();
            Map<String, Siswa> siswaByEmail = new HashMap<>();
            Map<String, Siswa> siswaByName = new HashMap<>();

            for (Siswa s : allSiswa) {
                if (s.getNisn() != null && !s.getNisn().trim().isEmpty()) {
                    siswaByNisn.put(cleanKey(s.getNisn()), s);
                }
                if (s.getUser() != null) {
                    if (s.getUser().getUsername() != null && !s.getUser().getUsername().trim().isEmpty()) {
                        siswaByUsername.put(cleanKey(s.getUser().getUsername()), s);
                    }
                    if (s.getUser().getEmail() != null && !s.getUser().getEmail().trim().isEmpty()) {
                        siswaByEmail.put(cleanKey(s.getUser().getEmail()), s);
                        siswaByEmail.put(cleanKey(s.getUser().getEmail().split("@")[0]), s);
                    }
                }
                if (s.getNamaLengkap() != null && !s.getNamaLengkap().trim().isEmpty()) {
                    siswaByName.put(cleanKey(s.getNamaLengkap()), s);
                }
            }

            Map<String, Kelas> kelasMap = new HashMap<>();
            for (Kelas k : allKelas) {
                if (k.getNamaKelas() != null) {
                    kelasMap.put(cleanKey(k.getNamaKelas()), k);
                }
            }

            List<CekAkunRowResultDTO> results = new ArrayList<>();
            int totalValid = 0;
            int totalTidakDitemukan = 0;
            int totalKelasBerbeda = 0;

            for (int r = headerRowIndex + 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;

                String nisnVal = colNisn < row.getLastCellNum() ? getCellValueAsString(row.getCell(colNisn)).trim() : "";
                String namaVal = colNama < row.getLastCellNum() ? getCellValueAsString(row.getCell(colNama)).trim() : "";
                String kelasVal = colKelas < row.getLastCellNum() ? getCellValueAsString(row.getCell(colKelas)).trim() : "";

                // Skip completely empty rows
                if (nisnVal.isEmpty() && namaVal.isEmpty() && kelasVal.isEmpty()) {
                    continue;
                }

                String cleanNisn = cleanKey(nisnVal);
                String cleanNama = cleanKey(namaVal);
                String cleanKelasInput = cleanKey(kelasVal);

                // Match student
                Siswa matchedSiswa = null;
                if (!cleanNisn.isEmpty()) {
                    matchedSiswa = siswaByNisn.get(cleanNisn);
                    if (matchedSiswa == null) {
                        matchedSiswa = siswaByUsername.get(cleanNisn);
                    }
                    if (matchedSiswa == null) {
                        matchedSiswa = siswaByEmail.get(cleanNisn);
                    }
                }
                if (matchedSiswa == null && !cleanNama.isEmpty()) {
                    matchedSiswa = siswaByName.get(cleanNama);
                }

                CekAkunRowResultDTO rowResult = new CekAkunRowResultDTO();
                rowResult.setRowNum(r + 1);
                rowResult.setNisnInput(nisnVal);
                rowResult.setNamaInput(namaVal);
                rowResult.setKelasInput(kelasVal);

                if (matchedSiswa == null) {
                    rowResult.setStatus("TIDAK_DITEMUKAN");
                    rowResult.setKeterangan("Akun tidak ditemukan di database (NISN/Nama belum terdaftar)");
                    totalTidakDitemukan++;
                } else {
                    rowResult.setDbNisn(matchedSiswa.getNisn());
                    rowResult.setDbNama(matchedSiswa.getNamaLengkap());
                    if (matchedSiswa.getUser() != null) {
                        rowResult.setDbEmail(matchedSiswa.getUser().getEmail());
                        rowResult.setDbActive(matchedSiswa.getUser().getIsActive());
                    }

                    String dbKelasName = (matchedSiswa.getKelas() != null && matchedSiswa.getKelas().getNamaKelas() != null)
                            ? matchedSiswa.getKelas().getNamaKelas().trim()
                            : "";
                    rowResult.setDbKelas(dbKelasName.isEmpty() ? "(Belum ada kelas)" : dbKelasName);

                    String cleanDbKelas = cleanKey(dbKelasName);

                    if (cleanKelasInput.isEmpty()) {
                        rowResult.setStatus("VALID");
                        rowResult.setKeterangan("Akun terdaftar (Kelas di Excel kosong)");
                        totalValid++;
                    } else if (cleanDbKelas.equals(cleanKelasInput)) {
                        rowResult.setStatus("VALID");
                        rowResult.setKeterangan("Akun & Kelas Sesuai");
                        totalValid++;
                    } else {
                        rowResult.setStatus("KELAS_BERBEDA");
                        if (cleanDbKelas.isEmpty()) {
                            rowResult.setKeterangan("Akun ada, tapi di sistem belum masuk kelas (Excel: " + kelasVal + ")");
                        } else {
                            rowResult.setKeterangan("Kelas Berbeda: di sistem '" + dbKelasName + "' vs di Excel '" + kelasVal + "'");
                        }
                        totalKelasBerbeda++;
                    }
                }

                results.add(rowResult);
            }

            return CekAkunResponseDTO.builder()
                    .totalBaris(results.size())
                    .totalValid(totalValid)
                    .totalTidakDitemukan(totalTidakDitemukan)
                    .totalKelasBerbeda(totalKelasBerbeda)
                    .results(results)
                    .build();

        } catch (Exception e) {
            log.error("Error verifying Cek Akun Excel file: ", e);
            throw new RuntimeException("Gagal memproses file Excel: " + e.getMessage(), e);
        }
    }

    private String cleanKey(String val) {
        if (val == null) return "";
        return val.trim().toLowerCase().replaceAll("[^a-zA-Z0-9]", "");
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getDateCellValue().toString();
                }
                // Handle whole numbers without decimal point (.0)
                double num = cell.getNumericCellValue();
                if (num == Math.floor(num)) {
                    return String.format("%.0f", num);
                }
                return String.valueOf(num);
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                try {
                    return cell.getStringCellValue();
                } catch (Exception e) {
                    return String.valueOf(cell.getNumericCellValue());
                }
            default:
                return "";
        }
    }
}
