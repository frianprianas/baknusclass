package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.Siswa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SiswaRepository extends JpaRepository<Siswa, Long> {
    Optional<Siswa> findByNisn(String nisn);

    Optional<Siswa> findByUserId(Long userId);

    Optional<Siswa> findByUserUsername(String username);

    List<Siswa> findByKelasId(Long kelasId);

    @Query("SELECT s FROM Siswa s LEFT JOIN FETCH s.user LEFT JOIN FETCH s.kelas")
    List<Siswa> findAllWithUserAndKelas();
}
