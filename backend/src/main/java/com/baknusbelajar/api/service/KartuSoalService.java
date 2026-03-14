package com.baknusbelajar.api.service;

import com.baknusbelajar.api.dto.exam.KartuSoalRequest;
import com.baknusbelajar.api.entity.SoalEssay;
import com.baknusbelajar.api.entity.UjianMapel;
import com.baknusbelajar.api.repository.SoalEssayRepository;
import com.baknusbelajar.api.repository.UjianMapelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

@Slf4j
@Service
@RequiredArgsConstructor
public class KartuSoalService {

    private final UjianMapelRepository ujianMapelRepository;
    private final SoalEssayRepository soalEssayRepository;
    private final BaknusDriveService baknusDriveService;

    @Transactional
    @CacheEvict(value = "soalEssayCache", allEntries = true)
    public String createKartuSoal(KartuSoalRequest request) {
        UjianMapel ujian = ujianMapelRepository.findById(request.getUjianMapelId())
                .orElseThrow(() -> new RuntimeException("Ujian tidak ditemukan"));

        // Prevent Oracle empty string mapped to NULL error
        String pertanyaan = request.getPetunjukAssesment();
        if (pertanyaan == null || pertanyaan.trim().isEmpty())
            pertanyaan = "-";

        String kunciJawaban = request.getKunciJawaban();
        if (kunciJawaban == null || kunciJawaban.trim().isEmpty())
            kunciJawaban = "-";

        SoalEssay soal;
        // If soalEssayId is provided, update existing; otherwise create new
        if (request.getSoalEssayId() != null) {
            soal = soalEssayRepository.findById(request.getSoalEssayId())
                    .orElseThrow(() -> new RuntimeException("Soal tidak ditemukan"));
        } else {
            soal = new SoalEssay();
            soal.setUjianMapel(ujian);
        }

        soal.setPertanyaan(pertanyaan);
        soal.setKunciJawaban(kunciJawaban);
        soal.setBobotNilai(request.getBobotNilai() != null ? request.getBobotNilai() : 10.0);
        soalEssayRepository.save(soal);

        // 2. Generate Docx
        byte[] docxBytes = generateDocx(request, ujian);

        // 3. Upload to BaknusDrive
        String safeJudul = (request.getJudul() != null ? request.getJudul() : "Kartu").replaceAll("[^a-zA-Z0-9]", "_");
        String noSoal = request.getNomorSoal() != null ? "_" + request.getNomorSoal() : "";
        String fileName = "Kartu_Soal_" + safeJudul + noSoal + ".docx";

        Resource resource = new ByteArrayResource(docxBytes) {
            @Override
            public String getFilename() {
                return fileName;
            }
        };

        try {
            return baknusDriveService.uploadFileResource(
                    ujian.getEventUjian().getNamaEvent(),
                    ujian.getGuruMapel().getMapel().getNamaMapel(),
                    resource);
        } catch (Exception e) {
            log.error("Gagal upload kartu soal ke drive: {}", e.getMessage());
            return "Soal tersimpan di DB, tapi gagal upload ke Drive: " + e.getMessage();
        }
    }

    @Transactional
    public void generateAndUploadAutoKartuSoal(UjianMapel ujian, String pertanyaan, String kunciJawaban, Double bobot,
            String jenis) {
        try {
            KartuSoalRequest req = new KartuSoalRequest();
            req.setUjianMapelId(ujian.getId());
            req.setJudul("Soal " + jenis + " - " + ujian.getGuruMapel().getMapel().getNamaMapel());
            req.setTujuanPembelajaran("-");
            req.setKriteriaKetercapaian("-");
            req.setPetunjukAssesment(pertanyaan);
            req.setKunciJawaban(kunciJawaban);
            req.setBobotNilai(bobot);
            req.setNomorSoal(null);

            byte[] docxBytes = generateDocx(req, ujian);
            String fileName = "Kartu_Soal_Auto_" + jenis + "_" + System.currentTimeMillis() + ".docx";

            Resource resource = new ByteArrayResource(docxBytes) {
                @Override
                public String getFilename() {
                    return fileName;
                }
            };

            baknusDriveService.uploadFileResource(
                    ujian.getEventUjian().getNamaEvent(),
                    ujian.getGuruMapel().getMapel().getNamaMapel(),
                    resource);
        } catch (Exception e) {
            log.error("Gagal auto upload kartu soal ke drive (Terjadi error di service): {}", e.getMessage(), e);
        }
    }

    private byte[] generateDocx(KartuSoalRequest request, UjianMapel ujian) {
        try (XWPFDocument document = new XWPFDocument();
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // Header/Judul
            XWPFParagraph title = document.createParagraph();
            title.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun titleRun = title.createRun();
            titleRun.setBold(true);
            titleRun.setFontSize(16);
            titleRun.setText("KARTU SOAL");

            if (request.getNomorSoal() != null) {
                XWPFParagraph noPara = document.createParagraph();
                noPara.setAlignment(ParagraphAlignment.CENTER);
                XWPFRun noRun = noPara.createRun();
                noRun.setBold(true);
                noRun.setFontSize(14);
                noRun.setText("NOMOR: " + request.getNomorSoal());
            }

            XWPFParagraph subTitle = document.createParagraph();
            subTitle.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun subRun = subTitle.createRun();
            subRun.setBold(true);
            subRun.setFontSize(14);
            subRun.setText(request.getJudul());

            // Info Section
            addInfoRow(document, "Mata Pelajaran", ujian.getGuruMapel().getMapel().getNamaMapel());
            addInfoRow(document, "Guru Pengampu", ujian.getGuruMapel().getGuru().getNamaLengkap());
            addInfoRow(document, "Event", ujian.getEventUjian().getNamaEvent());
            if (request.getBobotNilai() != null) {
                addInfoRow(document, "Bobot Nilai", String.valueOf(request.getBobotNilai()));
            }

            document.createParagraph(); // Spacer

            // Main Sections with basic styling
            addSection(document, "A. TUJUAN PEMBELAJARAN", request.getTujuanPembelajaran());
            addSection(document, "B. KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP)",
                    request.getKriteriaKetercapaian());
            addSection(document, "C. PETUNJUK ASSESMENT / SOAL", stripHtml(request.getPetunjukAssesment()));
            addSection(document, "D. KUNCI JAWABAN", stripHtml(request.getKunciJawaban()));
            addSection(document, "E. RUBRIK PENILAIAN", "Terlampir sesuai standar penilaian sekolah.");

            document.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Gagal menjurnal kartu soal ke Word", e);
        }
    }

    private void addInfoRow(XWPFDocument doc, String label, String value) {
        XWPFParagraph p = doc.createParagraph();
        XWPFRun r1 = p.createRun();
        r1.setBold(true);
        r1.setText(label + ": ");
        XWPFRun r2 = p.createRun();
        r2.setText(value);
    }

    private void addSection(XWPFDocument doc, String header, String content) {
        XWPFParagraph hPara = doc.createParagraph();
        hPara.setSpacingBefore(200);
        XWPFRun hRun = hPara.createRun();
        hRun.setBold(true);
        hRun.setUnderline(UnderlinePatterns.SINGLE);
        hRun.setText(header);

        XWPFParagraph cPara = doc.createParagraph();
        XWPFRun cRun = cPara.createRun();
        cRun.setText(content != null ? content : "-");
    }

    private String stripHtml(String html) {
        if (html == null)
            return "";
        return html.replaceAll("<[^>]*>", "");
    }
}
