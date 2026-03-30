import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, Footer, PageNumber } from "docx";
import { saveAs } from "file-saver";
import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist/build/pdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;

// Automatically uses the current domain, but falls back to localhost for local testing
const API_BASE = import.meta.env.PROD ? "" : "http://localhost:8080";

/* -------------------- Utilities -------------------- */
function normalizeRowKeys(row) {
  const out = {};
  for (let key in row) {
    let val = row[key];
    const lowerKey = key.toLowerCase().trim().replace(/[^a-z0-9]/g, ""); 
    if (lowerKey.includes("roll") || lowerKey.includes("reg") || lowerKey === "id") {
      val = typeof val === "number" ? String(Math.trunc(val)) : String(val).trim();
      out["registerNumber"] = val; 
      continue;
    }
    out[lowerKey] = val ?? "";
  }
  return out;
}

function readFirstSheet(file, onJSON) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    const data = new Uint8Array(evt.target.result);
    const wb = XLSX.read(data, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false, dateNF: "yyyy-mm-dd" });
    onJSON(Array.isArray(json) ? json : []);
  };
  reader.readAsArrayBuffer(file);
}

function mergeResults(rows) {
  const map = {};
  rows.forEach((r) => {
    const key = `${r.registerNumber}-${r.subjectCode || r.subject}`;
    map[key] = map[key] ? { ...map[key], grade: r.grade || map[key].grade, result: r.result || map[key].result } : r;
  });
  return Object.values(map);
}

/* -------------------- SHARED GPA CALCULATOR COMPONENT -------------------- */
function GPACalculator() {
  const [rows, setRows] = useState([{ id: 1, subject: "", grade: "O", credits: 3 }]);
  const [gpa, setGpa] = useState(null);

  const gradePoints = { "O": 10, "A+": 9, "A": 8, "B+": 7, "B": 6, "C": 5, "U": 0, "RA": 0, "AB": 0, "SA": 0, "W": 0 };

  const addRow = () => setRows([...rows, { id: Date.now(), subject: "", grade: "O", credits: 3 }]);
  const removeRow = (id) => setRows(rows.filter(r => r.id !== id));
  
  const updateRow = (id, field, val) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const calculateGPA = () => {
    let totalPoints = 0;
    let totalCredits = 0;
    rows.forEach(r => {
      const cr = Number(r.credits) || 0;
      const pts = gradePoints[r.grade.toUpperCase()] || 0;
      totalPoints += (pts * cr);
      totalCredits += cr;
    });
    setGpa(totalCredits > 0 ? (totalPoints / totalCredits).toFixed(3) : "0.000");
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-indigo-800">🎓 GPA / CGPA Calculator</h2>
          <p className="text-sm text-gray-500">Calculate your exact grade point average.</p>
        </div>
        {gpa !== null && (
          <div className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow-md text-center">
            <div className="text-xs uppercase tracking-wider font-bold opacity-80">Calculated GPA</div>
            <div className="text-2xl font-black">{gpa}</div>
          </div>
        )}
      </div>

      <div className="space-y-3 mb-6">
        <div className="grid grid-cols-12 gap-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
          <div className="col-span-5">Subject (Optional)</div>
          <div className="col-span-3">Grade</div>
          <div className="col-span-3">Credits</div>
          <div className="col-span-1 text-center">Action</div>
        </div>

        <AnimatePresence>
          {rows.map((row) => (
            <motion.div key={row.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="grid grid-cols-12 gap-3 items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
              <div className="col-span-5">
                <input type="text" placeholder="e.g. CS3452" value={row.subject} onChange={(e) => updateRow(row.id, "subject", e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-gray-700" />
              </div>
              <div className="col-span-3">
                <select value={row.grade} onChange={(e) => updateRow(row.id, "grade", e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-indigo-700 bg-white">
                  {Object.keys(gradePoints).map(g => <option key={g} value={g}>{g} ({gradePoints[g]} pts)</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <input type="number" min="1" max="10" value={row.credits} onChange={(e) => updateRow(row.id, "credits", e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-center" />
              </div>
              <div className="col-span-1 text-center">
                <button onClick={() => removeRow(row.id)} className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded transition-colors" title="Remove row">✖</button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex gap-4">
        <button onClick={addRow} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-lg border border-gray-300 transition-colors">
          + Add Subject
        </button>
        <button onClick={calculateGPA} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition-transform active:scale-95">
          🧮 Calculate GPA
        </button>
      </div>
    </div>
  );
}

/* -------------------- SHARED DOCX GENERATORS -------------------- */
const exportSemesterPaperDocx = async (config, templateType) => {
  const { header, partA, partB, partC, customContent } = config;
  try {
    if (!header) { alert("⚠️ This document is corrupted. Please delete it."); return; }

    const noBorders = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } };
    const createCell = (text, width = 10, bold = false, align = AlignmentType.CENTER) => new TableCell({ width: { size: width, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: (text || "").toString(), bold })], alignment: align, spacing: { before: 150, after: 150 } })] });
    const createLeftCell = (text, width = 70, bold = false) => new TableCell({ width: { size: width, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: (text || "").toString(), bold })], spacing: { before: 150, after: 150 } })] });
    const regBoxCells = Array.from({ length: 12 }).map(() => new TableCell({ width: { size: 3, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "", spacing: { before: 150, after: 150 } })] }));
    
    const childrenNodes = [
      new Table({ width: { size: 60, type: WidthType.PERCENTAGE }, alignment: AlignmentType.RIGHT, rows: [new TableRow({ children: [new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "Register Number  ", bold: true })], alignment: AlignmentType.RIGHT, spacing: { before: 150, after: 150 } })], borders: noBorders }), ...regBoxCells] })] }),
      new Paragraph({ text: "" }),
      new Paragraph({ children: [new TextRun({ text: "Question Paper Code: __________________", bold: true })], alignment: AlignmentType.CENTER }),
      new Paragraph({ text: "" }),
      new Paragraph({ children: [new TextRun({ text: "St. Peter’s College of Engineering and Technology", bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: "(An Autonomous Institution)", size: 24 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: header.examSession || "", bold: true })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: header.semesters || "", bold: true })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: header.department || "", bold: true })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: header.subject || "", bold: true })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: header.regulations || "", bold: true })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: "Common to CSE & IT", bold: true })], alignment: AlignmentType.CENTER }),
      new Paragraph({ text: "(Any requirements like Graphs, Charts, Tables, Data books, etc.) if applicable", alignment: AlignmentType.CENTER }),
      new Paragraph({ text: "", spacing: { after: 200 } }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Duration: Three Hours", bold: true })] })] }), new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Maximum Marks: 100", bold: true })], alignment: AlignmentType.RIGHT })] })] })] }),
      new Paragraph({ children: [new TextRun({ text: "Answer ALL Questions", bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 } }),
    ];

    if (templateType === 3) {
       const lines = (customContent || "No content provided.").split("\n");
       lines.forEach(line => {
           childrenNodes.push(new Paragraph({ text: line, spacing: { before: 100, after: 100 } }));
       });
    } else {
      const partARows = (partA || []).map(q => new TableRow({ children: [createCell(q.qNo + ".", 10, false, AlignmentType.LEFT), createLeftCell(q.question, 70, false), createCell(q.btl, 10, false, AlignmentType.CENTER), createCell(q.co, 10, false, AlignmentType.CENTER)] }));
      const createOrRow = () => new TableRow({ children: [new TableCell({ columnSpan: 5, children: [new Paragraph({ children: [new TextRun({ text: "(Or)", bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } })] })] });
      const partBRows = (partB || []).flatMap(q => [new TableRow({ children: [createCell(q.qNo + ".", 10, false, AlignmentType.LEFT), createLeftCell(`(a) ${q.a?.question || ""}`, 50, false), createCell(`(${q.a?.marks || ""})`, 10, false, AlignmentType.CENTER), createCell(q.a?.btl || "", 10, false, AlignmentType.CENTER), createCell(q.a?.co || "", 10, false, AlignmentType.CENTER)] }), createOrRow(), new TableRow({ children: [createCell("", 10), createLeftCell(`(b) ${q.b?.question || ""}`, 50, false), createCell(`(${q.b?.marks || ""})`, 10, false, AlignmentType.CENTER), createCell(q.b?.btl || "", 10, false, AlignmentType.CENTER), createCell(q.b?.co || "", 10, false, AlignmentType.CENTER)] })]);

      childrenNodes.push(
        new Paragraph({ children: [new TextRun({ text: "Part A – (10 X 2 = 20 Marks)", bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: [new TableRow({ children: [createCell("Q. No.", 10, true, AlignmentType.LEFT), createCell("Question", 70, true, AlignmentType.CENTER), createCell("BTL", 10, true), createCell("CO", 10, true)] }), ...partARows] }),
        new Paragraph({ pageBreakBefore: true, children: [new TextRun({ text: `PART B (5 × ${templateType === 1 ? "13 = 65" : "16 = 80"} Marks)`, bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 400, after: 200 } }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: [new TableRow({ children: [createCell("Q. No.", 8, true, AlignmentType.LEFT), createCell("Answer All Questions", 62, true, AlignmentType.CENTER), createCell("Marks", 10, true), createCell("BTL", 10, true), createCell("CO", 10, true)] }), ...partBRows] })
      );

      if (templateType === 1 && partC) {
        const partCRows = [new TableRow({ children: [createCell(partC.qNo + ".", 10, false, AlignmentType.LEFT), createLeftCell(`(a) ${partC.a?.question || ""}`, 50, false), createCell(`(${partC.a?.marks || ""})`, 10, false, AlignmentType.CENTER), createCell(partC.a?.btl || "", 10, false, AlignmentType.CENTER), createCell(partC.a?.co || "", 10, false, AlignmentType.CENTER)] }), createOrRow(), new TableRow({ children: [createCell("", 10), createLeftCell(`(b) ${partC.b?.question || ""}`, 50, false), createCell(`(${partC.b?.marks || ""})`, 10, false, AlignmentType.CENTER), createCell(partC.b?.btl || "", 10, false, AlignmentType.CENTER), createCell(partC.b?.co || "", 10, false, AlignmentType.CENTER)] })];
        childrenNodes.push(
          new Paragraph({ children: [new TextRun({ text: "PART C (1 × 15 = 15 Marks)", bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 400, after: 200 } }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: [new TableRow({ children: [createCell("Q. No.", 8, true, AlignmentType.LEFT), createCell("Question", 62, true, AlignmentType.CENTER), createCell("Marks", 10, true), createCell("BTL", 10, true), createCell("CO", 10, true)] }), ...partCRows] })
        );
      }
    }

    childrenNodes.push(
      new Paragraph({ pageBreakBefore: true, children: [new TextRun({ text: "Note:", bold: true })] }),
      new Paragraph({ text: "#\tA maximum of two questions can have two subdivisions.", spacing: { before: 100 } }),
      new Paragraph({ text: "#\tQuestions from same unit and same blooms taxonomy Knowledge level to be maintained in either / or questions with same mark weightage even if the questions have sub divisions.", spacing: { before: 100 } }),
      new Paragraph({ text: "#\tCompulsory Question can be derived from any of the Unit.", spacing: { before: 100 } }),
      new Paragraph({ text: "#\t{Maximum two sub divisions in (Part B & Part C) question if necessary.}", spacing: { before: 100 } }),
      new Paragraph({ text: "" }),
      new Paragraph({ children: [new TextRun({ text: "*****", bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 400 } })
    );

    const doc = new Document({
      sections: [{
        properties: {},
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Knowledge Level: K1 – Remember; K2 – Understand; K3 – Apply; K4 – Analyze; K5 – Evaluate; K6 – Create", size: 16, color: "555555" })] }), new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Page ", size: 16, color: "555555", bold: true }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "555555", bold: true }), new TextRun({ text: " of ", size: 16, color: "555555", bold: true }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "555555", bold: true })] })] }) },
        children: childrenNodes,
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${(header.subject || "Paper").substring(0,6)}_SemesterPaper.docx`);
  } catch(err) { alert("❌ Error creating document: " + err.message); }
};

const exportUnitTestPaperDocx = async (config) => {
  try {
    const { unitHeader, unitPartA, unitPartB, unitPartC, coDistribution } = config;
    if (!unitHeader) { alert("⚠️ This document is corrupted or from an older version. Please delete it."); return; }

    const marksArray = (coDistribution && coDistribution.marks && coDistribution.marks.length > 0) ? coDistribution.marks : ['-','63','-','-','-','-'];
    const percArray = (coDistribution && (coDistribution.perc || coDistribution.percentage) && (coDistribution.perc || coDistribution.percentage).length > 0) ? (coDistribution.perc || coDistribution.percentage) : ['-','100','-','-','-','-'];

    const standardBorders = { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1 }, insideVertical: { style: BorderStyle.SINGLE, size: 1 } };
    const createCell = (text, width = 10, bold = false, align = AlignmentType.CENTER) => new TableCell({ width: { size: width, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: (text || "").toString(), bold })], alignment: align, spacing: { before: 150, after: 150 } })] });
    const regBoxCells = Array.from({ length: 12 }).map(() => new TableCell({ width: { size: 3, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "", spacing: { before: 150, after: 150 } })] }));
    
    const partARows = (unitPartA || []).map(q => new TableRow({ children: [createCell(q.qNo, 5), createCell(q.question, 75, false, AlignmentType.LEFT), createCell(q.kLevel, 10), createCell(q.co, 10)] }));
    const partBRows = (unitPartB || []).map(q => new TableRow({ children: [createCell(q.qNo, 5), createCell(q.question, 67, false, AlignmentType.LEFT), createCell(q.marks, 8), createCell(q.kLevel, 10), createCell(q.co, 10)] }));
    const partCRows = (unitPartC || []).map(q => new TableRow({ children: [createCell(q.qNo, 5), createCell(q.question, 67, false, AlignmentType.LEFT), createCell(q.marks, 8), createCell(q.kLevel, 10), createCell(q.co, 10)] }));

    const doc = new Document({
      sections: [{
        properties: {},
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Knowledge Level: K1 – Remember; K2 – Understand; K3 – Apply; K4 – Analyze; K5 – Evaluate; K6 – Create", size: 16, color: "555555" })] }), new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Page ", size: 16, color: "555555" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "555555" }), new TextRun({ text: " of ", size: 16, color: "555555" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "555555" })] })] }) },
        children: [
          new Table({ width: { size: 50, type: WidthType.PERCENTAGE }, alignment: AlignmentType.RIGHT, rows: [new TableRow({ children: [new TableCell({ width: { size: 64, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "Reg. No.  ", bold: true })], alignment: AlignmentType.RIGHT, spacing: { before: 150, after: 150 } })], borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } } }), ...regBoxCells] })] }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun({ text: "Question Paper Code: __________________", bold: true })], alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun({ text: "ST. PETER’S COLLEGE OF ENGINEERING AND TECHNOLOGY", bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun({ text: "AVADI, CHENNAI 600 054", bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun({ text: unitHeader.examSession || "", bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 100 } }),
          new Paragraph({ children: [new TextRun({ text: unitHeader.semesterWord || "" })], alignment: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun({ text: unitHeader.department || "", bold: true })], alignment: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun({ text: unitHeader.subject || "", bold: true })], alignment: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun({ text: unitHeader.regulations || "", bold: true })], alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "", spacing: { after: 100 } }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } }, rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Duration: " + (unitHeader.duration || ""), bold: true })] })] }), new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Max. Marks " + (unitHeader.maxMarks || ""), bold: true })], alignment: AlignmentType.RIGHT })] })] })] }),
          new Paragraph({ children: [new TextRun({ text: "Answer ALL Questions", bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 150, after: 150 } }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: standardBorders, rows: [new TableRow({ children: [new TableCell({ columnSpan: 2, children: [new Paragraph({ children: [new TextRun({ text: "PART-A (5 x 2 = 10 Marks)", bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 150, after: 150 } })] }), createCell("K-Level", 10, true), createCell("CO", 10, true)] }), ...partARows]}),
          new Paragraph({ text: "", spacing: { after: 150 } }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: standardBorders, rows: [new TableRow({ children: [new TableCell({ columnSpan: 2, children: [new Paragraph({ children: [new TextRun({ text: "PART - B (2 x 13 = 26 marks) (Any 2)", bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 150, after: 150 } })] }), createCell("Marks", 8, true), createCell("K-Level", 10, true), createCell("CO", 10, true)] }), ...partBRows]}),
          new Paragraph({ text: "", spacing: { after: 150 } }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: standardBorders, rows: [new TableRow({ children: [new TableCell({ columnSpan: 2, children: [new Paragraph({ children: [new TextRun({ text: "PART - C (1 x 14 = 14 marks)", bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 150, after: 150 } })] }), createCell("Marks", 8, true), createCell("K-Level", 10, true), createCell("CO", 10, true)] }), ...partCRows]}),
          new Paragraph({ text: "", spacing: { after: 150 } }),
          new Table({ 
            width: { size: 100, type: WidthType.PERCENTAGE }, 
            borders: standardBorders, 
            rows: [
              new TableRow({ children: [new TableCell({ columnSpan: 7, children: [new Paragraph({ children: [new TextRun({ text: "Distribution of COs (Percentage wise)", bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 150, after: 150 } })] })] }),
              new TableRow({ children: [createCell("Evaluation", 16, true), createCell("CO1", 14, true), createCell("CO2", 14, true), createCell("CO3", 14, true), createCell("CO4", 14, true), createCell("CO5", 14, true), createCell("CO6", 14, true)] }),
              new TableRow({ children: [createCell("Marks", 16, true), createCell(marksArray[0], 14), createCell(marksArray[1], 14), createCell(marksArray[2], 14), createCell(marksArray[3], 14), createCell(marksArray[4], 14), createCell(marksArray[5], 14)] }),
              new TableRow({ children: [createCell("%", 16, true), createCell(percArray[0], 14), createCell(percArray[1], 14), createCell(percArray[2], 14), createCell(percArray[3], 14), createCell(percArray[4], 14), createCell(percArray[5], 14)] })
            ]
          })
        ],
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${(unitHeader.subject || "UnitTest").substring(0,6)}_UnitTest.docx`);
  } catch(err) { alert("❌ Error creating Unit Test document: " + err.message); }
};

