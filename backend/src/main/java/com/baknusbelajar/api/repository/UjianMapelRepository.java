package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.UjianMapel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UjianMapelRepository extends JpaRepository<UjianMapel, Long> {
    List<UjianMapel> findByEventUjianId(Long eventId);

    List<UjianMapel> findByGuruId(Long guruId);

    long countByGuruIdAndEventUjian_StatusAktifTrue(Long guruId);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT u FROM UjianMapel u WHERE u.eventUjian.id = :eventId AND (" +
           "EXISTS (SELECT 1 FROM com.baknusbelajar.api.entity.GuruMapel gm WHERE gm.mapel.id = u.mapel.id AND gm.guru.id = u.guru.id " +
           "AND gm.kelas.id = (SELECT s.kelas.id FROM com.baknusbelajar.api.entity.Siswa s WHERE s.id = :siswaId)))")
    List<UjianMapel> findByEventAndStudent(Long eventId, Long siswaId);
}
