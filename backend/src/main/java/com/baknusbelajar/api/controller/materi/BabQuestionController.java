package com.baknusbelajar.api.controller.materi;

import com.baknusbelajar.api.dto.materi.BabQuestionDTO;
import com.baknusbelajar.api.service.BabQuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bab-questions")
@RequiredArgsConstructor
public class BabQuestionController {

    private final BabQuestionService babQuestionService;

    @GetMapping("/bab/{babId}")
    public ResponseEntity<List<BabQuestionDTO>> getQuestions(@PathVariable Long babId) {
        return ResponseEntity.ok(babQuestionService.getQuestionsByBab(babId));
    }

    @PostMapping("/bab/{babId}")
    @PreAuthorize("hasRole('SISWA')")
    public ResponseEntity<BabQuestionDTO> askQuestion(
            @PathVariable Long babId,
            @RequestBody String question,
            Authentication auth) {
        // Raw string from body
        return ResponseEntity.ok(babQuestionService.askQuestion(babId, auth.getName(), question));
    }

    @PutMapping("/{id}/answer")
    @PreAuthorize("hasRole('GURU')")
    public ResponseEntity<BabQuestionDTO> answerQuestion(
            @PathVariable Long id,
            @RequestBody String answer) {
        return ResponseEntity.ok(babQuestionService.answerQuestion(id, answer));
    }
}
