package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.Kelas;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface KelasRepository extends JpaRepository<Kelas, Long> {
    Optional<Kelas> findByNamaKelasIgnoreCase(String namaKelas);
}
