package com.baknusbelajar.api.repository;

import com.baknusbelajar.api.entity.BabQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BabQuestionRepository extends JpaRepository<BabQuestion, Long> {
    List<BabQuestion> findByBabIdOrderByAskedAtDesc(Long babId);

    List<BabQuestion> findByBabGuruMapelGuruUserUsernameOrderByAskedAtDesc(String teacherUsername);
}
