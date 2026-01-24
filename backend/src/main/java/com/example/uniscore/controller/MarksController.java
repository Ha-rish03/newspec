package com.example.uniscore.controller;

import com.example.uniscore.entity.InternalMarks;
import com.example.uniscore.entity.ExternalMarks;
import com.example.uniscore.entity.SeminarMarks;
import com.example.uniscore.repo.InternalMarksRepo;
import com.example.uniscore.repo.ExternalMarksRepo;
import com.example.uniscore.repo.SeminarMarksRepo;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/marks")
@CrossOrigin
public class MarksController {

    private final InternalMarksRepo internalRepo;
    private final ExternalMarksRepo externalRepo;
    private final SeminarMarksRepo seminarRepo;

    public MarksController(InternalMarksRepo internalRepo, ExternalMarksRepo externalRepo, SeminarMarksRepo seminarRepo) {
        this.internalRepo = internalRepo;
        this.externalRepo = externalRepo;
        this.seminarRepo = seminarRepo;
    }

    @PostMapping("/internal")
    public String uploadInternal(@RequestBody List<InternalMarks> marks) {
        internalRepo.saveAll(marks);
        return "Internal marks uploaded";
    }

    // ✅ NEW ENDPOINT FOR SEMINAR
    @PostMapping("/seminar")
    public String uploadSeminar(@RequestBody List<SeminarMarks> marks) {
        seminarRepo.saveAll(marks);
        return "Seminar marks uploaded";
    }

    @PostMapping("/external")
    public String uploadExternal(@RequestBody List<ExternalMarks> marks) {
        externalRepo.saveAll(marks);
        return "External marks uploaded";
    }
}