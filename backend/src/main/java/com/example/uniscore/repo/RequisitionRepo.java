package com.example.uniscore.repo;

import com.example.uniscore.entity.Requisition;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RequisitionRepo extends JpaRepository<Requisition, Long> {
    List<Requisition> findByFacultyId(String facultyId);
}