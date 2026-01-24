package com.example.uniscore.controller;

import com.example.uniscore.entity.Result;
import com.example.uniscore.entity.StudentUser;
import com.example.uniscore.repo.ResultRepo;
import com.example.uniscore.repo.StudentUserRepo;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/students")
@CrossOrigin
public class StudentProfileController {

    private final StudentUserRepo studentUserRepo;
    private final ResultRepo resultRepo;

    public StudentProfileController(StudentUserRepo studentUserRepo, ResultRepo resultRepo) {
        this.studentUserRepo = studentUserRepo;
        this.resultRepo = resultRepo;
    }

    @GetMapping("/{regNo}/profile")
    public ResponseEntity<?> getProfile(@PathVariable String regNo) {
        StudentUser student = studentUserRepo.findByRegisterNumber(regNo);
        if (student == null) {
            return ResponseEntity.notFound().build();
        }

        // ✅ SECURITY: Only fetch results where isPublished = true
        List<Result> results = resultRepo.findByRegisterNumberAndIsPublishedTrue(regNo);

        return ResponseEntity.ok(Map.of(
            "student", student,
            "results", results
        ));
    }
}