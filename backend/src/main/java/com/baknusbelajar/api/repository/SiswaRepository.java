package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.Siswa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SiswaRepository extends JpaRepository<Siswa, Long> {
    Optional<Siswa> findByNisn(String nisn);

    Optional<Siswa> findByUserId(Long userId);

    List<Siswa> findByKelasId(Long kelasId);

}
