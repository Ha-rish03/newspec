package com.example.uniscore.controller;

import com.example.uniscore.dto.QuestionPaperRequest;
import com.example.uniscore.service.QuestionPaperService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/faculty")
@CrossOrigin
public class FacultyController {

    private final QuestionPaperService questionPaperService;

    public FacultyController(QuestionPaperService questionPaperService) {
        this.questionPaperService = questionPaperService;
    }

    @PostMapping("/save-question-paper")
    public ResponseEntity<?> saveQuestionPaper(@RequestBody QuestionPaperRequest request) {
        try {
            String savedPath = questionPaperService.saveToWord(request);
            return ResponseEntity.ok(Map.of("message", "Semester Paper saved", "path", savedPath));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/save-unit-test")
    public ResponseEntity<?> saveUnitTest(@RequestBody QuestionPaperRequest request) {
        try {
            String savedPath = questionPaperService.saveUnitTestToWord(request);
            return ResponseEntity.ok(Map.of("message", "Unit Test saved", "path", savedPath));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}