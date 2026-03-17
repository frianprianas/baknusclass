package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.ForumKomentar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ForumKomentarRepository extends JpaRepository<ForumKomentar, Long> {
    List<ForumKomentar> findByTopikIdOrderByCreatedAtAsc(Long topikId);
}
