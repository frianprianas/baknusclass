package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.exam.DraftSoalDTO;
import com.baknusbelajar.api.dto.exam.QuestionTemplateRequestDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.*;
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
public class QuestionDocxService {

    private final AiQuestionImportService aiQuestionImportService;

    // Pattern untuk mendeteksi huruf Arab
    private static final Pattern ARABIC_PATTERN = Pattern.compile("[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]");
    // Pattern untuk mendeteksi sintaks markdown gambar ![alt](url)
    private static final Pattern MD_IMAGE_PATTERN = Pattern.compile("!\\[([^\\]]*)\\]\\(([^\\)]+)\\)");

    /**
     * Menghasilkan file Word (.docx) dinamis berisi tabel template bank soal
     * dengan format nomor, keterangan tipe, pertanyaan, opsi A-E, kunci, dan skor.
     */
    public byte[] generateTemplate(QuestionTemplateRequestDTO req) {
        int pgBiasa = req.getPgBiasaCount() != null ? Math.max(0, req.getPgBiasaCount()) : 0;
        int pgKompleks = req.getPgKompleksCount() != null ? Math.max(0, req.getPgKompleksCount()) : 0;
        int benarSalah = req.getBenarSalahCount() != null ? Math.max(0, req.getBenarSalahCount()) : 0;
        int bsMajemuk = req.getBsMajemukCount() != null ? Math.max(0, req.getBsMajemukCount()) : 0;
        int essay = req.getEssayCount() != null ? Math.max(0, req.getEssayCount()) : 0;

        double bobotPG = req.getDefaultBobotPG() != null && req.getDefaultBobotPG() > 0 ? req.getDefaultBobotPG() : 2.0;
        double bobotEssay = req.getDefaultBobotEssay() != null && req.getDefaultBobotEssay() > 0 ? req.getDefaultBobotEssay() : 10.0;

        // Jika semua 0, buat default 1 contoh per tipe
        if (pgBiasa == 0 && pgKompleks == 0 && benarSalah == 0 && bsMajemuk == 0 && essay == 0) {
            pgBiasa = 5;
            pgKompleks = 2;
            benarSalah = 2;
            bsMajemuk = 1;
            essay = 2;
        }

        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // ==================== JUDUL & HEADER DOKUMEN ====================
            XWPFParagraph titlePara = doc.createParagraph();
            titlePara.setAlignment(ParagraphAlignment.CENTER);
            titlePara.setSpacingAfter(100);
            XWPFRun titleRun = titlePara.createRun();
            titleRun.setBold(true);
            titleRun.setFontSize(16);
            titleRun.setFontFamily("Calibri");
            titleRun.setColor("1E3A8A");
            titleRun.setText("TEMPLATE BANK SOAL UJIAN (FORMAT TABEL RESMI)");

            XWPFParagraph mapelPara = doc.createParagraph();
            mapelPara.setAlignment(ParagraphAlignment.CENTER);
            mapelPara.setSpacingAfter(200);
            XWPFRun mapelRun = mapelPara.createRun();
            mapelRun.setFontSize(12);
            mapelRun.setFontFamily("Calibri");
            mapelRun.setColor("475569");
            String mapelText = req.getNamaMapel() != null && !req.getNamaMapel().trim().isEmpty() ? req.getNamaMapel() : "Semua Mata Pelajaran";
            mapelRun.setText("Mata Pelajaran: " + mapelText + " | SMK Bakti Nusantara 666");

            // ==================== KOTAK PETUNJUK PENGISIAN ====================
            XWPFTable infoBox = doc.createTable(1, 1);
            infoBox.setWidth("100%");
            XWPFTableCell infoCell = infoBox.getRow(0).getCell(0);
            infoCell.setColor("F0FDF4");

            XWPFParagraph pTitle = infoCell.getParagraphs().get(0);
            XWPFRun rTitle = pTitle.createRun();
            rTitle.setBold(true);
            rTitle.setFontSize(10);
            rTitle.setColor("065F46");
            rTitle.setText("💡 PETUNJUK SINGKAT PENGISIAN TEMPLATE SOAL:");

            addBullet(infoCell, "1. Tipe Soal: Wajib diisi salah satu dari: PG_BIASA, PG_KOMPLEKS, BENAR_SALAH, BS_MAJEMUK, atau ESSAY.");
            addBullet(infoCell, "2. Format Kunci Jawaban: PG_BIASA: 1 huruf (A/B/C/D/E) | PG_KOMPLEKS: pisah koma (misal: A,C) | BENAR_SALAH: A (Benar) atau B (Salah) | BS_MAJEMUK: B,S,B,B (status per butir) | ESSAY: Pedoman penskoran (boleh '-').");
            addBullet(infoCell, "3. Gambar (Foto/Diagram): Cukup Paste (Ctrl+V) atau Insert Picture langsung ke dalam sel Pertanyaan atau Pilihan jawaban.");
            addBullet(infoCell, "4. Huruf Arab & Jepang: Cukup ketik/paste langsung ke sel tabel (didukung penuh, teks Arab otomatis rapi RTL).");
            addBullet(infoCell, "5. Rumus Matematika: Mendukung format LaTeX (misal: $$\\int_0^1 x^2 dx$$ atau matriks $$\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}$$), simbol Unicode (∫, ∑, √, x²), atau tag HTML.");

            XWPFParagraph spacer = doc.createParagraph();
            spacer.setSpacingBefore(150);

            // ==================== TABEL UTAMA INPUT SOAL ====================
            int totalRows = 1 + pgBiasa + pgKompleks + benarSalah + bsMajemuk + essay;
            int numCols = 10;
            XWPFTable table = doc.createTable(totalRows, numCols);
            table.setWidth("100%");

            // Header Tabel
            String[] headers = {
                    "No",
                    "Tipe Soal",
                    "Pertanyaan (Teks, Rumus, Gambar)",
                    "Pilihan A",
                    "Pilihan B",
                    "Pilihan C",
                    "Pilihan D",
                    "Pilihan E",
                    "Kunci",
                    "Skor"
            };

            XWPFTableRow headerRow = table.getRow(0);
            for (int i = 0; i < numCols; i++) {
                XWPFTableCell cell = headerRow.getCell(i);
                cell.setColor("1E40AF"); // Royal Blue
                XWPFParagraph p = cell.getParagraphs().get(0);
                p.setAlignment(ParagraphAlignment.CENTER);
                XWPFRun r = p.createRun();
                r.setBold(true);
                r.setFontSize(9);
                r.setFontFamily("Calibri");
                r.setColor("FFFFFF");
                r.setText(headers[i]);
            }

            int rowIdx = 1;

            // 1. Baris PG Biasa
            for (int i = 0; i < pgBiasa; i++) {
                populateDocxRow(table.getRow(rowIdx), rowIdx, "PG_BIASA",
                        "Tuliskan pertanyaan pilihan ganda nomor " + rowIdx + " di sini...",
                        "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Opsi E",
                        "A", bobotPG);
                rowIdx++;
            }

            // 2. Baris PG Kompleks
            for (int i = 0; i < pgKompleks; i++) {
                populateDocxRow(table.getRow(rowIdx), rowIdx, "PG_KOMPLEKS",
                        "Tuliskan pertanyaan pilihan ganda kompleks nomor " + rowIdx + " (lebih dari 1 jawaban benar) di sini...",
                        "Pilihan 1", "Pilihan 2", "Pilihan 3", "Pilihan 4", "Pilihan 5",
                        "A,C", bobotPG);
                rowIdx++;
            }

            // 3. Baris Benar / Salah Tunggal
            for (int i = 0; i < benarSalah; i++) {
                populateDocxRow(table.getRow(rowIdx), rowIdx, "BENAR_SALAH",
                        "Tuliskan pernyataan benar/salah nomor " + rowIdx + " di sini...",
                        "Benar", "Salah", "-", "-", "-",
                        "A", bobotPG);
                rowIdx++;
            }

            // 4. Baris Tabel Benar / Salah Majemuk
            for (int i = 0; i < bsMajemuk; i++) {
                populateDocxRow(table.getRow(rowIdx), rowIdx, "BS_MAJEMUK",
                        "Tuliskan stimulus/pengantar tabel pernyataan nomor " + rowIdx + " di sini...",
                        "Pernyataan 1", "Pernyataan 2", "Pernyataan 3", "Pernyataan 4", "Pernyataan 5",
                        "B,S,B,B,S", bobotPG * 2);
                rowIdx++;
            }

            // 5. Baris Essay
            for (int i = 0; i < essay; i++) {
                populateDocxRow(table.getRow(rowIdx), rowIdx, "ESSAY",
                        "Tuliskan pertanyaan essay/uraian nomor " + rowIdx + " di sini...",
                        "-", "-", "-", "-", "-",
                        "-", bobotEssay);
                rowIdx++;
            }

            doc.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Failed to generate Word template (.docx): ", e);
            throw new RuntimeException("Gagal membuat template Word: " + e.getMessage(), e);
        }
    }

    private void addBullet(XWPFTableCell cell, String text) {
        XWPFParagraph p = cell.addParagraph();
        p.setSpacingBefore(40);
        p.setSpacingAfter(40);
        XWPFRun r = p.createRun();
        r.setFontSize(8);
        r.setFontFamily("Calibri");
        r.setColor("1E293B");
        r.setText(text);
    }

    private void populateDocxRow(XWPFTableRow row, int no, String tipe, String pertanyaan,
                                 String pilA, String pilB, String pilC, String pilD, String pilE,
                                 String kunci, double bobot) {
        setCellText(row.getCell(0), String.valueOf(no), ParagraphAlignment.CENTER, false, null);
        setCellText(row.getCell(1), tipe, ParagraphAlignment.CENTER, true, getTipeBgColor(tipe));
        setCellText(row.getCell(2), pertanyaan, ParagraphAlignment.LEFT, false, null);
        setCellText(row.getCell(3), pilA, ParagraphAlignment.LEFT, false, null);
        setCellText(row.getCell(4), pilB, ParagraphAlignment.LEFT, false, null);
        setCellText(row.getCell(5), pilC, ParagraphAlignment.LEFT, false, null);
        setCellText(row.getCell(6), pilD, ParagraphAlignment.LEFT, false, null);
        setCellText(row.getCell(7), pilE, ParagraphAlignment.LEFT, false, null);
        setCellText(row.getCell(8), kunci, ParagraphAlignment.CENTER, true, "FEF3C7");
        setCellText(row.getCell(9), String.valueOf(bobot), ParagraphAlignment.CENTER, false, null);
    }

    private String getTipeBgColor(String tipe) {
        switch (tipe) {
            case "PG_BIASA": return "EFF6FF";
            case "PG_KOMPLEKS": return "EEF2FF";
            case "BENAR_SALAH": return "F0FDF4";
            case "BS_MAJEMUK": return "FDF4FF";
            case "ESSAY": return "FFFBEB";
            default: return "F8FAFC";
        }
    }

    private void setCellText(XWPFTableCell cell, String text, ParagraphAlignment align, boolean bold, String bgColor) {
        if (cell == null) return;
        if (bgColor != null) {
            cell.setColor(bgColor);
        }
        XWPFParagraph p = cell.getParagraphs().isEmpty() ? cell.addParagraph() : cell.getParagraphs().get(0);
        p.setAlignment(align);
        // Clear existing runs
        while (p.getRuns().size() > 0) {
            p.removeRun(0);
        }
        XWPFRun r = p.createRun();
        r.setFontSize(8);
        r.setFontFamily("Calibri");
        r.setBold(bold);
        r.setText(text != null ? text : "");
    }

    /**
     * Membaca dan menguraikan dokumen Word (.docx) langsung dari tabel
     * tanpa bergantung pada AI, mengekstrak gambar, aksara Arab, Jepang, dan notasi matematika.
     */
    public List<DraftSoalDTO> parseDocx(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File Word (.docx) tidak boleh kosong.");
        }

        List<DraftSoalDTO> list = new ArrayList<>();

        try (InputStream is = file.getInputStream(); XWPFDocument doc = new XWPFDocument(is)) {
            List<XWPFTable> tables = doc.getTables();
            if (tables.isEmpty()) {
                throw new IllegalArgumentException("Tidak ditemukan tabel soal dalam dokumen Word ini.");
            }

            // Cari tabel yang memiliki kolom pertanyaan / tipe soal
            XWPFTable questionTable = null;
            for (XWPFTable t : tables) {
                if (t.getRows().size() > 1) {
                    XWPFTableRow header = t.getRow(0);
                    String headerText = header.getTableCells().stream()
                            .map(c -> c.getText().toLowerCase())
                            .reduce("", (a, b) -> a + " " + b);
                    if (headerText.contains("pertanyaan") || headerText.contains("soal") || headerText.contains("tipe")) {
                        questionTable = t;
                        break;
                    }
                }
            }

            // Jika tidak ditemukan tabel bertuliskan pertanyaan, gunakan tabel terbesar
            if (questionTable == null) {
                questionTable = tables.stream().max(Comparator.comparingInt(t -> t.getRows().size())).orElse(null);
            }

            if (questionTable == null || questionTable.getRows().size() <= 1) {
                throw new IllegalArgumentException("Tabel soal dalam berkas Word tidak memiliki baris data.");
            }

            int questionCounter = 1;
            List<XWPFTableRow> rows = questionTable.getRows();

            for (int r = 1; r < rows.size(); r++) {
                XWPFTableRow row = rows.get(r);
                List<XWPFTableCell> cells = row.getTableCells();
                if (cells.size() < 3) continue;

                // Index mapping:
                // 0: No, 1: Tipe Soal, 2: Pertanyaan, 3: PilA, 4: PilB, 5: PilC, 6: PilD, 7: PilE, 8: Kunci, 9: Skor
                String tipeRaw = getCellContentWithImages(cells.size() > 1 ? cells.get(1) : null);
                String pertanyaan = getCellContentWithImages(cells.size() > 2 ? cells.get(2) : null);

                if (pertanyaan == null || pertanyaan.trim().isEmpty()) {
                    continue; // Skip baris kosong
                }

                // Cek jika header terulang
                if (pertanyaan.trim().equalsIgnoreCase("pertanyaan") || pertanyaan.trim().equalsIgnoreCase("pertanyaan (soal)")) {
                    continue;
                }

                String tipeSoal = normalizeTipeSoal(tipeRaw);

                String pilA = cells.size() > 3 ? getCellContentWithImages(cells.get(3)) : "-";
                String pilB = cells.size() > 4 ? getCellContentWithImages(cells.get(4)) : "-";
                String pilC = cells.size() > 5 ? getCellContentWithImages(cells.get(5)) : "-";
                String pilD = cells.size() > 6 ? getCellContentWithImages(cells.get(6)) : "-";
                String pilE = cells.size() > 7 ? getCellContentWithImages(cells.get(7)) : "-";
                String kunci = cells.size() > 8 ? getCellContentWithImages(cells.get(8)) : "";
                String bobotRaw = cells.size() > 9 ? getCellContentWithImages(cells.get(9)) : "";

                pilA = (pilA != null && !pilA.trim().isEmpty()) ? pilA.trim() : "-";
                pilB = (pilB != null && !pilB.trim().isEmpty()) ? pilB.trim() : "-";
                pilC = (pilC != null && !pilC.trim().isEmpty()) ? pilC.trim() : "-";
                pilD = (pilD != null && !pilD.trim().isEmpty()) ? pilD.trim() : "-";
                pilE = (pilE != null && !pilE.trim().isEmpty()) ? pilE.trim() : "-";

                pertanyaan = formatRichContent(pertanyaan);
                pilA = formatRichContent(pilA);
                pilB = formatRichContent(pilB);
                pilC = formatRichContent(pilC);
                pilD = formatRichContent(pilD);
                pilE = formatRichContent(pilE);

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

            log.info("Successfully parsed {} questions from Word (.docx) table: {}", list.size(), file.getOriginalFilename());
            return list;
        } catch (Exception e) {
            log.error("Error parsing Word (.docx) questions: ", e);
            throw new RuntimeException("Gagal membaca tabel berkas Word (.docx): " + e.getMessage(), e);
        }
    }

    /**
     * Membaca teks sel dan mengekstrak gambar yang tertanam di dalam sel Word
     * menjadi tag <img src="data:image/...;base64,...">.
     */
    private String getCellContentWithImages(XWPFTableCell cell) {
        if (cell == null) return "";
        StringBuilder sb = new StringBuilder();

        for (XWPFParagraph p : cell.getParagraphs()) {
            for (XWPFRun r : p.getRuns()) {
                String text = r.getText(0);
                if (text != null) {
                    sb.append(text);
                }

                // Ekstraksi gambar yang di-paste / insert ke dalam sel Word
                List<XWPFPicture> pictures = r.getEmbeddedPictures();
                if (pictures != null && !pictures.isEmpty()) {
                    for (XWPFPicture pic : pictures) {
                        try {
                            XWPFPictureData data = pic.getPictureData();
                            if (data != null && data.getData() != null) {
                                String mime = data.getPackagePart().getContentType();
                                if (mime == null || mime.isEmpty()) {
                                    mime = "image/png";
                                }
                                String b64 = Base64.getEncoder().encodeToString(data.getData());
                                sb.append("<p><img src=\"data:")
                                        .append(mime)
                                        .append(";base64,")
                                        .append(b64)
                                        .append("\" style=\"max-width:100%; max-height:420px; border-radius:10px; margin:8px 0; display:block; box-shadow:0 2px 8px rgba(0,0,0,0.1);\" alt=\"Gambar Soal\" /></p>");
                            }
                        } catch (Exception ex) {
                            log.warn("Gagal mengekstrak gambar dari run Word: {}", ex.getMessage());
                        }
                    }
                }
            }
            sb.append(" ");
        }

        return sb.toString().trim();
    }

    /**
     * Parse file Word dan langsung simpan ke Ujian
     */
    public int importAndSave(Long ujianId, MultipartFile file) {
        List<DraftSoalDTO> drafts = parseDocx(file);
        if (drafts.isEmpty()) {
            throw new IllegalArgumentException("Tidak ada butir soal yang valid ditemukan dalam tabel Word.");
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
}

