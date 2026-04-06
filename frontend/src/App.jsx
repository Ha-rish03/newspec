import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, Footer, PageNumber } from "docx";
import { saveAs } from "file-saver";
import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import mammoth from "mammoth";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;

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
    const json = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false, dateNF: "dd-mm-yyyy" });
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

/* -------------------- SHARED GPA CALCULATOR -------------------- */
function GPACalculator() {
  const [mode, setMode] = useState("GPA");
  const gradePoints = { "O": 10, "A+": 9, "A": 8, "B+": 7, "B": 6, "C": 5, "U": 0, "RA": 0, "AB": 0, "SA": 0, "W": 0 };
  const [gpaRows, setGpaRows] = useState([{ id: 1, subject: "", grade: "O", credits: 3 }]);
  const [gpaResult, setGpaResult] = useState(null);
  const [semesters, setSemesters] = useState([{ id: 1, name: "Semester 1", rows: [{ id: 101, subject: "", grade: "O", credits: 3 }] }]);
  const [cgpaResult, setCgpaResult] = useState(null);
  const [openSem, setOpenSem] = useState(1);

  const addGpaRow = () => setGpaRows([...gpaRows, { id: Date.now(), subject: "", grade: "O", credits: 3 }]);
  const removeGpaRow = (id) => setGpaRows(gpaRows.filter(r => r.id !== id));
  const updateGpaRow = (id, field, val) => setGpaRows(gpaRows.map(r => r.id === id ? { ...r, [field]: val } : r));

  const calculateGPA = () => {
    let totalPoints = 0; let totalCredits = 0;
    gpaRows.forEach(r => {
      const cr = Number(r.credits) || 0;
      const pts = gradePoints[r.grade.toUpperCase()] || 0;
      totalPoints += (pts * cr); totalCredits += cr;
    });
    setGpaResult(totalCredits > 0 ? (totalPoints / totalCredits).toFixed(3) : "0.000");
  };

  const addSemester = () => {
    const newId = Date.now();
    setSemesters([...semesters, { id: newId, name: `Semester ${semesters.length + 1}`, rows: [{ id: Date.now() + 1, subject: "", grade: "O", credits: 3 }] }]);
    setOpenSem(newId);
  };
  const removeSemester = (id) => setSemesters(semesters.filter(s => s.id !== id));
  const addCgpaRow = (semId) => setSemesters(semesters.map(s => s.id === semId ? { ...s, rows: [...s.rows, { id: Date.now(), subject: "", grade: "O", credits: 3 }] } : s));
  const removeCgpaRow = (semId, rowId) => setSemesters(semesters.map(s => s.id === semId ? { ...s, rows: s.rows.filter(r => r.id !== rowId) } : s));
  const updateCgpaRow = (semId, rowId, field, val) => setSemesters(semesters.map(s => s.id === semId ? { ...s, rows: s.rows.map(r => r.id === rowId ? { ...r, [field]: val } : r) } : s));

  const calculateCGPA = () => {
    let totalPoints = 0; let totalCredits = 0;
    semesters.forEach(sem => {
      sem.rows.forEach(r => {
        const cr = Number(r.credits) || 0;
        const pts = gradePoints[r.grade.toUpperCase()] || 0;
        totalPoints += (pts * cr); totalCredits += cr;
      });
    });
    setCgpaResult(totalCredits > 0 ? (totalPoints / totalCredits).toFixed(3) : "0.000");
  };

  const renderRow = (row, onUpdate, onRemove) => (
    <motion.div key={row.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="grid grid-cols-12 gap-3 items-center bg-white p-2 rounded-lg border border-gray-200 shadow-sm mb-2">
      <div className="col-span-5"><input type="text" placeholder="Subject..." value={row.subject} onChange={(e) => onUpdate(row.id, "subject", e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-gray-700" /></div>
      <div className="col-span-3"><select value={row.grade} onChange={(e) => onUpdate(row.id, "grade", e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-indigo-700 bg-white">{Object.keys(gradePoints).map(g => <option key={g} value={g}>{g} ({gradePoints[g]} pts)</option>)}</select></div>
      <div className="col-span-3"><input type="number" min="1" max="10" value={row.credits} onChange={(e) => onUpdate(row.id, "credits", e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-center" /></div>
      <div className="col-span-1 text-center"><button onClick={() => onRemove(row.id)} className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded transition-colors" title="Remove">✖</button></div>
    </motion.div>
  );

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-indigo-800">🎓 Academic Calculator</h2>
          <div className="flex gap-2 mt-2 bg-indigo-50 p-1 rounded-lg w-fit">
            <button onClick={() => setMode("GPA")} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${mode === "GPA" ? "bg-white text-indigo-700 shadow-sm" : "text-indigo-400 hover:text-indigo-600"}`}>GPA (1 Semester)</button>
            <button onClick={() => setMode("CGPA")} className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${mode === "CGPA" ? "bg-white text-indigo-700 shadow-sm" : "text-indigo-400 hover:text-indigo-600"}`}>CGPA (All Semesters)</button>
          </div>
        </div>
        {(mode === "GPA" ? gpaResult : cgpaResult) !== null && (
          <div className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow-md text-center min-w-[120px]">
            <div className="text-xs uppercase tracking-wider font-bold opacity-80">Calculated {mode}</div>
            <div className="text-2xl font-black">{mode === "GPA" ? gpaResult : cgpaResult}</div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-12 gap-3 px-2 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider"><div className="col-span-5">Subject</div><div className="col-span-3">Grade</div><div className="col-span-3">Credits</div><div className="col-span-1 text-center">Del</div></div>
      {mode === "GPA" && (
        <div className="space-y-2 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
          <AnimatePresence>{gpaRows.map(row => renderRow(row, updateGpaRow, removeGpaRow))}</AnimatePresence>
          <button onClick={addGpaRow} className="w-full py-2 border-2 border-dashed border-indigo-200 text-indigo-600 font-bold rounded-lg hover:bg-indigo-50 transition-colors">+ Add Subject</button>
        </div>
      )}
      {mode === "CGPA" && (
        <div className="space-y-4 mb-6">
          {semesters.map((sem, index) => (
             <div key={sem.id} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <div onClick={() => setOpenSem(openSem === sem.id ? null : sem.id)} className="bg-indigo-50 px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-indigo-100 transition-colors">
                   <div className="flex items-center gap-3"><span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{index + 1}</span><h3 className="font-bold text-indigo-900">{sem.name}</h3></div>
                   <div className="flex items-center gap-4">{semesters.length > 1 && <button onClick={(e) => { e.stopPropagation(); removeSemester(sem.id); }} className="text-red-500 hover:underline text-xs font-bold px-2 py-1 bg-red-50 rounded">Delete Sem</button>}<span className="text-indigo-400 font-bold">{openSem === sem.id ? "▲" : "▼"}</span></div>
                </div>
                <AnimatePresence>
                   {openSem === sem.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-gray-50 p-4">
                         {sem.rows.map(row => renderRow(row, (rId, f, v) => updateCgpaRow(sem.id, rId, f, v), (rId) => removeCgpaRow(sem.id, rId)))}
                         <button onClick={() => addCgpaRow(sem.id)} className="w-full mt-2 py-2 border-2 border-dashed border-indigo-200 text-indigo-600 font-bold rounded-lg hover:bg-indigo-50 transition-colors">+ Add Subject to {sem.name}</button>
                      </motion.div>
                   )}
                </AnimatePresence>
             </div>
          ))}
          <button onClick={addSemester} className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-lg border border-gray-300 hover:bg-gray-200 transition-colors">+ Add New Semester</button>
        </div>
      )}
      <button onClick={mode === "GPA" ? calculateGPA : calculateCGPA} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-lg shadow-md transition-transform active:scale-95 text-lg flex justify-center items-center gap-2">🧮 Calculate Final {mode}</button>
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
       lines.forEach(line => { childrenNodes.push(new Paragraph({ text: line, spacing: { before: 100, after: 100 } })); });
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
    let pass3 = password.trim(); 

    if (tab === "student" && pass1.includes("-")) {
      const parts = pass1.split("-");
      if (parts[0].length === 4) { 
        pass2 = `${parts[2]}-${parts[1]}-${parts[0]}`; 
        pass3 = `${parseInt(parts[1])}/${parseInt(parts[2])}/${parts[0].substring(2)}`; 
      }
    }

    try {
      const passwordsToTry = tab === "student" ? [pass1, pass2, pass3] : [pass1];
      let res = null;
      let data = null;

      for (let p of passwordsToTry) {
        res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registerNumber: tab === "admin" ? "admin" : regNo.trim(), password: p, role: tab }),
        });
        
        if (res.ok) {
           data = await res.json();
           break; 
        }
      }

      if (!res || !res.ok) throw new Error("Login failed");
      
      onLogin({ role: data.role || data.user?.role, name: data.name || "", registerNumber: data.registerNumber || (tab === "admin" ? "admin" : regNo.trim()), department: data.department || "Unknown" });
    } catch { 
      alert("Invalid credentials. Please verify your Register Number and Password."); 
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
                <input type="date" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700" />
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
  const [activeTab, setActiveTab] = useState("qpapers"); 
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
  
  const [newAdminPassword, setNewAdminPassword] = useState("");

  // REQUISITION STATE
  const [reqDept, setReqDept] = useState("CSE");
  const [reqSem, setReqSem] = useState("3");
  const [reqSubject, setReqSubject] = useState("");
  const [reqTitle, setReqTitle] = useState("");
  const [reqApptNo, setReqApptNo] = useState("");
  const [reqType, setReqType] = useState("SEMESTER");
  const [reqFaculty, setReqFaculty] = useState("");
  const [reqDeadline, setReqDeadline] = useState("");
  const [requisitions, setRequisitions] = useState([]);
  const [qPaperSubTab, setQPaperSubTab] = useState("bank");
  const [viewingClaim, setViewingClaim] = useState(null);

  const deptRef = useRef(dept); 
  const manualDeptRef = useRef(manualDept); 
  const manualSemRef = useRef(manualSem);   

  useEffect(() => { 
    deptRef.current = dept; manualDeptRef.current = manualDept; manualSemRef.current = manualSem; 
    setPreviewData([]); setMessage(""); 
  }, [dept, sem, activeTab, calcDept, calcSem, manualDept, manualSem]);

  useEffect(() => {
    if (activeTab === "grid" && gridType === "internal") {
      fetch(`${API_BASE}/api/import/fetch-subjects?department=${dept}&semester=${sem}&paperType=${gridPaperType}`)
        .then(res => { if (!res.ok) throw new Error("Server Error"); return res.json(); })
        .then(data => {
            const arr = Array.isArray(data) ? data : [];
            setGridSubjectList(arr); 
            if(arr.length > 0) setGridSubject(arr[0].subjectCode); else setGridSubject(""); 
        }).catch(err => { setGridSubjectList([]); setGridSubject(""); });
    }
  }, [dept, sem, gridPaperType, activeTab, gridType]);

  useEffect(() => {
    if (activeTab === "qpapers") {
      fetch(`${API_BASE}/api/import/question-papers`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setSavedPapers(Array.isArray(data) ? data : []))
        .catch(() => setSavedPapers([]));
        
      fetch(`${API_BASE}/api/requisitions`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setRequisitions(Array.isArray(data) ? data : []))
        .catch(() => setRequisitions([]));
    }
  }, [activeTab, qPaperSubTab]);

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

  const handleAdminPasswordChange = async () => {
    if(!newAdminPassword) return alert("Please enter a new password");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/password`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: newAdminPassword }) });
      if(res.ok) { setMessage("✅ Admin password updated successfully!"); setNewAdminPassword(""); } else { setMessage("❌ Failed to update admin password."); }
    } catch(err) { setMessage("❌ Network error while updating password."); }
    setLoading(false);
  };

  const handleCreateRequisition = async () => {
    if(!reqSubject || !reqFaculty || !reqDeadline || !reqApptNo || !reqTitle) return alert("Please fill all fields to send request.");
    const payload = { department: reqDept, semester: reqSem, subjectCode: reqSubject.toUpperCase(), courseTitle: reqTitle, examType: reqType, facultyId: reqFaculty, deadline: reqDeadline, appointmentLetterNo: reqApptNo, status: "PENDING" };
    const success = await apiPost("/api/requisitions", payload);
    if(success) {
      setReqSubject(""); setReqTitle(""); setReqApptNo(""); setReqFaculty(""); setReqDeadline("");
      fetch(`${API_BASE}/api/requisitions`).then(res => res.ok ? res.json() : []).then(data => setRequisitions(Array.isArray(data) ? data : []));
    }
  };

  const handleSubjectUpload = (e) => { const file = e.target.files[0]; if (!file) return; const currentDept = deptRef.current; readFirstSheet(file, (rows) => { const mapped = rows.map((r) => { const n = normalizeRowKeys(r); return { subjectCode: n.subjectcode || n["subject code"], subjectName: n.subjectname || n["subject name"], department: currentDept, semester: parseInt(sem), l: parseInt(n.l)||0, t: parseInt(n.t)||0, p: parseInt(n.p)||0, credits: parseInt(n.c)||0, paperType: "THEORY" }; }); apiPost("/api/import/subjects", mapped); }); };
  const handleLoginUpload = (e) => { const file = e.target.files[0]; if (!file) return; readFirstSheet(file, (rows) => { const mapped = rows.map((r) => { const n = normalizeRowKeys(r); let rawPassword = ""; for (let k in n) { if (k.includes("dob") || k.includes("birth") || k.includes("pass")) { rawPassword = String(n[k]).trim(); break; } } let formattedPassword = rawPassword; if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(rawPassword)) { const parts = rawPassword.split(/[\/\-]/); formattedPassword = `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`; } else if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(rawPassword)) { const parts = rawPassword.split(/[\/\-]/); formattedPassword = `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`; } else if (!isNaN(rawPassword) && Number(rawPassword) > 20000) { const dateObj = new Date((Number(rawPassword) - 25569) * 86400 * 1000); const y = dateObj.getFullYear(); const m = String(dateObj.getMonth() + 1).padStart(2, '0'); const d = String(dateObj.getDate()).padStart(2, '0'); formattedPassword = `${d}-${m}-${y}`; } return { registerNumber: n.registerNumber, name: n.name, password: formattedPassword, department: n.department || "", semester: n.semester ? parseInt(n.semester) : parseInt(sem), role: uploadRole }; }); const validRows = mapped.filter(m => m.registerNumber); if(validRows.length === 0) { setMessage("⚠️ No valid Register Numbers found."); return; } apiPost("/api/import/logins", validRows); }); };
  const fetchSubjects = async (type) => { setPaperType(type); setSubjectList([]); setSelectedSubject(""); setMessage(`Fetching ${type} subjects...`); try { const res = await fetch(`${API_BASE}/api/import/fetch-subjects?department=${dept}&semester=${sem}&paperType=${type}`); if (!res.ok) throw new Error("Failed to fetch subjects"); const data = await res.json(); setSubjectList(data); if (data.length === 0) setMessage(`⚠️ No ${type} subjects found.`); else setMessage(""); } catch (err) { setMessage(`❌ Error: ${err.message}`); } };
  const handleInternalUpload = () => { if (!internalFile || !selectedSubject) { setMessage("⚠️ Select a subject and file first."); return; } const formData = new FormData(); formData.append("file", internalFile); formData.append("subjectCode", selectedSubject); formData.append("department", dept); apiPost("/api/import/internal-upload", formData, true); };
  const handleExternalUpload = (e) => { const file = e.target.files[0]; if (!file) return; readFirstSheet(file, (rows) => { const mapped = rows.map((r) => { const n = normalizeRowKeys(r); return { registerNumber: n.registerNumber, subjectCode: n.subjectcode || n.subject, externalMarks: parseInt(n.mark) || 0 }; }); apiPost("/api/import/external", mapped); }); };
  const handleCalculate = () => { apiPost("/api/import/calculate-results", {}); };
  const handlePreview = async (targetSem, targetDept) => { setLoadingPreview(true); setPreviewData([]); try { const res = await fetch(`${API_BASE}/api/import/preview?semester=${targetSem}&department=${targetDept}&_t=${Date.now()}`); if(res.ok) { const data = await res.json(); setPreviewData(data); if(data.length > 0) setMessage(`✅ Loaded ${data.length} results.`); else setMessage(`⚠️ No results found for ${targetDept} Sem ${targetSem}.`); } } catch(err) { setMessage("❌ Error fetching preview"); } setLoadingPreview(false); };
  const handlePublish = async (targetSem, targetDept) => { if(!confirm(`Are you sure you want to PUBLISH results for ${targetDept} Sem ${targetSem}?`)) return; try { const res = await fetch(`${API_BASE}/api/import/publish?semester=${targetSem}&department=${targetDept}`, { method: "POST" }); const text = await res.text(); setMessage(res.ok ? "🎉 " + text : "❌ Publish failed"); handlePreview(targetSem, targetDept); } catch(err) { setMessage("❌ Error publishing"); } };
  const handleDropDrafts = async (targetSem, targetDept) => { if(!confirm(`⚠️ DELETE all unpublished drafts for ${targetDept} Sem ${targetSem}?`)) return; try { const res = await fetch(`${API_BASE}/api/import/drop-drafts?semester=${targetSem}&department=${targetDept}`, { method: "DELETE" }); if(res.ok) { setMessage("✅ Drafts Deleted."); setPreviewData([]); } } catch(err) { setMessage("❌ Error dropping drafts"); } };
  const handleDownload = () => { const ws = XLSX.utils.json_to_sheet(previewData); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Draft Results"); XLSX.writeFile(wb, `Results_Draft.xlsx`); };
  const handleUnpublishLive = async (targetSem, targetDept) => { if(!confirm(`🚨 DANGER: Are you sure you want to DROP/UNPUBLISH the LIVE results for ${targetDept} Sem ${targetSem}?`)) return; try { const res = await fetch(`${API_BASE}/api/import/unpublish?semester=${targetSem}&department=${targetDept}`, { method: "DELETE" }); if(res.ok) { setMessage(`✅ Successfully dropped live results for ${targetDept} Semester ${targetSem}.`); } else { const text = await res.text(); setMessage(`❌ Error unpublishing: ${text}`); } } catch(err) { setMessage("❌ Network error dropping live results."); } };
  const handlePromote = async (targetDept, targetSem) => { if(!confirm(`⚠️ PROMOTION: Are you sure you want to promote all ${targetDept} Semester ${targetSem} students to the next stage?`)) return; setLoading(true); try { const res = await fetch(`${API_BASE}/api/import/promote-students?department=${targetDept}&currentSemester=${targetSem}`, { method: "POST" }); const data = await res.json(); if(res.ok) setMessage(`🎉 Success: ${data.message}`); else setMessage(`❌ Error: ${data.error || "Promotion failed"}`); } catch (err) { setMessage("❌ Network error during promotion."); } setLoading(false); };
  const handleDeletePaper = async (id) => { if (!confirm("⚠️ Are you sure you want to permanently delete this question paper?")) return; setLoading(true); try { const res = await fetch(`${API_BASE}/api/import/question-paper/${id}`, { method: "DELETE" }); const data = await res.json(); if (res.ok) { setMessage(`✅ Success: ${data.message}`); setSavedPapers(prev => prev.filter(paper => paper.id !== id)); } else { setMessage(`❌ Error: ${data.error}`); } } catch (err) { setMessage("❌ Network error during deletion."); } setLoading(false); };

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
        if(templateMode === "CUSTOM") { customCols.forEach(c => base[c] = ""); return base; }
        return { ...base, ut1: "", ut2: "", ut3: "", ut4: "", ut5: "", utAvg: "", utScaled: "", title: "", dress: "", pres: "", disc: "", semMarks: "", int1: "", ex1: "", ex2: "", ex3: "", ex4: "", ex5: "", ex6: "", ex7: "", ex8: "", ex9: "", ex10: "", pAvg: "", p75: "", p25: "", pInt: "", iUt1: "", iUt2: "", iUt3: "", iUtT: "", iUtEq: "", iUt: "", iTitle: "", iDress: "", iPres: "", iDisc: "", iSemMarks: "", iInt75: "", iEx1: "", iEx2: "", iEx3: "", iEx4: "", iEx5: "", iExAvg: "", iEx75: "", iModel: "", iIntFinal: "" };
      }));
      if(filtered.length === 0) setMessage(`⚠️ No students found in ${dept} Semester ${sem}.`);
      else setMessage(`✅ Loaded ${filtered.length} students. Ready for data entry.`);
    } catch (e) { setMessage("❌ Error fetching students. Ensure database has data."); setGridData([]); }
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
      const payload = validData.map(s => ({ registerNumber: s.registerNumber, subjectCode: gridSubject.toUpperCase().trim(), externalMarks: parseInt(s.extMarks) || 0 }));
      apiPost("/api/import/external", payload).then(success => { if(success) alert(`✅ External Marks saved! You can now run the Calculation Engine.`); });
      return;
    }
    let aoa = []; let merges = [];
    if (templateMode === "CUSTOM") { aoa = [ ["Register Number", "Name", ...customCols] ]; gridData.forEach((s) => { const hasData = customCols.some(c => s[c]); if (hasData) { aoa.push([s.registerNumber, s.name, ...customCols.map(c => s[c])]); } }); merges = []; }
    else if (gridPaperType === "THEORY") {
        aoa = [ ["S.No", "Register Number", "Name of the Student", "Unit Test", "", "", "", "", "", "", "Seminar/ Case Study - Rubrics for Evaluation", "", "", "", "", "Internal I"], ["", "", "", "UT-1", "UT-2", "UT-3", "UT-4", "UT-5", "Avg", "UT", "Title", "Dress Code &", "Presenta", "Discus", "Marks", "Marks"] ];
        gridData.forEach((s, idx) => { if(s.ut1 || s.int1 || s.title) { aoa.push([ idx + 1, String(s.registerNumber), String(s.name), s.ut1, s.ut2, s.ut3, s.ut4, s.ut5, s.utAvg, s.utScaled, s.title, s.dress, s.pres, s.disc, s.semMarks, s.int1 ]); } });
        merges = [{ s: {r:0, c:3}, e: {r:0, c:9} }, { s: {r:0, c:10}, e: {r:0, c:14} }];
    } 
    else if (gridPaperType === "PRACTICAL") {
        aoa = [ ["S.No", "Register Number", "Name of the Student", "Marks for Each Experiemont (10)", "", "", "", "", "", "", "", "", "", "Average", "75%", "25%", "Internal Mark"], ["", "", "", "Ex-1", "Ex-2", "Ex-3", "Ex-4", "Ex-5", "Ex-6", "Ex-7", "Ex-8", "Ex-9", "Ex-10", "", "", "", ""] ];
        gridData.forEach((s, idx) => { if(s.ex1 || s.pInt) { aoa.push([ idx + 1, String(s.registerNumber), String(s.name), s.ex1, s.ex2, s.ex3, s.ex4, s.ex5, s.ex6, s.ex7, s.ex8, s.ex9, s.ex10, s.pAvg, s.p75, s.p25, s.pInt ]); } });
        merges = [{ s: {r:0, c:3}, e: {r:0, c:12} }];
    } 
    else if (gridPaperType === "INTEGRATED") {
        aoa = [ ["S.No", "Register Number", "Name of the Student", "Unit Test", "", "", "", "", "", "Seminar/ Case Study - Rubrics for Evaluation", "", "", "", "", "Internal Mar", "Marks for Each Experiemont (10)", "", "", "", "", "Average", "75%", "Model", "Internal"], ["", "", "", "UT-1", "UT-2", "UT-3", "UT-T", "UT-eq", "UT", "Title", "Dress Code &", "Presenta", "Discus", "Marks", "75%", "Ex-1", "Ex-2", "Ex-3", "Ex-4", "Ex-5", "", "", "", ""] ];
        gridData.forEach((s, idx) => { if(s.iUt1 || s.iIntFinal) { aoa.push([ idx + 1, String(s.registerNumber), String(s.name), s.iUt1, s.iUt2, s.iUt3, s.iUtT, s.iUtEq, s.iUt, s.iTitle, s.iDress, s.iPres, s.iDisc, s.iSemMarks, s.iInt75, s.iEx1, s.iEx2, s.iEx3, s.iEx4, s.iEx5, s.iExAvg, s.iEx75, s.iModel, s.iIntFinal ]); } });
        merges = [{ s: {r:0, c:3}, e: {r:0, c:8} }, { s: {r:0, c:9}, e: {r:0, c:13} }, { s: {r:0, c:15}, e: {r:0, c:19} }];
    }

    if(aoa.length === 1 || aoa.length === 2 && templateMode !== "CUSTOM") { alert("No marks entered!"); return; }
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!merges'] = merges; const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Internals");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const file = new File([new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })], "live_grid_internals.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const formData = new FormData(); formData.append("file", file); formData.append("subjectCode", gridSubject); formData.append("department", dept);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/import/internal-upload`, { method: "POST", body: formData });
      const text = await response.text();
      if(response.ok) { setMessage(`✅ Success: ${text}`); alert(`✅ Internal Marks saved successfully via ${templateMode === "CUSTOM" ? "Custom" : gridPaperType} template!`); } 
      else { setMessage(`❌ Error: ${text}`); }
    } catch (err) { setMessage(`❌ Network Error submitting marks.`); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800">
      <header className="bg-white shadow px-6 py-4 flex justify-between items-center z-10 sticky top-0"><h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">🎓 SPCET Admin</h1><button onClick={onLogout} className="text-sm text-red-500 font-medium hover:underline">Logout</button></header>
      <main className="flex-1 max-w-[1500px] mx-auto w-full p-6">
        
        {/* TAB NAVIGATION */}
        <div className="flex gap-4 border-b border-gray-200 mb-6 overflow-x-auto">
          <button onClick={() => setActiveTab("qpapers")} className={`pb-2 px-4 font-bold transition-colors ${activeTab === "qpapers" ? "border-b-2 border-purple-600 text-purple-700" : "text-gray-500 hover:text-purple-700"}`}>1. Question Papers</button>
          <button onClick={() => setActiveTab("setup")} className={`pb-2 px-4 font-medium transition-colors ${activeTab === "setup" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500"}`}>2. Setup</button>
          <button onClick={() => setActiveTab("excel")} className={`pb-2 px-4 font-medium transition-colors ${activeTab === "excel" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500"}`}>3. Excel Uploads</button>
          <button onClick={() => setActiveTab("grid")} className={`pb-2 px-4 font-bold transition-colors ${activeTab === "grid" ? "border-b-2 border-green-600 text-green-700" : "text-gray-500 hover:text-green-700"}`}>4. Live Grid Entry</button>
          <button onClick={() => setActiveTab("process")} className={`pb-2 px-4 font-medium transition-colors ${activeTab === "process" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500"}`}>5. Calculate</button>
          <button onClick={() => setActiveTab("manual")} className={`pb-2 px-4 font-bold transition-colors ${activeTab === "manual" ? "border-b-2 border-orange-500 text-orange-600" : "text-gray-500 hover:text-orange-600"}`}>6. Final Override</button>
          <button onClick={() => setActiveTab("manage")} className={`pb-2 px-4 font-bold transition-colors ${activeTab === "manage" ? "border-b-2 border-red-600 text-red-600" : "text-gray-500 hover:text-red-600"}`}>7. Manage Live</button>
          <button onClick={() => setActiveTab("gpa")} className={`pb-2 px-4 font-bold transition-colors ${activeTab === "gpa" ? "border-b-2 border-indigo-600 text-indigo-700" : "text-gray-500 hover:text-indigo-700"}`}>8. GPA Calc</button>
          <button onClick={() => setActiveTab("settings")} className={`pb-2 px-4 font-bold transition-colors ${activeTab === "settings" ? "border-b-2 border-gray-800 text-gray-800" : "text-gray-500 hover:text-gray-800"}`}>9. Settings</button>
        </div>

        <AnimatePresence>{message && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`p-4 rounded-md mb-6 text-sm font-medium shadow-sm ${message.startsWith("✅") || message.startsWith("🎉") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{message}</motion.div>}</AnimatePresence>
        
        {/* SETTINGS VIEW */}
        {activeTab === "settings" && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 max-w-md">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Admin Security Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">New Admin Password</label>
                    <input type="password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 outline-none" placeholder="Enter new master password" />
                  </div>
                  <button onClick={handleAdminPasswordChange} disabled={loading} className="w-full bg-gray-800 text-white font-bold py-3 rounded-lg hover:bg-gray-900 transition-colors shadow-md">
                    {loading ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </div>
           </motion.div>
        )}

        {activeTab === "gpa" && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="max-w-4xl mx-auto"><GPACalculator /></div></motion.div>)}
        
        {/* Other Tabs (Setup, Excel, Grid, Process, Manual, Manage) remain unchanged for brevity, keeping only functionality intact */}
        {activeTab === "setup" && (<div><h2 className="text-xl font-bold mb-4 text-indigo-800">1. Setup Database</h2><input type="file" onChange={handleSubjectUpload} accept=".xlsx" className="mb-4 block" /><input type="file" onChange={handleLoginUpload} accept=".xlsx" className="block" /></div>)}

        {/* 7. ADMIN QUESTION PAPERS BANK & REQUISITIONS */}
        {activeTab === "qpapers" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            
            {/* SUB-TABS FOR ADMIN */}
            <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
              <button onClick={() => setQPaperSubTab("bank")} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${qPaperSubTab === "bank" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Paper Bank</button>
              <button onClick={() => setQPaperSubTab("reqs")} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${qPaperSubTab === "reqs" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Requisitions</button>
            </div>

            {qPaperSubTab === "bank" && (
              <div className="bg-purple-50 p-8 rounded-xl shadow-sm border border-purple-200">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-purple-800">Completed Question Papers</h2>
                  <button onClick={() => setActiveTab("setup")} className="bg-purple-200 text-purple-800 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-purple-300">🔄 Refresh</button>
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
                          </div>
                        </div>
                        
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => {
                              if (paper.examType === "UNIT_TEST") exportUnitTestPaperDocx(JSON.parse(paper.paperData));
                              else exportSemesterPaperDocx(JSON.parse(paper.paperData), paper.hasPartC);
                          }} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg transition-all active:scale-95 flex justify-center items-center gap-2">
                            <span>📥</span> Download
                          </button>
                          <button onClick={() => handleDeletePaper(paper.id)} className="bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 font-bold py-2 px-3 rounded-lg transition-all active:scale-95 flex justify-center items-center" title="Delete Paper">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* REQUISITIONS TAB */}
            {qPaperSubTab === "reqs" && (
              <div className="space-y-6">
                 {/* Create Request Form */}
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-100">
                    <h3 className="text-lg font-bold text-purple-800 mb-4">Send New Requisition</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                       <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dept</label><select value={reqDept} onChange={e=>setReqDept(e.target.value)} className="w-full p-2 border rounded outline-none">{DEPARTMENTS.map(d=><option key={d}>{d}</option>)}</select></div>
                       <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sem</label><select value={reqSem} onChange={e=>setReqSem(e.target.value)} className="w-full p-2 border rounded outline-none">{[1,2,3,4,5,6,7,8].map(n=><option key={n}>{n}</option>)}</select></div>
                       <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label><select value={reqType} onChange={e=>setReqType(e.target.value)} className="w-full p-2 border rounded outline-none"><option value="UNIT_TEST">Unit Test</option><option value="SEMESTER">Semester</option></select></div>
                       <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject Code</label><input type="text" value={reqSubject} onChange={e=>setReqSubject(e.target.value)} placeholder="e.g. CS3452" className="w-full p-2 border rounded outline-none font-bold text-purple-700" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                       <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Course Title</label><input type="text" value={reqTitle} onChange={e=>setReqTitle(e.target.value)} placeholder="e.g. Theory of Computation" className="w-full p-2 border rounded outline-none" /></div>
                       <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Appt Letter No.</label><input type="text" value={reqApptNo} onChange={e=>setReqApptNo(e.target.value)} placeholder="e.g. SPCET/COE/AM26/11" className="w-full p-2 border rounded outline-none" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                       <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target Faculty ID</label><input type="text" value={reqFaculty} onChange={e=>setReqFaculty(e.target.value)} placeholder="e.g. 1127001" className="w-full p-2 border rounded outline-none" /></div>
                       <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Deadline</label><input type="date" value={reqDeadline} onChange={e=>setReqDeadline(e.target.value)} className="w-full p-2 border rounded outline-none" /></div>
                    </div>
                    <button onClick={handleCreateRequisition} className="bg-purple-600 text-white font-bold py-2 px-6 rounded shadow-md hover:bg-purple-700">Send Request</button>
                 </div>

                 {/* Tracking Table */}
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50"><h3 className="font-bold text-gray-700">Requisition Tracking</h3></div>
                    <div className="overflow-x-auto">
                       <table className="w-full text-sm text-left">
                          <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                             <tr><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Dept/Sem</th><th className="px-4 py-3">Faculty ID</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3">Action</th></tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                             {requisitions.length === 0 ? <tr><td colSpan="5" className="text-center py-4 text-gray-400 font-medium">No requisitions sent yet.</td></tr> : 
                                requisitions.map((r, i) => (
                                  <tr key={i} className="hover:bg-gray-50">
                                     <td className="px-4 py-3 font-bold text-gray-800">{r.subjectCode} <span className="text-[10px] bg-gray-200 px-1 rounded font-normal">{r.examType}</span></td>
                                     <td className="px-4 py-3 text-gray-600">{r.department} - Sem {r.semester}</td>
                                     <td className="px-4 py-3 font-mono text-gray-600">{r.facultyId}</td>
                                     <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider 
                                          ${r.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 
                                            r.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 
                                            r.status === 'SUBMITTED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                          {r.status}
                                        </span>
                                     </td>
                                     <td className="px-4 py-3">
                                        {r.status === 'SUBMITTED' && (
                                           <button onClick={() => setViewingClaim(r)} className="text-xs bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded hover:bg-indigo-200">View Claim</button>
                                        )}
                                     </td>
                                  </tr>
                                ))
                             }
                          </tbody>
                       </table>
                    </div>
                 </div>
              </div>
            )}

            {/* View Claim Modal for Admin */}
            {viewingClaim && (
               <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 relative">
                     <button onClick={() => setViewingClaim(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 font-bold text-xl">✕</button>
                     <h2 className="text-xl font-bold text-indigo-800 mb-2 border-b pb-2">Official Claim Form Details</h2>
                     
                     <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                        <div><p className="text-xs font-bold text-gray-500 uppercase">Appt. Letter No.</p><p className="font-medium text-gray-800">{viewingClaim.appointmentLetterNo}</p></div>
                        <div><p className="text-xs font-bold text-gray-500 uppercase">College Name & Code</p><p className="font-medium text-gray-800">{viewingClaim.collegeNameCode || "-"}</p></div>
                        <div><p className="text-xs font-bold text-gray-500 uppercase">Faculty Name</p><p className="font-medium text-gray-800">{viewingClaim.facultyName}</p></div>
                        <div><p className="text-xs font-bold text-gray-500 uppercase">Designation</p><p className="font-medium text-gray-800">{viewingClaim.designation}</p></div>
                        <div><p className="text-xs font-bold text-gray-500 uppercase">AICTE / Anna Univ ID</p><p className="font-medium text-gray-800">{viewingClaim.aicteId}</p></div>
                        <div><p className="text-xs font-bold text-gray-500 uppercase">PAN Number</p><p className="font-medium text-gray-800">{viewingClaim.pan}</p></div>
                        <div><p className="text-xs font-bold text-gray-500 uppercase">QP Dept</p><p className="font-medium text-gray-800">{viewingClaim.qpDept || "-"}</p></div>
                        <div><p className="text-xs font-bold text-gray-500 uppercase">Examiner Dept</p><p className="font-medium text-gray-800">{viewingClaim.examinerDept || "-"}</p></div>
                        <div><p className="text-xs font-bold text-gray-500 uppercase">Mobile Number</p><p className="font-medium text-gray-800">{viewingClaim.mobile || "-"}</p></div>
                        <div><p className="text-xs font-bold text-gray-500 uppercase">Email ID</p><p className="font-medium text-gray-800">{viewingClaim.email || "-"}</p></div>
                        <div><p className="text-xs font-bold text-gray-500 uppercase">Semester & Regulation</p><p className="font-medium text-gray-800">{viewingClaim.semesterAndReg || "-"}</p></div>
                        <div className="col-span-2"><p className="text-xs font-bold text-gray-500 uppercase">College Address</p><p className="font-medium text-gray-800">{viewingClaim.address}</p></div>
                     </div>
                     
                     <h3 className="text-md font-bold text-indigo-800 mt-6 mb-2 border-b pb-2">Remuneration</h3>
                     <div className="bg-gray-50 p-4 rounded border text-sm">
                        <div className="flex justify-between mb-2"><span>Question Paper Type</span><span className="font-bold text-indigo-700">{viewingClaim.qpType || "-"}</span></div>
                        <div className="flex justify-between mb-2"><span>Amount Claimed (Manually Entered)</span><span className="font-bold">Rs. {viewingClaim.amountClaimed || "0"}</span></div>
                        <div className="flex justify-between border-t pt-2 mt-2 font-bold text-lg text-green-700"><span>Calculated Total Amount</span><span>Rs. {viewingClaim.totalAmount}</span></div>
                        <div className="mt-3 text-xs text-green-700 font-bold bg-green-100 inline-block px-2 py-1 rounded">
                           {viewingClaim.mailedConfirmation ? "✅ Confirmed: Mailed to coeqp@spcet.ac.in" : "❌ Not Mailed"}
                        </div>
                     </div>
                     
                     <h3 className="text-md font-bold text-indigo-800 mt-6 mb-2 border-b pb-2">Bank Details</h3>
                     <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="text-xs font-bold text-gray-500 uppercase">Account Number</p><p className="font-mono text-lg font-bold text-gray-800">{viewingClaim.accountNo}</p></div>
                        <div><p className="text-xs font-bold text-gray-500 uppercase">IFSC Code</p><p className="font-mono font-bold text-gray-800">{viewingClaim.ifsc}</p></div>
                        <div><p className="text-xs font-bold text-gray-500 uppercase">Bank Name</p><p className="font-medium text-gray-800">{viewingClaim.bankName}</p></div>
                        <div><p className="text-xs font-bold text-gray-500 uppercase">Branch</p><p className="font-medium text-gray-800">{viewingClaim.branchName}</p></div>
                     </div>
                  </div>
               </div>
            )}

          </motion.div>
        )}
      </main>
    </div>
  );
}

/* -------------------- FACULTY DASHBOARD -------------------- */
function FacultyDashboard({ user, onLogout }) {
  const [view, setView] = useState("tasks"); 
  const [templateType, setTemplateType] = useState(1);
  const [myReqs, setMyReqs] = useState([]);
  const [activeTask, setActiveTask] = useState(null); 

  const [header, setHeader] = useState({ examSession: "B.E / B.Tech Degree Examinations", semesters: "", department: user?.department || "CSE", subject: "", regulations: "(Regulations 2021)", requirements: "Nil" });
  const [partA, setPartA] = useState(Array.from({ length: 10 }, (_, i) => ({ qNo: i + 1, question: "", btl: "K1", co: "CO1" })));
  const [partB, setPartB] = useState(Array.from({ length: 5 }, (_, i) => ({ qNo: i + 11, a: { question: "", btl: "K2", co: `CO${i+1}`, marks: "13" }, b: { question: "", btl: "K2", co: `CO${i+1}`, marks: "13" } })));
  const [partC, setPartC] = useState({ qNo: 16, a: { question: "", btl: "K4", co: "CO5", marks: "15" }, b: { question: "", btl: "K4", co: "CO5", marks: "15" } });
  const [customContent, setCustomContent] = useState("");

  const [unitHeader, setUnitHeader] = useState({ examSession: "BE - DEGREE EXAMINATIONS", semesterWord: "", department: "DEPARTMENT OF " + (user?.department || "CSE"), subject: "", regulations: "(Regulations 2021)", duration: "2 Hours", maxMarks: "50" });
  const [unitPartA, setUnitPartA] = useState(Array.from({ length: 5 }, (_, i) => ({ qNo: i + 1, question: "", kLevel: "K1", co: "CO1" })));
  const [unitPartB, setUnitPartB] = useState(Array.from({ length: 3 }, (_, i) => ({ qNo: i + 6, question: "", marks: "13", kLevel: "K2", co: "CO2" })));
  const [unitPartC, setUnitPartC] = useState([{ qNo: 9, question: "", marks: "14", kLevel: "K4", co: "CO3" }]);
  const [coDist, setCoDist] = useState({ marks: ['-','63','-','-','-','-'], perc: ['-','100','-','-','-','-'] });

  // UPGRADED CLAIM FORM STATE based on Google Form requirements
  const [claimForm, setClaimForm] = useState({
     facultyName: user?.name || "", 
     designation: "", 
     collegeNameCode: "", 
     qpDept: "", 
     examinerDept: user?.department || "", 
     mobile: "", 
     email: "",
     subjectCode: "", 
     subjectName: "", 
     qpType: "1 with key", 
     semesterAndReg: "", 
     amountClaimed: "", 
     mailedConfirmation: false,
     accountNo: "", 
     bankName: "", 
     branchName: "", 
     ifsc: ""
  });
  const [passbookFiles, setPassbookFiles] = useState(null); // Will hold up to 5 files
  const [scannedClaimFile, setScannedClaimFile] = useState(null); // 1 mandatory file
  const [answerKeyFile, setAnswerKeyFile] = useState(null);
  const [submittingDetails, setSubmittingDetails] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/requisitions/faculty/${user.registerNumber}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setMyReqs(Array.isArray(data) ? data : []))
      .catch(() => setMyReqs([]));
  }, [user.registerNumber]);

  // Pre-fill subject details when task opens
  useEffect(() => {
      if(activeTask) {
          setClaimForm(prev => ({
              ...prev,
              subjectCode: activeTask.subjectCode,
              subjectName: activeTask.courseTitle
          }));
      }
  }, [activeTask]);

  const handleUpdateReqStatus = async (id, newStatus) => {
    try {
      await fetch(`${API_BASE}/api/requisitions/${id}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
      setMyReqs(myReqs.map(r => r.id === id ? { ...r, status: newStatus } : r));
    } catch(err) { alert("Failed to update status"); }
  };

  const handleSubmitClaimForm = async () => {
    if(!claimForm.accountNo || !claimForm.ifsc || !claimForm.pan) return alert("Please fill all mandatory fields (PAN, Account No, IFSC).");
    if(!claimForm.mailedConfirmation) return alert("You must check the box confirming you mailed the documents to coeqp@spcet.ac.in");
    
    setSubmittingDetails(true);
    
    // Auto-calculate base total (though user inputs claimed amount manually as requested)
    let autoCalcTotal = 0;
    if (claimForm.qpType === "1 with key") autoCalcTotal = 750 + 500;
    if (claimForm.qpType === "2 with key") autoCalcTotal = (750 * 2) + (500 * 2);
    
    const payload = { 
        ...claimForm, 
        totalAmount: autoCalcTotal.toString() 
    };

    try {
      await fetch(`${API_BASE}/api/requisitions/${activeTask.id}/details`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      await handleUpdateReqStatus(activeTask.id, "READY");
    } catch(err) { alert("Failed to save claim details"); }
    setSubmittingDetails(false);
  };

  const startGenerating = (task) => {
    setActiveTask(task);
    if(task.examType === "UNIT_TEST") {
       setUnitHeader({...unitHeader, subject: task.subjectCode, department: task.department});
       setView("unit");
    } else {
       setHeader({...header, subject: task.subjectCode, department: task.department});
       setView("semester");
    }
  };

  const handleGenerateWord = async () => {
    const config = { header, partA, partB, partC, customContent };
    await exportSemesterPaperDocx(config, templateType);
    try { 
      await fetch(`${API_BASE}/api/import/save-question-paper`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectCode: header.subject, department: header.department, examSession: header.examSession, hasPartC: templateType === 1, examType: "SEMESTER", paperData: JSON.stringify(config) }) }); 
      if(activeTask) await handleUpdateReqStatus(activeTask.id, "SUBMITTED");
      alert("✅ Document downloaded and sent to Admin Portal!");
      setView("tasks");
    } catch(err) { console.warn(err); }
  };

  const handleGenerateUnitWord = async () => {
    const config = { unitHeader, unitPartA, unitPartB, unitPartC, coDistribution: { marks: coDist.marks, percentage: coDist.perc } };
    await exportUnitTestPaperDocx(config);
    try {
      await fetch(`${API_BASE}/api/import/save-question-paper`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectCode: unitHeader.subject, department: unitHeader.department, examSession: unitHeader.examSession, hasPartC: false, examType: "UNIT_TEST", paperData: JSON.stringify(config) }) });
      if(activeTask) await handleUpdateReqStatus(activeTask.id, "SUBMITTED");
      alert("✅ Unit Test Document downloaded and sent to Admin Portal!");
      setView("tasks");
    } catch(err) { console.warn(err); }
  };

  const handleDocxUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { const arrayBuffer = await file.arrayBuffer(); const result = await mammoth.extractRawText({ arrayBuffer }); setCustomContent(result.value); alert("✅ Document text successfully extracted!"); } 
    catch (err) { alert("❌ Failed to read DOCX file. Make sure it is a valid Word Document."); }
  };

  if (view === "tasks") {
    const pendingTasks = myReqs.filter(r => r.status === "PENDING" || r.status === "ACCEPTED" || r.status === "READY");
    
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800">
        <header className="bg-white shadow px-6 py-4 flex justify-between items-center z-10 sticky top-0"><h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">👨‍🏫 Faculty Portal</h1><div className="flex items-center gap-4"><button onClick={() => setView("menu")} className="text-gray-500 font-bold hover:text-indigo-600">Free Create mode</button><button onClick={onLogout} className="text-sm text-red-500 font-medium hover:underline">Logout</button></div></header>
        <main className="flex-1 max-w-5xl mx-auto w-full p-6">
           <h2 className="text-2xl font-bold text-slate-800 mb-6">My Official Tasks</h2>
           
           {pendingTasks.length === 0 ? (
              <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-200 text-center text-gray-500">You have no pending question paper requests from the Admin.</div>
           ) : (
              <div className="space-y-6">
                 {pendingTasks.map(task => {
                    const isUrgent = new Date(task.deadline).getTime() - new Date().getTime() < (3 * 24 * 60 * 60 * 1000); 
                    
                    return (
                      <div key={task.id} className={`bg-white p-6 rounded-xl shadow-sm border-l-4 ${isUrgent ? 'border-l-red-500' : 'border-l-indigo-500'} border border-gray-200`}>
                         <div className="flex justify-between items-start mb-4">
                            <div>
                               <div className="flex items-center gap-2 mb-1">
                                  <span className="bg-gray-100 text-gray-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded">{task.examType.replace('_', ' ')}</span>
                                  {isUrgent && <span className="bg-red-100 text-red-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded flex items-center gap-1">⚠️ Urgent</span>}
                               </div>
                               <h3 className="text-xl font-bold text-gray-800">{task.subjectCode} - {task.courseTitle}</h3>
                               <p className="text-sm text-gray-500">{task.department} - Semester {task.semester} (Appt: {task.appointmentLetterNo})</p>
                            </div>
                            <div className="text-right">
                               <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Deadline</p>
                               <p className={`font-bold ${isUrgent ? 'text-red-600' : 'text-gray-700'}`}>{task.deadline}</p>
                            </div>
                         </div>
                         
                         {task.status === "PENDING" && (
                            <div className="flex gap-3 mt-4 border-t pt-4">
                               <button onClick={() => { setActiveTask(task); handleUpdateReqStatus(task.id, "ACCEPTED"); }} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow-sm transition-transform active:scale-95">Accept Request</button>
                               <button onClick={() => handleUpdateReqStatus(task.id, "REJECTED")} className="bg-white border border-red-200 text-red-500 hover:bg-red-50 font-bold py-2 px-6 rounded-lg transition-colors">Decline</button>
                            </div>
                         )}

                         {task.status === "ACCEPTED" && activeTask?.id === task.id && (
                            <div className="mt-4 border-t pt-4 bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-xl border-t-gray-200">
                               <h4 className="font-bold text-indigo-800 mb-4 text-lg">Official Claim Form & Details</h4>
                               <p className="text-xs text-gray-600 mb-6">Please complete this form to process your remuneration. This must be filled before the generator unlocks.</p>
                               
                               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Name (As per Bank A/c) *</label><input type="text" value={claimForm.facultyName} onChange={e=>setClaimForm({...claimForm, facultyName: e.target.value})} className="w-full p-2 border rounded outline-none text-sm" /></div>
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Designation *</label><input type="text" value={claimForm.designation} onChange={e=>setClaimForm({...claimForm, designation: e.target.value})} className="w-full p-2 border rounded outline-none text-sm" /></div>
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">College Name & Code *</label><input type="text" value={claimForm.collegeNameCode} onChange={e=>setClaimForm({...claimForm, collegeNameCode: e.target.value})} placeholder="e.g. SPCET (1127)" className="w-full p-2 border rounded outline-none text-sm" /></div>
                                  
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Dept for QP Setting *</label><input type="text" value={claimForm.qpDept} onChange={e=>setClaimForm({...claimForm, qpDept: e.target.value})} className="w-full p-2 border rounded outline-none text-sm" /></div>
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Department of Examiner *</label><input type="text" value={claimForm.examinerDept} onChange={e=>setClaimForm({...claimForm, examinerDept: e.target.value})} className="w-full p-2 border rounded outline-none text-sm" /></div>
                                  
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Mobile Number *</label><input type="text" value={claimForm.mobile} onChange={e=>setClaimForm({...claimForm, mobile: e.target.value})} className="w-full p-2 border rounded outline-none text-sm" /></div>
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Email ID *</label><input type="email" value={claimForm.email} onChange={e=>setClaimForm({...claimForm, email: e.target.value})} className="w-full p-2 border rounded outline-none text-sm" /></div>
                                  
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Subject Code *</label><input type="text" value={claimForm.subjectCode} readOnly className="w-full p-2 border rounded bg-gray-100 outline-none text-sm font-bold text-gray-600" /></div>
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Name of the Subject *</label><input type="text" value={claimForm.subjectName} readOnly className="w-full p-2 border rounded bg-gray-100 outline-none text-sm font-bold text-gray-600" /></div>
                                  
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Semester and Regulation *</label><input type="text" value={claimForm.semesterAndReg} onChange={e=>setClaimForm({...claimForm, semesterAndReg: e.target.value})} placeholder="e.g. Sem 3 (Reg 2021)" className="w-full p-2 border rounded outline-none text-sm" /></div>
                                  
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">AICTE / Anna Univ ID</label><input type="text" value={claimForm.aicteId} onChange={e=>setClaimForm({...claimForm, aicteId: e.target.value})} className="w-full p-2 border rounded outline-none text-sm" /></div>
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">PAN Number *</label><input type="text" value={claimForm.pan} onChange={e=>setClaimForm({...claimForm, pan: e.target.value})} className="w-full p-2 border rounded outline-none text-sm font-mono uppercase" /></div>
                                  <div className="col-span-1 md:col-span-3"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Official College Address *</label><input type="text" value={claimForm.address} onChange={e=>setClaimForm({...claimForm, address: e.target.value})} className="w-full p-2 border rounded outline-none text-sm" /></div>
                               </div>

                               <h5 className="font-bold text-gray-700 mb-3 border-b pb-1">Bank Details (As per Passbook)</h5>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Bank Account No (Only Savings A/C) *</label><input type="text" value={claimForm.accountNo} onChange={e=>setClaimForm({...claimForm, accountNo: e.target.value})} className="w-full p-2 border rounded outline-none font-mono text-sm" /></div>
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Bank Name *</label><input type="text" value={claimForm.bankName} onChange={e=>setClaimForm({...claimForm, bankName: e.target.value})} className="w-full p-2 border rounded outline-none text-sm" /></div>
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Branch *</label><input type="text" value={claimForm.branchName} onChange={e=>setClaimForm({...claimForm, branchName: e.target.value})} className="w-full p-2 border rounded outline-none text-sm" /></div>
                                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">IFSC Code *</label><input type="text" value={claimForm.ifsc} onChange={e=>setClaimForm({...claimForm, ifsc: e.target.value})} className="w-full p-2 border rounded outline-none font-mono uppercase text-sm" /></div>
                               </div>

                               <h5 className="font-bold text-gray-700 mb-3 border-b pb-1">Remuneration & Confirmation</h5>
                               <div className="bg-white p-4 rounded border border-gray-200 mb-6">
                                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                                     <div className="flex-1 w-full">
                                         <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">No of Question Paper *</label>
                                         <select value={claimForm.qpType} onChange={e=>setClaimForm({...claimForm, qpType: e.target.value})} className="w-full p-2 border rounded outline-none text-sm font-bold text-indigo-700">
                                            <option value="1 with key">1 with key</option>
                                            <option value="2 with key">2 with key</option>
                                            <option value="Others (QP Scrutiny)">Others (QP Scrutiny)</option>
                                         </select>
                                     </div>
                                     <div className="flex-1 w-full">
                                         <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Amount Claimed *</label>
                                         <input type="number" value={claimForm.amountClaimed} onChange={e=>setClaimForm({...claimForm, amountClaimed: e.target.value})} placeholder="Rs." className="w-full p-2 border rounded outline-none text-sm font-bold text-green-700" />
                                     </div>
                                  </div>
                                  
                                  <div className="flex items-start gap-3 mt-4 p-3 bg-red-50 border border-red-200 rounded">
                                      <input type="checkbox" checked={claimForm.mailedConfirmation} onChange={e=>setClaimForm({...claimForm, mailedConfirmation: e.target.checked})} className="mt-1 w-5 h-5 accent-red-600" id="mailCheck" />
                                      <label htmlFor="mailCheck" className="text-xs text-red-800 font-medium">Question Paper with Answer Key, Claim Form, Front page of Bank pass book is Mailed to <span className="font-bold">coeqp@spcet.ac.in</span> (Mandatory for Claim upload readable bank pass book) * Yes</label>
                                  </div>
                               </div>

                               <div className="grid grid-cols-1 gap-4 mb-6">
                                  <div className="border border-dashed border-gray-300 p-4 rounded-lg bg-white">
                                     <label className="block text-xs font-bold text-gray-700 mb-1">First Page of Bank Pass book with account details *</label>
                                     <p className="text-[10px] text-gray-500 mb-2">Pls Make sure the readability of uploaded documents. Upload up to 5 supported files: PDF. Max 100 MB per file.</p>
                                     <input type="file" multiple accept=".pdf" onChange={e => setPassbookFiles(e.target.files)} className="text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700" />
                                  </div>
                                  
                                  <div className="border border-dashed border-gray-300 p-4 rounded-lg bg-white">
                                     <label className="block text-xs font-bold text-gray-700 mb-1">Scanned Copy of Claim Form (Mandatory) *</label>
                                     <p className="text-[10px] text-gray-500 mb-2">Upload 1 supported file: PDF. Max 10 MB.</p>
                                     <input type="file" accept=".pdf" onChange={e => setScannedClaimFile(e.target.files[0])} className="text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700" />
                                  </div>
                               </div>

                               <button onClick={handleSubmitClaimForm} disabled={submittingDetails} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded shadow-md transition-transform active:scale-95 text-lg">Submit Official Claim & Unlock Generator</button>
                            </div>
                         )}

                         {task.status === "READY" && (
                            <div className="mt-4 border-t pt-4">
                               <div className="bg-green-50 text-green-700 text-sm font-medium p-3 rounded mb-4 flex items-center gap-2">✅ Claim Form Submitted. Generator Unlocked.</div>
                               <button onClick={() => startGenerating(task)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-transform active:scale-95 w-full flex justify-center items-center gap-2">
                                  <span>⚙️</span> Open Question Paper Generator
                               </button>
                            </div>
                         )}
                      </div>
                    );
                 })}
              </div>
           )}
        </main>
      </div>
    );
  }

  // Fallback Free Create Menu
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800">
        <header className="bg-white shadow px-6 py-4 flex justify-between items-center z-10 sticky top-0"><h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">👨‍🏫 Faculty Portal</h1><div className="flex items-center gap-4"><button onClick={() => setView("tasks")} className="text-indigo-600 font-bold bg-indigo-50 px-3 py-1.5 rounded">Return to Tasks</button><button onClick={onLogout} className="text-sm text-red-500 font-medium hover:underline">Logout</button></div></header>
        <main className="flex-1 max-w-4xl mx-auto w-full p-6 flex flex-col items-center justify-center">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Free Create Mode</h2>
          <p className="text-gray-500 mb-8">Generate papers manually without an Admin Requisition.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            <div onClick={() => { setActiveTask(null); setView("semester"); }} className="bg-white p-8 rounded-xl shadow-md border border-gray-200 hover:border-indigo-500 hover:shadow-xl transition-all cursor-pointer flex flex-col items-center text-center group"><span className="text-5xl mb-4 group-hover:scale-110 transition-transform">📝</span><h3 className="text-xl font-bold text-indigo-700 mb-2">Semester Question Paper</h3></div>
            <div onClick={() => { setActiveTask(null); setView("unit"); }} className="bg-white p-8 rounded-xl shadow-md border border-gray-200 hover:border-teal-500 hover:shadow-xl transition-all cursor-pointer flex flex-col items-center text-center group"><span className="text-5xl mb-4 group-hover:scale-110 transition-transform">📋</span><h3 className="text-xl font-bold text-teal-700 mb-2">Unit Test Question Paper</h3></div>
          </div>
        </main>
      </div>
    );
  }

  if (view === "unit") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800">
        <header className="bg-white shadow px-6 py-4 flex justify-between items-center z-10 sticky top-0"><div className="flex items-center gap-4"><button onClick={() => setView(activeTask ? "tasks" : "menu")} className="text-gray-500 hover:text-indigo-600 font-bold transition-colors">← Back</button><h1 className="text-xl font-bold text-teal-600 flex items-center gap-2">📋 Unit Test Generator</h1>{activeTask && <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2 py-1 rounded">Task Mode</span>}</div><button onClick={onLogout} className="text-sm text-red-500 font-medium hover:underline">Logout</button></header>
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
      <header className="bg-white shadow px-6 py-4 flex justify-between items-center z-10 sticky top-0"><div className="flex items-center gap-4"><button onClick={() => setView(activeTask ? "tasks" : "menu")} className="text-gray-500 hover:text-indigo-600 font-bold transition-colors">← Back</button><h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">📝 Semester Question Paper Generator</h1>{activeTask && <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded">Task Mode</span>}</div><button onClick={onLogout} className="text-sm text-red-500 font-medium hover:underline">Logout</button></header>
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
             <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-bold text-orange-800">Custom Paper Content</h2>
                 <label className="bg-orange-100 text-orange-800 border border-orange-300 font-bold py-2 px-4 rounded-lg cursor-pointer hover:bg-orange-200 transition-colors shadow-sm text-sm">
                    📄 Import from .docx
                    <input type="file" accept=".docx" onChange={handleDocxUpload} className="hidden" />
                 </label>
             </div>
             <p className="text-sm text-gray-500 mb-4">Type or paste your custom question paper here, OR click the button above to upload an existing `.docx` file to automatically extract the text!</p>
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
                { profile?.student?.department === "CSE" ? "104-B.E. Computer Science and Engineering" :
  profile?.student?.department === "ECE" ? "106-B.E. Electronics and Communication Engineering" :
  profile?.student?.department === "EEE" ? "105-B.E. Electrical and Electronics Engineering" :
  profile?.student?.department === "BIO TECH" ? "214-B.Tech. Biotechnology" :
  profile?.student?.department === "MECH" ? "114-B.E. Mechanical Engineering" :
  profile?.student?.department === "AIDS" ? "149-B.Tech. Artificial Intelligence and Data Science" :
  profile?.student?.department === "AERO" ? "101-B.E. Aeronautical Engineering" :
  profile?.student?.department === "CIVIL" ? "103-B.E. Civil Engineering" :
  profile?.student?.department === "CHEM" ? "203-B.Tech. Chemical Engineering" :
  profile?.student?.department === "CSBS" ? "148-B.E. Computer Science and Business Systems" :
  profile?.student?.department === "BIO MEDICINE" ? "121-B.E. Biomedical Engineering" :
   profile?.student?.department === "IT" ? "205-B.Tech. Information Technology" :

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