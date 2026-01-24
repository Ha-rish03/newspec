package com.example.uniscore.repo;

import com.example.uniscore.entity.InternalMarks;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InternalMarksRepo extends JpaRepository<InternalMarks, Long> {

    // ✅ CHANGED: 'rollNo' -> 'registerNumber' to match the Entity and Excel Header
    List<InternalMarks> findByRegisterNumber(String registerNumber);

    // ✅ CHANGED: Removed 'internalNo'. We only need Student + Subject to find the mark.
    Optional<InternalMarks> findByRegisterNumberAndSubjectCode(String registerNumber, String subjectCode);

    // ✅ NEW: Essential for re-uploading. 
    // This allows the service to wipe old marks for a subject before saving the new Excel data.
    void deleteBySubjectCode(String subjectCode);
}