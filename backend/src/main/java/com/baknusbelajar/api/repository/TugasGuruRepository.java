package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.TugasGuru;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TugasGuruRepository extends JpaRepository<TugasGuru, Long> {
    List<TugasGuru> findByGuruMapelId(Long guruMapelId);
}
