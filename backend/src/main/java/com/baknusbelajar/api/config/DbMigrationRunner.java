package com.baknusbelajar.api.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import com.baknusbelajar.api.entity.SoalEssay;
import com.baknusbelajar.api.entity.SoalPG;
import com.baknusbelajar.api.entity.UjianMapel;
import com.baknusbelajar.api.repository.SoalEssayRepository;
import com.baknusbelajar.api.repository.SoalPGRepository;
import com.baknusbelajar.api.repository.UjianMapelRepository;
import java.util.List;

@Component
public class DbMigrationRunner implements CommandLineRunner {

    private final DataSource dataSource;
    private final UjianMapelRepository ujianMapelRepository;
    private final SoalPGRepository soalPGRepository;
    private final SoalEssayRepository soalEssayRepository;

    public DbMigrationRunner(DataSource dataSource,
                             UjianMapelRepository ujianMapelRepository,
                             SoalPGRepository soalPGRepository,
                             SoalEssayRepository soalEssayRepository) {
        this.dataSource = dataSource;
        this.ujianMapelRepository = ujianMapelRepository;
        this.soalPGRepository = soalPGRepository;
        this.soalEssayRepository = soalEssayRepository;
    }

    @Override
    public void run(String... args) throws Exception {
        System.out.println("====== Running Temporary Oracle DB Schema Migration via JDBC ======");
        
        String[] sqls = {
            "ALTER TABLE tb_guru ADD is_co_admin NUMBER(1) DEFAULT 0 NOT NULL",
            "ALTER TABLE tb_forum_topik ADD is_guru_only NUMBER(1) DEFAULT 0 NOT NULL",
            "ALTER TABLE tb_forum_topik ADD creator_user_id NUMBER(19)",
            "ALTER TABLE tb_forum_topik ADD CONSTRAINT fk_forum_topik_creator FOREIGN KEY (creator_user_id) REFERENCES tb_users(id)",
            "ALTER TABLE tb_forum_topik MODIFY guru_mapel_id NULL",
            "ALTER TABLE tb_ujian_mapel ADD jenis_ujian VARCHAR2(50) DEFAULT 'UJIAN_UTAMA' NOT NULL",
            "ALTER TABLE tb_ujian_mapel ADD pembuat_guru_id NUMBER(19)",
            "ALTER TABLE tb_ujian_mapel ADD CONSTRAINT fk_ujian_mapel_pembuat FOREIGN KEY (pembuat_guru_id) REFERENCES tb_guru(id)",
            "ALTER TABLE tb_ujian_mapel MODIFY token VARCHAR2(20)",
            "ALTER TABLE tb_soal_pg MODIFY pilihan_c NULL",
            "ALTER TABLE tb_soal_pg MODIFY pilihan_d NULL",
            "ALTER TABLE tb_soal_pg MODIFY pilihan_e NULL"
        };

        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
             
            for (String sql : sqls) {
                try {
                    stmt.executeUpdate(sql);
                    System.out.println("Oracle Migration Success: " + sql);
                } catch (Exception e) {
                    System.out.println("Oracle Migration Ignored: " + e.getMessage());
                }
            }

            // Perform mapel one-time deletion check
            boolean alreadyCleared = false;
            try {
                try (var rs = stmt.executeQuery("SELECT COUNT(*) FROM tb_app_settings WHERE config_key = 'mapel_cleared_v2'")) {
                    if (rs.next() && rs.getInt(1) > 0) {
                        alreadyCleared = true;
                    }
                }
            } catch (Exception e) {
                System.out.println("Oracle Migration: tb_app_settings check failed (probably table not created yet): " + e.getMessage());
            }

            if (!alreadyCleared) {
                System.out.println("====== Running One-Time Mapel Truncation/Deletion ======");
                String[] deleteSqls = {
                    "DELETE FROM tb_ujian_mapel_kelas",
                    "DELETE FROM tb_materi_view_log",
                    "DELETE FROM tb_bab_attendance",
                    "DELETE FROM tb_bab_question",
                    "DELETE FROM tb_jawaban_siswa",
                    "DELETE FROM tb_soal_essay",
                    "DELETE FROM tb_soal_pg",
                    "DELETE FROM STATUS_UJIAN_SISWA",
                    "DELETE FROM tb_nilai_praktek",
                    "DELETE FROM tb_tugas_siswa",
                    "DELETE FROM tb_forum_komentar",
                    "DELETE FROM tb_materi",
                    "DELETE FROM tb_ujian_mapel",
                    "DELETE FROM tb_tugas_guru",
                    "DELETE FROM tb_forum_topik",
                    "DELETE FROM tb_bab",
                    "DELETE FROM tb_guru_mapel",
                    "DELETE FROM tb_siswa_mapel",
                    "DELETE FROM tb_mapel"
                };

                for (String sql : deleteSqls) {
                    try {
                        stmt.executeUpdate(sql);
                        System.out.println("One-Time Delete Success: " + sql);
                    } catch (Exception e) {
                        System.out.println("One-Time Delete Ignored/Failed: " + sql + " -> " + e.getMessage());
                    }
                }

                try {
                    stmt.executeUpdate("INSERT INTO tb_app_settings (config_key, config_value) VALUES ('mapel_cleared_v2', 'true')");
                    System.out.println("One-Time Delete Flag saved successfully to tb_app_settings.");
                } catch (Exception e) {
                    System.out.println("One-Time Delete Flag save failed: " + e.getMessage());
                }
            } else {
                System.out.println("====== Mapel Deletion Skipped (Already Cleared) ======");
            }

            
            // Ensure default Latihan / Simulasi Event exists in tb_event_ujian
            try {
                try (var rs = stmt.executeQuery("SELECT COUNT(*) FROM tb_event_ujian WHERE UPPER(nama_event) LIKE '%LATIHAN%' OR UPPER(nama_event) LIKE '%SIMULASI%'")) {
                    if (rs.next() && rs.getInt(1) == 0) {
                        stmt.executeUpdate("INSERT INTO tb_event_ujian (nama_event, semester, tahun_ajaran, tanggal_mulai, tanggal_selesai, status_aktif) VALUES ('Simulasi & Latihan CBT', 'GANJIL', '2025/2026', TO_DATE('2025-01-01', 'YYYY-MM-DD'), TO_DATE('2035-12-31', 'YYYY-MM-DD'), 1)");
                        System.out.println("Oracle Migration: Default Event LATIHAN created successfully in tb_event_ujian.");
                    }
                }
            } catch (Exception e) {
                System.out.println("Oracle Migration: Check/Insert tb_event_ujian error: " + e.getMessage());
            }

            System.out.println("====== Oracle DB Schema Migration Completed Successfully ======");
            copyQuestionsFrom16To17Sep();
        } catch (Exception e) {
            System.err.println("Oracle Migration Fatal Error: " + e.getMessage());
        }
    }

    private void copyQuestionsFrom16To17Sep() {
        System.out.println("====== Checking Auto-Copy Soal 16 Sep -> 17 Sep ======");
        try {
            boolean alreadyCopied = false;
            try (Connection conn = dataSource.getConnection();
                 Statement stmt = conn.createStatement()) {
                try (var rs = stmt.executeQuery("SELECT COUNT(*) FROM tb_app_settings WHERE config_key = 'copy_soal_16_to_17_sep_v1'")) {
                    if (rs.next() && rs.getInt(1) > 0) {
                        alreadyCopied = true;
                    }
                } catch (Exception ignored) {}
            } catch (Exception e) {
                System.out.println("Flag check error: " + e.getMessage());
            }

            if (alreadyCopied) {
                System.out.println("====== Auto-Copy Soal 16 to 17 Sep: Skipped (Flag already set) ======");
                return;
            }

            List<UjianMapel> allExams = ujianMapelRepository.findAll();
            UjianMapel sourceExam = null;
            UjianMapel targetExam = null;

            for (UjianMapel u : allExams) {
                if (u.getWaktuMulai() == null) continue;

                String mapelName = (u.getMapel() != null && u.getMapel().getNamaMapel() != null)
                        ? u.getMapel().getNamaMapel().toLowerCase() : "";
                int day = u.getWaktuMulai().getDayOfMonth();
                int month = u.getWaktuMulai().getMonthValue();
                int hour = u.getWaktuMulai().getHour();
                int minute = u.getWaktuMulai().getMinute();

                // Match 16 Sep (Row 1 in UI: 16 Sep, 19.11)
                if (month == 9 && day == 16) {
                    if (sourceExam == null || (hour == 19 && minute == 11) || mapelName.contains("ujicoba")) {
                        sourceExam = u;
                    }
                }

                // Match 17 Sep (Row 2 in UI: 17 Sep, 01.03)
                if (month == 9 && day == 17) {
                    if (targetExam == null || (hour == 1 && minute == 3) || mapelName.contains("ujicoba")) {
                        targetExam = u;
                    }
                }
            }

            if (sourceExam != null && targetExam != null) {
                System.out.println("Source Exam: ID=" + sourceExam.getId() + " (" + (sourceExam.getMapel() != null ? sourceExam.getMapel().getNamaMapel() : "-") + ", Waktu: " + sourceExam.getWaktuMulai() + ")");
                System.out.println("Target Exam: ID=" + targetExam.getId() + " (" + (targetExam.getMapel() != null ? targetExam.getMapel().getNamaMapel() : "-") + ", Waktu: " + targetExam.getWaktuMulai() + ")");

                List<SoalPG> sourcePG = soalPGRepository.findByUjianMapelId(sourceExam.getId());
                List<SoalEssay> sourceEssay = soalEssayRepository.findByUjianMapelId(sourceExam.getId());

                System.out.println("Found " + sourcePG.size() + " PG and " + sourceEssay.size() + " Essay in Source Exam ID " + sourceExam.getId());

                int copiedPG = 0;
                for (SoalPG spg : sourcePG) {
                    SoalPG newPG = SoalPG.builder()
                            .ujianMapel(targetExam)
                            .pertanyaan(spg.getPertanyaan())
                            .pilihanA(spg.getPilihanA())
                            .pilihanB(spg.getPilihanB())
                            .pilihanC(spg.getPilihanC())
                            .pilihanD(spg.getPilihanD())
                            .pilihanE(spg.getPilihanE())
                            .kunciJawaban(spg.getKunciJawaban())
                            .bobotNilai(spg.getBobotNilai())
                            .tipeSoal(spg.getTipeSoal() != null ? spg.getTipeSoal() : "PG_BIASA")
                            .build();
                    soalPGRepository.save(newPG);
                    copiedPG++;
                }

                int copiedEssay = 0;
                for (SoalEssay se : sourceEssay) {
                    SoalEssay newEssay = SoalEssay.builder()
                            .ujianMapel(targetExam)
                            .pertanyaan(se.getPertanyaan())
                            .kunciJawaban(se.getKunciJawaban())
                            .bobotNilai(se.getBobotNilai())
                            .build();
                    soalEssayRepository.save(newEssay);
                    copiedEssay++;
                }

                System.out.println("Successfully auto-copied " + copiedPG + " PG and " + copiedEssay + " Essay from 16 Sep to 17 Sep!");

                try (Connection conn = dataSource.getConnection();
                     Statement stmt = conn.createStatement()) {
                    stmt.executeUpdate("INSERT INTO tb_app_settings (config_key, config_value) VALUES ('copy_soal_16_to_17_sep_v1', 'true')");
                    System.out.println("Flag copy_soal_16_to_17_sep_v1 saved successfully.");
                } catch (Exception e) {
                    System.out.println("Error saving app settings flag: " + e.getMessage());
                }
            } else {
                System.out.println("Exam matching info: sourceExam=" + sourceExam + ", targetExam=" + targetExam);
            }
        } catch (Exception e) {
            System.err.println("Auto-copy error: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
