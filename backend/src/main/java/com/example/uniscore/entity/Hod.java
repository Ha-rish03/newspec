package com.example.uniscore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@Table(name = "hods")
public class Hod {

    @Id
    @Column(name = "register_number")
    private String registerNumber; // Using this as the HOD ID

    private String name;
    private String password;
    private String department;
    private String role = "hod";
}