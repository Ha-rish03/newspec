package com.example.uniscore.controller;

import com.example.uniscore.entity.Requisition;
import com.example.uniscore.repo.RequisitionRepo;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/requisitions")
@CrossOrigin
public class RequisitionController {

    private final RequisitionRepo repo;

    public RequisitionController(RequisitionRepo repo) {
        this.repo = repo;
    }

    @GetMapping
    public ResponseEntity<?> getAll() {
        return ResponseEntity.ok(repo.findAll());
    }

    @GetMapping("/faculty/{facultyId}")
    public ResponseEntity<?> getForFaculty(@PathVariable String facultyId) {
        return ResponseEntity.ok(repo.findByFacultyId(facultyId));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Requisition req) {
        repo.save(req);
        return ResponseEntity.ok(Map.of("message", "Requisition sent successfully"));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Requisition req = repo.findById(id).orElse(null);
        if (req != null) {
            req.setStatus(body.get("status"));
            repo.save(req);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.badRequest().build();
    }

    @PostMapping("/{id}/details")
    public ResponseEntity<?> saveDetails(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Requisition req = repo.findById(id).orElse(null);
        if (req != null) {
            // Detailed Google Form mappings
            if (body.containsKey("facultyName")) req.setFacultyName((String) body.get("facultyName"));
            if (body.containsKey("designation")) req.setDesignation((String) body.get("designation"));
            if (body.containsKey("collegeNameCode")) req.setCollegeNameCode((String) body.get("collegeNameCode"));
            if (body.containsKey("qpDept")) req.setQpDept((String) body.get("qpDept"));
            if (body.containsKey("examinerDept")) req.setExaminerDept((String) body.get("examinerDept"));
            if (body.containsKey("mobile")) req.setMobile((String) body.get("mobile"));
            if (body.containsKey("email")) req.setEmail((String) body.get("email"));
            if (body.containsKey("qpType")) req.setQpType((String) body.get("qpType"));
            if (body.containsKey("semesterAndReg")) req.setSemesterAndReg((String) body.get("semesterAndReg"));
            if (body.containsKey("amountClaimed")) req.setAmountClaimed((String) body.get("amountClaimed"));
            if (body.containsKey("mailedConfirmation")) req.setMailedConfirmation((Boolean) body.get("mailedConfirmation"));
            
            if (body.containsKey("aicteId")) req.setAicteId((String) body.get("aicteId"));
            if (body.containsKey("pan")) req.setPan((String) body.get("pan"));
            if (body.containsKey("address")) req.setAddress((String) body.get("address"));
            
            // Bank Details
            if (body.containsKey("accountNo")) req.setAccountNo((String) body.get("accountNo"));
            if (body.containsKey("ifsc")) req.setIfsc((String) body.get("ifsc"));
            if (body.containsKey("bankName")) req.setBankName((String) body.get("bankName"));
            if (body.containsKey("branchName")) req.setBranchName((String) body.get("branchName"));
            
            // Auto Calculated baseline reference
            if (body.containsKey("totalAmount")) req.setTotalAmount(String.valueOf(body.get("totalAmount")));

            repo.save(req);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.badRequest().build();
    }
}