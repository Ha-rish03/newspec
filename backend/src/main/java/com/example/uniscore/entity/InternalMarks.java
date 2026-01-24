package com.example.uniscore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@Table(name = "internal_marks")
public class InternalMarks {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "register_number")
    private String registerNumber;

    @Column(name = "subject_code")
    private String subjectCode;

    // --- THEORY BREAKDOWN ---
    @Column(name = "theory_ut_score")
    private Double theoryUtScore;       // Calculated (Avg of 5 UTs * 0.6)
    
    @Column(name = "theory_seminar_score")
    private Double theorySeminarScore;  // Raw from Excel

    // --- PRACTICAL BREAKDOWN ---
    @Column(name = "practical_exp_score")
    private Double practicalExpScore;   // Calculated (Avg of Exps * 0.75)
    
    @Column(name = "practical_model_score")
    private Double practicalModelScore; // Raw from Excel

    // --- FINAL RESULT ---
    @Column(name = "final_internal")
    private Double finalInternal;       // The mark out of 100 used for grading
}