package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.SoalEssay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface SoalEssayRepository extends JpaRepository<SoalEssay, Long> {
    @Query("SELECT s FROM SoalEssay s WHERE s.ujianMapel.id = :ujianMapelId ORDER BY COALESCE(s.urutan, 0) ASC, s.id ASC")
    List<SoalEssay> findByUjianMapelId(@Param("ujianMapelId") Long ujianMapelId);

    List<SoalEssay> findByUjianMapelIdOrderByUrutanAscIdAsc(Long ujianMapelId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query(value = "DELETE FROM tb_soal_essay WHERE id = :id", nativeQuery = true)
    void deleteSoalById(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query(value = "DELETE FROM tb_soal_essay WHERE ujian_mapel_id = :ujianId", nativeQuery = true)
    void deleteByUjianMapelId(@Param("ujianId") Long ujianId);
}
