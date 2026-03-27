package com.example.uniscore.repo;

import com.example.uniscore.entity.QuestionPaper;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionPaperRepo extends JpaRepository<QuestionPaper, Long> {
}