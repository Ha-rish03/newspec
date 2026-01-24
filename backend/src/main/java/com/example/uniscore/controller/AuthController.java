package com.example.uniscore.controller;

import com.example.uniscore.entity.Result;
import com.example.uniscore.entity.StudentUser;
import com.example.uniscore.repo.ResultRepo;
import com.example.uniscore.repo.StudentUserRepo;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = {"http://localhost:5173", "http://127.0.0.1:5173"})
public class AuthController {

    private final StudentUserRepo studentUserRepo;
    private final ResultRepo resultRepo;

    public AuthController(StudentUserRepo studentUserRepo, ResultRepo resultRepo) {
        this.studentUserRepo = studentUserRepo;
        this.resultRepo = resultRepo;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        // ✅ 1. Accept 'registerNumber' from Frontend
        String registerNumber = body.get("registerNumber");
        
        // Fallback for safety (if frontend sends old key)
        if (registerNumber == null) {
            registerNumber = body.get("rollNo");
        }
        
        if (registerNumber == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Register Number is required"));
        }

        registerNumber = registerNumber.trim();
        String password = body.get("password").trim();

        // ✅ 2. Admin Login Check
        if ("admin".equalsIgnoreCase(registerNumber) && "admin".equals(password)) {
            Map<String, Object> adminResp = new HashMap<>();
            adminResp.put("registerNumber", "admin"); // Consistent Key
            adminResp.put("name", "Administrator");
            adminResp.put("department", "All");
            adminResp.put("role", "admin");
            return ResponseEntity.ok(adminResp);
        }

        // ✅ 3. DB Lookup using new method: findByRegisterNumber
        StudentUser user = studentUserRepo.findByRegisterNumber(registerNumber);
        
        if (user == null || !user.getPassword().trim().equals(password)) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
        }

        // Normalize role
        String role = user.getRole().trim().toLowerCase();
        
        // ✅ 4. Construct Response with 'registerNumber'
        Map<String, Object> resp = new HashMap<>();
        resp.put("registerNumber", user.getRegisterNumber()); 
        resp.put("name", user.getName());
        resp.put("department", user.getDepartment());
        resp.put("role", role);

        return ResponseEntity.ok(resp);
    }

    @GetMapping("/results")
    public ResponseEntity<?> getAllResults() {
        List<Result> results = resultRepo.findAll();
        return ResponseEntity.ok(Map.of("results", results));
    }
}