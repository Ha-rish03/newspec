package com.example.uniscore.repo;

import com.example.uniscore.entity.Result;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface ResultRepo extends JpaRepository<Result, Long> {

    List<Result> findByRegisterNumberAndIsPublishedTrue(String registerNumber);

    // ✅ UPDATED: Find by Sem AND Dept (For Admin Preview)
    List<Result> findBySemesterAndDepartment(String semester, String department);

    // ✅ UPDATED: Publish only for specific Sem AND Dept
    @Modifying
    @Transactional
    @Query("UPDATE Result r SET r.isPublished = true WHERE r.semester = :semester AND r.department = :department")
    void publishResults(String semester, String department);
}