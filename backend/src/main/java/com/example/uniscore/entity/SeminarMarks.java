package com.example.uniscore.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "seminar_marks", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"rollNo", "subjectCode", "internalNo"})
})
public class SeminarMarks {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String rollNo;
    private String subjectCode;
    private Integer internalNo; // 1, 2, 3, 4, 5
    private Double mark; // Out of 100
}