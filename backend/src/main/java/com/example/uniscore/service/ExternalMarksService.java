package com.example.uniscore.service;

import com.example.uniscore.entity.ExternalMarks;
import com.example.uniscore.repo.ExternalMarksRepo;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class ExternalMarksService {

    private final ExternalMarksRepo externalMarksRepo;

    public ExternalMarksService(ExternalMarksRepo externalMarksRepo) {
        this.externalMarksRepo = externalMarksRepo;
    }

    public ExternalMarks saveMark(ExternalMarks mark) {
        return externalMarksRepo.save(mark);
    }

    public List<ExternalMarks> getAllExternalMarks() {
        return externalMarksRepo.findAll();
    }
}