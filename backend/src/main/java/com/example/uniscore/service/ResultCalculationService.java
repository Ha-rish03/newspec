package com.example.uniscore.service;

import com.example.uniscore.entity.*;
import com.example.uniscore.repo.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ResultCalculationService {

    private final InternalMarksRepo internalMarksRepo;
    private final ExternalMarksRepo externalMarksRepo;
    private final ResultRepo resultRepo;
    private final SubjectRepo subjectRepo;

    public ResultCalculationService(
            InternalMarksRepo internalMarksRepo,
            ExternalMarksRepo externalMarksRepo,
            ResultRepo resultRepo,
            SubjectRepo subjectRepo
    ) {
        this.internalMarksRepo = internalMarksRepo;
        this.externalMarksRepo = externalMarksRepo;
        this.resultRepo = resultRepo;
        this.subjectRepo = subjectRepo;
    }

    @Transactional
    public void calculateResults() {
        // 1. Fetch Master Data
        Map<String, Subject> subjectMap = subjectRepo.findAll()
                .stream()
                .collect(Collectors.toMap(Subject::getSubjectCode, s -> s));

        List<InternalMarks> allInternals = internalMarksRepo.findAll();
        Map<String, Map<String, InternalMarks>> internalMap = new HashMap<>();

        for (InternalMarks im : allInternals) {
            internalMap
                .computeIfAbsent(im.getRegisterNumber(), k -> new HashMap<>())
                .put(im.getSubjectCode(), im);
        }

        List<ExternalMarks> externals = externalMarksRepo.findAll();
        List<Result> results = new ArrayList<>();

        for (ExternalMarks em : externals) {
            String regNo = em.getRegisterNumber(); 
            String subCode = em.getSubjectCode();
            Subject subject = subjectMap.get(subCode);

            if (subject == null) continue;

            double internalScore = 0.0;
            if (internalMap.containsKey(regNo) && internalMap.get(regNo).containsKey(subCode)) {
                InternalMarks im = internalMap.get(regNo).get(subCode);
                if (im.getFinalInternal() != null) internalScore = im.getFinalInternal();
            }

            double externalScore = em.getExternalMarks();
            double finalScore;
            
            int l = (subject.getL() != null) ? subject.getL() : 0;
            int t = (subject.getT() != null) ? subject.getT() : 0;
            int p = (subject.getP() != null) ? subject.getP() : 0;

            if (p > (l + t)) finalScore = (internalScore * 0.5) + (externalScore * 0.5);
            else finalScore = (internalScore * 0.4) + (externalScore * 0.6);

            String grade;
            String status;
            int finalMarkRounded = (int) Math.round(finalScore);

            if (finalMarkRounded >= 45 && externalScore >= 45) {
                status = "PASS";
                if (finalMarkRounded >= 91) grade = "O";
                else if (finalMarkRounded >= 81) grade = "A+";
                else if (finalMarkRounded >= 71) grade = "A";
                else if (finalMarkRounded >= 61) grade = "B+";
                else if (finalMarkRounded >= 51) grade = "B";
                else grade = "C"; 
            } else {
                grade = "RA";
                status = "FAIL";
            }

            results.add(Result.builder()
                    .registerNumber(regNo) 
                    .subjectCode(subject.getSubjectCode())
                    .semester(String.valueOf(subject.getSemester()))
                    // ✅ NEW: Save the Department from the Subject
                    .department(subject.getDepartment()) 
                    .grade(grade)
                    .result(status)
                    .finalMarks(finalMarkRounded)
                    .isPublished(false) 
                    .build());
        }
        
        // Wipe old results to avoid duplicates
        resultRepo.deleteAll();
        resultRepo.saveAll(results);
    }

    // ✅ UPDATED: Preview specific Dept & Sem
    public List<Result> getResultsBySemAndDept(String semester, String department) {
        return resultRepo.findBySemesterAndDepartment(semester, department);
    }

    // ✅ UPDATED: Publish specific Dept & Sem
    public void publishResults(String semester, String department) {
        resultRepo.publishResults(semester, department);
    }
}