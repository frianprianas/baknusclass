package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.SoalEssay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SoalEssayRepository extends JpaRepository<SoalEssay, Long> {
    List<SoalEssay> findByUjianMapelId(Long ujianMapelId);
}
