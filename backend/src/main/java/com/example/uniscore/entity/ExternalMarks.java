package com.example.uniscore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@Table(name = "external_marks")
public class ExternalMarks {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "register_number") // ✅ MATCHES DB
    private String registerNumber;    // ✅ RENAMED FROM rollNo

    @Column(name = "subject_code")
    private String subjectCode;

    @Column(name = "external_marks")
    private Double externalMarks;
}