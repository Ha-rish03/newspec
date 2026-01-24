package com.example.uniscore.repo;

import com.example.uniscore.entity.ExternalMarks;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExternalMarksRepo extends JpaRepository<ExternalMarks, Long> {
    List<ExternalMarks> findByRegisterNumber(String registerNumber); // ✅ Renamed
}