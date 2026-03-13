package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.SiswaMapel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SiswaMapelRepository extends JpaRepository<SiswaMapel, Long> {
    List<SiswaMapel> findBySiswaId(Long siswaId);

    List<SiswaMapel> findByMapelId(Long mapelId);

    boolean existsBySiswaIdAndMapelId(Long siswaId, Long mapelId);

}
