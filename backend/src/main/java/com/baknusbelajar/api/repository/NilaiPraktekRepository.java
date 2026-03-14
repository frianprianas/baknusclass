package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.NilaiPraktek;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NilaiPraktekRepository extends JpaRepository<NilaiPraktek, Long> {
    List<NilaiPraktek> findByUjianMapelId(Long ujianMapelId);

    Optional<NilaiPraktek> findByUjianMapelIdAndSiswaId(Long ujianMapelId, Long siswaId);
}
