package com.example.uniscore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@Table(name = "students")
public class Student {
    
    @Id
    @Column(name = "register_number")
    private String registerNumber;
    
    private String name;
    private String password;
    private String department;
    
    private Integer semester; 
    
    // ✅ NEW: Automatically tracks the Academic Year (1, 2, 3, or 4)
    @Column(name = "academic_year")
    private Integer year; 
    
    private String role = "student";
}