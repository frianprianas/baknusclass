package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.SoalPG;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface SoalPGRepository extends JpaRepository<SoalPG, Long> {
    @Query("SELECT s FROM SoalPG s WHERE s.ujianMapel.id = :ujianMapelId ORDER BY COALESCE(s.urutan, 0) ASC, s.id ASC")
    List<SoalPG> findByUjianMapelId(@Param("ujianMapelId") Long ujianMapelId);

    List<SoalPG> findByUjianMapelIdOrderByUrutanAscIdAsc(Long ujianMapelId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query(value = "DELETE FROM tb_soal_pg WHERE id = :id", nativeQuery = true)
    void deleteSoalById(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query(value = "DELETE FROM tb_soal_pg WHERE ujian_mapel_id = :ujianId", nativeQuery = true)
    void deleteByUjianMapelId(@Param("ujianId") Long ujianId);
}
