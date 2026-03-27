package com.example.uniscore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@Table(name = "question_papers")
public class QuestionPaper {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String subjectCode;
    private String department;
    private String examSession;
    private boolean hasPartC;
    
    // ✅ NEW: Tells the Admin if it's a Semester Exam or Unit Test
    private String examType; 

    @Column(columnDefinition = "LONGTEXT")
    private String paperData; 
}