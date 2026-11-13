package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.exam.DraftSoalDTO;
import com.baknusbelajar.api.dto.exam.QuestionTemplateRequestDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ooxml.POIXMLDocumentPart;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuestionExcelService {

    private final AiQuestionImportService aiQuestionImportService;

    // Pattern untuk mendeteksi huruf Arab
    private static final Pattern ARABIC_PATTERN = Pattern.compile("[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]");
    // Pattern untuk mendeteksi sintaks markdown gambar ![alt](url)
    private static final Pattern MD_IMAGE_PATTERN = Pattern.compile("!\\[([^\\]]*)\\]\\(([^\\)]+)\\)");

    /**
     * Menghasilkan file Excel (.xlsx) dinamis berisi template bank soal
     * dengan dukungan teks multibahasa (Arab, Jepang), notasi matematika, dan gambar.
     */
    public byte[] generateTemplate(QuestionTemplateRequestDTO req) {
        int pgBiasa = req.getPgBiasaCount() != null ? Math.max(0, req.getPgBiasaCount()) : 0;
        int pgKompleks = req.getPgKompleksCount() != null ? Math.max(0, req.getPgKompleksCount()) : 0;
        int benarSalah = req.getBenarSalahCount() != null ? Math.max(0, req.getBenarSalahCount()) : 0;
        int bsMajemuk = req.getBsMajemukCount() != null ? Math.max(0, req.getBsMajemukCount()) : 0;
        int essay = req.getEssayCount() != null ? Math.max(0, req.getEssayCount()) : 0;

        double bobotPG = req.getDefaultBobotPG() != null && req.getDefaultBobotPG() > 0 ? req.getDefaultBobotPG() : 2.0;
        double bobotEssay = req.getDefaultBobotEssay() != null && req.getDefaultBobotEssay() > 0 ? req.getDefaultBobotEssay() : 10.0;

        // Jika semua 0, buat default 1 contoh untuk tiap tipe agar tidak kosong
        if (pgBiasa == 0 && pgKompleks == 0 && benarSalah == 0 && bsMajemuk == 0 && essay == 0) {
            pgBiasa = 5;
            pgKompleks = 2;
            benarSalah = 2;
            bsMajemuk = 1;
            essay = 2;
        }

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // ==================== STYLES ====================
            // Header Style
            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            Font headerFont = workbook.createFont();
            headerFont.setFontName("Calibri");
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerFont.setFontHeightInPoints((short) 11);
            headerStyle.setFont(headerFont);

            // Data Style General
            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderTop(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);
            Font dataFont = workbook.createFont();
            dataFont.setFontName("Calibri");
            dataFont.setFontHeightInPoints((short) 10);
            dataStyle.setFont(dataFont);

            // Center Data Style
            CellStyle centerStyle = workbook.createCellStyle();
            centerStyle.cloneStyleFrom(dataStyle);
            centerStyle.setAlignment(HorizontalAlignment.CENTER);

            // ==================== SHEET 1: SOAL_UJIAN ====================
            Sheet sheetSoal = workbook.createSheet("SOAL_UJIAN");
            sheetSoal.setDisplayGridlines(true);

            String[] headers = {
                    "No",
                    "Tipe Soal",
                    "Pertanyaan (Soal)",
                    "Pilihan A",
                    "Pilihan B",
                    "Pilihan C",
                    "Pilihan D",
                    "Pilihan E",
                    "Kunci Jawaban",
                    "Bobot Nilai"
            };

            Row headerRow = sheetSoal.createRow(0);
            headerRow.setHeightInPoints(28);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowIdx = 1;

            // 1. PG Biasa
            for (int i = 0; i < pgBiasa; i++) {
                Row row = sheetSoal.createRow(rowIdx);
                row.setHeightInPoints(22);
                createRowCells(row, rowIdx, "PG_BIASA",
                        "Tuliskan pertanyaan pilihan ganda nomor " + rowIdx + " di sini...",
                        "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Opsi E",
                        "A", bobotPG, centerStyle, dataStyle);
                rowIdx++;
            }

            // 2. PG Kompleks
            for (int i = 0; i < pgKompleks; i++) {
                Row row = sheetSoal.createRow(rowIdx);
                row.setHeightInPoints(22);
                createRowCells(row, rowIdx, "PG_KOMPLEKS",
                        "Tuliskan pertanyaan pilihan ganda kompleks nomor " + rowIdx + " (banyak kunci) di sini...",
                        "Pilihan 1", "Pilihan 2", "Pilihan 3", "Pilihan 4", "Pilihan 5",
                        "A,C", bobotPG, centerStyle, dataStyle);
                rowIdx++;
            }

            // 3. Benar / Salah Tunggal
            for (int i = 0; i < benarSalah; i++) {
                Row row = sheetSoal.createRow(rowIdx);
                row.setHeightInPoints(22);
                createRowCells(row, rowIdx, "BENAR_SALAH",
                        "Tuliskan pernyataan benar/salah nomor " + rowIdx + " di sini...",
                        "Benar", "Salah", "-", "-", "-",
                        "A", bobotPG, centerStyle, dataStyle);
                rowIdx++;
            }

            // 4. Tabel Benar / Salah Majemuk
            for (int i = 0; i < bsMajemuk; i++) {
                Row row = sheetSoal.createRow(rowIdx);
                row.setHeightInPoints(22);
                createRowCells(row, rowIdx, "BS_MAJEMUK",
                        "Tuliskan narasi/stimulus tabel pernyataan nomor " + rowIdx + " di sini...",
                        "Pernyataan 1", "Pernyataan 2", "Pernyataan 3", "Pernyataan 4", "Pernyataan 5",
                        "B,S,B,B,S", bobotPG * 2, centerStyle, dataStyle);
                rowIdx++;
            }

            // 5. Essay
            for (int i = 0; i < essay; i++) {
                Row row = sheetSoal.createRow(rowIdx);
                row.setHeightInPoints(22);
                createRowCells(row, rowIdx, "ESSAY",
                        "Tuliskan pertanyaan essay/uraian nomor " + rowIdx + " di sini...",
                        "-", "-", "-", "-", "-",
                        "-", bobotEssay, centerStyle, dataStyle);
                rowIdx++;
            }

            // Dropdown Data Validation untuk Kolom B (Tipe Soal)
            DataValidationHelper validationHelper = sheetSoal.getDataValidationHelper();
            DataValidationConstraint constraint = validationHelper.createExplicitListConstraint(
                    new String[]{"PG_BIASA", "PG_KOMPLEKS", "BENAR_SALAH", "BS_MAJEMUK", "ESSAY"}
            );
            CellRangeAddressList addressList = new CellRangeAddressList(1, Math.max(rowIdx + 100, 500), 1, 1);
            DataValidation validation = validationHelper.createValidation(constraint, addressList);
            validation.setShowErrorBox(true);
            validation.createErrorBox("Tipe Soal Tidak Valid", "Pilihlah salah satu dari: PG_BIASA, PG_KOMPLEKS, BENAR_SALAH, BS_MAJEMUK, atau ESSAY.");
            sheetSoal.addValidationData(validation);

            // Atur lebar kolom
            sheetSoal.setColumnWidth(0, 6 * 256);   // No
            sheetSoal.setColumnWidth(1, 16 * 256);  // Tipe Soal
            sheetSoal.setColumnWidth(2, 45 * 256);  // Pertanyaan
            sheetSoal.setColumnWidth(3, 20 * 256);  // Pilihan A
            sheetSoal.setColumnWidth(4, 20 * 256);  // Pilihan B
            sheetSoal.setColumnWidth(5, 20 * 256);  // Pilihan C
            sheetSoal.setColumnWidth(6, 20 * 256);  // Pilihan D
            sheetSoal.setColumnWidth(7, 20 * 256);  // Pilihan E
            sheetSoal.setColumnWidth(8, 20 * 256);  // Kunci Jawaban
            sheetSoal.setColumnWidth(9, 14 * 256);  // Bobot Nilai

            // ==================== SHEET 2: PETUNJUK_PENGISIAN ====================
            Sheet sheetPetunjuk = workbook.createSheet("PETUNJUK_PENGISIAN");
            sheetPetunjuk.setDisplayGridlines(true);

            // Title Petunjuk
            Row titleRow = sheetPetunjuk.createRow(0);
            titleRow.setHeightInPoints(28);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("PANDUAN LENGKAP PENGISIAN TEMPLATE SOAL BAKNUSCLASS");
            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 13);
            titleFont.setColor(IndexedColors.DARK_BLUE.getIndex());
            titleStyle.setFont(titleFont);
            titleCell.setCellStyle(titleStyle);

            String[][] petunjukData = {
                    {"Topik / Kolom", "Aturan & Format Pengisian"},
                    {"No", "Nomor urut soal (angka bulat 1, 2, 3, ...)."},
                    {"Tipe Soal", "Wajib memilih salah satu: PG_BIASA, PG_KOMPLEKS, BENAR_SALAH, BS_MAJEMUK, atau ESSAY."},
                    {"Pertanyaan", "Isi dengan teks pertanyaan/soal lengkap. Stimulus, narasi, rumus, dan gambar bisa disematkan di sini."},
                    {"Pilihan A - E", "Untuk PG_BIASA / PG_KOMPLEKS: Opsi A sampai E (jika hanya 4 opsi A-D, isi Pilihan E dengan '-').\nUntuk BENAR_SALAH: Pilihan A = 'Benar', B = 'Salah', C-E = '-'.\nUntuk BS_MAJEMUK: Pilihan A sampai E diisi butir-butir pernyataan.\nUntuk ESSAY: Pilihan A sampai E diisi '-'."},
                    {"Kunci Jawaban", "Format kunci berdasarkan tipe soal:\n"
                            + "1. PG_BIASA: 1 huruf kapital (misal: A atau B).\n"
                            + "2. PG_KOMPLEKS: Huruf kapital dipisah koma (misal: A,C atau B,D,E).\n"
                            + "3. BENAR_SALAH: Huruf 'A' jika Benar, atau 'B' jika Salah.\n"
                            + "4. BS_MAJEMUK: Status B dan S dipisah koma (misal: B,S,B atau B,B,S,B).\n"
                            + "5. ESSAY: Boleh diisi pedoman penskoran essay atau '-' (tidak dinilai otomatis)."},
                    {"Bobot Nilai", "Nilai / skor per butir soal (misal: 2 untuk PG atau 10 untuk Essay)."},
                    {"Gambar (Diagram / Foto)", "DAPAT DIMASUKKAN DENGAN CARA:\n"
                            + "a) Paste / Insert Picture langsung ke dalam baris soal di Excel. Sistem akan otomatis mengekstrak gambar dan menyematkannya ke soal.\n"
                            + "b) Mengetikkan link gambar langsung, misalnya: https://domain.com/gambar.png\n"
                            + "c) Format Markdown gambar: ![Keterangan](https://domain.com/gambar.png)\n"
                            + "d) Tag HTML: <img src=\"https://...\" />"},
                    {"Huruf Arab & Harakat", "Mendukung 100% huruf Hijaiyah, harakat lengkap, dan ayat Al-Qur'an (misal: بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ). Cukup copy-paste langsung ke kolom Pertanyaan atau Pilihan jawaban. Tampilan otomatis diatur Right-to-Left (RTL)."},
                    {"Huruf Jepang / Mandarin", "Mendukung penuh aksara Jepang (Kanji, Hiragana, Katakana: 日本語, ひらがな, カタカナ) dan Mandarin (Hanzi). Langsung ketik atau paste ke sel Excel."},
                    {"Notasi Matematika", "Mendukung berbagai gaya penulisan matematika:\n"
                            + "a) Format LaTeX Math (Direkomendasikan):\n"
                            + "   - Integral: $$\\int_{0}^{1} (3x^2 + 2x) dx$$\n"
                            + "   - Matriks: $$\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$$ atau $$\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$$\n"
                            + "   - Pangkat & Pecahan: $$x^{2} + \\frac{1}{2}x - 5 = 0$$\n"
                            + "b) Simbol Unicode Matematika Langsung: ∫, ∑, √, ±, ≠, ≤, ≥, π, θ, x², x³, yⁿ, x₁\n"
                            + "c) Tag HTML: x<sup>2</sup> (pangkat), x<sub>1</sub> (indeks), atau tabel matriks."}
            };

            for (int r = 0; r < petunjukData.length; r++) {
                Row row = sheetPetunjuk.createRow(r + 2);
                row.setHeightInPoints(r == 0 ? 24 : 44);
                Cell c0 = row.createCell(0);
                Cell c1 = row.createCell(1);
                c0.setCellValue(petunjukData[r][0]);
                c1.setCellValue(petunjukData[r][1]);

                if (r == 0) {
                    c0.setCellStyle(headerStyle);
                    c1.setCellStyle(headerStyle);
                } else {
                    CellStyle wrapStyle = workbook.createCellStyle();
                    wrapStyle.cloneStyleFrom(dataStyle);
                    wrapStyle.setWrapText(true);
                    c0.setCellStyle(dataStyle);
                    c1.setCellStyle(wrapStyle);
                }
            }

            sheetPetunjuk.setColumnWidth(0, 24 * 256);
            sheetPetunjuk.setColumnWidth(1, 100 * 256);

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Failed to generate questions template: ", e);
            throw new RuntimeException("Gagal membuat template Excel: " + e.getMessage(), e);
        }
    }

    private void createRowCells(Row row, int no, String tipe, String pertanyaan,
                                String pilA, String pilB, String pilC, String pilD, String pilE,
                                String kunci, double bobot, CellStyle centerStyle, CellStyle dataStyle) {
        Cell c0 = row.createCell(0); c0.setCellValue(no); c0.setCellStyle(centerStyle);
        Cell c1 = row.createCell(1); c1.setCellValue(tipe); c1.setCellStyle(centerStyle);
        Cell c2 = row.createCell(2); c2.setCellValue(pertanyaan); c2.setCellStyle(dataStyle);
        Cell c3 = row.createCell(3); c3.setCellValue(pilA); c3.setCellStyle(dataStyle);
        Cell c4 = row.createCell(4); c4.setCellValue(pilB); c4.setCellStyle(dataStyle);
        Cell c5 = row.createCell(5); c5.setCellValue(pilC); c5.setCellStyle(dataStyle);
        Cell c6 = row.createCell(6); c6.setCellValue(pilD); c6.setCellStyle(dataStyle);
        Cell c7 = row.createCell(7); c7.setCellValue(pilE); c7.setCellStyle(dataStyle);
        Cell c8 = row.createCell(8); c8.setCellValue(kunci); c8.setCellStyle(centerStyle);
        Cell c9 = row.createCell(9); c9.setCellValue(bobot); c9.setCellStyle(centerStyle);
    }

    /**
     * Membaca dan menguraikan file Excel template menjadi List<DraftSoalDTO>.
     * Ekstraksi gambar tertanam (embedded images), huruf Arab, Jepang, dan rumus matematika.
     */
    public List<DraftSoalDTO> parseExcel(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File Excel tidak boleh kosong.");
        }

        List<DraftSoalDTO> list = new ArrayList<>();

        try (InputStream is = file.getInputStream(); Workbook workbook = WorkbookFactory.create(is)) {
            Sheet sheet = workbook.getSheet("SOAL_UJIAN");
            if (sheet == null) {
                // Fallback to sheet 0
                sheet = workbook.getSheetAt(0);
            }

            // 1. Ekstraksi seluruh gambar yang disematkan ke dalam worksheet (anchored images)
            Map<Integer, Map<Integer, List<String>>> embeddedPictures = extractEmbeddedPictures(sheet);

            int lastRow = sheet.getLastRowNum();
            int questionCounter = 1;

            for (int r = 1; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;

                String pertanyaan = getCellValueAsString(row.getCell(2));

                // Cek gambar pada baris ini
                Map<Integer, List<String>> rowPictures = embeddedPictures.get(r);
                boolean hasRowPictures = rowPictures != null && !rowPictures.isEmpty();

                if ((pertanyaan == null || pertanyaan.trim().isEmpty()) && !hasRowPictures) {
                    continue; // Skip baris kosong
                }

                // Cek jika pertanyaan adalah header yang tidak sengaja terbaca
                if (pertanyaan != null && (pertanyaan.trim().equalsIgnoreCase("pertanyaan") || pertanyaan.trim().equalsIgnoreCase("pertanyaan (soal)"))) {
                    continue;
                }

                String tipeRaw = getCellValueAsString(row.getCell(1));
                String tipeSoal = normalizeTipeSoal(tipeRaw);

                String pilA = getCellValueAsString(row.getCell(3));
                String pilB = getCellValueAsString(row.getCell(4));
                String pilC = getCellValueAsString(row.getCell(5));
                String pilD = getCellValueAsString(row.getCell(6));
                String pilE = getCellValueAsString(row.getCell(7));
                String kunci = getCellValueAsString(row.getCell(8));
                String bobotRaw = getCellValueAsString(row.getCell(9));

                // Sematkan gambar ke Pertanyaan atau Opsi Jawaban berdasarkan letak kolomnya
                if (rowPictures != null) {
                    for (Map.Entry<Integer, List<String>> entry : rowPictures.entrySet()) {
                        int col = entry.getKey();
                        String imgHtml = String.join(" ", entry.getValue());
                        if (col == 3) {
                            pilA = (pilA == null || pilA.equals("-") ? "" : pilA + " ") + imgHtml;
                        } else if (col == 4) {
                            pilB = (pilB == null || pilB.equals("-") ? "" : pilB + " ") + imgHtml;
                        } else if (col == 5) {
                            pilC = (pilC == null || pilC.equals("-") ? "" : pilC + " ") + imgHtml;
                        } else if (col == 6) {
                            pilD = (pilD == null || pilD.equals("-") ? "" : pilD + " ") + imgHtml;
                        } else if (col == 7) {
                            pilE = (pilE == null || pilE.equals("-") ? "" : pilE + " ") + imgHtml;
                        } else {
                            pertanyaan = (pertanyaan == null ? "" : pertanyaan + " ") + imgHtml;
                        }
                    }
                }

                // Format teks (proses markdown image, arab RTL wrapper jika perlu)
                pertanyaan = formatRichContent(pertanyaan);
                pilA = formatRichContent(pilA != null && !pilA.trim().isEmpty() ? pilA.trim() : "-");
                pilB = formatRichContent(pilB != null && !pilB.trim().isEmpty() ? pilB.trim() : "-");
                pilC = formatRichContent(pilC != null && !pilC.trim().isEmpty() ? pilC.trim() : "-");
                pilD = formatRichContent(pilD != null && !pilD.trim().isEmpty() ? pilD.trim() : "-");
                pilE = formatRichContent(pilE != null && !pilE.trim().isEmpty() ? pilE.trim() : "-");

                if ("BENAR_SALAH".equalsIgnoreCase(tipeSoal)) {
                    if (pilA.equals("-")) pilA = "Benar";
                    if (pilB.equals("-")) pilB = "Salah";
                }

                double bobot = 2.0;
                if ("ESSAY".equalsIgnoreCase(tipeSoal)) {
                    bobot = 10.0;
                }
                if (bobotRaw != null && !bobotRaw.trim().isEmpty()) {
                    try {
                        bobot = Double.parseDouble(bobotRaw.trim().replace(",", "."));
                    } catch (NumberFormatException ignored) {}
                }

                if (kunci == null || kunci.trim().isEmpty()) {
                    kunci = "ESSAY".equalsIgnoreCase(tipeSoal) ? "-" : "A";
                } else {
                    kunci = kunci.trim();
                }

                DraftSoalDTO dto = DraftSoalDTO.builder()
                        .nomor(questionCounter++)
                        .tipeSoal(tipeSoal)
                        .pertanyaan(pertanyaan.trim())
                        .pilihanA(pilA)
                        .pilihanB(pilB)
                        .pilihanC(pilC)
                        .pilihanD(pilD)
                        .pilihanE(pilE)
                        .kunciJawaban(kunci)
                        .bobotNilai(bobot)
                        .build();

                list.add(dto);
            }

            log.info("Successfully parsed {} questions from Excel file: {}", list.size(), file.getOriginalFilename());
            return list;
        } catch (Exception e) {
            log.error("Error reading questions Excel: ", e);
            throw new RuntimeException("Gagal membaca berkas Excel: " + e.getMessage(), e);
        }
    }

    /**
     * Mengekstrak seluruh gambar tertanam di worksheet XLSX dan mengelompokkannya
     * berdasarkan baris dan kolom anchor.
     */
    private Map<Integer, Map<Integer, List<String>>> extractEmbeddedPictures(Sheet sheet) {
        Map<Integer, Map<Integer, List<String>>> result = new HashMap<>();

        try {
            if (sheet instanceof XSSFSheet) {
                XSSFSheet xssfSheet = (XSSFSheet) sheet;
                for (POIXMLDocumentPart part : xssfSheet.getRelations()) {
                    if (part instanceof XSSFDrawing) {
                        XSSFDrawing drawing = (XSSFDrawing) part;
                        for (XSSFShape shape : drawing.getShapes()) {
                            if (shape instanceof XSSFPicture) {
                                XSSFPicture pic = (XSSFPicture) shape;
                                XSSFClientAnchor anchor = pic.getClientAnchor();
                                if (anchor != null) {
                                    int row = anchor.getRow1();
                                    int col = anchor.getCol1();
                                    PictureData picData = pic.getPictureData();
                                    if (picData != null && picData.getData() != null) {
                                        String mime = picData.getMimeType();
                                        if (mime == null || mime.isEmpty()) {
                                            mime = "image/png";
                                        }
                                        String base64 = Base64.getEncoder().encodeToString(picData.getData());
                                        String imgTag = "<p><img src=\"data:" + mime + ";base64," + base64 + "\" style=\"max-width:100%; max-height:420px; border-radius:10px; margin:8px 0; display:block; box-shadow:0 2px 8px rgba(0,0,0,0.1);\" alt=\"Gambar Soal\" /></p>";

                                        result.computeIfAbsent(row, k -> new HashMap<>())
                                                .computeIfAbsent(col, k -> new ArrayList<>())
                                                .add(imgTag);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Tidak dapat membaca gambar tertanam di Excel: {}", e.getMessage());
        }

        return result;
    }

    /**
     * Memformat teks konten agar gambar link markdown dan teks Arab tampil sempurna.
     */
    private String formatRichContent(String text) {
        if (text == null || text.trim().isEmpty()) {
            return "-";
        }

        String formatted = text;

        // 1. Ubah markdown image ![alt](url) menjadi tag <img>
        Matcher matcher = MD_IMAGE_PATTERN.matcher(formatted);
        if (matcher.find()) {
            formatted = matcher.replaceAll("<p><img src=\"$2\" alt=\"$1\" style=\"max-width:100%; border-radius:8px; margin:6px 0;\" /></p>");
        }

        // 2. Jika teks murni URL gambar (misal: https://domain/soal.png), bungkus dengan tag img
        if (formatted.matches("^(http|https)://\\S+\\.(png|jpg|jpeg|gif|webp|svg)(\\?\\S*)?$")) {
            formatted = "<p><img src=\"" + formatted + "\" style=\"max-width:100%; border-radius:8px; margin:6px 0;\" alt=\"Gambar Soal\" /></p>";
        }

        // 3. Jika mengandung teks Arab yang dominan dan belum dibungkus tag HTML, beri wadah RTL
        if (ARABIC_PATTERN.matcher(formatted).find() && !formatted.contains("<div dir=\"rtl\"") && !formatted.contains("<span dir=\"rtl\"")) {
            formatted = "<div dir=\"rtl\" style=\"font-family:'Traditional Arabic', 'Amiri', Tahoma, sans-serif; text-align:right; font-size:1.25em; line-height:1.8;\">" + formatted + "</div>";
        }

        return formatted;
    }

    /**
     * Parse file Excel dan langsung simpan ke Ujian
     */
    public int importAndSave(Long ujianId, MultipartFile file) {
        List<DraftSoalDTO> drafts = parseExcel(file);
        if (drafts.isEmpty()) {
            throw new IllegalArgumentException("Tidak ada butir soal yang valid ditemukan dalam berkas Excel.");
        }
        return aiQuestionImportService.saveBatchQuestions(ujianId, drafts);
    }

    private String normalizeTipeSoal(String raw) {
        if (raw == null || raw.trim().isEmpty()) return "PG_BIASA";
        String s = raw.trim().toUpperCase();
        if (s.contains("ESSAY") || s.contains("URAIAN")) return "ESSAY";
        if (s.contains("KOMPLEKS")) return "PG_KOMPLEKS";
        if (s.contains("MAJEMUK") || s.contains("BS_MAJEMUK")) return "BS_MAJEMUK";
        if (s.contains("BENAR") || s.contains("SALAH")) return "BENAR_SALAH";
        return "PG_BIASA";
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue();
            case NUMERIC:
                double val = cell.getNumericCellValue();
                if (val == Math.floor(val)) {
                    return String.valueOf((long) val);
                }
                return String.valueOf(val);
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                try {
                    return cell.getStringCellValue();
                } catch (Exception e) {
                    try {
                        return String.valueOf(cell.getNumericCellValue());
                    } catch (Exception ex) {
                        return "";
                    }
                }
            case BLANK:
            default:
                return "";
        }
    }
}
