package com.example.uniscore.controller;

import com.example.uniscore.entity.Result;
import com.example.uniscore.entity.Student;
import com.example.uniscore.repo.ResultRepo;
import com.example.uniscore.repo.StudentRepo;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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

    // --- NEW: Upload Photo Endpoint ---
    @PostMapping("/{regNo}/photo")
    public ResponseEntity<?> uploadPhoto(@PathVariable String regNo, @RequestParam("photo") MultipartFile file) {
        try {
            Student student = studentRepo.findById(regNo).orElse(null);
            if (student == null) return ResponseEntity.badRequest().body(Map.of("error", "Student not found"));
            
            student.setPhoto(file.getBytes());
            studentRepo.save(student);
            
            return ResponseEntity.ok(Map.of("message", "Photo uploaded successfully"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Could not upload photo"));
        }
    }

    // --- NEW: Serve Photo to the React App ---
    @GetMapping("/{regNo}/photo")
    public ResponseEntity<byte[]> getPhoto(@PathVariable String regNo) {
        Student student = studentRepo.findById(regNo).orElse(null);
        if (student == null || student.getPhoto() == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.IMAGE_JPEG_VALUE)
                .body(student.getPhoto());
    }
}