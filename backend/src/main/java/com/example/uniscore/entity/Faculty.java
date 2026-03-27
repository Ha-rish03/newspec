package com.example.uniscore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@Table(name = "faculty")
public class Faculty {

    @Id
    @Column(name = "register_number") 
    private String registerNumber; // Using this as the Faculty ID

    private String name;
    private String password;
    private String department;
    private String role = "faculty";
}