/* -------------------- Login -------------------- */
function ThemedLogin({ onLogin }) {
  const [tab, setTab] = useState("student");
  const [regNo, setRegNo] = useState(""); 
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    
    let pass1 = password.trim();
    let pass2 = password.trim();

    // SMART LOGIN BYPASS: React will test BOTH date formats!
    if (tab === "student" && pass1.includes("-")) {
      const parts = pass1.split("-");
      if (parts[0].length === 4) { 
        pass2 = `${parts[2]}-${parts[1]}-${parts[0]}`; // Creates DD-MM-YYYY
      } else if (parts[2].length === 4) {
        pass2 = `${parts[2]}-${parts[1]}-${parts[0]}`; // Creates YYYY-MM-DD
      }
    }

    try {
      // Try Format 1 first
      let res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registerNumber: tab === "admin" ? "admin" : regNo.trim(), password: pass1, role: tab }),
      });
      
      // If it fails, instantly try Format 2
      if (!res.ok && pass1 !== pass2) {
        res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registerNumber: tab === "admin" ? "admin" : regNo.trim(), password: pass2, role: tab }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      
      onLogin({ role: data.role || data.user?.role, name: data.name || "", registerNumber: data.registerNumber || (tab === "admin" ? "admin" : regNo.trim()), department: data.department || "Unknown" });
    } catch { 
      alert("Invalid credentials. Please verify your Register Number and DOB."); 
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center relative" style={{ backgroundImage: "url('/college-bg.jpg')" }}>
      <div className="absolute inset-0 bg-black/40" />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative z-10 w-[480px] p-6 glacier-card bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl">
        <div className="flex items-end gap-6 mb-4"><div className="text-slate-800 text-lg font-semibold">SPCET Portal</div><div className="flex-1 border-b border-slate-400/40" /></div>
        <div className="p-4">
          <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
            {["student", "faculty", "hod", "admin"].map((t) => (
              <button key={t} onClick={() => { setTab(t); setRegNo(""); setPassword(""); }} className={`flex-1 py-2 rounded-md text-xs font-bold uppercase transition-all ${tab === t ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{t}</button>
            ))}
          </div>
          <div className="space-y-4">
            <input value={tab === "admin" ? "admin" : regNo} onChange={(e) => setRegNo(e.target.value)} disabled={tab === "admin"} placeholder={tab === "admin" ? "admin" : "Register Number / ID"} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            
            {tab === "student" ? (
              <div className="relative mt-2">
                <label className="text-[10px] font-bold text-gray-500 absolute -top-2 left-3 bg-white px-1 uppercase tracking-wider">Date of Birth</label>
                {/* CALENDAR IS BACK! type="date" */}
                <input 
                  type="date" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700" 
                />
              </div>
            ) : (
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            )}

            <button onClick={handleLogin} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all active:scale-95">Login as {tab.toUpperCase()}</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------- ADMIN DASHBOARD -------------------- */
function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState("grid"); 
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const DEPARTMENTS = ["CSE", "IT", "ECE", "EEE", "AIDS", "MECH", "CIVIL", "AERO","CSBS","BIOTECH"];
  
  const [dept, setDept] = useState("CSE"); 
  const [sem, setSem] = useState(3); 
  const [uploadRole, setUploadRole] = useState("student");
  const [calcDept, setCalcDept] = useState("CSE"); 
  const [calcSem, setCalcSem] = useState("3");
  const [manualDept, setManualDept] = useState("CSE"); 
  const [manualSem, setManualSem] = useState("3");

  const [gridType, setGridType] = useState("internal"); 
  const [gridPaperType, setGridPaperType] = useState("THEORY");
  const [templateMode, setTemplateMode] = useState("STANDARD"); 
  
  const [uploadFormat, setUploadFormat] = useState("EXCEL");
  const [ocrText, setOcrText] = useState("");
  const [showOcrModal, setShowOcrModal] = useState(false);

  const [manualUploadFormat, setManualUploadFormat] = useState("EXCEL");
  const [manualOcrText, setManualOcrText] = useState("");
  const [showManualOcrModal, setShowManualOcrModal] = useState(false);
  const [manualOcrSubject, setManualOcrSubject] = useState("");

  const [gridSubjectList, setGridSubjectList] = useState([]);
  const [gridSubject, setGridSubject] = useState("");
  const [gridData, setGridData] = useState([]);
  
  const [customCols, setCustomCols] = useState([]);
  const [savedPapers, setSavedPapers] = useState([]);

  const deptRef = useRef(dept); 
  const manualDeptRef = useRef(manualDept); 
  const manualSemRef = useRef(manualSem);   

  useEffect(() => { 
    deptRef.current = dept; manualDeptRef.current = manualDept; manualSemRef.current = manualSem; 
    setPreviewData([]); setMessage(""); 
  }, [dept, sem, activeTab, calcDept, calcSem, manualDept, manualSem]);

  // FIX 1: Bulletproof subject fetching
  useEffect(() => {
    if (activeTab === "grid" && gridType === "internal") {
      fetch(`${API_BASE}/api/import/fetch-subjects?department=${dept}&semester=${sem}&paperType=${gridPaperType}`)
        .then(res => {
            if (!res.ok) throw new Error("Server Error");
            return res.json();
        })
        .then(data => {
            const arr = Array.isArray(data) ? data : [];
            setGridSubjectList(arr); 
            if(arr.length > 0) setGridSubject(arr[0].subjectCode); else setGridSubject(""); 
        })
        .catch(err => {
            console.warn("Failed to fetch subjects for grid");
            setGridSubjectList([]);
            setGridSubject("");
        });
    }
  }, [dept, sem, gridPaperType, activeTab, gridType]);

  // FIX 2: Bulletproof paper fetching
  useEffect(() => {
    if (activeTab === "qpapers") {
      fetch(`${API_BASE}/api/import/question-papers`)
        .then(res => {
            if (!res.ok) throw new Error("Server Error");
            return res.json();
        })
        .then(data => setSavedPapers(Array.isArray(data) ? data : []))
        .catch(() => setSavedPapers([]));
    }
  }, [activeTab]);

  const [paperType, setPaperType] = useState(null); const [subjectList, setSubjectList] = useState([]); const [selectedSubject, setSelectedSubject] = useState(""); const [internalFile, setInternalFile] = useState(null);
  const [previewData, setPreviewData] = useState([]); const [loadingPreview, setLoadingPreview] = useState(false);

  const apiPost = async (endpoint, body, isFile = false) => {
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, { method: "POST", headers: isFile ? {} : { "Content-Type": "application/json" }, body: isFile ? body : JSON.stringify(body) });
      const text = await response.text();
      try { const json = JSON.parse(text); if (json.message) setMessage(`✅ Success: ${json.message}`); else if (!response.ok) throw new Error(json.message || text); else setMessage(`✅ Success: Action Completed`); } 
      catch { if (!response.ok) throw new Error(text); setMessage(`✅ Success: ${text}`); } return true; 
    } catch (err) { setMessage(`❌ Error: ${err.message}`); return false; } finally { setLoading(false); }
  };

  const handleSubjectUpload = (e) => { const file = e.target.files[0]; if (!file) return; const currentDept = deptRef.current; readFirstSheet(file, (rows) => { const mapped = rows.map((r) => { const n = normalizeRowKeys(r); return { subjectCode: n.subjectcode || n["subject code"], subjectName: n.subjectname || n["subject name"], department: currentDept, semester: parseInt(sem), l: parseInt(n.l)||0, t: parseInt(n.t)||0, p: parseInt(n.p)||0, credits: parseInt(n.c)||0, paperType: "THEORY" }; }); apiPost("/api/import/subjects", mapped); }); };
  
  const handleLoginUpload = (e) => { 
      const file = e.target.files[0]; 
      if (!file) return; 
      readFirstSheet(file, (rows) => { 
        const mapped = rows.map((r) => { 
          const n = normalizeRowKeys(r); 
          let rawPassword = "";
          for (let k in n) {
              if (k.includes("dob") || k.includes("birth") || k.includes("pass")) {
                  rawPassword = String(n[k]).trim();
                  break;
              }
          }
          
          let formattedPassword = rawPassword;
          // --- STRICT DD-MM-YYYY DATABASE LOGIC ---
          if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(rawPassword)) {
              // If Excel gives DD-MM-YYYY, keep it and ensure 0-padding
              const parts = rawPassword.split(/[\/\-]/);
              formattedPassword = `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
          } else if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(rawPassword)) {
              // If Excel is YYYY-MM-DD, flip it to DD-MM-YYYY
              const parts = rawPassword.split(/[\/\-]/);
              formattedPassword = `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
          } else if (!isNaN(rawPassword) && Number(rawPassword) > 20000) {
              // If Excel sends a weird number, convert directly to DD-MM-YYYY
              const dateObj = new Date((Number(rawPassword) - 25569) * 86400 * 1000);
              const y = dateObj.getFullYear();
              const m = String(dateObj.getMonth() + 1).padStart(2, '0');
              const d = String(dateObj.getDate()).padStart(2, '0');
              formattedPassword = `${d}-${m}-${y}`; 
          }
          // ------------------------------------------

          return { 
            registerNumber: n.registerNumber, 
            name: n.name, 
            password: formattedPassword, 
            department: n.department || "", 
            semester: n.semester ? parseInt(n.semester) : parseInt(sem), 
            role: uploadRole 
          }; 
        }); 
        const validRows = mapped.filter(m => m.registerNumber); 
        if(validRows.length === 0) { setMessage("⚠️ No valid Register Numbers found."); return; } 
        apiPost("/api/import/logins", validRows); 
      }); 
  };

  const fetchSubjects = async (type) => { setPaperType(type); setSubjectList([]); setSelectedSubject(""); setMessage(`Fetching ${type} subjects...`); try { const res = await fetch(`${API_BASE}/api/import/fetch-subjects?department=${dept}&semester=${sem}&paperType=${type}`); if (!res.ok) throw new Error("Failed to fetch subjects"); const data = await res.json(); setSubjectList(data); if (data.length === 0) setMessage(`⚠️ No ${type} subjects found.`); else setMessage(""); } catch (err) { setMessage(`❌ Error: ${err.message}`); } };
  const handleInternalUpload = () => { if (!internalFile || !selectedSubject) { setMessage("⚠️ Select a subject and file first."); return; } const formData = new FormData(); formData.append("file", internalFile); formData.append("subjectCode", selectedSubject); formData.append("department", dept); apiPost("/api/import/internal-upload", formData, true); };
  const handleExternalUpload = (e) => { const file = e.target.files[0]; if (!file) return; readFirstSheet(file, (rows) => { const mapped = rows.map((r) => { const n = normalizeRowKeys(r); return { registerNumber: n.registerNumber, subjectCode: n.subjectcode || n.subject, externalMarks: parseInt(n.mark) || 0 }; }); apiPost("/api/import/external", mapped); }); };
  const handleCalculate = () => { apiPost("/api/import/calculate-results", {}); };
  const handlePreview = async (targetSem, targetDept) => { setLoadingPreview(true); setPreviewData([]); try { const res = await fetch(`${API_BASE}/api/import/preview?semester=${targetSem}&department=${targetDept}&_t=${Date.now()}`); if(res.ok) { const data = await res.json(); setPreviewData(data); if(data.length > 0) setMessage(`✅ Loaded ${data.length} results.`); else setMessage(`⚠️ No results found for ${targetDept} Sem ${targetSem}.`); } } catch(err) { setMessage("❌ Error fetching preview"); } setLoadingPreview(false); };
  const handlePublish = async (targetSem, targetDept) => { if(!confirm(`Are you sure you want to PUBLISH results for ${targetDept} Sem ${targetSem}?`)) return; try { const res = await fetch(`${API_BASE}/api/import/publish?semester=${targetSem}&department=${targetDept}`, { method: "POST" }); const text = await res.text(); setMessage(res.ok ? "🎉 " + text : "❌ Publish failed"); handlePreview(targetSem, targetDept); } catch(err) { setMessage("❌ Error publishing"); } };
  const handleDropDrafts = async (targetSem, targetDept) => { if(!confirm(`⚠️ DELETE all unpublished drafts for ${targetDept} Sem ${targetSem}?`)) return; try { const res = await fetch(`${API_BASE}/api/import/drop-drafts?semester=${targetSem}&department=${targetDept}`, { method: "DELETE" }); if(res.ok) { setMessage("✅ Drafts Deleted."); setPreviewData([]); } } catch(err) { setMessage("❌ Error dropping drafts"); } };
  const handleDownload = () => { const ws = XLSX.utils.json_to_sheet(previewData); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Draft Results"); XLSX.writeFile(wb, `Results_Draft.xlsx`); };
  const handleUnpublishLive = async (targetSem, targetDept) => { if(!confirm(`🚨 DANGER: Are you sure you want to DROP/UNPUBLISH the LIVE results for ${targetDept} Sem ${targetSem}?`)) return; try { const res = await fetch(`${API_BASE}/api/import/unpublish?semester=${targetSem}&department=${targetDept}`, { method: "DELETE" }); if(res.ok) { setMessage(`✅ Successfully dropped live results for ${targetDept} Semester ${targetSem}.`); } else { const text = await res.text(); setMessage(`❌ Error unpublishing: ${text}`); } } catch(err) { setMessage("❌ Network error dropping live results."); } };
  
  const handlePromote = async (targetDept, targetSem) => {
    if(!confirm(`⚠️ PROMOTION: Are you sure you want to promote all ${targetDept} Semester ${targetSem} students to the next stage?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/import/promote-students?department=${targetDept}&currentSemester=${targetSem}`, { method: "POST" });
      const data = await res.json();
      if(res.ok) setMessage(`🎉 Success: ${data.message}`);
      else setMessage(`❌ Error: ${data.error || "Promotion failed"}`);
    } catch (err) { setMessage("❌ Network error during promotion."); }
    setLoading(false);
  };

  const handleDeletePaper = async (id) => {
    if (!confirm("⚠️ Are you sure you want to permanently delete this question paper?")) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/import/question-paper/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ Success: ${data.message}`);
        setSavedPapers(prev => prev.filter(paper => paper.id !== id));
      } else { setMessage(`❌ Error: ${data.error}`); }
    } catch (err) { setMessage("❌ Network error during deletion."); }
    setLoading(false);
  };
  
  const handleSmartScanUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type === "application/pdf") { alert("⚠️ The AI Scanner requires an Image file (PNG/JPG). Please take a screenshot of your PDF and upload the image!"); return; }
    
    setLoading(true); setMessage("🔍 Document AI is scanning your image... This may take a moment."); setShowOcrModal(true);
    try {
      const result = await Tesseract.recognize(file, 'eng', { logger: m => console.log(m) });
      setOcrText(result.data.text);
      setMessage("✅ Smart Scan complete. Please verify the extracted text below.");
    } catch (err) {
      setMessage("❌ OCR Failed. Make sure the image is clear, or try a different file.");
      setShowOcrModal(false);
    }
    setLoading(false);
  };

  const parseOcrDataToDB = () => {
      const currentDept = deptRef.current; 
      const currentSem = String(sem);
      const lines = ocrText.split('\n');
      const finalPayload = [];
      const regex = /(1127\d{8}|[A-Z0-9]{10,14}).*?(\d{1,3})/i;

      lines.forEach(line => {
          const match = line.match(regex);
          if (match) {
              const regNo = match[1].toUpperCase();
              const mark = parseInt(match[2]);
              if (mark <= 100) {
                 finalPayload.push({
                     registerNumber: regNo, subjectCode: selectedSubject || "SCANNED", semester: currentSem, grade: mark >= 50 ? "PASS" : "FAIL", result: mark >= 50 ? "PASS" : "FAIL", mark: String(mark), department: currentDept
                 });
              }
          }
      });
      if (finalPayload.length === 0) { alert("⚠️ Could not find valid Register Numbers and Marks in the text."); return; }
      if(!confirm(`📢 SCANNED UPLOAD:\nFound ${finalPayload.length} valid students.\nClick OK to upload directly to Drafts.`)) return; 
      
      apiPost("/api/import/results", finalPayload).then((success) => { 
          if(success) { setShowOcrModal(false); setTimeout(() => handlePreview(currentSem, currentDept), 1500); }
      });
  };

  const handleManualSmartScanUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type === "application/pdf") {
        alert("⚠️ You uploaded a PDF. Please change the Dropdown above to 'Native PDF' instead of 'AI Smart Scan'!");
        return;
    }

    setLoading(true); setMessage("🔍 Document AI is scanning your image... This may take a moment."); setShowManualOcrModal(true);
    try {
      const result = await Tesseract.recognize(file, 'eng', { logger: m => console.log(m) });
      setManualOcrText(result.data.text);
      setMessage("✅ Smart Scan complete. Please verify the extracted grades below.");
    } catch (err) {
      setMessage("❌ OCR Failed. Make sure the image is clear.");
      setShowManualOcrModal(false);
    }
    setLoading(false);
  };

  const parseManualOcrDataToDB = () => {
      const currentDept = manualDeptRef.current;
      const currentSem = String(manualSemRef.current);
      const lines = manualOcrText.split('\n');
      const finalPayload = [];

      let globalRegNo = null;
      lines.forEach(line => {
          const rMatch = line.match(/\b(1127\d{8}|[A-Z0-9]{10,14})\b/i);
          if (rMatch && !globalRegNo) globalRegNo = rMatch[1].toUpperCase();
      });

      lines.forEach(line => {
          const regMatch = line.match(/\b(1127\d{8}|[A-Z0-9]{10,14})\b/i);
          const subjMatch = line.match(/\b([A-Z]{2,3}\d{4,5})\b/i);
          
          const gradesRegex = /\b(O|0|Ο|A\+|A|B\+|B|C|U|RA|AB|SA|W|FAIL|PASS)\b/ig;
          let grades = [];
          let match;
          while ((match = gradesRegex.exec(line)) !== null) {
              grades.push(match[1].toUpperCase().replace(/0|Ο/g, 'O'));
          }

          if (grades.length > 0) {
              const gradeVal = grades[grades.length - 1]; 
              const isFail = ["U", "RA", "AB", "FAIL", "F", "ABSENT", "WH", "W", "SA"].includes(gradeVal);

              if (subjMatch && globalRegNo) {
                  const subjCode = subjMatch[1].toUpperCase();
                  if (!finalPayload.some(p => p.registerNumber === globalRegNo && p.subjectCode === subjCode)) {
                      finalPayload.push({
                          registerNumber: globalRegNo,
                          subjectCode: subjCode,
                          semester: currentSem,
                          grade: gradeVal,
                          result: isFail ? "FAIL" : "PASS",
                          mark: "0",
                          department: currentDept
                      });
                  }
              }
              else if (regMatch && manualOcrSubject) {
                  const regNo = regMatch[1].toUpperCase();
                  if (!finalPayload.some(p => p.registerNumber === regNo && p.subjectCode === manualOcrSubject)) {
                      finalPayload.push({
                          registerNumber: regNo,
                          subjectCode: manualOcrSubject.trim().toUpperCase(),
                          semester: currentSem,
                          grade: gradeVal,
                          result: isFail ? "FAIL" : "PASS",
                          mark: "0",
                          department: currentDept
                      });
                  }
              }
          }
      });

      if (finalPayload.length === 0) { alert("⚠️ Could not find valid grades in the text."); return; }
      if(!confirm(`📢 SCANNED MANUAL UPLOAD:\nTarget Dept: ${currentDept}\nTarget Sem: ${currentSem}\nFound ${finalPayload.length} valid grades.\nClick OK to upload to Drafts.`)) return;

      apiPost("/api/import/results", finalPayload).then((success) => {
          if(success) { setShowManualOcrModal(false); setTimeout(() => handlePreview(currentSem, currentDept), 1500); }
      });
  };

  const handleManualPDFUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setLoading(true);
      setMessage("📄 Extracting text and mapping grades from PDF... Please wait.");

      try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let allLines = [];

          for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();

              const itemsByY = {};
              content.items.forEach(item => {
                  const y = Math.round(item.transform[5]);
                  let targetY = y;
                  for (let existingY in itemsByY) {
                      if (Math.abs(existingY - y) < 5) {
                          targetY = existingY;
                          break;
                      }
                  }
                  if (!itemsByY[targetY]) itemsByY[targetY] = [];
                  itemsByY[targetY].push(item);
              });

              const yCoords = Object.keys(itemsByY).sort((a, b) => b - a); 
              yCoords.forEach(y => {
                  const lineItems = itemsByY[y].sort((a, b) => a.transform[4] - b.transform[4]); 
                  const lineText = lineItems.map(item => item.str.trim()).filter(str => str.length > 0).join(" ");
                  if (lineText) allLines.push(lineText);
              });
          }

          const currentDept = manualDeptRef.current;
          const currentSem = String(manualSemRef.current);
          const finalPayload = [];
          let currentSubjects = [];

          allLines.forEach(line => {
              const subjectMatches = line.match(/\b[A-Z]{2,3}\d{4,5}\b/g);
              if (subjectMatches && subjectMatches.length >= 2) {
                  currentSubjects = subjectMatches;
              }

              const regMatch = line.match(/\b(1127\d{8}|[A-Z0-9]{10,14})\b/);
              if (regMatch && currentSubjects.length > 0) {
                  const regNo = regMatch[1].toUpperCase();
                  const afterRegNo = line.substring(line.indexOf(regNo) + regNo.length);
                  
                  const gradeRegex = /\b(O|0|Ο|A\+|A|B\+|B|C|U|RA|AB|SA|W|WH\d*)\b/g;
                  const grades = [];
                  let gMatch;
                  while ((gMatch = gradeRegex.exec(afterRegNo)) !== null) {
                      grades.push(gMatch[1].toUpperCase().replace(/0|Ο/g, 'O'));
                  }

                  const validGrades = grades.slice(-currentSubjects.length);

                  for(let i = 0; i < Math.min(validGrades.length, currentSubjects.length); i++) {
                      const gradeVal = validGrades[i];
                      const isFail = ["U", "RA", "AB", "FAIL", "F", "ABSENT", "WH", "WH1", "W", "SA"].includes(gradeVal);
                      
                      finalPayload.push({
                          registerNumber: regNo,
                          subjectCode: currentSubjects[i],
                          semester: currentSem,
                          grade: gradeVal,
                          result: isFail ? "FAIL" : "PASS",
                          mark: "0",
                          department: currentDept
                      });
                  }
              }
          });

          if (finalPayload.length === 0) {
              alert("⚠️ Could not find valid Students and Subjects in this PDF.");
              setLoading(false);
              return;
          }

          if(!confirm(`📢 PDF PROCESSED:\nTarget Dept: ${currentDept}\nTarget Sem: ${currentSem}\nMapped ${finalPayload.length} total grades from the PDF.\nClick OK to upload to Drafts.`)) {
              setLoading(false);
              return;
          }

          apiPost("/api/import/results", finalPayload).then((success) => {
              if(success) { setTimeout(() => handlePreview(currentSem, currentDept), 1500); }
          });

      } catch (err) {
          console.error(err);
          setMessage("❌ Failed to process PDF. Is it password protected?");
      }
      setLoading(false);
  };

  const handleCustomTemplateUpload = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    readFirstSheet(file, (rows) => {
       if(rows.length > 0) {
          const originalHeaders = Object.keys(rows[0]).filter(k => k.toLowerCase() !== "registernumber" && k.toLowerCase() !== "name");
          setCustomCols(originalHeaders);
          
          const resetData = gridData.map(s => {
             const newStudent = { registerNumber: s.registerNumber, name: s.name };
             originalHeaders.forEach(h => newStudent[h] = "");
             return newStudent;
          });
          setGridData(resetData);
          setMessage("✅ Custom Grid Template Loaded! You can now start entering data.");
       }
    });
  };

  // FIX 3: Bulletproof Student fetching
  const fetchStudentsForGrid = async () => {
    if(!gridSubject.trim() && gridType === "external") { alert("Please enter the Subject Code."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/import/logins`);
      if (!res.ok) throw new Error("Server returned an error");
      const data = await res.json();
      const validData = Array.isArray(data) ? data : [];
      
      const targetYear = Math.ceil(Number(sem) / 2);
      const filtered = validData.filter(u => {
        const dbDept = String(u.department || "").trim().toUpperCase();
        const uiDept = String(dept).trim().toUpperCase();
        if (dbDept !== uiDept) return false;
        if (Number(sem) === 99) return Number(u.semester) === 99;
        const studentYear = Number(u.year) || Math.ceil(Number(u.semester) / 2);
        return studentYear === targetYear;
      });
      
      setGridData(filtered.map(s => {
        const base = { registerNumber: s.registerNumber, name: s.name, extMarks: "" };
        if(templateMode === "CUSTOM") {
            customCols.forEach(c => base[c] = "");
            return base;
        }
        return {
          ...base,
          ut1: "", ut2: "", ut3: "", ut4: "", ut5: "", utAvg: "", utScaled: "",
          title: "", dress: "", pres: "", disc: "", semMarks: "", int1: "",
          ex1: "", ex2: "", ex3: "", ex4: "", ex5: "", ex6: "", ex7: "", ex8: "", ex9: "", ex10: "", pAvg: "", p75: "", p25: "", pInt: "",
          iUt1: "", iUt2: "", iUt3: "", iUtT: "", iUtEq: "", iUt: "",
          iTitle: "", iDress: "", iPres: "", iDisc: "", iSemMarks: "", iInt75: "",
          iEx1: "", iEx2: "", iEx3: "", iEx4: "", iEx5: "", iExAvg: "", iEx75: "", iModel: "", iIntFinal: ""
        };
      }));

      if(filtered.length === 0) setMessage(`⚠️ No students found in ${dept} Semester ${sem}.`);
      else setMessage(`✅ Loaded ${filtered.length} students. Ready for data entry.`);
    } catch (e) {
      setMessage("❌ Error fetching students. Ensure database has data.");
      setGridData([]);
    }
    setLoading(false);
  };

  const handleGridChange = (index, field, value) => {
    const newData = [...gridData];
    newData[index][field] = value;
    setGridData(newData);
  };

  const saveGridData = async () => {
    if (gridType === "external") {
      const validData = gridData.filter(s => s.extMarks.trim() !== "");
      if(validData.length === 0) { alert("No external marks entered!"); return; }
      const payload = validData.map(s => ({
        registerNumber: s.registerNumber, subjectCode: gridSubject.toUpperCase().trim(), externalMarks: parseInt(s.extMarks) || 0
      }));
      apiPost("/api/import/external", payload).then(success => {
        if(success) alert(`✅ External Marks saved! You can now run the Calculation Engine.`);
      });
      return;
    }

    let aoa = [];
    let merges = [];

    if (templateMode === "CUSTOM") {
        aoa = [ ["Register Number", "Name", ...customCols] ];
        gridData.forEach((s) => {
           const hasData = customCols.some(c => s[c]);
           if (hasData) {
               aoa.push([s.registerNumber, s.name, ...customCols.map(c => s[c])]);
           }
        });
        merges = [];
    }
    else if (gridPaperType === "THEORY") {
        aoa = [
            ["S.No", "Register Number", "Name of the Student", "Unit Test", "", "", "", "", "", "", "Seminar/ Case Study - Rubrics for Evaluation", "", "", "", "", "Internal I"],
            ["", "", "", "UT-1", "UT-2", "UT-3", "UT-4", "UT-5", "Avg", "UT", "Title", "Dress Code &", "Presenta", "Discus", "Marks", "Marks"]
        ];
        gridData.forEach((s, idx) => {
            if(s.ut1 || s.int1 || s.title) {
                aoa.push([
                    idx + 1, String(s.registerNumber), String(s.name), 
                    s.ut1, s.ut2, s.ut3, s.ut4, s.ut5, s.utAvg, s.utScaled,
                    s.title, s.dress, s.pres, s.disc, s.semMarks, s.int1
                ]);
            }
        });
        merges = [{ s: {r:0, c:3}, e: {r:0, c:9} }, { s: {r:0, c:10}, e: {r:0, c:14} }];
    } 
    else if (gridPaperType === "PRACTICAL") {
        aoa = [
            ["S.No", "Register Number", "Name of the Student", "Marks for Each Experiemont (10)", "", "", "", "", "", "", "", "", "", "Average", "75%", "25%", "Internal Mark"],
            ["", "", "", "Ex-1", "Ex-2", "Ex-3", "Ex-4", "Ex-5", "Ex-6", "Ex-7", "Ex-8", "Ex-9", "Ex-10", "", "", "", ""]
        ];
        gridData.forEach((s, idx) => {
            if(s.ex1 || s.pInt) {
                aoa.push([
                    idx + 1, String(s.registerNumber), String(s.name),
                    s.ex1, s.ex2, s.ex3, s.ex4, s.ex5, s.ex6, s.ex7, s.ex8, s.ex9, s.ex10,
                    s.pAvg, s.p75, s.p25, s.pInt
                ]);
            }
        });
        merges = [{ s: {r:0, c:3}, e: {r:0, c:12} }];
    } 
    else if (gridPaperType === "INTEGRATED") {
        aoa = [
            ["S.No", "Register Number", "Name of the Student", "Unit Test", "", "", "", "", "", "Seminar/ Case Study - Rubrics for Evaluation", "", "", "", "", "Internal Mar", "Marks for Each Experiemont (10)", "", "", "", "", "Average", "75%", "Model", "Internal"],
            ["", "", "", "UT-1", "UT-2", "UT-3", "UT-T", "UT-eq", "UT", "Title", "Dress Code &", "Presenta", "Discus", "Marks", "75%", "Ex-1", "Ex-2", "Ex-3", "Ex-4", "Ex-5", "", "", "", ""]
        ];
        gridData.forEach((s, idx) => {
            if(s.iUt1 || s.iIntFinal) {
                aoa.push([
                    idx + 1, String(s.registerNumber), String(s.name),
                    s.iUt1, s.iUt2, s.iUt3, s.iUtT, s.iUtEq, s.iUt,
                    s.iTitle, s.iDress, s.iPres, s.iDisc, s.iSemMarks, s.iInt75,
                    s.iEx1, s.iEx2, s.iEx3, s.iEx4, s.iEx5, s.iExAvg, s.iEx75, s.iModel, s.iIntFinal
                ]);
            }
        });
        merges = [{ s: {r:0, c:3}, e: {r:0, c:8} }, { s: {r:0, c:9}, e: {r:0, c:13} }, { s: {r:0, c:15}, e: {r:0, c:19} }];
    }

    if(aoa.length === 1 || aoa.length === 2 && templateMode !== "CUSTOM") { alert("No marks entered!"); return; }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Internals");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const file = new File([blob], "live_grid_internals.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("subjectCode", gridSubject);
    formData.append("department", dept);

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/import/internal-upload`, { method: "POST", body: formData });
      const text = await response.text();
      if(response.ok) {
        setMessage(`✅ Success: ${text}`);
        alert(`✅ Internal Marks saved successfully via ${templateMode === "CUSTOM" ? "Custom" : gridPaperType} template!`);
      } else { setMessage(`❌ Error: ${text}`); }
    } catch (err) { setMessage(`❌ Network Error submitting marks.`); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800">
      <header className="bg-white shadow px-6 py-4 flex justify-between items-center z-10 sticky top-0"><h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">🎓 SPCET Admin</h1><button onClick={onLogout} className="text-sm text-red-500 font-medium hover:underline">Logout</button></header>
      <main className="flex-1 max-w-[1500px] mx-auto w-full p-6">
        
        {/* TAB NAVIGATION */}
        <div className="flex gap-4 border-b border-gray-200 mb-6 overflow-x-auto">
          <button onClick={() => setActiveTab("setup")} className={`pb-2 px-4 font-medium transition-colors ${activeTab === "setup" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500"}`}>1. Setup</button>
          <button onClick={() => setActiveTab("excel")} className={`pb-2 px-4 font-medium transition-colors ${activeTab === "excel" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500"}`}>2. Excel Uploads</button>
          <button onClick={() => setActiveTab("grid")} className={`pb-2 px-4 font-bold transition-colors ${activeTab === "grid" ? "border-b-2 border-green-600 text-green-700" : "text-gray-500 hover:text-green-700"}`}>3. Live Grid Entry</button>
          <button onClick={() => setActiveTab("process")} className={`pb-2 px-4 font-medium transition-colors ${activeTab === "process" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500"}`}>4. Calculate</button>
          <button onClick={() => setActiveTab("manual")} className={`pb-2 px-4 font-bold transition-colors ${activeTab === "manual" ? "border-b-2 border-orange-500 text-orange-600" : "text-gray-500 hover:text-orange-600"}`}>5. Final Override</button>
          <button onClick={() => setActiveTab("manage")} className={`pb-2 px-4 font-bold transition-colors ${activeTab === "manage" ? "border-b-2 border-red-600 text-red-600" : "text-gray-500 hover:text-red-600"}`}>6. Manage Live</button>
          <button onClick={() => setActiveTab("qpapers")} className={`pb-2 px-4 font-bold transition-colors ${activeTab === "qpapers" ? "border-b-2 border-purple-600 text-purple-700" : "text-gray-500 hover:text-purple-700"}`}>7. Question Papers</button>
          
          {/* NEW GPA TAB */}
          <button onClick={() => setActiveTab("gpa")} className={`pb-2 px-4 font-bold transition-colors ${activeTab === "gpa" ? "border-b-2 border-indigo-600 text-indigo-700" : "text-gray-500 hover:text-indigo-700"}`}>8. GPA Calc</button>
        </div>

        <AnimatePresence>{message && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`p-4 rounded-md mb-6 text-sm font-medium shadow-sm ${message.startsWith("✅") || message.startsWith("🎉") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{message}</motion.div>}</AnimatePresence>
        
        {/* NEW GPA VIEW */}
        {activeTab === "gpa" && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="max-w-4xl mx-auto">
                 <GPACalculator />
              </div>
           </motion.div>
        )}

        {activeTab === "setup" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6"> 
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex gap-4 items-end">
              <div className="flex-1"><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Target Department</label><select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md outline-none">{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Target Semester</label>
                <select value={sem} onChange={(e) => setSem(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md outline-none">
                   {[1, 2, 3, 4, 5, 6, 7, 8, 99].map((n) => <option key={n} value={n}>{n === 99 ? "Graduated 🎓" : `Semester ${n}`}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"><h3 className="font-bold text-lg mb-2 text-gray-700">1. Upload Subjects</h3><input type="file" onChange={handleSubjectUpload} accept=".xlsx, .csv" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-700" /></div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"><h3 className="font-bold text-lg text-gray-700">2. Upload Logins</h3><div className="mb-2"><select value={uploadRole} onChange={(e) => setUploadRole(e.target.value)} className="text-xs border border-gray-300 rounded px-2 py-1"><option value="student">Role: STUDENT</option><option value="hod">Role: HOD</option><option value="faculty">Role: FACULTY</option></select></div><input type="file" onChange={handleLoginUpload} accept=".xlsx, .csv" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-700" /></div>
              
              <div className="bg-indigo-50 p-6 rounded-xl shadow-sm border border-indigo-100 col-span-1 md:col-span-2">
                <h3 className="font-bold text-lg mb-2 text-indigo-800">🎓 Semester Promotion Engine</h3>
                <p className="text-sm text-indigo-600 mb-4">Automatically move all students up one semester. Semester 8 students will be marked as <b>Graduated</b>.</p>
                <button onClick={() => handlePromote(dept, sem)} disabled={loading || Number(sem) === 99} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:bg-gray-400">
                  <span>📈</span> Run Promotion for {dept} Sem {sem}
                </button>
              </div>
            </div>
          </motion.div>
        )}
        
        {activeTab === "excel" && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 mb-6">
                <div className="flex justify-between mb-6">
                    <h2 className="text-lg font-bold text-gray-800">Upload Internal Marks</h2>
                    <select value={uploadFormat} onChange={e => setUploadFormat(e.target.value)} className="p-2 border border-blue-300 rounded-lg font-bold text-blue-700 bg-blue-50 outline-none">
                        <option value="EXCEL">📄 Excel / CSV Document</option>
                        <option value="SCAN">📸 AI Smart Scan (Image OCR)</option>
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Department</label><select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md">{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Semester</label><select value={sem} onChange={(e) => setSem(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md">{[1, 2, 3, 4, 5, 6, 7, 8, 99].map((n) => <option key={n} value={n}>{n === 99 ? "Graduated 🎓" : `Semester ${n}`}</option>)}</select></div>
                </div>

                {uploadFormat === "EXCEL" ? (
                    <>
                        <div className="mb-6"><label className="block text-xs font-bold text-gray-500 uppercase mb-3">Select Paper Type</label><div className="flex gap-4"><button onClick={() => fetchSubjects("THEORY")} className="flex-1 py-2 rounded-lg border font-medium text-sm">📘 Theory</button><button onClick={() => fetchSubjects("PRACTICAL")} className="flex-1 py-2 rounded-lg border font-medium text-sm">🧪 Practical</button><button onClick={() => fetchSubjects("INTEGRATED")} className="flex-1 py-2 rounded-lg border font-medium text-sm">🔀 Integrated</button></div></div>
                        {paperType && (<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200"><div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select Subject</label><select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm">{subjectList.map((s) => <option key={s.subjectCode} value={s.subjectCode}>{s.subjectCode} - {s.subjectName}</option>)}</select></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Upload Internal Excel</label><input type="file" onChange={(e) => setInternalFile(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-600 file:text-white" accept=".xlsx, .xls, .csv" /></div><button onClick={handleInternalUpload} disabled={loading} className="w-full py-2 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700">🚀 Upload Internals</button></motion.div>)}
                    </>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                        <h3 className="font-bold text-blue-900 mb-2">📸 Document AI (OCR)</h3>
                        <p className="text-sm text-blue-700 mb-4">Upload a clear photo (PNG/JPG) of a physical marksheet. The system will use Optical Character Recognition to extract Register Numbers and Marks automatically.</p>
                        <input type="file" onChange={handleSmartScanUpload} accept="image/*" className="block w-full text-sm text-blue-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-600 file:text-white file:font-bold hover:file:bg-blue-700 cursor-pointer" />
                        
                        {showOcrModal && (
                            <div className="mt-6 p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
                                <h4 className="font-bold text-gray-700 mb-2">Raw Scanned Data</h4>
                                <textarea value={ocrText} onChange={e => setOcrText(e.target.value)} className="w-full h-40 p-3 border border-gray-300 rounded text-sm font-mono text-gray-600 outline-none focus:border-blue-500" placeholder="Extracted text will appear here. You can manually edit it before saving..." />
                                <div className="mt-4 flex gap-4">
                                    <input type="text" placeholder="Subject Code (e.g. CS3452)" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="border p-2 rounded flex-1 outline-none font-bold" />
                                    <button onClick={parseOcrDataToDB} className="bg-green-600 text-white font-bold py-2 px-6 rounded shadow-md hover:bg-green-700">Send to Drafts</button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
            
            {uploadFormat === "EXCEL" && (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100"><h2 className="text-lg font-bold mb-4 text-gray-800">Upload External Marks (Excel)</h2><p className="text-sm text-gray-500 mb-4">Upload the final university external marks sheet.</p><input type="file" onChange={handleExternalUpload} accept=".xlsx, .csv" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-teal-50 file:text-teal-700" /></div>
            )}
        </motion.div>)}
        
        {/* 3. LIVE GRID ENTRY TAB */}
        {activeTab === "grid" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-green-50 p-8 rounded-xl shadow-sm border border-green-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-green-800">Live Grid Data Entry</h2>
                <span className="bg-green-200 text-green-800 text-xs font-bold px-3 py-1 rounded shadow-sm">Excel Generator Backend</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-green-700 uppercase mb-2">Target Dept</label>
                  <select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full p-2.5 border border-green-300 rounded-lg font-bold text-gray-700 bg-white outline-none focus:ring-2 focus:ring-green-500">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-green-700 uppercase mb-2">Semester</label>
                  <select value={sem} onChange={(e) => setSem(e.target.value)} className="w-full p-2.5 border border-green-300 rounded-lg font-bold text-gray-700 bg-white outline-none focus:ring-2 focus:ring-green-500">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 99].map(n => <option key={n} value={n}>{n === 99 ? "Graduated 🎓" : `Semester ${n}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-green-700 uppercase mb-2">Mark Type</label>
                  <select value={gridType} onChange={(e) => { setGridType(e.target.value); setGridData([]); }} className="w-full p-2.5 border border-green-300 rounded-lg font-bold text-indigo-700 bg-white outline-none focus:ring-2 focus:ring-green-500">
                    <option value="internal">Internal Marks</option>
                    <option value="external">External Marks</option>
                  </select>
                </div>
                
                {gridType === "internal" ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-green-700 uppercase mb-2">Paper Type</label>
                      <select value={gridPaperType} onChange={(e) => { setGridPaperType(e.target.value); setGridData([]); }} className="w-full p-2.5 border border-green-300 rounded-lg font-bold text-indigo-700 bg-white outline-none focus:ring-2 focus:ring-green-500">
                        <option value="THEORY">📘 Theory</option>
                        <option value="PRACTICAL">🧪 Practical</option>
                        <option value="INTEGRATED">🔀 Integrated</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-green-700 uppercase mb-2">Template Mode</label>
                      <select value={templateMode} onChange={(e) => { setTemplateMode(e.target.value); setGridData([]); setCustomCols([]); }} className="w-full p-2.5 border border-green-300 rounded-lg font-bold text-orange-700 bg-white outline-none focus:ring-2 focus:ring-green-500">
                        <option value="STANDARD">📐 Standard Grid</option>
                        <option value="CUSTOM">⚙️ Custom Excel</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-green-700 uppercase mb-2">Subject Code</label>
                    <input type="text" placeholder="e.g. CS3452" value={gridSubject} onChange={(e) => setGridSubject(e.target.value.toUpperCase())} className="w-full p-2.5 border border-green-300 rounded-lg font-bold text-gray-700 bg-white shadow-sm focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                )}
              </div>

              {gridType === "internal" && (
                <div className="mb-6">
                  <label className="block text-xs font-bold text-green-700 uppercase mb-2">Select Subject from Database</label>
                  <select value={gridSubject} onChange={(e) => setGridSubject(e.target.value)} className="w-full p-2.5 border border-green-300 rounded-lg font-bold text-gray-700 bg-white outline-none focus:ring-2 focus:ring-green-500">
                    {gridSubjectList.length === 0 ? <option value="">No subjects found for this Dept/Sem/Type</option> : gridSubjectList.map(s => <option key={s.subjectCode} value={s.subjectCode}>{s.subjectCode} - {s.subjectName}</option>)}
                  </select>
                </div>
              )}
              
              {gridType === "internal" && templateMode === "CUSTOM" && (
                <div className="mb-6">
                  <label className="block text-xs font-bold text-green-700 uppercase mb-2">Upload Custom Template (Excel)</label>
                  <input type="file" onChange={handleCustomTemplateUpload} accept=".xlsx, .xls, .csv" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-green-100 file:text-green-800 font-bold" />
                  <p className="text-xs text-gray-500 mt-2">Upload any Excel sheet. The grid will automatically rebuild itself using your exact headers! (Saved as {gridPaperType} type)</p>
                </div>
              )}

              <button onClick={fetchStudentsForGrid} disabled={gridType === "internal" && templateMode === "CUSTOM" && customCols.length === 0} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors active:scale-95 flex justify-center items-center gap-2 disabled:bg-gray-400">
                <span>🔄</span> Fetch Roster for Entry
              </button>
            </div>

            {gridData.length > 0 && (
              <div className="bg-white border border-gray-300 rounded-xl overflow-hidden shadow-lg">
                <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
                  <h3 className="font-bold text-lg tracking-wide">Entering {gridType === 'internal' ? gridPaperType + ' Internals' : 'Externals'} for {templateMode === "CUSTOM" ? "Custom Document" : gridSubject}</h3>
                  <span className="text-sm font-bold bg-indigo-500 px-4 py-1.5 rounded-full">{gridData.length} Students</span>
                </div>
                
                <div className="max-h-[650px] overflow-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    
                    <thead className="bg-slate-100 text-slate-700 uppercase text-xs font-bold sticky top-0 shadow-sm z-40 whitespace-nowrap">
                      
                      {gridType === "internal" && templateMode === "CUSTOM" && (
                        <tr>
                          <th className="px-6 py-4 border-r border-b-2 border-slate-300 bg-slate-200 w-[160px] min-w-[160px] sticky left-0 z-50">Register No</th>
                          <th className="px-6 py-4 border-r border-b-2 border-slate-300 bg-slate-200 w-[250px] min-w-[250px] sticky left-[160px] z-50">Name</th>
                          {customCols.map(c => (
                             <th key={c} className="px-4 py-4 text-center border-b-2 border-r border-slate-300 bg-blue-50 text-blue-900 tracking-wider">{c}</th>
                          ))}
                        </tr>
                      )}

                      {gridType === "internal" && templateMode === "STANDARD" && gridPaperType === "THEORY" && (
                        <>
                          <tr>
                            <th rowSpan={2} className="px-6 py-4 border-r border-b-2 border-slate-300 bg-slate-200 w-[160px] min-w-[160px] sticky left-0 z-50">Register No</th>
                            <th rowSpan={2} className="px-6 py-4 border-r border-b-2 border-slate-300 bg-slate-200 w-[250px] min-w-[250px] sticky left-[160px] z-50">Name</th>
                            <th colSpan={7} className="px-4 py-2 text-center border-b border-r border-slate-300 bg-blue-100 text-blue-900 tracking-wider">Unit Test</th>
                            <th colSpan={5} className="px-4 py-2 text-center border-b border-r border-slate-300 bg-amber-100 text-amber-900 tracking-wider">Seminar / Case Study</th>
                            <th rowSpan={2} className="px-4 py-4 text-center border-b-2 border-slate-300 bg-teal-100 text-teal-900 tracking-wider">Internal I</th>
                          </tr>
                          <tr>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">UT-1</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">UT-2</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">UT-3</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">UT-4</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">UT-5</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">Avg</th>
                            <th className="px-2 py-2 text-center border-r border-b-2 border-slate-300 bg-blue-100">UT</th>
                            
                            <th className="px-2 py-2 text-center bg-amber-50 border-r border-b-2 border-slate-300">Title</th>
                            <th className="px-2 py-2 text-center bg-amber-50 border-r border-b-2 border-slate-300">Dress</th>
                            <th className="px-2 py-2 text-center bg-amber-50 border-r border-b-2 border-slate-300">Presenta</th>
                            <th className="px-2 py-2 text-center bg-amber-50 border-r border-b-2 border-slate-300">Discus</th>
                            <th className="px-2 py-2 text-center border-r border-b-2 border-slate-300 bg-amber-100">Marks</th>
                          </tr>
                        </>
                      )}

                      {gridType === "internal" && templateMode === "STANDARD" && gridPaperType === "PRACTICAL" && (
                        <>
                          <tr>
                            <th rowSpan={2} className="px-6 py-4 border-r border-b-2 border-slate-300 bg-slate-200 w-[160px] min-w-[160px] sticky left-0 z-50">Register No</th>
                            <th rowSpan={2} className="px-6 py-4 border-r border-b-2 border-slate-300 bg-slate-200 w-[250px] min-w-[250px] sticky left-[160px] z-50">Name</th>
                            <th colSpan={10} className="px-4 py-2 text-center border-b border-r border-slate-300 bg-blue-100 text-blue-900 tracking-wider">Marks for Each Experiment (10)</th>
                            <th rowSpan={2} className="px-3 py-4 text-center border-r border-b-2 border-slate-300 bg-slate-100">Avg</th>
                            <th rowSpan={2} className="px-3 py-4 text-center border-r border-b-2 border-slate-300 bg-slate-100">75%</th>
                            <th rowSpan={2} className="px-3 py-4 text-center border-r border-b-2 border-slate-300 bg-slate-100">25%</th>
                            <th rowSpan={2} className="px-4 py-4 text-center border-b-2 border-slate-300 bg-teal-100 text-teal-900 tracking-wider">Int Mark</th>
                          </tr>
                          <tr>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">Ex-1</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">Ex-2</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">Ex-3</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">Ex-4</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">Ex-5</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">Ex-6</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">Ex-7</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">Ex-8</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">Ex-9</th>
                            <th className="px-2 py-2 text-center border-r border-b-2 border-slate-300 bg-blue-100">Ex-10</th>
                          </tr>
                        </>
                      )}

                      {gridType === "internal" && templateMode === "STANDARD" && gridPaperType === "INTEGRATED" && (
                        <>
                          <tr>
                            <th rowSpan={2} className="px-6 py-4 border-r border-b-2 border-slate-300 bg-slate-200 w-[160px] min-w-[160px] sticky left-0 z-50">Register No</th>
                            <th rowSpan={2} className="px-6 py-4 border-r border-b-2 border-slate-300 bg-slate-200 w-[250px] min-w-[250px] sticky left-[160px] z-50">Name</th>
                            <th colSpan={6} className="px-4 py-2 text-center border-b border-r border-slate-300 bg-blue-100 text-blue-900 tracking-wider">Unit Test</th>
                            <th colSpan={5} className="px-4 py-2 text-center border-b border-r border-slate-300 bg-amber-100 text-amber-900 tracking-wider">Seminar / Case Study</th>
                            <th rowSpan={2} className="px-4 py-4 text-center border-r border-b-2 border-slate-300 bg-teal-50 text-teal-900 tracking-wider">Int Mar</th>
                            <th colSpan={5} className="px-4 py-2 text-center border-b border-r border-slate-300 bg-purple-100 text-purple-900 tracking-wider">Experiments</th>
                            <th rowSpan={2} className="px-3 py-4 text-center border-r border-b-2 border-slate-300 bg-slate-100">Avg</th>
                            <th rowSpan={2} className="px-3 py-4 text-center border-r border-b-2 border-slate-300 bg-slate-100">75%</th>
                            <th rowSpan={2} className="px-3 py-4 text-center border-r border-b-2 border-slate-300 bg-slate-100">Model</th>
                            <th rowSpan={2} className="px-4 py-4 text-center border-b-2 border-slate-300 bg-teal-100 text-teal-900 tracking-wider">Internal</th>
                          </tr>
                          <tr>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">UT-1</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">UT-2</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">UT-3</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">UT-T</th>
                            <th className="px-2 py-2 text-center bg-blue-50 border-r border-b-2 border-slate-300">UT-eq</th>
                            <th className="px-2 py-2 text-center border-r border-b-2 border-slate-300 bg-blue-100">UT</th>
                            
                            <th className="px-2 py-2 text-center bg-amber-50 border-r border-b-2 border-slate-300">Title</th>
                            <th className="px-2 py-2 text-center bg-amber-50 border-r border-b-2 border-slate-300">Dress</th>
                            <th className="px-2 py-2 text-center bg-amber-50 border-r border-b-2 border-slate-300">Presenta</th>
                            <th className="px-2 py-2 text-center bg-amber-50 border-r border-b-2 border-slate-300">Discus</th>
                            <th className="px-2 py-2 text-center border-r border-b-2 border-slate-300 bg-amber-100">Marks</th>

                            <th className="px-2 py-2 text-center bg-purple-50 border-r border-b-2 border-slate-300">Ex-1</th>
                            <th className="px-2 py-2 text-center bg-purple-50 border-r border-b-2 border-slate-300">Ex-2</th>
                            <th className="px-2 py-2 text-center bg-purple-50 border-r border-b-2 border-slate-300">Ex-3</th>
                            <th className="px-2 py-2 text-center bg-purple-50 border-r border-b-2 border-slate-300">Ex-4</th>
                            <th className="px-2 py-2 text-center bg-purple-50 border-r border-b-2 border-slate-300">Ex-5</th>
                          </tr>
                        </>
                      )}

                      {gridType === "external" && (
                        <tr>
                          <th className="px-6 py-4 border-b-2 border-slate-300 bg-slate-200">Register No</th>
                          <th className="px-6 py-4 border-b-2 border-slate-300 bg-slate-200">Name</th>
                          <th className="px-6 py-4 text-center border-b-2 border-slate-300 bg-teal-100 text-teal-900 text-base">External Marks (Out of 100)</th>
                        </tr>
                      )}
                    </thead>

                    <tbody className="divide-y divide-gray-200 whitespace-nowrap">
                      {gridData.map((s, idx) => (
                        <tr key={s.registerNumber} className="hover:bg-indigo-50/50 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-gray-700 border-r sticky left-0 bg-white z-20 w-[160px] min-w-[160px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{s.registerNumber}</td>
                          <td className="px-4 py-3 font-semibold text-gray-800 border-r sticky left-[160px] bg-white z-20 w-[250px] min-w-[250px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-normal leading-tight">{s.name}</td>
                          
                          {gridType === "internal" && templateMode === "CUSTOM" && customCols.map(c => (
                             <td key={c} className="px-2 py-2 text-center border-r"><input type="text" value={s[c] || ""} onChange={(e) => handleGridChange(idx, c, e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                          ))}

                          {gridType === "internal" && templateMode === "STANDARD" && gridPaperType === "THEORY" && (
                            <>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.ut1} onChange={(e) => handleGridChange(idx, "ut1", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.ut2} onChange={(e) => handleGridChange(idx, "ut2", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.ut3} onChange={(e) => handleGridChange(idx, "ut3", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.ut4} onChange={(e) => handleGridChange(idx, "ut4", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.ut5} onChange={(e) => handleGridChange(idx, "ut5", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.utAvg} onChange={(e) => handleGridChange(idx, "utAvg", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.utScaled} onChange={(e) => handleGridChange(idx, "utScaled", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              
                              <td className="px-2 py-2 text-center border-r"><input type="text" value={s.title} onChange={(e) => handleGridChange(idx, "title", e.target.value)} className="w-48 p-2 text-sm border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" placeholder="Seminar Topic..." /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.dress} onChange={(e) => handleGridChange(idx, "dress", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.pres} onChange={(e) => handleGridChange(idx, "pres", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.disc} onChange={(e) => handleGridChange(idx, "disc", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.semMarks} onChange={(e) => handleGridChange(idx, "semMarks", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              
                              <td className="px-3 py-2 text-center"><input type="number" value={s.int1} onChange={(e) => handleGridChange(idx, "int1", e.target.value)} className="w-20 text-center p-2 text-base font-bold border border-teal-400 bg-teal-50 text-teal-900 rounded focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none shadow-inner" /></td>
                            </>
                          )}

                          {gridType === "internal" && templateMode === "STANDARD" && gridPaperType === "PRACTICAL" && (
                            <>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.ex1} onChange={(e) => handleGridChange(idx, "ex1", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.ex2} onChange={(e) => handleGridChange(idx, "ex2", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.ex3} onChange={(e) => handleGridChange(idx, "ex3", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.ex4} onChange={(e) => handleGridChange(idx, "ex4", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.ex5} onChange={(e) => handleGridChange(idx, "ex5", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.ex6} onChange={(e) => handleGridChange(idx, "ex6", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.ex7} onChange={(e) => handleGridChange(idx, "ex7", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.ex8} onChange={(e) => handleGridChange(idx, "ex8", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.ex9} onChange={(e) => handleGridChange(idx, "ex9", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.ex10} onChange={(e) => handleGridChange(idx, "ex10", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.pAvg} onChange={(e) => handleGridChange(idx, "pAvg", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.p75} onChange={(e) => handleGridChange(idx, "p75", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.p25} onChange={(e) => handleGridChange(idx, "p25", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-3 py-2 text-center"><input type="number" value={s.pInt} onChange={(e) => handleGridChange(idx, "pInt", e.target.value)} className="w-20 text-center p-2 text-base font-bold border border-teal-400 bg-teal-50 text-teal-900 rounded focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none shadow-inner" /></td>
                            </>
                          )}

                          {gridType === "internal" && templateMode === "STANDARD" && gridPaperType === "INTEGRATED" && (
                            <>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iUt1} onChange={(e) => handleGridChange(idx, "iUt1", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iUt2} onChange={(e) => handleGridChange(idx, "iUt2", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iUt3} onChange={(e) => handleGridChange(idx, "iUt3", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iUtT} onChange={(e) => handleGridChange(idx, "iUtT", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iUtEq} onChange={(e) => handleGridChange(idx, "iUtEq", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iUt} onChange={(e) => handleGridChange(idx, "iUt", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              
                              <td className="px-2 py-2 text-center border-r"><input type="text" value={s.iTitle} onChange={(e) => handleGridChange(idx, "iTitle", e.target.value)} className="w-48 p-2 text-sm border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" placeholder="Topic..." /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iDress} onChange={(e) => handleGridChange(idx, "iDress", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iPres} onChange={(e) => handleGridChange(idx, "iPres", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iDisc} onChange={(e) => handleGridChange(idx, "iDisc", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iSemMarks} onChange={(e) => handleGridChange(idx, "iSemMarks", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iInt75} onChange={(e) => handleGridChange(idx, "iInt75", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded outline-none bg-teal-50 text-teal-800 shadow-inner" /></td>

                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iEx1} onChange={(e) => handleGridChange(idx, "iEx1", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iEx2} onChange={(e) => handleGridChange(idx, "iEx2", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iEx3} onChange={(e) => handleGridChange(idx, "iEx3", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iEx4} onChange={(e) => handleGridChange(idx, "iEx4", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iEx5} onChange={(e) => handleGridChange(idx, "iEx5", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iExAvg} onChange={(e) => handleGridChange(idx, "iExAvg", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iEx75} onChange={(e) => handleGridChange(idx, "iEx75", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-2 py-2 text-center border-r"><input type="number" value={s.iModel} onChange={(e) => handleGridChange(idx, "iModel", e.target.value)} className="w-16 text-center p-2 text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none shadow-inner" /></td>
                              <td className="px-3 py-2 text-center"><input type="number" value={s.iIntFinal} onChange={(e) => handleGridChange(idx, "iIntFinal", e.target.value)} className="w-20 text-center p-2 text-base font-bold border border-teal-400 bg-teal-100 text-teal-900 rounded focus:border-teal-600 focus:ring-2 focus:ring-teal-300 outline-none shadow-inner" /></td>
                            </>
                          )}
                          
                          {gridType === "external" && (
                            <td className="px-4 py-2 text-center">
                              <input type="number" value={s.extMarks} onChange={(e) => handleGridChange(idx, "extMarks", e.target.value)} className="w-32 text-center p-2 text-base border border-teal-400 bg-teal-50 font-bold rounded focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none shadow-inner" placeholder="0-100" />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 bg-slate-100 border-t border-slate-300 flex justify-end">
                   <button onClick={saveGridData} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-10 rounded-lg shadow-lg transition-transform active:scale-95 flex items-center gap-2 text-lg tracking-wide">
                     <span>{loading ? "Saving..." : "💾 Upload to Server Engine"}</span>
                   </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* 4. PROCESS TAB */}
        {activeTab === "process" && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6"><div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between"><div><h3 className="font-bold text-xl text-indigo-800">Run Calculation Engine</h3><p className="text-sm text-gray-500 mt-1">Merges Internal + External marks from the database into final Grades.</p></div><button onClick={handleCalculate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-lg font-bold shadow-lg transition-transform active:scale-95">⚙️ Calculate Results</button></div><div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"><h4 className="font-bold text-gray-700 mb-3 text-sm uppercase">Preview & Publish</h4><div className="flex flex-wrap gap-4 items-center mb-4"><div className="flex items-center gap-2"><span className="text-sm font-medium text-gray-500">Dept:</span><select value={calcDept} onChange={(e) => setCalcDept(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm font-bold w-24 outline-none">{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div><div className="flex items-center gap-2"><span className="text-sm font-medium text-gray-500">Sem:</span><select value={calcSem} onChange={(e) => setCalcSem(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm font-bold w-24 outline-none">{[1, 2, 3, 4, 5, 6, 7, 8, 99].map(n => <option key={n} value={n}>{n === 99 ? "Graduated 🎓" : `Semester ${n}`}</option>)}</select></div><button onClick={() => handlePreview(calcSem, calcDept)} disabled={loadingPreview} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded border border-gray-300 text-sm font-medium transition-colors">{loadingPreview ? "Loading..." : "Check Drafts"}</button>{previewData.length > 0 && (<div className="flex gap-2 ml-auto"><button onClick={handleDownload} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-bold shadow-md flex items-center gap-2"><span>📥</span> Download Draft</button><button onClick={() => handlePublish(calcSem, calcDept)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold shadow-md flex items-center gap-2"><span>🚀</span> Publish Live</button></div>)}</div>{previewData.length > 0 && (<div className="overflow-hidden border border-gray-200 rounded-lg"><div className="max-h-[500px] overflow-y-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold sticky top-0 shadow-sm z-10"><tr><th className="px-4 py-3 bg-gray-50">Register No</th><th className="px-4 py-3 bg-gray-50">Subject</th><th className="px-4 py-3 text-center bg-gray-50">Marks</th><th className="px-4 py-3 text-center bg-gray-50">Grade</th><th className="px-4 py-3 text-center bg-gray-50">Status</th></tr></thead><tbody className="divide-y divide-gray-100">{previewData.map((r, i) => (<tr key={i} className="hover:bg-gray-50"><td className="px-4 py-2 font-mono text-gray-600">{r.registerNumber}</td><td className="px-4 py-2">{r.subjectCode}</td><td className="px-4 py-2 text-center">{r.finalMarks}</td><td className="px-4 py-2 text-center font-bold text-blue-600">{r.grade}</td><td className="px-4 py-2 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${r.result === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{r.result}</span></td></tr>))}</tbody></table></div></div>)}</div></motion.div>)}
        
        {/* 5. MANUAL OVERRIDE (EXCEL / PDF / SCAN) */}
        {activeTab === "manual" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
             <div className="bg-orange-50 p-8 rounded-xl shadow-sm border border-orange-200">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-bold text-orange-800">Manual Result Override</h2>
                 <select value={manualUploadFormat} onChange={e => setManualUploadFormat(e.target.value)} className="p-2 border border-orange-300 rounded-lg font-bold text-orange-700 bg-white outline-none">
                     <option value="EXCEL">📄 Excel / CSV Document</option>
                     <option value="PDF">📑 Native PDF (Whole Semester)</option>
                     <option value="SCAN">📸 AI Smart Scan (Image OCR)</option>
                 </select>
               </div>
               
               <div className="grid grid-cols-2 gap-6 mb-6">
                 <div><label className="block text-xs font-bold text-orange-700 uppercase mb-2">Target Department</label><select value={manualDept} onChange={(e) => setManualDept(e.target.value)} className="w-full p-3 border border-orange-300 rounded-lg font-bold text-gray-700 bg-white">{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                 <div><label className="block text-xs font-bold text-orange-700 uppercase mb-2">Target Semester</label><select value={manualSem} onChange={(e) => setManualSem(e.target.value)} className="w-full p-3 border border-orange-300 rounded-lg font-bold text-gray-700 bg-white">{[1, 2, 3, 4, 5, 6, 7, 8, 99].map(n => <option key={n} value={n}>{n === 99 ? "Graduated 🎓" : `Semester ${n}`}</option>)}</select></div>
               </div>
               
               {manualUploadFormat === "EXCEL" && (
                   <div className="bg-white p-6 rounded-lg border border-orange-100 mb-6"><label className="block text-sm font-bold text-gray-600 mb-3">Upload Final Grade Sheet (Excel/CSV)</label><input type="file" onChange={(e) => {
                      const file = e.target.files[0]; if (!file) return; const currentDept = manualDeptRef.current; const currentSem = String(manualSemRef.current);
                      readFirstSheet(file, (rows) => {
                        if (rows.length === 0) return; const firstRow = normalizeRowKeys(rows[0]); const isVertical = !!(firstRow.subject || firstRow.subjectcode || firstRow.code); let finalPayload = [];
                        if (isVertical) { finalPayload = rows.map((r) => { const n = normalizeRowKeys(r); return { registerNumber: n.registerNumber || n.rollno || "", subjectCode: n.subjectcode || n.subject || "", semester: currentSem, grade: n.grade || "", result: n.result || "", mark: "0", department: currentDept }; }); } else { finalPayload = rows.flatMap((r) => { const n = normalizeRowKeys(r); const regNo = n.registerNumber || n.rollno; if (!regNo) return []; const ignoreKeys = ["registernumber", "rollno", "name", "sno", "serialno", "department", "semester", "dob", "password"]; return Object.keys(r).map(k => { const lowerKey = k.toLowerCase().trim().replace(/[^a-z0-9]/g, ""); if (ignoreKeys.includes(lowerKey)) return null; const gradeVal = String(r[k]).trim(); if (!gradeVal) return null; return { registerNumber: regNo, subjectCode: k.trim(), semester: currentSem, grade: gradeVal, result: ["U", "RA", "AB", "FAIL", "F", "ABSENT", "WH", "SA"].includes(gradeVal.toUpperCase()) ? "FAIL" : "PASS", mark: "0", department: currentDept }; }).filter(item => item !== null); }); }
                        const validData = finalPayload.filter(x => x.registerNumber && x.subjectCode); if (validData.length === 0) { setMessage("⚠️ No valid data found."); return; } if(!confirm(`📢 MANUAL UPLOAD:\nTarget Dept: ${currentDept}\nTarget Sem: ${currentSem}\nRows Found: ${validData.length}\nClick OK to Upload.`)) return; apiPost("/api/import/results", validData).then((success) => { if(success) setTimeout(() => handlePreview(currentSem, currentDept), 1500); });
                      });
                   }} accept=".xlsx, .csv" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:font-bold file:bg-orange-600 file:text-white hover:file:bg-orange-700 cursor-pointer" /></div>
               )}

               {manualUploadFormat === "PDF" && (
                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-purple-50 p-6 rounded-xl border border-purple-200 mb-6">
                        <h3 className="font-bold text-purple-900 mb-2">📑 Native PDF Extractor</h3>
                        <p className="text-sm text-purple-700 mb-4">Upload the official whole-semester PDF from the University. The system will automatically map every student's row to the correct subject columns at the top of the page!</p>
                        <input type="file" onChange={handleManualPDFUpload} accept="application/pdf" className="block w-full text-sm text-purple-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-purple-600 file:text-white file:font-bold hover:file:bg-purple-700 cursor-pointer" />
                   </motion.div>
               )}

               {manualUploadFormat === "SCAN" && (
                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-orange-100/50 p-6 rounded-xl border border-orange-200 mb-6">
                        <h3 className="font-bold text-orange-900 mb-2">📸 Document AI (OCR) for Final Grades</h3>
                        <p className="text-sm text-orange-700 mb-4">Upload a scanned image (PNG/JPG) of the final result sheet (e.g. mobile screenshot). The AI will extract Register Numbers and Letter Grades (O, A+, B, U, etc.) automatically.</p>
                        <input type="file" onChange={handleManualSmartScanUpload} accept="image/*" className="block w-full text-sm text-orange-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-orange-600 file:text-white file:font-bold hover:file:bg-orange-700 cursor-pointer" />
                        
                        {showManualOcrModal && (
                            <div className="mt-6 p-4 bg-white rounded-lg border border-orange-200 shadow-sm">
                                <h4 className="font-bold text-gray-700 mb-2">Raw Scanned Data</h4>
                                <textarea value={manualOcrText} onChange={e => setManualOcrText(e.target.value)} className="w-full h-40 p-3 border border-gray-300 rounded text-sm font-mono text-gray-600 outline-none focus:border-orange-500" placeholder="Extracted text will appear here. You can manually edit it before saving..." />
                                <div className="mt-4 flex gap-4">
                                    <input type="text" placeholder="Subject Code (For Horizontal rows only)" value={manualOcrSubject} onChange={e => setManualOcrSubject(e.target.value)} className="border p-2 rounded flex-1 outline-none font-bold" />
                                    <button onClick={parseManualOcrDataToDB} className="bg-green-600 text-white font-bold py-2 px-6 rounded shadow-md hover:bg-green-700">Send to Drafts</button>
                                </div>
                            </div>
                        )}
                   </motion.div>
               )}
               
               <div className="flex gap-4">
                 <button onClick={() => handlePreview(manualSem, manualDept)} className="flex-1 bg-white border border-orange-300 text-orange-700 font-bold py-3 rounded-lg hover:bg-orange-50 transition-colors shadow-sm">2. Check Drafts</button>
                 <button onClick={() => handleDropDrafts(manualSem, manualDept)} className="flex-1 bg-red-100 border border-red-300 text-red-700 font-bold py-3 rounded-lg hover:bg-red-200 transition-colors shadow-sm">3. Drop Results</button>
                 <button onClick={() => handlePublish(manualSem, manualDept)} className="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 shadow-md transition-colors">4. Publish Live 🚀</button>
               </div>
             </div>
             {previewData.length > 0 && (<div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-700">Draft Results Preview</h3><button onClick={handleDownload} className="text-indigo-600 text-sm font-bold hover:underline">Download Excel</button></div><div className="max-h-[500px] overflow-y-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold sticky top-0"><tr><th className="px-4 py-3">Register No</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3 text-center">Grade</th><th className="px-4 py-3 text-center">Result</th></tr></thead><tbody className="divide-y divide-gray-100">{previewData.map((r, i) => (<tr key={i} className="hover:bg-gray-50"><td className="px-4 py-2 font-mono">{r.registerNumber}</td><td className="px-4 py-2">{r.subjectCode}</td><td className="px-4 py-2 text-center font-bold text-blue-600">{r.grade}</td><td className="px-4 py-2 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${r.result === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{r.result}</span></td></tr>))}</tbody></table></div></div>)}
          </motion.div>
        )}

        {/* 6. MANAGE LIVE */}
        {activeTab === "manage" && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6"><div className="bg-red-50 p-8 rounded-xl shadow-sm border border-red-200"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-red-800">Manage Published Results</h2><span className="bg-red-200 text-red-800 text-xs font-bold px-3 py-1 rounded-full shadow-sm">Live Mode</span></div><p className="text-red-700 text-sm mb-6 font-medium">Use this section to completely remove results that are currently visible to Students and HODs.</p><div className="grid grid-cols-2 gap-6 mb-8"><div><label className="block text-xs font-bold text-red-700 uppercase mb-2">Target Department</label><select value={calcDept} onChange={(e) => setCalcDept(e.target.value)} className="w-full p-3 border border-red-300 rounded-lg font-bold text-gray-700 bg-white outline-none">{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div><div><label className="block text-xs font-bold text-red-700 uppercase mb-2">Target Semester</label><select value={calcSem} onChange={(e) => setCalcSem(e.target.value)} className="w-full p-3 border border-red-300 rounded-lg font-bold text-gray-700 bg-white outline-none">{[1, 2, 3, 4, 5, 6, 7, 8, 99].map(n => <option key={n} value={n}>{n === 99 ? "Graduated 🎓" : `Semester ${n}`}</option>)}</select></div></div><button onClick={() => handleUnpublishLive(calcSem, calcDept)} className="w-full bg-red-600 text-white font-bold py-4 rounded-lg hover:bg-red-700 shadow-lg transition-all active:scale-95 flex justify-center items-center gap-2 text-lg"><span>🚨</span> Unpublish & Drop Live Results</button></div></motion.div>)}
        
        {/* 7. ADMIN QUESTION PAPERS BANK */}
        {activeTab === "qpapers" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-purple-50 p-8 rounded-xl shadow-sm border border-purple-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-purple-800">Question Paper Bank</h2>
                <button onClick={() => setActiveTab("qpapers")} className="bg-purple-200 text-purple-800 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-purple-300">🔄 Refresh</button>
              </div>
              
              {savedPapers.length === 0 ? (
                 <div className="text-center p-10 bg-white rounded-xl border border-dashed border-purple-300 text-purple-500 font-medium">No question papers have been generated by faculty yet.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedPapers.map((paper, index) => (
                    <div key={index} className="bg-white p-5 rounded-xl border border-purple-100 shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="bg-purple-100 text-purple-800 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">{paper.department}</span>
                          <h3 className="font-bold text-lg text-gray-800 mt-2">{paper.subjectCode}</h3>
                          <p className="text-xs text-gray-500 mt-1">{paper.examSession}</p>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${paper.examType === 'UNIT_TEST' ? 'bg-teal-100 text-teal-800' : 'bg-indigo-100 text-indigo-800'}`}>
                              {paper.examType === 'UNIT_TEST' ? "UNIT TEST" : "SEMESTER PAPER"}
                            </span>
                            {paper.examType !== 'UNIT_TEST' && (
                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${paper.hasPartC ? 'text-blue-600 border border-blue-200' : 'text-gray-500 border border-gray-200'}`}>
                                  {paper.hasPartC ? "Template 1" : "Template 2"}
                                </span>
                            )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => {
                            if (paper.examType === "UNIT_TEST") {
                                exportUnitTestPaperDocx(JSON.parse(paper.paperData));
                            } else {
                                exportSemesterPaperDocx(JSON.parse(paper.paperData), paper.hasPartC);
                            }
                        }} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg transition-all active:scale-95 flex justify-center items-center gap-2">
                          <span>📥</span> Download
                        </button>
                        
                        <button onClick={() => handleDeletePaper(paper.id)} className="bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 font-bold py-2 px-3 rounded-lg transition-all active:scale-95 flex justify-center items-center" title="Delete Paper">
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

/* -------------------- FACULTY DASHBOARD -------------------- */
function FacultyDashboard({ user, onLogout }) {
  const [view, setView] = useState("menu"); 
  const [templateType, setTemplateType] = useState(1);

  const [header, setHeader] = useState({
    examSession: "B.E / B.Tech Degree Examinations – November/December 2025",
    semesters: "V, VI, VII, VIII Semester",
    department: user?.department || "CSE & IT",
    subject: "CCS356 – Object Oriented Software Engineering",
    regulations: "(Regulations 2021)",
    requirements: "Nil"
  });

  const [partA, setPartA] = useState(Array.from({ length: 10 }, (_, i) => ({ qNo: i + 1, question: "", btl: "K1", co: "CO1" })));
  const [partB, setPartB] = useState(Array.from({ length: 5 }, (_, i) => ({ qNo: i + 11, a: { question: "", btl: "K2", co: `CO${i+1}`, marks: "13" }, b: { question: "", btl: "K2", co: `CO${i+1}`, marks: "13" } })));
  const [partC, setPartC] = useState({ qNo: 16, a: { question: "", btl: "K4", co: "CO5", marks: "15" }, b: { question: "", btl: "K4", co: "CO5", marks: "15" } });
  
  const [customContent, setCustomContent] = useState("");

  const [unitHeader, setUnitHeader] = useState({
    examSession: "BE - DEGREE EXAMINATIONS, APRIL 2024",
    semesterWord: "Fourth Semester",
    department: "DEPARTMENT OF " + (user?.department || "CSE & IT"),
    subject: "CS3452 - THEORY OF COMPUTATION",
    regulations: "(Regulations 2021)",
    duration: "2 Hours",
    maxMarks: "50"
  });

  const [unitPartA, setUnitPartA] = useState(Array.from({ length: 5 }, (_, i) => ({ qNo: i + 1, question: "", kLevel: "K1", co: "CO1" })));
  const [unitPartB, setUnitPartB] = useState(Array.from({ length: 3 }, (_, i) => ({ qNo: i + 6, question: "", marks: "13", kLevel: "K2", co: "CO2" })));
  const [unitPartC, setUnitPartC] = useState([{ qNo: 9, question: "", marks: "14", kLevel: "K4", co: "CO3" }]);
  const [coDist, setCoDist] = useState({ marks: ['-','63','-','-','-','-'], perc: ['-','100','-','-','-','-'] });

  const handleGenerateWord = async () => {
    const config = { header, partA, partB, partC, customContent };
    await exportSemesterPaperDocx(config, templateType);

    try { 
      await fetch(`${API_BASE}/api/import/save-question-paper`, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ 
           subjectCode: header.subject,
           department: header.department,
           examSession: header.examSession,
           hasPartC: templateType === 1,
           examType: "SEMESTER", 
           paperData: JSON.stringify(config) 
        }) 
      }); 
      alert("✅ Document downloaded and sent to Admin Portal!");
    } catch(err) { console.warn(err); }
  };

  const handleGenerateUnitWord = async () => {
    const config = { unitHeader, unitPartA, unitPartB, unitPartC, coDistribution: { marks: coDist.marks, percentage: coDist.perc } };
    await exportUnitTestPaperDocx(config);
    
    try {
      await fetch(`${API_BASE}/api/import/save-question-paper`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
           subjectCode: unitHeader.subject,
           department: unitHeader.department,
           examSession: unitHeader.examSession,
           hasPartC: false,
           examType: "UNIT_TEST",
           paperData: JSON.stringify(config) 
        })
      });
      alert("✅ Unit Test Document downloaded and sent to Admin Portal!");
    } catch(err) { console.warn("Backend save failed.", err); }
  };

  if (view === "menu") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800">
        <header className="bg-white shadow px-6 py-4 flex justify-between items-center z-10 sticky top-0"><h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">👨‍🏫 Faculty Portal</h1><button onClick={onLogout} className="text-sm text-red-500 font-medium hover:underline">Logout</button></header>
        <main className="flex-1 max-w-4xl mx-auto w-full p-6 flex flex-col items-center justify-center">
          <h2 className="text-3xl font-bold text-slate-800 mb-8">What would you like to create?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            <div onClick={() => setView("semester")} className="bg-white p-8 rounded-xl shadow-md border border-gray-200 hover:border-indigo-500 hover:shadow-xl transition-all cursor-pointer flex flex-col items-center text-center group"><span className="text-5xl mb-4 group-hover:scale-110 transition-transform">📝</span><h3 className="text-xl font-bold text-indigo-700 mb-2">Semester Question Paper</h3></div>
            <div onClick={() => setView("unit")} className="bg-white p-8 rounded-xl shadow-md border border-gray-200 hover:border-teal-500 hover:shadow-xl transition-all cursor-pointer flex flex-col items-center text-center group"><span className="text-5xl mb-4 group-hover:scale-110 transition-transform">📋</span><h3 className="text-xl font-bold text-teal-700 mb-2">Unit Test Question Paper</h3></div>
          </div>
        </main>
      </div>
    );
  }

  if (view === "unit") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800">
        <header className="bg-white shadow px-6 py-4 flex justify-between items-center z-10 sticky top-0"><div className="flex items-center gap-4"><button onClick={() => setView("menu")} className="text-gray-500 hover:text-indigo-600 font-bold transition-colors">← Back</button><h1 className="text-xl font-bold text-teal-600 flex items-center gap-2">📋 Unit Test Generator</h1></div><button onClick={onLogout} className="text-sm text-red-500 font-medium hover:underline">Logout</button></header>
        <main className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-6">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-4 text-teal-800">Unit Exam Header</h2>
            <div className="grid grid-cols-2 gap-4">
              <input value={unitHeader.examSession} onChange={e => setUnitHeader({...unitHeader, examSession: e.target.value})} className="p-2 border rounded" placeholder="Exam Session" />
              <input value={unitHeader.semesterWord} onChange={e => setUnitHeader({...unitHeader, semesterWord: e.target.value})} className="p-2 border rounded" placeholder="Semester Word" />
              <input value={unitHeader.department} onChange={e => setUnitHeader({...unitHeader, department: e.target.value})} className="p-2 border rounded" placeholder="Department" />
              <input value={unitHeader.subject} onChange={e => setUnitHeader({...unitHeader, subject: e.target.value})} className="p-2 border rounded font-bold text-teal-700" placeholder="Subject" />
              <input value={unitHeader.duration} onChange={e => setUnitHeader({...unitHeader, duration: e.target.value})} className="p-2 border rounded" placeholder="Duration" />
              <input value={unitHeader.maxMarks} onChange={e => setUnitHeader({...unitHeader, maxMarks: e.target.value})} className="p-2 border rounded" placeholder="Max Marks" />
            </div>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100"><h2 className="text-xl font-bold mb-4">Part A (5 x 2 = 10 Marks)</h2>{unitPartA.map((q, index) => (<div key={index} className="flex gap-4 mb-3 items-start border-b pb-3"><span className="font-bold text-gray-500 w-8 pt-2">{q.qNo}.</span><textarea value={q.question} onChange={e => { const newA = [...unitPartA]; newA[index].question = e.target.value; setUnitPartA(newA); }} className="flex-1 p-2 border border-gray-300 rounded resize-none" rows="2" placeholder="Question..." /><input value={q.kLevel} onChange={e => { const newA = [...unitPartA]; newA[index].kLevel = e.target.value; setUnitPartA(newA); }} className="w-16 p-2 border rounded text-center" placeholder="K-Level" /><input value={q.co} onChange={e => { const newA = [...unitPartA]; newA[index].co = e.target.value; setUnitPartA(newA); }} className="w-16 p-2 border rounded text-center" placeholder="CO" /></div>))}</div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100"><h2 className="text-xl font-bold mb-4">Part B (2 x 13 = 26 Marks) - Any 2</h2>{unitPartB.map((q, index) => (<div key={index} className="flex gap-4 mb-3 items-start border-b pb-3"><span className="font-bold text-gray-500 w-8 pt-2">{q.qNo}.</span><textarea value={q.question} onChange={e => { const newB = [...unitPartB]; newB[index].question = e.target.value; setUnitPartB(newB); }} className="flex-1 p-2 border border-gray-300 rounded resize-none" rows="3" placeholder="Question..." /><input value={q.marks} onChange={e => { const newB = [...unitPartB]; newB[index].marks = e.target.value; setUnitPartB(newB); }} className="w-16 p-2 border rounded text-center" placeholder="Marks" /><input value={q.kLevel} onChange={e => { const newB = [...unitPartB]; newB[index].kLevel = e.target.value; setUnitPartB(newB); }} className="w-16 p-2 border rounded text-center" placeholder="K-Level" /><input value={q.co} onChange={e => { const newB = [...unitPartB]; newB[index].co = e.target.value; setUnitPartB(newB); }} className="w-16 p-2 border rounded text-center" placeholder="CO" /></div>))}</div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100"><h2 className="text-xl font-bold mb-4">Part C (1 x 14 = 14 Marks)</h2><div className="flex gap-4 mb-3 items-start"><span className="font-bold text-gray-500 w-8 pt-2">{unitPartC[0].qNo}.</span><textarea value={unitPartC[0].question} onChange={e => setUnitPartC([{...unitPartC[0], question: e.target.value}])} className="flex-1 p-2 border border-gray-300 rounded resize-none" rows="3" placeholder="Question..." /><input value={unitPartC[0].marks} onChange={e => setUnitPartC([{...unitPartC[0], marks: e.target.value}])} className="w-16 p-2 border rounded text-center" /><input value={unitPartC[0].kLevel} onChange={e => setUnitPartC([{...unitPartC[0], kLevel: e.target.value}])} className="w-16 p-2 border rounded text-center" /><input value={unitPartC[0].co} onChange={e => setUnitPartC([{...unitPartC[0], co: e.target.value}])} className="w-16 p-2 border rounded text-center" /></div></div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100"><h2 className="text-xl font-bold mb-4">Distribution of COs</h2><div className="grid grid-cols-7 gap-2 text-center font-bold text-sm bg-gray-100 p-2 rounded"><div>Evaluation</div><div>CO1</div><div>CO2</div><div>CO3</div><div>CO4</div><div>CO5</div><div>CO6</div></div><div className="grid grid-cols-7 gap-2 mt-2"><div className="font-bold pt-2 text-center">Marks</div>{coDist.marks.map((m, i) => <input key={`m${i}`} value={m} onChange={e => { const nm = [...coDist.marks]; nm[i] = e.target.value; setCoDist({...coDist, marks: nm}) }} className="border p-2 text-center rounded" />)}</div><div className="grid grid-cols-7 gap-2 mt-2"><div className="font-bold pt-2 text-center">%</div>{coDist.perc.map((p, i) => <input key={`p${i}`} value={p} onChange={e => { const np = [...coDist.perc]; np[i] = e.target.value; setCoDist({...coDist, perc: np}) }} className="border p-2 text-center rounded" />)}</div></div>
          <div className="flex justify-end pt-4 pb-10"><button onClick={handleGenerateUnitWord} className="bg-teal-600 text-white font-bold py-4 px-8 rounded-lg shadow-lg hover:bg-teal-700 active:scale-95 transition-all text-lg flex items-center gap-2">📄 Submit & Download Unit Test</button></div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800">
      <header className="bg-white shadow px-6 py-4 flex justify-between items-center z-10 sticky top-0"><div className="flex items-center gap-4"><button onClick={() => setView("menu")} className="text-gray-500 hover:text-indigo-600 font-bold transition-colors">← Back</button><h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">📝 Semester Question Paper Generator</h1></div><button onClick={onLogout} className="text-sm text-red-500 font-medium hover:underline">Logout</button></header>
      <main className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-6">
        
        {/* ✅ TEMPLATE FORMAT TOGGLE */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-indigo-900">Template Format</h2>
            <p className="text-sm text-gray-500">Select the template format for this question paper.</p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setTemplateType(1)} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${templateType === 1 ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Template 1</button>
            <button onClick={() => setTemplateType(2)} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${templateType === 2 ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Template 2</button>
            <button onClick={() => setTemplateType(3)} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${templateType === 3 ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Template 3 (Custom)</button>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100"><h2 className="text-xl font-bold mb-4">Exam Header Details</h2><div className="grid grid-cols-2 gap-4"><input value={header.examSession} onChange={e => setHeader({...header, examSession: e.target.value})} className="p-2 border rounded" placeholder="Exam Session" /><input value={header.semesters} onChange={e => setHeader({...header, semesters: e.target.value})} className="p-2 border rounded" placeholder="Semester(s)" /><input value={header.department} onChange={e => setHeader({...header, department: e.target.value})} className="p-2 border rounded" placeholder="Department" /><input value={header.subject} onChange={e => setHeader({...header, subject: e.target.value})} className="p-2 border rounded font-bold text-indigo-700" placeholder="Subject Code & Name" /></div></div>
        
        {templateType === 3 ? (
           <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
             <h2 className="text-xl font-bold mb-4 text-orange-800">Custom Paper Content</h2>
             <p className="text-sm text-gray-500 mb-4">Type or paste your entirely custom question paper here. The system will automatically wrap it in the official College Header and formatting.</p>
             <textarea value={customContent} onChange={e => setCustomContent(e.target.value)} className="w-full h-96 p-4 border border-gray-300 rounded font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="PART A\n1. Explain XYZ...\n2. What is ABC?\n\nPART B\n3. Calculate..." />
           </div>
        ) : (
           <>
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100"><h2 className="text-xl font-bold mb-4 text-blue-800">Part A (10 x 2 = 20 Marks)</h2>{partA.map((q, index) => (<div key={index} className="flex gap-4 mb-3 items-start border-b pb-3"><span className="font-bold text-gray-500 w-8 pt-2">Q{q.qNo}.</span><textarea value={q.question} onChange={e => { const newA = [...partA]; newA[index].question = e.target.value; setPartA(newA); }} className="flex-1 p-2 border border-gray-300 rounded resize-none" rows="2" placeholder="Type question here..." /><input value={q.btl} onChange={e => { const newA = [...partA]; newA[index].btl = e.target.value; setPartA(newA); }} className="w-16 p-2 border rounded text-center" placeholder="BTL" /><input value={q.co} onChange={e => { const newA = [...partA]; newA[index].co = e.target.value; setPartA(newA); }} className="w-16 p-2 border rounded text-center" placeholder="CO" /></div>))}</div>
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100"><h2 className="text-xl font-bold mb-4 text-green-800">Part B (5 x {templateType === 1 ? "13 = 65" : "16 = 80"} Marks)</h2>{partB.map((q, index) => (<div key={index} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200"><div className="font-bold text-lg mb-2 text-gray-700">Question {q.qNo}</div><div className="flex gap-4 mb-2"><span className="font-bold text-gray-500 pt-2">(a)</span><textarea value={q.a.question} onChange={e => { const newB = [...partB]; newB[index].a.question = e.target.value; setPartB(newB); }} className="flex-1 p-2 border rounded" rows="2" placeholder="Option A question..." /><input value={q.a.btl} onChange={e => { const newB = [...partB]; newB[index].a.btl = e.target.value; setPartB(newB); }} className="w-16 p-2 border rounded text-center" /><input value={q.a.co} onChange={e => { const newB = [...partB]; newB[index].a.co = e.target.value; setPartB(newB); }} className="w-16 p-2 border rounded text-center" /></div><div className="text-center font-bold text-gray-400 text-sm italic my-1">(OR)</div><div className="flex gap-4"><span className="font-bold text-gray-500 pt-2">(b)</span><textarea value={q.b.question} onChange={e => { const newB = [...partB]; newB[index].b.question = e.target.value; setPartB(newB); }} className="flex-1 p-2 border rounded" rows="2" placeholder="Option B question..." /><input value={q.b.btl} onChange={e => { const newB = [...partB]; newB[index].b.btl = e.target.value; setPartB(newB); }} className="w-16 p-2 border rounded text-center" /><input value={q.b.co} onChange={e => { const newB = [...partB]; newB[index].b.co = e.target.value; setPartB(newB); }} className="w-16 p-2 border rounded text-center" /></div></div>))}</div>
              
              {templateType === 1 && (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100"><h2 className="text-xl font-bold mb-4 text-purple-800">Part C (1 x 15 = 15 Marks)</h2><div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200"><div className="font-bold text-lg mb-2 text-gray-700">Question {partC.qNo}</div><div className="flex gap-4 mb-2"><span className="font-bold text-gray-500 pt-2">(a)</span><textarea value={partC.a.question} onChange={e => setPartC({ ...partC, a: { ...partC.a, question: e.target.value } })} className="flex-1 p-2 border rounded" rows="2" placeholder="Option A question..." /><input value={partC.a.btl} onChange={e => setPartC({ ...partC, a: { ...partC.a, btl: e.target.value } })} className="w-16 p-2 border rounded text-center" /><input value={partC.a.co} onChange={e => setPartC({ ...partC, a: { ...partC.a, co: e.target.value } })} className="w-16 p-2 border rounded text-center" /></div><div className="text-center font-bold text-gray-400 text-sm italic my-1">(OR)</div><div className="flex gap-4"><span className="font-bold text-gray-500 pt-2">(b)</span><textarea value={partC.b.question} onChange={e => setPartC({ ...partC, b: { ...partC.b, question: e.target.value } })} className="flex-1 p-2 border rounded" rows="2" placeholder="Option B question..." /><input value={partC.b.btl} onChange={e => setPartC({ ...partC, b: { ...partC.b, btl: e.target.value } })} className="w-16 p-2 border rounded text-center" /><input value={partC.b.co} onChange={e => setPartC({ ...partC, b: { ...partC.b, co: e.target.value } })} className="w-16 p-2 border rounded text-center" /></div></div></div>
              )}
           </>
        )}

        <div className="flex justify-end pt-4 pb-10"><button onClick={handleGenerateWord} className="bg-indigo-600 text-white font-bold py-4 px-8 rounded-lg shadow-lg hover:bg-indigo-700 active:scale-95 transition-all text-lg flex items-center gap-2">📄 Submit & Download Word Template</button></div>
      </main>
    </div>
  );
}

/* -------------------- STUDENT DASHBOARD -------------------- */
function StudentResultPage({ user, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [selectedSem, setSelectedSem] = useState(null); 
  const [showCalculator, setShowCalculator] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/students/${user.registerNumber}/profile`);
        if (res.ok) {
          const data = await res.json();
          setProfile({ ...data, results: mergeResults(data.results || []) });
        }
      } catch (e) { console.warn(e); }
    }
    load();
  }, [user.registerNumber]);

  const resultsList = profile?.results || [];
  const availableSems = [...new Set(resultsList.map(r => r.semester))].sort((a, b) => Number(b) - Number(a)); 
  const currentSem = selectedSem || (availableSems.length > 0 ? availableSems[0] : null);
  const displayedResults = resultsList.filter(r => String(r.semester) === String(currentSem));

  return (
    <div className="min-h-screen p-6 bg-slate-50 print:bg-white print:p-0">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-lg p-8 border border-gray-100 print:shadow-none print:border-none print:m-0 print:max-w-full">
        
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
          <div className="flex items-center">
            <img src="/college-logo.jpg" alt="Logo" className="w-16 h-16 object-contain mr-4 rounded-full border print:border-none" />
            <div>
              <h1 className="text-2xl font-bold text-green-800">St. Peters College of Engineering and Technology</h1>
              <p className="text-green-600 font-medium text-sm">Student Result Portal</p>
            </div>
          </div>
          <button onClick={() => setShowCalculator(!showCalculator)} className="hidden md:flex px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-bold border border-indigo-200 hover:bg-indigo-100 transition-colors print:hidden">
            {showCalculator ? "Hide Calculator" : "🧮 Open GPA Calculator"}
          </button>
        </div>

        {showCalculator && (
          <div className="mb-8 print:hidden">
            <GPACalculator />
          </div>
        )}

        {/* Profile Details Box */}
        <div className="bg-[#b3e6e6] border border-teal-200 rounded-lg p-6 mb-8 print:bg-white print:border-none print:p-0 print:mb-4">
          <h2 className="text-[#3b9c9c] text-center text-2xl font-semibold mb-6">Student Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-6 max-w-2xl mx-auto text-gray-700">
            <div className="flex items-center">
              <span className="w-48 font-bold">Register Number</span>
              <span className="font-mono text-[15px]">{profile?.student?.registerNumber ?? user.registerNumber}</span>
            </div>
            <div className="flex items-center">
              <span className="w-48 font-bold">Name</span>
              <span className="uppercase text-[15px]">{profile?.student?.name ?? user.name}</span>
            </div>
            <div className="flex items-center">
              <span className="w-48 font-bold">Institution</span>
              <span className="uppercase text-[15px]">1127 - ST.PETER'S COLLEGE OF ENGINEERING AND TECHNOLOGY</span>
            </div>
            <div className="flex items-center">
              <span className="w-48 font-bold">Branch</span>
              <span className="uppercase text-[15px]">
                {profile?.student?.department === "IT" ? "205-B.Tech. Information Technology" : 
                 profile?.student?.department === "CSE" ? "104-B.E. Computer Science and Engineering" : 
                 user.department}
              </span>
            </div>
          </div>
        </div>

        {/* SEMESTER TABS */}
        {availableSems.length > 0 && (
          <div className="mb-6">
            <div className="flex gap-3 overflow-x-auto pb-2 print:hidden">
              {availableSems.map(sem => (
                <button 
                  key={sem} 
                  onClick={() => setSelectedSem(sem)}
                  className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap shadow-sm active:scale-95 ${String(currentSem) === String(sem) ? "bg-green-600 text-white ring-2 ring-green-300 ring-offset-1" : "bg-white text-green-700 border border-green-200 hover:bg-green-50"}`}
                >
                  {Number(sem) === 99 ? "Graduated 🎓" : `Semester ${sem} ${sem === availableSems[0] && " (Latest)"}`}
                </button>
              ))}
            </div>
            <h2 className="hidden print:block text-xl font-bold text-green-800 mb-4 border-b pb-2">
               {Number(currentSem) === 99 ? "Graduation Profile" : `Semester ${currentSem} Results`}
            </h2>
          </div>
        )}

        {/* Results Table */}
        {displayedResults.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-green-200 shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#483d8b] text-white uppercase text-[11px] tracking-wider font-semibold print:bg-gray-200 print:text-black">
                <tr>
                  <th className="px-6 py-4">Semester</th>
                  <th className="px-6 py-4">Subject Code</th>
                  <th className="px-6 py-4 text-center">Grade</th>
                  <th className="px-6 py-4 text-center">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {displayedResults.map((r, i) => (
                  <tr key={i} className="hover:bg-green-50 transition-colors print:hover:bg-white">
                    <td className="px-6 py-4 text-gray-700">{Number(r.semester) === 99 ? "Graduated" : r.semester}</td>
                    <td className="px-6 py-4 font-bold text-gray-800">{r.subjectCode || r.subject}</td>
                    <td className="px-6 py-4 text-center font-bold text-[#483d8b] print:text-black">{r.grade}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-4 py-1.5 rounded-sm text-xs font-bold shadow-sm ${r.result === "PASS" ? "bg-[#e0f5e9] text-[#228b22]" : "bg-red-100 text-red-800"} print:bg-transparent print:border print:border-gray-500 print:shadow-none`}>
                        {r.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
           <div className="text-center py-12 bg-white rounded-xl border border-dashed border-green-300 text-green-600 font-medium">
              {availableSems.length === 0 ? "No results published yet. Check back later!" : `No results found for Semester ${currentSem}.`}
           </div>
        )}

        <div className="mt-8 flex justify-end gap-4 print:hidden">
          <button onClick={() => window.print()} className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold transition-all shadow-md active:scale-95 flex items-center gap-2">
            <span>📄</span> Download PDF
          </button>
          <button onClick={onLogout} className="px-6 py-2.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold transition-all shadow-sm active:scale-95">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- HOD Dashboard -------------------- */
function HodDashboard({ user, onLogout }) {
  const [semester, setSemester] = useState("3");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState({});

  useEffect(() => {
    fetch(`${API_BASE}/api/import/logins`)
      .then(res => res.json())
      .catch(() => []) 
      .then(data => {
        if(Array.isArray(data)) {
            const map = {};
            data.forEach(s => map[s.registerNumber] = s.name);
            setStudents(map);
        }
      });
  }, []);

  useEffect(() => {
    async function fetchResults() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/import/preview?semester=${semester}&department=${user.department}&_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        } else {
          setResults([]);
        }
      } catch (e) {
        setResults([]);
      }
      setLoading(false);
    }
    if (user.department) fetchResults();
  }, [semester, user.department]);

  const processData = () => {
    const grouped = {};
    const allSubjects = new Set();
    results.forEach((r) => {
      if (!grouped[r.registerNumber]) {
        grouped[r.registerNumber] = {
          registerNumber: r.registerNumber,
          name: students[r.registerNumber] || "Unknown",
          grades: {}
        };
      }
      grouped[r.registerNumber].grades[r.subjectCode] = r.grade;
      allSubjects.add(r.subjectCode);
    });
    const sortedSubjects = Array.from(allSubjects).sort();
    const rows = Object.values(grouped).sort((a, b) => a.registerNumber.localeCompare(b.registerNumber));
    return { rows, subjects: sortedSubjects };
  };

  const { rows, subjects } = processData();

  const handleDownload = () => {
    const excelData = rows.map(row => {
      const flatRow = { "Register Number": row.registerNumber, "Name": row.name };
      subjects.forEach(sub => flatRow[sub] = row.grades[sub] || "-");
      return flatRow;
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Results_${user.department}_Sem${semester}`);
    XLSX.writeFile(wb, `${user.department}_Sem_${semester}_Results.xlsx`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white shadow-sm border-b px-8 py-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            👨‍🏫 HOD Portal <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">{user.department}</span>
          </h2>
        </div>
        <button onClick={onLogout} className="text-red-500 hover:text-red-700 text-sm font-medium">Logout</button>
      </div>

      <div className="max-w-6xl mx-auto w-full p-8">
        <div className="flex flex-wrap items-end gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select Semester</label>
            <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-32 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
              {[1, 2, 3, 4, 5, 6, 7, 8, 99].map(n => <option key={n} value={n}>{n === 99 ? "Graduated 🎓" : `Semester ${n}`}</option>)}
            </select>
          </div>
          {rows.length > 0 && (
            <button onClick={handleDownload} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md">
              Download Report
            </button>
          )}
        </div>
        
        {rows.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="p-4 text-left">Reg No</th>
                        <th className="p-4 text-left">Name</th>
                        {subjects.map(sub => <th key={sub} className="p-4 text-center">{sub}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row) => (
                        <tr key={row.registerNumber} className="hover:bg-indigo-50">
                          <td className="p-3 font-mono">{row.registerNumber}</td>
                          <td className="p-3">{row.name}</td>
                          {subjects.map(sub => (
                            <td key={sub} className="p-3 text-center font-bold text-gray-700">
                              {row.grades[sub] || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </div>
        ) : (
            <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                No published results found for {user.department} {Number(semester) === 99 ? "Graduates" : `Semester ${semester}`}.
            </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const handleLogout = () => setUser(null);

  if (!user) return <ThemedLogin onLogin={setUser} />;
  if (user.role === "admin") return <AdminDashboard onLogout={handleLogout} />;
  if (user.role === "hod") return <HodDashboard user={user} onLogout={handleLogout} />;
  if (user.role === "faculty") return <FacultyDashboard user={user} onLogout={handleLogout} />;
  if (user.role === "student") return <StudentResultPage user={user} onLogout={handleLogout} />;

  return <div className="p-10 text-center text-red-500 font-bold">Unknown role: {user.role}</div>;
}