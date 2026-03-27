package com.example.uniscore.repo;

import com.example.uniscore.entity.Subject;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

// ✅ Note the <Subject, Long> here
public interface SubjectRepo extends JpaRepository<Subject, Long> {
    
    List<Subject> findByDepartmentAndSemesterAndPaperType(String department, int semester, String paperType);
    
    // ✅ Custom query to fetch a specific subject for a specific department safely
    Subject findBySubjectCodeAndDepartment(String subjectCode, String department);
}