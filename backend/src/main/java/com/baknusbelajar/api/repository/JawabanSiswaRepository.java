package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.JawabanSiswa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JawabanSiswaRepository extends JpaRepository<JawabanSiswa, Long> {
    List<JawabanSiswa> findBySiswaId(Long siswaId);

    List<JawabanSiswa> findBySoalEssayId(Long soalId);

    Optional<JawabanSiswa> findBySiswaIdAndSoalEssayId(Long siswaId, Long soalId);

    List<JawabanSiswa> findBySoalEssay_UjianMapel_Id(Long ujianId);

    List<JawabanSiswa> findBySiswaIdAndSoalEssay_UjianMapel_Id(Long siswaId, Long ujianId);

    long countBySkorFinalGuruIsNull();
    long countBySoalEssay_UjianMapel_Guru_IdAndSkorFinalGuruIsNull(Long guruId);
    List<JawabanSiswa> findBySoalEssay_UjianMapel_Guru_Id(Long guruId);
}
