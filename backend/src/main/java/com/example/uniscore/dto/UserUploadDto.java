package com.example.uniscore.dto;

import lombok.Data;

@Data
public class UserUploadDto {
    private String registerNumber;
    private String name;
    private String password;
    private String department;
    private Integer semester; // Only applies to students, but safe to leave null for faculty/HODs
    private String role;
}