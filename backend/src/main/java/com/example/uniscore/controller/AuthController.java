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
            // First, check the database to see if a custom admin password has been set
            Student adminUser = studentRepo.findById("admin").orElse(null);
            boolean isValidAdmin = false;

            if (adminUser != null) {
                // Check against the database password
                isValidAdmin = adminUser.getPassword().equals(password);
            } else {
                // If not in database yet, fallback to default hardcoded "admin" password
                isValidAdmin = "admin".equalsIgnoreCase(registerNumber) && "admin".equals(password);
            }

            if (isValidAdmin) {
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

    // ✅ NEW: Endpoint to securely change the Admin Password
    @PutMapping("/admin/password")
    public ResponseEntity<?> updateAdminPassword(@RequestBody Map<String, String> payload) {
        String newPassword = payload.get("password");
        
        if (newPassword == null || newPassword.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password cannot be empty"));
        }

        // Fetch the admin user from the database
        Student adminUser = studentRepo.findById("admin").orElse(null);
        
        if (adminUser != null) {
            // Update existing admin
            adminUser.setPassword(newPassword.trim());
            studentRepo.save(adminUser);
            return ResponseEntity.ok(Map.of("message", "Admin password updated successfully!"));
        } else {
            // If "admin" doesn't exist in DB yet, create it so we can store the password
            Student newAdmin = new Student();
            newAdmin.setRegisterNumber("admin");
            newAdmin.setPassword(newPassword.trim());
            newAdmin.setRole("admin");
            newAdmin.setName("System Admin");
            studentRepo.save(newAdmin);
            return ResponseEntity.ok(Map.of("message", "Admin password created successfully!"));
        }
    }

    @GetMapping("/results")
    public ResponseEntity<?> getAllResults() {
        List<Result> results = resultRepo.findAll();
        return ResponseEntity.ok(Map.of("results", results));
    }
}