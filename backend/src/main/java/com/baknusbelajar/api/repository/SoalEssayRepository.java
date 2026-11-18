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
    List<SoalEssay> findByUjianMapelId(Long ujianMapelId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query(value = "DELETE FROM tb_soal_essay WHERE id = :id", nativeQuery = true)
    void deleteSoalById(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query(value = "DELETE FROM tb_soal_essay WHERE ujian_mapel_id = :ujianId", nativeQuery = true)
    void deleteByUjianMapelId(@Param("ujianId") Long ujianId);
}
