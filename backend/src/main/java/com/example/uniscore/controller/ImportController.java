package com.example.uniscore.controller;

import com.example.uniscore.dto.UserUploadDto;
import com.example.uniscore.entity.*;
import com.example.uniscore.repo.*;
import com.example.uniscore.service.InternalUploadService;
import com.example.uniscore.service.ManualUploadService; 
import com.example.uniscore.service.ResultCalculationService;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/import")
@CrossOrigin
public class ImportController {

    private final StudentRepo studentRepo;
    private final FacultyRepo facultyRepo;
    private final HodRepo hodRepo;
    private final SubjectRepo subjectRepo;
    private final ExternalMarksRepo externalMarksRepo;
    private final InternalMarksRepo internalMarksRepo; 
    private final InternalUploadService internalUploadService;
    private final ResultCalculationService resultCalculationService;
    private final ManualUploadService manualUploadService; 
    private final ResultRepo resultRepo;
    
    // ✅ ADDED Question Paper Repository
    private final QuestionPaperRepo questionPaperRepo;

    public ImportController(
            StudentRepo studentRepo, FacultyRepo facultyRepo, HodRepo hodRepo,
            SubjectRepo subjectRepo, ExternalMarksRepo externalMarksRepo, InternalMarksRepo internalMarksRepo,
            InternalUploadService internalUploadService, ResultCalculationService resultCalculationService,
            ManualUploadService manualUploadService, ResultRepo resultRepo,
            QuestionPaperRepo questionPaperRepo 
    ) {
        this.studentRepo = studentRepo; this.facultyRepo = facultyRepo; this.hodRepo = hodRepo;
        this.subjectRepo = subjectRepo; this.externalMarksRepo = externalMarksRepo; this.internalMarksRepo = internalMarksRepo;
        this.internalUploadService = internalUploadService; this.resultCalculationService = resultCalculationService;
        this.manualUploadService = manualUploadService; this.resultRepo = resultRepo;
        this.questionPaperRepo = questionPaperRepo; 
    }

    @PostMapping("/subjects")
    public ResponseEntity<?> uploadSubjects(@RequestBody List<Subject> subjects) {
        for (Subject s : subjects) {
            Subject existing = subjectRepo.findBySubjectCodeAndDepartment(s.getSubjectCode(), s.getDepartment());
            if (existing != null) {
                s.setId(existing.getId()); 
            }
            subjectRepo.save(s);
        }
        return ResponseEntity.ok(Map.of("message", "Subjects uploaded successfully", "count", subjects.size()));
    }

    @PostMapping("/logins")
    public ResponseEntity<?> uploadLogins(@RequestBody List<UserUploadDto> users) {
        int count = 0;
        for (UserUploadDto u : users) {
            if ("student".equalsIgnoreCase(u.getRole())) {
                Student s = new Student();
                s.setRegisterNumber(u.getRegisterNumber()); 
                s.setName(u.getName());
                s.setPassword(u.getPassword()); 
                s.setDepartment(u.getDepartment());
                s.setSemester(u.getSemester());
                
                if (u.getSemester() != null) {
                    s.setYear((int) Math.ceil(u.getSemester() / 2.0));
                }
                
                studentRepo.save(s);
            } else if ("faculty".equalsIgnoreCase(u.getRole())) {
                Faculty f = new Faculty();
                f.setRegisterNumber(u.getRegisterNumber()); f.setName(u.getName());
                f.setPassword(u.getPassword()); f.setDepartment(u.getDepartment());
                facultyRepo.save(f);
            } else if ("hod".equalsIgnoreCase(u.getRole())) {
                Hod h = new Hod();
                h.setRegisterNumber(u.getRegisterNumber()); h.setName(u.getName());
                h.setPassword(u.getPassword()); h.setDepartment(u.getDepartment());
                hodRepo.save(h);
            }
            count++;
        }
        return ResponseEntity.ok(Map.of("message", "Logins sorted and uploaded successfully", "count", count));
    }
    
    @GetMapping("/logins")
    public List<Student> getLogins() { 
        return studentRepo.findAll(); 
    }

    // ✅ UPDATED: The new Graduation Lifecycle endpoint!
    @PostMapping("/promote-students")
    @Transactional
    public ResponseEntity<?> promoteStudents(@RequestParam String department, @RequestParam int currentSemester) {
        List<Student> students = studentRepo.findByDepartmentAndSemester(department, currentSemester);
        
        if (students.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No students found in " + department + " Semester " + currentSemester));
        }

        int promotedCount = 0;
        int graduatedCount = 0;
        
        for (Student s : students) {
            if (s.getSemester() < 8) { 
                int newSemester = s.getSemester() + 1;
                s.setSemester(newSemester);
                s.setYear((int) Math.ceil(newSemester / 2.0));
                promotedCount++;
            } else if (s.getSemester() == 8) {
                // ✅ GRADUATION LOGIC: Sem 8 becomes Sem 99 (Alumni Status)
                s.setSemester(99); 
                s.setYear(5); // Alumni Year
                graduatedCount++;
            }
        }
        
        studentRepo.saveAll(students);
        return ResponseEntity.ok(Map.of("message", "✅ Promoted " + promotedCount + " students. 🎓 Graduated " + graduatedCount + " students!"));
    }

