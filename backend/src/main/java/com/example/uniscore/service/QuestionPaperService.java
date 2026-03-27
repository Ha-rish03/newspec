package com.example.uniscore.service;

import com.example.uniscore.dto.QuestionPaperRequest;
import org.apache.poi.wp.usermodel.HeaderFooterType;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

@Service
public class QuestionPaperService {

    // =========================================================================
    // 1. SEMESTER QUESTION PAPER GENERATOR
    // =========================================================================
    public String saveToWord(QuestionPaperRequest request) throws IOException {
        XWPFDocument document = new XWPFDocument();
        createStandardFooter(document);

        XWPFParagraph regPara = document.createParagraph();
        regPara.setAlignment(ParagraphAlignment.RIGHT);
        XWPFRun regRun = regPara.createRun();
        regRun.setText("Register Number:  [  ] [  ] [  ] [  ] [  ] [  ] [  ] [  ] [  ] [  ] [  ] [  ]");
        regRun.setBold(true);

        XWPFParagraph codePara = document.createParagraph();
        codePara.setAlignment(ParagraphAlignment.RIGHT);
        XWPFRun codeRun = codePara.createRun();
        codeRun.setText("Question Paper Code: _____________________");
        codeRun.setBold(true);
        document.createParagraph();

        createCenterText(document, "St. Peter’s College of Engineering and Technology", true, 16, "000000");
        createCenterText(document, "(An Autonomous Institution)", false, 14, "000000");
        createCenterText(document, request.getHeader().getExamSession(), true, 12, "8B0000");
        createCenterText(document, request.getHeader().getSemesters(), true, 12, "8B0000");
        createCenterText(document, request.getHeader().getDepartment(), true, 12, "8B0000");
        createCenterText(document, request.getHeader().getSubject(), true, 12, "8B0000");
        createCenterText(document, request.getHeader().getRegulations(), true, 12, "8B0000");
        createCenterText(document, "Common to CSE & IT", true, 12, "8B0000");
        createCenterText(document, "(Any requirements like Graphs, Charts, Tables, Data books, etc.) if applicable", false, 10, "8B0000");
        document.createParagraph();

        createCenterText(document, "Part A – (10 X 2 = 20 Marks)", true, 12, "000000");
        XWPFTable tableA = document.createTable();
        removeBorders(tableA);
        XWPFTableRow headerRowA = tableA.getRow(0);
        createCellWithSpacing(headerRowA.getCell(0), "Q. No.", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowA.addNewTableCell(), "Question", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowA.addNewTableCell(), "BTL", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowA.addNewTableCell(), "CO#", true, ParagraphAlignment.CENTER, 150);
        if (request.getPartA() != null) {
            for (QuestionPaperRequest.QuestionA q : request.getPartA()) {
                XWPFTableRow row = tableA.createRow();
                createCellWithSpacing(row.getCell(0), q.getQNo() + ".", false, ParagraphAlignment.CENTER, 150);
                createCellWithSpacing(row.getCell(1), q.getQuestion() != null ? q.getQuestion() : "", false, ParagraphAlignment.LEFT, 150);
                createCellWithSpacing(row.getCell(2), q.getBtl() != null ? q.getBtl() : "", false, ParagraphAlignment.CENTER, 150);
                createCellWithSpacing(row.getCell(3), q.getCo() != null ? q.getCo() : "", false, ParagraphAlignment.CENTER, 150);
            }
        }
        document.createParagraph();

        XWPFParagraph pageBreakParaB = document.createParagraph();
        pageBreakParaB.setPageBreak(true);

        createCenterText(document, "PART B (5 × 13 = 65 Marks)", true, 12, "000000");
        XWPFTable tableB = document.createTable();
        removeBorders(tableB);
        XWPFTableRow headerRowB = tableB.getRow(0);
        createCellWithSpacing(headerRowB.getCell(0), "Q. No.", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowB.addNewTableCell(), "Answer All Questions", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowB.addNewTableCell(), "Marks", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowB.addNewTableCell(), "BTL", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowB.addNewTableCell(), "CO", true, ParagraphAlignment.CENTER, 150);

        if (request.getPartB() != null) {
            for (QuestionPaperRequest.QuestionB q : request.getPartB()) {
                XWPFTableRow rowA = tableB.createRow();
                createCellWithSpacing(rowA.getCell(0), q.getQNo() + ".", false, ParagraphAlignment.CENTER, 150);
                createCellWithSpacing(rowA.getCell(1), "(a) " + (q.getA().getQuestion() != null ? q.getA().getQuestion() : ""), false, ParagraphAlignment.LEFT, 150);
                createCellWithSpacing(rowA.getCell(2), "(" + q.getA().getMarks() + ")", false, ParagraphAlignment.CENTER, 150);
                createCellWithSpacing(rowA.getCell(3), q.getA().getBtl(), false, ParagraphAlignment.CENTER, 150);
                createCellWithSpacing(rowA.getCell(4), q.getA().getCo(), false, ParagraphAlignment.CENTER, 150);
                XWPFTableRow rowOr = tableB.createRow();
                createCellWithSpacing(rowOr.getCell(0), "", false, ParagraphAlignment.CENTER, 100);
                createCellWithSpacing(rowOr.getCell(1), "(Or)", true, ParagraphAlignment.CENTER, 100);
                createCellWithSpacing(rowOr.getCell(2), "", false, ParagraphAlignment.CENTER, 100);
                createCellWithSpacing(rowOr.getCell(3), "", false, ParagraphAlignment.CENTER, 100);
                createCellWithSpacing(rowOr.getCell(4), "", false, ParagraphAlignment.CENTER, 100);
                XWPFTableRow rowB = tableB.createRow();
                createCellWithSpacing(rowB.getCell(0), "", false, ParagraphAlignment.CENTER, 150);
                createCellWithSpacing(rowB.getCell(1), "(b) " + (q.getB().getQuestion() != null ? q.getB().getQuestion() : ""), false, ParagraphAlignment.LEFT, 150);
                createCellWithSpacing(rowB.getCell(2), "(" + q.getB().getMarks() + ")", false, ParagraphAlignment.CENTER, 150);
                createCellWithSpacing(rowB.getCell(3), q.getB().getBtl(), false, ParagraphAlignment.CENTER, 150);
                createCellWithSpacing(rowB.getCell(4), q.getB().getCo(), false, ParagraphAlignment.CENTER, 150);
            }
        }
        document.createParagraph();

        createCenterText(document, "PART C (1 × 15 = 15 Marks)", true, 12, "000000");
        XWPFTable tableC = document.createTable();
        removeBorders(tableC);
        XWPFTableRow headerRowC = tableC.getRow(0);
        createCellWithSpacing(headerRowC.getCell(0), "Q. No.", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowC.addNewTableCell(), "Question", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowC.addNewTableCell(), "Marks", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowC.addNewTableCell(), "BTL", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowC.addNewTableCell(), "CO", true, ParagraphAlignment.CENTER, 150);

        QuestionPaperRequest.QuestionC pc = request.getPartC();
        if (pc != null) {
            XWPFTableRow rowCA = tableC.createRow();
            createCellWithSpacing(rowCA.getCell(0), pc.getQNo() + ".", false, ParagraphAlignment.CENTER, 150);
            createCellWithSpacing(rowCA.getCell(1), "(a) " + (pc.getA().getQuestion() != null ? pc.getA().getQuestion() : ""), false, ParagraphAlignment.LEFT, 150);
            createCellWithSpacing(rowCA.getCell(2), "(" + pc.getA().getMarks() + ")", false, ParagraphAlignment.CENTER, 150);
            createCellWithSpacing(rowCA.getCell(3), pc.getA().getBtl(), false, ParagraphAlignment.CENTER, 150);
            createCellWithSpacing(rowCA.getCell(4), pc.getA().getCo(), false, ParagraphAlignment.CENTER, 150);
            XWPFTableRow rowCOr = tableC.createRow();
            createCellWithSpacing(rowCOr.getCell(0), "", false, ParagraphAlignment.CENTER, 100);
            createCellWithSpacing(rowCOr.getCell(1), "(Or)", true, ParagraphAlignment.CENTER, 100);
            createCellWithSpacing(rowCOr.getCell(2), "", false, ParagraphAlignment.CENTER, 100);
            createCellWithSpacing(rowCOr.getCell(3), "", false, ParagraphAlignment.CENTER, 100);
            createCellWithSpacing(rowCOr.getCell(4), "", false, ParagraphAlignment.CENTER, 100);
            XWPFTableRow rowCB = tableC.createRow();
            createCellWithSpacing(rowCB.getCell(0), "", false, ParagraphAlignment.CENTER, 150);
            createCellWithSpacing(rowCB.getCell(1), "(b) " + (pc.getB().getQuestion() != null ? pc.getB().getQuestion() : ""), false, ParagraphAlignment.LEFT, 150);
            createCellWithSpacing(rowCB.getCell(2), "(" + pc.getB().getMarks() + ")", false, ParagraphAlignment.CENTER, 150);
            createCellWithSpacing(rowCB.getCell(3), pc.getB().getBtl(), false, ParagraphAlignment.CENTER, 150);
            createCellWithSpacing(rowCB.getCell(4), pc.getB().getCo(), false, ParagraphAlignment.CENTER, 150);
        }

        XWPFParagraph pageBreakParaNotes = document.createParagraph();
        pageBreakParaNotes.setPageBreak(true);
        XWPFParagraph notePara = document.createParagraph();
        XWPFRun noteRun = notePara.createRun();
        noteRun.setText("Note:");
        noteRun.setBold(true);
        noteRun.setFontFamily("Times New Roman");
        createLeftText(document, "#\tA maximum of two questions can have two subdivisions.");
        createLeftText(document, "#\tQuestions from same unit and same blooms taxonomy Knowledge level to be maintained in either / or questions with same mark weightage even if the questions have sub divisions.");
        createLeftText(document, "#\tCompulsory Question can be derived from any of the Unit.");
        createLeftText(document, "#\t{Maximum two sub divisions in (Part B & Part C) question if necessary; Part B - Marks split up for may be 13 / 7 + 6 / 6+7 & Part C - Marks split up for may be 15 / 8 + 7 / 7+8 }");
        document.createParagraph();
        createCenterText(document, "*****", true, 12, "000000");

        return saveFile(document, request.getHeader().getSubject());
    }

