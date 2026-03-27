package com.example.uniscore.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class QuestionPaperRequest {
    // --- SEMESTER PAPER DTO ---
    private HeaderInfo header;
    private List<QuestionA> partA;
    private List<QuestionB> partB;
    private QuestionC partC;

    // --- UNIT TEST DTO ---
    private UnitHeader unitHeader;
    private List<UnitQuestion> unitPartA;
    private List<UnitQuestion> unitPartB;
    private List<UnitQuestion> unitPartC;
    private CoDistribution coDistribution;

    @Data
    public static class HeaderInfo {
        private String examSession; private String semesters; private String department;
        private String subject; private String regulations; private String requirements;
    }

    @Data
    public static class QuestionA {
        private int qNo; private String question; private String btl; private String co;
    }

    @Data
    public static class QuestionB {
        private int qNo; private Option a; private Option b;
    }

    @Data
    public static class QuestionC {
        private int qNo; private Option a; private Option b;
    }

    @Data
    public static class Option {
        private String question; private String btl; private String co; private String marks;
    }

    // --- NEW: UNIT TEST CLASSES ---
    @Data
    public static class UnitHeader {
        private String examSession; private String semesterWord; private String department;
        private String subject; private String regulations; private String duration; private String maxMarks;
    }

    @Data
    public static class UnitQuestion {
        private int qNo; private String question; private String marks; private String kLevel; private String co;
    }

    @Data
    public static class CoDistribution {
        private List<String> marks;
        private List<String> percentage;
    }
}