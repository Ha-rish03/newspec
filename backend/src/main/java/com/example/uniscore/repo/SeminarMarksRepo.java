package com.example.uniscore.repo;

import com.example.uniscore.entity.SeminarMarks;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SeminarMarksRepo extends JpaRepository<SeminarMarks, Long> {
    List<SeminarMarks> findByRollNo(String rollNo);
}
