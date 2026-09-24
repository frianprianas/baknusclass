package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.JawabanPG;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface JawabanPGRepository extends JpaRepository<JawabanPG, Long> {
    Optional<JawabanPG> findBySiswaIdAndSoalPGId(Long siswaId, Long soalPGId);
    List<JawabanPG> findBySoalPGId(Long soalPGId);
    List<JawabanPG> findBySiswaId(Long siswaId);
    List<JawabanPG> findBySoalPG_UjianMapel_Id(Long ujianMapelId);
    List<JawabanPG> findBySiswaIdAndSoalPG_UjianMapel_Id(Long siswaId, Long ujianMapelId);

    @Modifying
    @Transactional
    @Query("DELETE FROM JawabanPG j WHERE j.soalPG.id = :soalPGId")
    void deleteBySoalPGId(@Param("soalPGId") Long soalPGId);
}
