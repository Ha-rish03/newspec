package com.example.uniscore.repo;

import com.example.uniscore.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface StudentRepo extends JpaRepository<Student, String> {
    
    // ✅ NEW: Needed for the One-Click Promotion feature
    List<Student> findByDepartmentAndSemester(String department, int semester);
    
    List<Student> findByDepartmentAndYear(String department, int year);
}