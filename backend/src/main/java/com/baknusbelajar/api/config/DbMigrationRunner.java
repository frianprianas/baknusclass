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
            "ALTER TABLE tb_soal_pg MODIFY pilihan_e NULL",
            "ALTER TABLE tb_soal_pg MODIFY kunci_jawaban VARCHAR2(50)",
            "ALTER TABLE tb_soal_pg MODIFY pilihan_a VARCHAR2(2000)",
            "ALTER TABLE tb_soal_pg MODIFY pilihan_b VARCHAR2(2000)",
            "ALTER TABLE tb_soal_pg MODIFY pilihan_c VARCHAR2(2000)",
            "ALTER TABLE tb_soal_pg MODIFY pilihan_d VARCHAR2(2000)",
            "ALTER TABLE tb_soal_pg MODIFY pilihan_e VARCHAR2(2000)",
            "ALTER TABLE tb_soal_pg ADD tipe_soal VARCHAR2(20) DEFAULT 'PG_BIASA'"
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
        System.out.println("====== Auto-Copy Soal: Checking Exams for Ujicoba ======");
        try {
            List<UjianMapel> allExams = ujianMapelRepository.findAll();
            List<UjianMapel> ujicobaExams = new java.util.ArrayList<>();

            for (UjianMapel u : allExams) {
                String mapelName = (u.getMapel() != null && u.getMapel().getNamaMapel() != null)
                        ? u.getMapel().getNamaMapel().toLowerCase() : "";
                if (mapelName.contains("ujicoba")) {
                    ujicobaExams.add(u);
                }
            }

            System.out.println("Found " + ujicobaExams.size() + " ujicoba exams in database.");

            UjianMapel sourceExam = null;
            UjianMapel targetExam = null;

            for (UjianMapel u : ujicobaExams) {
                int pgCount = soalPGRepository.findByUjianMapelId(u.getId()).size();
                int essayCount = soalEssayRepository.findByUjianMapelId(u.getId()).size();
                System.out.println("Exam ID " + u.getId() + " (" + (u.getMapel() != null ? u.getMapel().getNamaMapel() : "") + ") at " + u.getWaktuMulai() + ": " + pgCount + " PG, " + essayCount + " Essay");

                if (pgCount > 0 || essayCount > 0) {
                    if (sourceExam == null) {
                        sourceExam = u;
                    }
                } else {
                    if (targetExam == null) {
                        targetExam = u;
                    }
                }
            }

            if (sourceExam != null && targetExam != null) {
                List<SoalPG> sourcePG = soalPGRepository.findByUjianMapelId(sourceExam.getId());
                List<SoalEssay> sourceEssay = soalEssayRepository.findByUjianMapelId(sourceExam.getId());

                System.out.println("Copying " + sourcePG.size() + " PG and " + sourceEssay.size() + " Essay from Exam ID " + sourceExam.getId() + " to Exam ID " + targetExam.getId());

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

                System.out.println("Successfully copied " + copiedPG + " PG and " + copiedEssay + " Essay into Exam ID " + targetExam.getId() + "!");
            } else {
                System.out.println("Auto-copy check finished: sourceExam=" + (sourceExam != null ? sourceExam.getId() : "null") + ", targetExam=" + (targetExam != null ? targetExam.getId() : "null"));
            }
        } catch (Exception e) {
            System.err.println("Auto-copy error in DbMigrationRunner: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
