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
}
