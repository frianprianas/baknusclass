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
            "ALTER TABLE tb_forum_topik MODIFY guru_mapel_id NULL"
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
            System.out.println("====== Oracle DB Schema Migration Completed Successfully ======");
        } catch (Exception e) {
            System.err.println("Oracle Migration Fatal Error: " + e.getMessage());
        }
    }
}