    // =========================================================================
    // 2. UNIT TEST QUESTION PAPER GENERATOR (COMPACT, WITH BORDERS)
    // =========================================================================
    public String saveUnitTestToWord(QuestionPaperRequest request) throws IOException {
        XWPFDocument document = new XWPFDocument();
        createStandardFooter(document);

        // Header Boxes
        XWPFParagraph topPara = document.createParagraph();
        topPara.setAlignment(ParagraphAlignment.RIGHT);
        XWPFRun topRun = topPara.createRun();
        topRun.setText("Reg. No. [  ] [  ] [  ] [  ] [  ] [  ] [  ] [  ] [  ] [  ] [  ] [  ]");
        topRun.setBold(true);
        topRun.setFontFamily("Times New Roman");

        XWPFParagraph codePara = document.createParagraph();
        codePara.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun codeRun = codePara.createRun();
        codeRun.setText("Question Paper Code: _____________________");
        codeRun.setBold(true);
        codeRun.setFontFamily("Times New Roman");

        // Main Headers
        createCenterText(document, "ST. PETER'S COLLEGE OF ENGINEERING AND TECHNOLOGY", true, 14, "000000");
        createCenterText(document, "AVADI, CHENNAI 600 054", true, 11, "000000");
        createCenterText(document, request.getUnitHeader().getExamSession(), true, 12, "000000");
        createCenterText(document, request.getUnitHeader().getSemesterWord(), true, 11, "000000");
        createCenterText(document, request.getUnitHeader().getDepartment(), true, 11, "000000");
        createCenterText(document, request.getUnitHeader().getSubject(), true, 12, "000000");
        createCenterText(document, request.getUnitHeader().getRegulations(), true, 11, "000000");
        document.createParagraph();

        // Duration & Marks
        XWPFParagraph durationPara = document.createParagraph();
        durationPara.setAlignment(ParagraphAlignment.LEFT);
        XWPFRun dRun = durationPara.createRun();
        dRun.setText("Duration: " + request.getUnitHeader().getDuration() + "                      ");
        dRun.setBold(true);
        dRun.setFontFamily("Times New Roman");
        XWPFRun mRun = durationPara.createRun();
        mRun.setText("                                Max. Marks " + request.getUnitHeader().getMaxMarks());
        mRun.setBold(true);
        mRun.setFontFamily("Times New Roman");
        
        createCenterText(document, "Answer ALL Questions", true, 12, "000000");

        // PART A TABLE (WITH BORDERS, PROPER SPACING)
        XWPFTable tableA = document.createTable();
        XWPFTableRow titleRowA = tableA.getRow(0);
        createCellWithSpacing(titleRowA.getCell(0), "PART-A (5 x 2 = 10 Marks)", true, ParagraphAlignment.CENTER, 150);
        titleRowA.getCell(0).getCTTc().addNewTcPr().addNewGridSpan().setVal(java.math.BigInteger.valueOf(2)); // Colspan 2
        createCellWithSpacing(titleRowA.addNewTableCell(), "K-Level", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(titleRowA.addNewTableCell(), "CO", true, ParagraphAlignment.CENTER, 150);

        if (request.getUnitPartA() != null) {
            for (QuestionPaperRequest.UnitQuestion q : request.getUnitPartA()) {
                XWPFTableRow row = tableA.createRow();
                createCellWithSpacing(row.getCell(0), q.getQNo() + ".", false, ParagraphAlignment.CENTER, 150);
                createCellWithSpacing(row.getCell(1), q.getQuestion(), false, ParagraphAlignment.LEFT, 150);
                createCellWithSpacing(row.getCell(2), q.getKLevel(), false, ParagraphAlignment.CENTER, 150);
                createCellWithSpacing(row.getCell(3), q.getCo(), false, ParagraphAlignment.CENTER, 150);
            }
        }
        document.createParagraph();

        // PART B TABLE
        XWPFTable tableB = document.createTable();
        XWPFTableRow titleRowB = tableB.getRow(0);
        createCellWithSpacing(titleRowB.getCell(0), "PART - B (2 x 13 = 26 marks) (Any 2)", true, ParagraphAlignment.CENTER, 150);
        titleRowB.getCell(0).getCTTc().addNewTcPr().addNewGridSpan().setVal(java.math.BigInteger.valueOf(2));
        createCellWithSpacing(titleRowB.addNewTableCell(), "Marks", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(titleRowB.addNewTableCell(), "K-Level", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(titleRowB.addNewTableCell(), "CO", true, ParagraphAlignment.CENTER, 150);

        if (request.getUnitPartB() != null) {
            for (QuestionPaperRequest.UnitQuestion q : request.getUnitPartB()) {
                XWPFTableRow row = tableB.createRow();
                createCellWithSpacing(row.getCell(0), q.getQNo() + ".", false, ParagraphAlignment.CENTER, 150);
                createCellWithSpacing(row.getCell(1), q.getQuestion(), false, ParagraphAlignment.LEFT, 150);
                createCellWithSpacing(row.getCell(2), q.getMarks(), false, ParagraphAlignment.CENTER, 150);
                createCellWithSpacing(row.getCell(3), q.getKLevel(), false, ParagraphAlignment.CENTER, 150);
                createCellWithSpacing(row.getCell(4), q.getCo(), false, ParagraphAlignment.CENTER, 150);
            }
        }
        document.createParagraph();

        // PART C TABLE
        XWPFTable tableC = document.createTable();
        XWPFTableRow titleRowC = tableC.getRow(0);
        createCellWithSpacing(titleRowC.getCell(0), "PART - C (1 x 14 = 14 marks)", true, ParagraphAlignment.CENTER, 150);
        titleRowC.getCell(0).getCTTc().addNewTcPr().addNewGridSpan().setVal(java.math.BigInteger.valueOf(2));
        createCellWithSpacing(titleRowC.addNewTableCell(), "Marks", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(titleRowC.addNewTableCell(), "K-Level", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(titleRowC.addNewTableCell(), "CO", true, ParagraphAlignment.CENTER, 150);

        if (request.getUnitPartC() != null && !request.getUnitPartC().isEmpty()) {
            QuestionPaperRequest.UnitQuestion pc = request.getUnitPartC().get(0);
            XWPFTableRow row = tableC.createRow();
            createCellWithSpacing(row.getCell(0), pc.getQNo() + ".", false, ParagraphAlignment.CENTER, 150);
            createCellWithSpacing(row.getCell(1), pc.getQuestion(), false, ParagraphAlignment.LEFT, 150);
            createCellWithSpacing(row.getCell(2), pc.getMarks(), false, ParagraphAlignment.CENTER, 150);
            createCellWithSpacing(row.getCell(3), pc.getKLevel(), false, ParagraphAlignment.CENTER, 150);
            createCellWithSpacing(row.getCell(4), pc.getCo(), false, ParagraphAlignment.CENTER, 150);
        }
        document.createParagraph();

        // CO DISTRIBUTION TABLE
        XWPFTable tableCO = document.createTable();
        XWPFTableRow titleRowCO = tableCO.getRow(0);
        createCellWithSpacing(titleRowCO.getCell(0), "Distribution of COs (Percentage wise)", true, ParagraphAlignment.CENTER, 150);
        titleRowCO.getCell(0).getCTTc().addNewTcPr().addNewGridSpan().setVal(java.math.BigInteger.valueOf(7));

        XWPFTableRow headerRowCO = tableCO.createRow();
        createCellWithSpacing(headerRowCO.getCell(0), "Evaluation", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowCO.addNewTableCell(), "CO1", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowCO.addNewTableCell(), "CO2", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowCO.addNewTableCell(), "CO3", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowCO.addNewTableCell(), "CO4", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowCO.addNewTableCell(), "CO5", true, ParagraphAlignment.CENTER, 150);
        createCellWithSpacing(headerRowCO.addNewTableCell(), "CO6", true, ParagraphAlignment.CENTER, 150);

        if (request.getCoDistribution() != null) {
            XWPFTableRow marksRow = tableCO.createRow();
            createCellWithSpacing(marksRow.getCell(0), "Marks", true, ParagraphAlignment.CENTER, 150);
            for(int i=0; i<6; i++) {
                createCellWithSpacing(marksRow.addNewTableCell(), request.getCoDistribution().getMarks().get(i), false, ParagraphAlignment.CENTER, 150);
            }
            XWPFTableRow percRow = tableCO.createRow();
            createCellWithSpacing(percRow.getCell(0), "%", true, ParagraphAlignment.CENTER, 150);
            for(int i=0; i<6; i++) {
                createCellWithSpacing(percRow.addNewTableCell(), request.getCoDistribution().getPercentage().get(i), false, ParagraphAlignment.CENTER, 150);
            }
        }

        return saveFile(document, request.getUnitHeader().getSubject());
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================
    private void createStandardFooter(XWPFDocument document) {
        XWPFFooter footer = document.createFooter(HeaderFooterType.DEFAULT);
        XWPFParagraph kPara = footer.createParagraph();
        kPara.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun kRun = kPara.createRun();
        kRun.setText("Knowledge Level: K1 – Remember; K2 – Understand; K3 – Apply; K4 – Analyze; K5 – Evaluate; K6 – Create");
        kRun.setFontSize(9);
        kRun.setColor("555555");
        kRun.setFontFamily("Times New Roman");

        XWPFParagraph pPara = footer.createParagraph();
        pPara.setAlignment(ParagraphAlignment.RIGHT);
        XWPFRun pRun = pPara.createRun();
        pRun.setText("Page ");
        pRun.setFontSize(10);
        pRun.setColor("555555");
        pPara.getCTP().addNewFldSimple().setInstr("PAGE");
        XWPFRun ofRun = pPara.createRun();
        ofRun.setText(" of ");
        ofRun.setFontSize(10);
        ofRun.setColor("555555");
        pPara.getCTP().addNewFldSimple().setInstr("NUMPAGES");
    }

    private String saveFile(XWPFDocument document, String subject) throws IOException {
        File dir = new File("Question_Papers_Archive");
        if (!dir.exists()) dir.mkdirs();
        String safeSub = subject.replaceAll("[^a-zA-Z0-9]", "_");
        if (safeSub.length() > 6) safeSub = safeSub.substring(0, 6);
        String filePath = "Question_Papers_Archive/" + safeSub + "_Paper_" + System.currentTimeMillis() + ".docx";
        try (FileOutputStream fileOut = new FileOutputStream(filePath)) {
            document.write(fileOut);
        }
        document.close();
        return filePath;
    }

    private void createCenterText(XWPFDocument doc, String text, boolean isBold, int fontSize, String colorHex) {
        XWPFParagraph para = doc.createParagraph();
        para.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun run = para.createRun();
        run.setText(text);
        run.setBold(isBold);
        run.setFontFamily("Times New Roman");
        if (fontSize > 0) run.setFontSize(fontSize);
        if (colorHex != null) run.setColor(colorHex);
    }

    private void createLeftText(XWPFDocument doc, String text) {
        XWPFParagraph para = doc.createParagraph();
        para.setAlignment(ParagraphAlignment.LEFT);
        XWPFRun run = para.createRun();
        run.setText(text);
        run.setFontFamily("Times New Roman");
    }

    private void createCellWithSpacing(XWPFTableCell cell, String text, boolean isBold, ParagraphAlignment align, int spacing) {
        if (cell.getParagraphs().size() > 0) cell.removeParagraph(0);
        XWPFParagraph para = cell.addParagraph();
        para.setAlignment(align);
        if (spacing > 0) {
            para.setSpacingBefore(spacing); 
            para.setSpacingAfter(spacing);  
        }
        XWPFRun run = para.createRun();
        run.setText(text);
        run.setBold(isBold);
        run.setFontFamily("Times New Roman");
    }

    private void removeBorders(XWPFTable table) {
        table.setTopBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "auto");
        table.setBottomBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "auto");
        table.setLeftBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "auto");
        table.setRightBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "auto");
        table.setInsideHBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "auto");
        table.setInsideVBorder(XWPFTable.XWPFBorderType.NONE, 0, 0, "auto");
    }
}