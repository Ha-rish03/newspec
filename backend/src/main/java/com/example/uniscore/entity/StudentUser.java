package com.example.uniscore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@Table(name = "student_users")
public class StudentUser {

    @Id
    @Column(name = "register_number") // ✅ MATCHES DB
    private String registerNumber;    // ✅ RENAMED FROM rollNo

    private String name;
    private String password;
    private String department;
    private String role;
}