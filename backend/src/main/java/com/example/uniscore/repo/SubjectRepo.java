package com.example.uniscore.repo;

import com.example.uniscore.entity.Subject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SubjectRepo extends JpaRepository<Subject, String> {

    // ✅ FIXED: This method name matches the ImportController exactly.
    // Spring Boot automatically creates the query based on the name.
    List<Subject> findByDepartmentAndSemesterAndPaperType(String department, Integer semester, String paperType);

}