    @PostMapping("/internal-upload")
    public ResponseEntity<?> uploadInternalFile(
            @RequestParam("file") MultipartFile file, 
            @RequestParam("subjectCode") String subjectCode,
            @RequestParam("department") String department) {
        try {
            Subject subject = subjectRepo.findBySubjectCodeAndDepartment(subjectCode, department);
            if (subject == null) {
                throw new RuntimeException("Subject not found: " + subjectCode + " for department " + department);
            }
            internalUploadService.processInternalUpload(file, subject);
            return ResponseEntity.ok("Internal marks processed for " + subjectCode);
        } catch (Exception e) { 
            e.printStackTrace(); 
            return ResponseEntity.badRequest().body("Error: " + e.getMessage()); 
        }
    }

    @GetMapping("/fetch-subjects")
    public ResponseEntity<?> fetchSubjects(@RequestParam String department, @RequestParam int semester, @RequestParam String paperType) {
        return ResponseEntity.ok(subjectRepo.findByDepartmentAndSemesterAndPaperType(department, semester, paperType));
    }

    @PostMapping("/external")
    public ResponseEntity<?> uploadExternalMarks(@RequestBody List<ExternalMarks> marks) {
        externalMarksRepo.saveAll(marks); return ResponseEntity.ok(Map.of("message", "External marks uploaded", "count", marks.size()));
    }

    @PostMapping("/calculate-results")
    public ResponseEntity<?> calculateResults() {
        try { resultCalculationService.calculateResults(); return ResponseEntity.ok("Results calculated! Check Preview."); } 
        catch (Exception e) { return ResponseEntity.badRequest().body("Calculation failed: " + e.getMessage()); }
    }

    @GetMapping("/preview")
    public ResponseEntity<?> previewResults(@RequestParam String semester, @RequestParam String department) {
        return ResponseEntity.ok(resultCalculationService.getResultsBySemAndDept(semester, department));
    }

    @PostMapping("/publish")
    public ResponseEntity<?> publishResults(@RequestParam String semester, @RequestParam String department) {
        resultCalculationService.publishResults(semester, department); return ResponseEntity.ok("Results are LIVE!");
    }

    @DeleteMapping("/drop-drafts")
    @Transactional
    public ResponseEntity<?> dropDrafts(@RequestParam String semester, @RequestParam String department) {
        List<Result> drafts = resultRepo.findBySemesterAndDepartment(semester, department).stream().filter(r -> !r.isPublished()).collect(Collectors.toList());
        resultRepo.deleteAll(drafts); return ResponseEntity.ok("Deleted " + drafts.size() + " drafts.");
    }

    @PostMapping("/results")
    public ResponseEntity<?> uploadManualResults(@RequestBody List<Map<String, Object>> rawResults) {
        try { int savedCount = manualUploadService.saveManualDrafts(rawResults); return ResponseEntity.ok(Map.of("message", "✅ Successfully uploaded " + savedCount + " drafts.")); } 
        catch (Exception e) { e.printStackTrace(); return ResponseEntity.badRequest().body(Map.of("error", "Upload failed: " + e.getMessage())); }
    }

    @DeleteMapping("/unpublish")
    @Transactional
    public ResponseEntity<?> unpublishLiveResults(@RequestParam String semester, @RequestParam String department) {
        try {
            List<Result> liveResults = resultRepo.findBySemesterAndDepartment(semester, department).stream().filter(Result::isPublished).collect(Collectors.toList());
            if (liveResults.isEmpty()) return ResponseEntity.badRequest().body("No live results found.");
            resultRepo.deleteAll(liveResults); return ResponseEntity.ok("Successfully dropped " + liveResults.size() + " live results.");
        } catch (Exception e) { e.printStackTrace(); return ResponseEntity.internalServerError().body("Error dropping live results: " + e.getMessage()); }
    }

    @PostMapping("/internal")
    @Transactional
    public ResponseEntity<?> saveInternalMarksJSON(@RequestBody List<InternalMarks> marksList) {
        try {
            if (marksList == null || marksList.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "No internal marks provided."));
            internalMarksRepo.saveAll(marksList);
            return ResponseEntity.ok(Map.of("message", "Successfully saved " + marksList.size() + " internal marks."));
        } catch (Exception e) { e.printStackTrace(); return ResponseEntity.badRequest().body(Map.of("error", "Save failed: " + e.getMessage())); }
    }

    @PostMapping("/save-question-paper")
    public ResponseEntity<?> saveQuestionPaper(@RequestBody QuestionPaper paper) {
        questionPaperRepo.save(paper);
        return ResponseEntity.ok(Map.of("message", "Question Paper Saved to Admin Portal!"));
    }

    @GetMapping("/question-papers")
    public List<QuestionPaper> getQuestionPapers() {
        return questionPaperRepo.findAll();
    }

    @DeleteMapping("/question-paper/{id}")
    public ResponseEntity<?> deleteQuestionPaper(@PathVariable Long id) {
        try {
            if (questionPaperRepo.existsById(id)) {
                questionPaperRepo.deleteById(id);
                return ResponseEntity.ok(Map.of("message", "Question Paper successfully deleted."));
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "Question paper not found."));
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to delete: " + e.getMessage()));
        }
    }
}