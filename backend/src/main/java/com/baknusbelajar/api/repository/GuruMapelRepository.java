package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.GuruMapel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GuruMapelRepository extends JpaRepository<GuruMapel, Long> {
    List<GuruMapel> findByGuruId(Long guruId);

    List<GuruMapel> findByMapelId(Long mapelId);

    void deleteByGuruId(Long guruId);

    List<GuruMapel> findByKelasId(Long kelasId);

    @org.springframework.data.jpa.repository.Query("SELECT CASE WHEN (" +
           "EXISTS (SELECT 1 FROM UjianMapel u WHERE u.guruMapel.id = :id) OR " +
           "EXISTS (SELECT 1 FROM Materi m WHERE m.guruMapel.id = :id) OR " +
           "EXISTS (SELECT 1 FROM ForumTopik f WHERE f.guruMapel.id = :id) OR " +
           "EXISTS (SELECT 1 FROM Bab b WHERE b.guruMapel.id = :id)" +
           ") THEN false ELSE true END FROM GuruMapel gm WHERE gm.id = :id")
    boolean isSafeToDelete(Long id);
}
