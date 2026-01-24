package com.example.uniscore.repo;

import com.example.uniscore.entity.StudentUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;



   public interface StudentUserRepo extends JpaRepository<StudentUser, String> {
    StudentUser findByRegisterNumber(String registerNumber); // ✅ RENAMED


    // Count users by role (student / hod)
    long countByRoleIgnoreCase(String role);

    // Count unique departments
    @Query("SELECT COUNT(DISTINCT s.department) FROM StudentUser s")
    long countDistinctDepartments();
}
// StudentUserRepo.java
