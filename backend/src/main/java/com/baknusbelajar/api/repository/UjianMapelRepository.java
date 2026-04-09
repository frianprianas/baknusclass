package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.UjianMapel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UjianMapelRepository extends JpaRepository<UjianMapel, Long> {
    List<UjianMapel> findByEventUjianId(Long eventId);

    List<UjianMapel> findByGuruMapelId(Long guruMapelId);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT u FROM UjianMapel u WHERE u.eventUjian.id = :eventId AND (" +
           "u.guruMapel.kelas.id = :kelasId OR " +
           "(u.guruMapel.kelas IS NULL AND u.guruMapel.mapel.id IN (SELECT sm.mapel.id FROM com.baknusbelajar.api.entity.SiswaMapel sm WHERE sm.siswa.id = :siswaId)))")
    List<UjianMapel> findByEventAndStudent(Long eventId, Long kelasId, Long siswaId);
}
