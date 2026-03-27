package com.example.uniscore.repo;
import com.example.uniscore.entity.Faculty;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FacultyRepo extends JpaRepository<Faculty, String> {}