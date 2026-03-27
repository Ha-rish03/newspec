package com.example.uniscore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@Table(name = "subjects")
public class Subject {

    // ✅ ADDED: Auto-generating ID so the same subject code can exist multiple times
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; 

    // ✅ REMOVED @Id from here!
    @Column(name = "subject_code")
    private String subjectCode;

    @Column(name = "subject_name")
    private String subjectName;

    @Column(name = "semester")
    private Integer semester;

    @Column(name = "department")
    private String department;

    private Integer l; // Lecture
    private Integer t; // Tutorial
    private Integer p; // Practical
    
    private Integer credits;

    // --- NEW: AUTO-DETECTED PAPER TYPE ---
    @Column(name = "paper_type")
    private String paperType; // THEORY, PRACTICAL, INTEGRATED

    @PrePersist
    @PreUpdate
    public void calculatePaperType() {
        int lecture = (l != null) ? l : 0;
        int practical = (p != null) ? p : 0;

        if (lecture > 0 && practical == 0) {
            this.paperType = "THEORY";
        } else if (lecture == 0 && practical > 0) {
            this.paperType = "PRACTICAL";
        } else if (lecture > 0 && practical > 0) {
            this.paperType = "INTEGRATED";
        } else {
            this.paperType = "THEORY"; // Fallback
        }
    }
}