package com.example.uniscore.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@Table(name = "requisitions")
public class Requisition {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String appointmentLetterNo;
    private String department;
    private String semester;
    private String subjectCode;
    private String courseTitle;
    private String examType;
    private String facultyId;
    private String deadline;
    private String status; // PENDING, ACCEPTED, REJECTED, READY, SUBMITTED
    
    // NEW Claim Form Details
    private String facultyName;
    private String designation;
    private String collegeNameCode; // "College name with college Code..."
    private String qpDept;          // "Department for Question Paper Setting"
    private String examinerDept;    // "Department of Examiner"
    private String mobile;
    private String email;
    private String qpType;          // "No of Question Paper" (1 with key, 2 with key, Others)
    private String semesterAndReg;  // "Semester and Regulation"
    private String amountClaimed;   // "Amount Claimed"
    private Boolean mailedConfirmation; // Checkbox confirmation
    private String aicteId;
    private String pan;
    private String address;
    
    // Bank Details
    private String accountNo;
    private String bankName;
    private String branchName;
    private String ifsc;
    
    private String totalAmount; // The internally calculated baseline for reference
}