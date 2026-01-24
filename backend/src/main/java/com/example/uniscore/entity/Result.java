package com.example.uniscore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@Table(name = "results")
public class Result {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "register_number")
    private String registerNumber;

    @Column(name = "subject_code")
    private String subjectCode;

    // ✅ NEW FIELD: Store Department (CSE, IT, etc.)
    private String department; 

    private String semester;
    private String grade;
    private String result;
    
    @Column(name = "final_marks")
    private Integer finalMarks;

    @Column(name = "is_published")
    @Builder.Default
    private boolean isPublished = false; 
}