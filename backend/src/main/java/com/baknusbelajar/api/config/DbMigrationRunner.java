package com.baknusbelajar.api.config;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DbMigrationRunner implements CommandLineRunner {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        System.out.println("====== Running Temporary Oracle DB Schema Migration ======");
        try {
            // 1. is_co_admin
            try {
                entityManager.createNativeQuery("ALTER TABLE tb_guru ADD is_co_admin NUMBER(1) DEFAULT 0 NOT NULL").executeUpdate();
                System.out.println("Oracle Migration: Added is_co_admin to tb_guru");
            } catch (Exception e) {
                // Ignore if already exists (ORA-01430: column being added already exists in table)
            }

            // 2. is_guru_only
            try {
                entityManager.createNativeQuery("ALTER TABLE tb_forum_topik ADD is_guru_only NUMBER(1) DEFAULT 0 NOT NULL").executeUpdate();
                System.out.println("Oracle Migration: Added is_guru_only to tb_forum_topik");
            } catch (Exception e) {
            }

            // 3. creator_user_id
            try {
                entityManager.createNativeQuery("ALTER TABLE tb_forum_topik ADD creator_user_id NUMBER(19)").executeUpdate();
                System.out.println("Oracle Migration: Added creator_user_id to tb_forum_topik");
            } catch (Exception e) {
            }

            // 4. foreign key for creator_user_id
            try {
                entityManager.createNativeQuery("ALTER TABLE tb_forum_topik ADD CONSTRAINT fk_forum_topik_creator FOREIGN KEY (creator_user_id) REFERENCES tb_users(id)").executeUpdate();
                System.out.println("Oracle Migration: Added FK constraint fk_forum_topik_creator");
            } catch (Exception e) {
            }

            // 5. modify guru_mapel_id to NULL
            try {
                entityManager.createNativeQuery("ALTER TABLE tb_forum_topik MODIFY guru_mapel_id NULL").executeUpdate();
                System.out.println("Oracle Migration: Modified guru_mapel_id to nullable");
            } catch (Exception e) {
            }
            
            System.out.println("====== Oracle DB Schema Migration Completed Successfully ======");
        } catch (Exception e) {
            System.err.println("Oracle Migration error: " + e.getMessage());
        }
    }
}
