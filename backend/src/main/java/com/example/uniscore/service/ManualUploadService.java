package com.example.uniscore.service;

import com.example.uniscore.entity.Result;
import com.example.uniscore.repo.ResultRepo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ManualUploadService {

    private final ResultRepo resultRepo;

    public ManualUploadService(ResultRepo resultRepo) {
        this.resultRepo = resultRepo;
    }

    /**
     * Processes raw JSON data from manual Excel uploads.
     * Saves entries strictly as DRAFTS (isPublished = false).
     */
    @Transactional
    public int saveManualDrafts(List<Map<String, Object>> rawResults) {
        if (rawResults == null || rawResults.isEmpty()) {
            throw new IllegalArgumentException("No data found in upload payload.");
        }

        List<Result> results = rawResults.stream()
                .map(this::mapToResultEntity)
                .collect(Collectors.toList());

        // Validate we actually parsed something
        if (results.isEmpty()) {
            throw new IllegalArgumentException("Could not parse any valid rows. Check column headers.");
        }

        // Save all to database
        resultRepo.saveAll(results);
        
        return results.size();
    }

    private Result mapToResultEntity(Map<String, Object> row) {
        // 1. Handle Key Variations (Frontend might send 'rollNo' or 'registerNumber')
        String regNo = (String) row.getOrDefault("registerNumber", "");
        if (regNo == null || regNo.isEmpty()) {
            regNo = (String) row.get("rollNo");
        }

        // 2. Safely Parse Marks (Handle Integers, Doubles, or Strings)
        Double marksDouble = 0.0;
        Object markObj = row.get("mark");
        if (markObj != null) {
            try {
                // Parse as double first to handle "98.0" or "98.5"
                marksDouble = Double.valueOf(String.valueOf(markObj));
            } catch (NumberFormatException e) {
                marksDouble = 0.0; // Default to 0 if invalid format
            }
        }

        // 3. Build Entity (Force isPublished = FALSE for Draft Mode)
        return Result.builder()
                .registerNumber(regNo)
                .subjectCode((String) row.getOrDefault("subjectCode", ""))
                .semester((String) row.getOrDefault("semester", ""))
                .department((String) row.getOrDefault("department", ""))
                .grade((String) row.getOrDefault("grade", ""))
                .result((String) row.getOrDefault("result", "")) 
                
                // ✅ FIX: Convert Double to Integer
                .finalMarks(marksDouble.intValue()) 
                
                .isPublished(false) // 🔒 CRITICAL: Start as Draft
                .build();
    }
}