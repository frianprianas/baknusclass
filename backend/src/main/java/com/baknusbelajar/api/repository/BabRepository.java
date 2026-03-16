package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.Bab;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BabRepository extends JpaRepository<Bab, Long> {
    List<Bab> findByGuruMapelIdOrderByUrutanAsc(Long guruMapelId);
}
