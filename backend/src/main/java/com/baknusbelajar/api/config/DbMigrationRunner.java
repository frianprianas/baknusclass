package com.baknusbelajar.api.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

@Component
public class DbMigrationRunner implements CommandLineRunner {

    private final DataSource dataSource;

    public DbMigrationRunner(DataSource dataSource) {
        this.dataSource = dataSource;
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
            "ALTER TABLE tb_ujian_mapel ADD CONSTRAINT fk_ujian_mapel_pembuat FOREIGN KEY (pembuat_guru_id) REFERENCES tb_guru(id)"
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

            System.out.println("====== Oracle DB Schema Migration Completed Successfully ======");
        } catch (Exception e) {
            System.err.println("Oracle Migration Fatal Error: " + e.getMessage());
        }
    }
}
