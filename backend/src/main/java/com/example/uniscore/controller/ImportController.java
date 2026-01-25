package com.example.uniscore.controller;

import com.example.uniscore.entity.*;
import com.example.uniscore.repo.*;
import com.example.uniscore.service.InternalUploadService;
import com.example.uniscore.service.ResultCalculationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/import")
//@CrossOrigin(origins = {"http://localhost:5173", "http://127.0.0.1:5173"})
public class ImportController {

    private final StudentUserRepo studentUserRepo;
    private final SubjectRepo subjectRepo;
    private final ExternalMarksRepo externalMarksRepo;
    private final InternalUploadService internalUploadService;
    private final ResultCalculationService resultCalculationService;

    public ImportController(
            StudentUserRepo studentUserRepo,
            SubjectRepo subjectRepo,
            ExternalMarksRepo externalMarksRepo,
            InternalUploadService internalUploadService,
            ResultCalculationService resultCalculationService
    ) {
        this.studentUserRepo = studentUserRepo;
        this.subjectRepo = subjectRepo;
        this.externalMarksRepo = externalMarksRepo;
        this.internalUploadService = internalUploadService;
        this.resultCalculationService = resultCalculationService;
    }

    // 1A. Upload Student Master (Logins) - POST
    @PostMapping("/logins")
    public ResponseEntity<?> importStudents(@RequestBody List<StudentUser> students) {
        studentUserRepo.saveAll(students);
        return ResponseEntity.ok("Uploaded " + students.size() + " students.");
    }

    // ✅ 1B. FETCH STUDENTS (This was missing!) - GET
    @GetMapping("/logins")
    public ResponseEntity<List<StudentUser>> getAllStudents() {
        return ResponseEntity.ok(studentUserRepo.findAll());
    }

    // 2. Upload Subject Master
    @PostMapping("/subjects")
    public ResponseEntity<?> importSubjects(@RequestBody List<Subject> subjects) {
        subjectRepo.saveAll(subjects);
        return ResponseEntity.ok("Uploaded " + subjects.size() + " subjects.");
    }

    // 3. Fetch Subjects for Dropdowns
    @GetMapping("/fetch-subjects")
    public ResponseEntity<List<Subject>> fetchSubjects(
            @RequestParam String department,
            @RequestParam int semester,
            @RequestParam String paperType
    ) {
        List<Subject> all = subjectRepo.findAll();
        List<Subject> filtered = all.stream()
                .filter(s -> s.getDepartment().equalsIgnoreCase(department))
                .filter(s -> s.getSemester() == semester)
                .filter(s -> s.getPaperType().equalsIgnoreCase(paperType))
                .collect(Collectors.toList());
        return ResponseEntity.ok(filtered);
    }

    // 4. Upload Internal Marks
    @PostMapping("/internal-upload")
    public ResponseEntity<?> uploadInternals(
            @RequestParam("file") MultipartFile file,
            @RequestParam("subjectCode") String subjectCode
    ) {
        try {
            Subject subject = subjectRepo.findById(subjectCode)
                    .orElseThrow(() -> new RuntimeException("Subject not found: " + subjectCode));
            internalUploadService.processInternalUpload(file, subject);
            return ResponseEntity.ok("Internals saved for " + subject.getSubjectName());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    // 5. Upload External Marks
    @PostMapping("/external")
    public ResponseEntity<?> importExternals(@RequestBody List<ExternalMarks> marks) {
        externalMarksRepo.saveAll(marks);
        return ResponseEntity.ok("Imported " + marks.size() + " external marks.");
    }

    // 6. Calculate Results (Draft)
    @PostMapping("/calculate-results")
    public ResponseEntity<?> calculateResults() {
        try {
            resultCalculationService.calculateResults();
            return ResponseEntity.ok("Results calculated! They are currently HIDDEN (Draft Mode).");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Calculation failed: " + e.getMessage());
        }
    }

    // 7. Preview Results (Dept specific)
    @GetMapping("/preview")
    public ResponseEntity<?> previewResults(
            @RequestParam String semester,
            @RequestParam String department
    ) {
        return ResponseEntity.ok(resultCalculationService.getResultsBySemAndDept(semester, department));
    }

    // 8. Publish Results (Dept specific)
    @PostMapping("/publish")
    public ResponseEntity<?> publishResults(
            @RequestParam String semester,
            @RequestParam String department
    ) {
        resultCalculationService.publishResults(semester, department);
        return ResponseEntity.ok("Results for " + department + " Sem " + semester + " are now LIVE!");
    }
}