package com.example.uniscore.controller;

import com.example.uniscore.entity.*;
import com.example.uniscore.repo.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin
public class AuthController {

    private final StudentRepo studentRepo;
    private final FacultyRepo facultyRepo;
    private final HodRepo hodRepo;
    private final ResultRepo resultRepo;

    public AuthController(StudentRepo studentRepo, FacultyRepo facultyRepo, HodRepo hodRepo, ResultRepo resultRepo) {
        this.studentRepo = studentRepo;
        this.facultyRepo = facultyRepo;
        this.hodRepo = hodRepo;
        this.resultRepo = resultRepo;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String registerNumber = body.get("registerNumber");
        String password = body.get("password");
        String role = body.get("role"); // React sends this! (student, faculty, hod, admin)

        if (registerNumber == null || password == null || role == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing credentials"));
        }

        registerNumber = registerNumber.trim();
        password = password.trim();

        // 1. Admin Login
        if ("admin".equalsIgnoreCase(role)) {
            if ("admin".equalsIgnoreCase(registerNumber) && "admin".equals(password)) {
                Map<String, Object> adminResp = new HashMap<>();
                adminResp.put("registerNumber", "admin");
                adminResp.put("name", "Administrator");
                adminResp.put("department", "All");
                adminResp.put("role", "admin");
                return ResponseEntity.ok(adminResp);
            }
            return ResponseEntity.status(401).body(Map.of("error", "Invalid admin credentials"));
        }

        String name = "";
        String dept = "";

        // 2. Check specific table based on the selected role
        if ("student".equalsIgnoreCase(role)) {
            Student s = studentRepo.findById(registerNumber).orElse(null);
            if (s == null || !s.getPassword().trim().equals(password)) {
                return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
            }
            name = s.getName();
            dept = s.getDepartment();
        } 
        else if ("faculty".equalsIgnoreCase(role)) {
            Faculty f = facultyRepo.findById(registerNumber).orElse(null);
            if (f == null || !f.getPassword().trim().equals(password)) {
                return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
            }
            name = f.getName();
            dept = f.getDepartment();
        } 
        else if ("hod".equalsIgnoreCase(role)) {
            Hod h = hodRepo.findById(registerNumber).orElse(null);
            if (h == null || !h.getPassword().trim().equals(password)) {
                return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
            }
            name = h.getName();
            dept = h.getDepartment();
        } else {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid role selected"));
        }

        // 3. Success Response
        Map<String, Object> resp = new HashMap<>();
        resp.put("registerNumber", registerNumber); 
        resp.put("name", name);
        resp.put("department", dept);
        resp.put("role", role);

        return ResponseEntity.ok(resp);
    }

    @GetMapping("/results")
    public ResponseEntity<?> getAllResults() {
        List<Result> results = resultRepo.findAll();
        return ResponseEntity.ok(Map.of("results", results));
    }
}