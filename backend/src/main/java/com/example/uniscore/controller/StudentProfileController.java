package com.example.uniscore.controller;

import com.example.uniscore.entity.Result;
import com.example.uniscore.entity.Student;
import com.example.uniscore.repo.ResultRepo;
import com.example.uniscore.repo.StudentRepo;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/students")
@CrossOrigin
public class StudentProfileController {

    private final StudentRepo studentRepo;
    private final ResultRepo resultRepo;

    public StudentProfileController(StudentRepo studentRepo, ResultRepo resultRepo) {
        this.studentRepo = studentRepo;
        this.resultRepo = resultRepo;
    }

    @GetMapping("/{regNo}/profile")
    public ResponseEntity<?> getProfile(@PathVariable String regNo) {
        // ✅ Changed to use the new StudentRepo and findById
        Student student = studentRepo.findById(regNo).orElse(null);
        
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