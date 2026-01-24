package com.example.uniscore.service;

import com.example.uniscore.entity.InternalMarks;
import com.example.uniscore.entity.Subject;
import com.example.uniscore.repo.InternalMarksRepo;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Service
public class InternalUploadService {

    private final InternalMarksRepo repository;

    public InternalUploadService(InternalMarksRepo repository) {
        this.repository = repository;
    }

    @Transactional
    public void processInternalUpload(MultipartFile file, Subject subject) throws IOException {
        System.out.println("--- DECIMAL HEADER UPLOAD STARTED ---");
        Workbook workbook = new XSSFWorkbook(file.getInputStream());
        Sheet sheet = workbook.getSheetAt(0);

        // 1. 🔍 FIND ANCHOR ROW
        int anchorRowIdx = -1;
        for (int i = 0; i < 50; i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;
            for (Cell cell : row) {
                if (cell.getCellType() == CellType.STRING) {
                    String val = cleanString(cell.getStringCellValue());
                    if (val.contains("registernumber") || val.contains("regno")) {
                        anchorRowIdx = i;
                        System.out.println("✅ Found Anchor at Row: " + i);
                        break;
                    }
                }
            }
            if (anchorRowIdx != -1) break;
        }

        if (anchorRowIdx == -1) {
            workbook.close();
            throw new RuntimeException("Error: 'Register Number' header not found.");
        }

        // 2. 🗺️ MAP COLUMNS
        Row mainHeader = sheet.getRow(anchorRowIdx);
        Row subHeader = sheet.getRow(anchorRowIdx + 1);

        int regNoIdx = findColumnIndex(mainHeader, "registernumber", "regno");
        
        // Find UT Columns
        List<Integer> utIndexes = new ArrayList<>();
        scanForUT(subHeader, utIndexes); 
        scanForUT(mainHeader, utIndexes);

        // Find Experiment Columns
        List<Integer> expIndexes = new ArrayList<>();
        scanForPrefix(subHeader, "ex", expIndexes);
        scanForPrefix(mainHeader, "ex", expIndexes);

        // Find Seminar
        int marks40Idx = findColumnIndex(subHeader, "marks40", "theoryseminarscore", "rubrics", "seminar");
        if (marks40Idx == -1) marks40Idx = findColumnIndex(mainHeader, "marks40", "theoryseminarscore", "rubrics", "seminar");

        // ✅ FIXED: Now finds "0.25" correctly even if it's a number
        int modelIdx = findColumnIndex(subHeader, "025", "25", "model");
        if (modelIdx == -1) modelIdx = findColumnIndex(mainHeader, "025", "25", "model");
        
        System.out.println("🎯 MODEL EXAM COLUMN INDEX: " + modelIdx);

        // 3. 🧹 PROCESS
        repository.deleteBySubjectCode(subject.getSubjectCode());

        List<InternalMarks> marksList = new ArrayList<>();
        int startDataRow = anchorRowIdx + 2; 

        for (int i = startDataRow; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null || regNoIdx == -1) continue;

            String regNo = getCellValue(row.getCell(regNoIdx));
            if (regNo.length() < 5 || cleanString(regNo).contains("sample")) continue;

            InternalMarks marks = new InternalMarks();
            marks.setRegisterNumber(regNo);
            marks.setSubjectCode(subject.getSubjectCode());

            double theoryPart = 0.0;
            double practicalPart = 0.0;

            // --- THEORY CALCULATION ---
            if (!subject.getPaperType().equals("PRACTICAL")) {
                double utSum = 0;
                for (int idx : utIndexes) utSum += getNumericValue(row.getCell(idx));
                
                double divisor = utIndexes.isEmpty() ? 1.0 : utIndexes.size();
                double utAvg = utSum / divisor; 
                double utScore = utAvg * 0.6; 

                double seminar = 0.0;
                if (marks40Idx != -1) {
                    seminar = getNumericValue(row.getCell(marks40Idx));
                }
                
                marks.setTheoryUtScore(utScore);
                marks.setTheorySeminarScore(seminar);
                theoryPart = utScore + seminar;
            }

            // --- PRACTICAL CALCULATION ---
            if (!subject.getPaperType().equals("THEORY")) {
                double expSum = 0;
                for (int idx : expIndexes) expSum += getNumericValue(row.getCell(idx));
                
                double expAvg = expIndexes.isEmpty() ? 0 : expSum / expIndexes.size();
                
                if (expAvg > 0 && expAvg <= 20) {
                    expAvg = expAvg * 10;
                }

                double expScore = expAvg * 0.75; 
                double model = (modelIdx != -1) ? getNumericValue(row.getCell(modelIdx)) : 0.0;
                
                marks.setPracticalExpScore(expScore);
                marks.setPracticalModelScore(model);
                practicalPart = expScore + model;
            }

            // --- FINAL SCORE LOGIC ---
            if (subject.getPaperType().equals("THEORY")) {
                marks.setFinalInternal(theoryPart);
            } else if (subject.getPaperType().equals("PRACTICAL")) {
                marks.setFinalInternal(practicalPart);
            } else {
                marks.setFinalInternal((theoryPart + practicalPart) / 2.0);
            }

            marksList.add(marks);
        }

        if (!marksList.isEmpty()) repository.saveAll(marksList);
        workbook.close();
        System.out.println("--- UPLOAD COMPLETE ---");
    }

    // --- HELPERS ---

    private String cleanString(String input) {
        if (input == null) return "";
        return input.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
    }

    private int findColumnIndex(Row row, String... targets) {
        if (row == null) return -1;
        for (Cell cell : row) {
            String val = cleanString(getCellValue(cell));
            if (val.isEmpty()) continue; 
            for (String t : targets) {
                if (val.contains(t)) return cell.getColumnIndex();
                if (val.length() > 3 && t.contains(val)) return cell.getColumnIndex();
            }
        }
        return -1;
    }

    private void scanForUT(Row row, List<Integer> indexes) {
        if (row == null) return;
        for (Cell cell : row) {
            String val = cleanString(getCellValue(cell));
            if (val.startsWith("ut") && !val.contains("60") && !val.contains("avg") && !val.contains("total")) {
                if (!indexes.contains(cell.getColumnIndex())) {
                    indexes.add(cell.getColumnIndex());
                }
            }
        }
    }

    private void scanForPrefix(Row row, String prefix, List<Integer> indexes) {
        if (row == null) return;
        for (Cell cell : row) {
            String val = cleanString(getCellValue(cell));
            if (val.startsWith(prefix) && !indexes.contains(cell.getColumnIndex())) {
                indexes.add(cell.getColumnIndex());
            }
        }
    }

    private double getNumericValue(Cell cell) {
        if (cell == null) return 0.0;
        if (cell.getCellType() == CellType.FORMULA) {
            try { return cell.getNumericCellValue(); } catch (Exception e) { return 0.0; }
        }
        if (cell.getCellType() == CellType.NUMERIC) return cell.getNumericCellValue();
        try { 
            String val = cell.getStringCellValue().trim();
            if (val.isEmpty() || val.equals("-") || val.equalsIgnoreCase("Ab")) return 0.0;
            return Double.parseDouble(val); 
        } catch (Exception e) { return 0.0; }
    }

    // ✅ FIXED: Reads numeric headers as "0.25" instead of "0"
    private String getCellValue(Cell cell) {
        if (cell == null) return "";
        if (cell.getCellType() == CellType.STRING) return cell.getStringCellValue().trim();
        // REMOVED THE (long) CAST HERE
        if (cell.getCellType() == CellType.NUMERIC) return String.valueOf(cell.getNumericCellValue());
        return "";
    }
}