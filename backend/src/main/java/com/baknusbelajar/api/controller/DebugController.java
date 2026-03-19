package com.baknusbelajar.api.controller;

import com.baknusbelajar.api.service.GeminiService;
import com.baknusbelajar.api.service.FallbackAiService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.Map;

@RestController
@RequestMapping("/api/debug")
@RequiredArgsConstructor
public class DebugController {

    private final GeminiService geminiService;
    private final FallbackAiService fallbackAiService;

    @GetMapping("/gemini")
    public Mono<String> testGemini(@RequestParam(defaultValue = "Say hello") String prompt) {
        // Use reflection to call private method or just test scoreEssay if priority is
        // gemini
        // Actually doScoreGemini is private, I'll make it protected or just call
        // scoreEssay and assume we can change settings
        // Wait, I'll just change scoreEssay to take priority into account but here I
        // want to test GEMINI specifically.
        return geminiService.scoreEssayDirect(prompt, "Kunci", "Jawaban");
    }

    @GetMapping("/gemini-direct")
    public Mono<String> testGeminiDirect(@RequestParam(defaultValue = "Say hello") String prompt) {
        return geminiService.callGemini(prompt);
    }

    @GetMapping("/mistral")
    public Mono<String> testMistral(@RequestParam(defaultValue = "Say hello") String prompt) {
        return fallbackAiService.callApi(prompt);
    }

    @GetMapping("/status")
    public Mono<Map<String, String>> status() {
        return Mono.just(Map.of("status", "UP", "version", "1.1-debug"));
    }
}
