import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

/* -------------------- Utilities -------------------- */
function normalizeRowKeys(row) {
  const out = {};
  for (let key in row) {
    let val = row[key];
    const lowerKey = key.toLowerCase().trim().replace(/[^a-z0-9]/g, ""); 

    if (
      lowerKey.includes("roll") || 
      lowerKey.includes("reg") || 
      lowerKey === "id"
    ) {
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
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
    onJSON(Array.isArray(json) ? json : []);
  };
  reader.readAsArrayBuffer(file);
}

function mergeResults(rows) {
  const map = {};
  rows.forEach((r) => {
    const key = `${r.registerNumber}-${r.subjectCode || r.subject}`;
    map[key] = map[key]
      ? { ...map[key], grade: r.grade || map[key].grade, result: r.result || map[key].result }
      : r;
  });
  return Object.values(map);
}

/* -------------------- Login -------------------- */
function ThemedLogin({ onLogin }) {
  const [tab, setTab] = useState("student");
  const [regNo, setRegNo] = useState(""); 
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const payload = {
      registerNumber: tab === "admin" ? "admin" : regNo, 
      password,
      role: tab,
    };

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      onLogin({
        role: data.role || data.user?.role,
        name: data.name || "",
        registerNumber: data.registerNumber || payload.registerNumber, 
        department: data.department || "Unknown",
      });
    } catch {
      alert("Invalid credentials");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
      style={{ backgroundImage: "url('/college-bg.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/40" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-[480px] p-6 glacier-card bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl"
      >
        <div className="flex items-end gap-6 mb-4">
          <div className="text-slate-800 text-lg font-semibold">UniScore Portal</div>
          <div className="flex-1 border-b border-slate-400/40" />
        </div>

        <div className="p-4">
          <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
            {["student", "hod", "admin"].map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setRegNo("");
                  setPassword("");
                }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  tab === t ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <input
              value={tab === "admin" ? "admin" : regNo}
              onChange={(e) => setRegNo(e.target.value)}
              disabled={tab === "admin"}
              placeholder={tab === "admin" ? "admin" : "Register Number"}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />

            <button 
              onClick={handleLogin} 
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all active:scale-95"
            >
              Login as {tab.toUpperCase()}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------- ADMIN DASHBOARD -------------------- */
/* -------------------- NEW ADMIN DASHBOARD (Fixed Role Upload) -------------------- */
function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState("setup"); 
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // --- Common State ---
  const [dept, setDept] = useState("CSE");
  const [sem, setSem] = useState(3);
  const [uploadRole, setUploadRole] = useState("student"); // ✅ NEW: Select Role for Upload
  
  // --- Internals State ---
  const [paperType, setPaperType] = useState(null);
  const [subjectList, setSubjectList] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [internalFile, setInternalFile] = useState(null);

  // --- Preview State ---
  const [previewSem, setPreviewSem] = useState("3");
  const [previewData, setPreviewData] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // --- API Helper ---
  const apiPost = async (endpoint, body, isFile = false) => {
    setLoading(true);
    setMessage("");
    try {
      const headers = isFile ? {} : { "Content-Type": "application/json" };
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers,
        body: isFile ? body : JSON.stringify(body),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text);
      setMessage(`✅ Success: ${text}`);
      return true; 
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // --- 1. Subject Master Upload ---
  const handleSubjectUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    readFirstSheet(file, (rows) => {
      const mapped = rows.map((raw) => {
        const r = normalizeRowKeys(raw);
        const l = parseInt(r.l) || 0;
        const t = parseInt(r.t) || 0;
        const p = parseInt(r.p) || 0;
        let type = "THEORY"; 
        if (p > 0 && l === 0) {
            type = "PRACTICAL"; 
        } else if (p > 0 && l > 0) {
            type = "INTEGRATED"; 
        }

        return {
          subjectCode: r.subjectcode || r["subject code"],
          subjectName: r.subjectname || r["subject name"],
          department: dept, 
          semester: parseInt(sem),
          l: l, t: t, p: p,
          credits: parseInt(r.c) || parseInt(r.credits) || 0,
          paperType: type 
        };
      });
      apiPost("/api/import/subjects", mapped);
    });
  };

  // --- 2. Login Upload (UPDATED) ---
  const handleLoginUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    readFirstSheet(file, (rows) => {
      const mapped = rows.map((raw) => {
        const r = normalizeRowKeys(raw);
        return {
          registerNumber: r.registerNumber, 
          name: r.name,
          password: r.password,
          // Use selected dept if not in Excel
          department: r.department || dept,
          role: uploadRole, // ✅ USES SELECTED ROLE
        };
      });
      const validRows = mapped.filter(m => m.registerNumber);
      if(validRows.length === 0) {
        setMessage("⚠️ No valid Register Numbers found.");
        return;
      }
      apiPost("/api/import/logins", validRows);
    });
  };

  // --- 3. Fetch Subjects ---
  const fetchSubjects = async (type) => {
    setPaperType(type);
    setSubjectList([]);
    setSelectedSubject("");
    setMessage(`Fetching ${type} subjects...`);
    try {
      const res = await fetch(
        `${API_BASE}/api/import/fetch-subjects?department=${dept}&semester=${sem}&paperType=${type}`
      );
      if (!res.ok) throw new Error("Failed to fetch subjects");
      const data = await res.json();
      setSubjectList(data);
      if (data.length === 0) setMessage(`⚠️ No ${type} subjects found for ${dept} Sem ${sem}.`);
      else setMessage("");
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
    }
  };

  // --- 4. Internal Upload ---
  const handleInternalUpload = () => {
    if (!internalFile || !selectedSubject) {
      setMessage("⚠️ Select a subject and file first.");
      return;
    }
    const formData = new FormData();
    formData.append("file", internalFile);
    formData.append("subjectCode", selectedSubject);
    apiPost("/api/import/internal-upload", formData, true);
  };

  // --- 5. External Upload ---
  const handleExternalUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    readFirstSheet(file, (rows) => {
      const mapped = rows.map((raw) => {
        const r = normalizeRowKeys(raw);
        return {
          registerNumber: r.registerNumber, 
          subjectCode: r.subjectcode || r.subject,
          externalMarks: parseInt(r.mark) || parseInt(r.marks) || 0,
        };
      });
      apiPost("/api/import/external", mapped);
    });
  };

  // --- 6. Calculate Results ---
  const handleCalculate = () => {
    apiPost("/api/import/calculate-results", {});
  };

  // --- Preview Logic ---
  const handlePreview = async () => {
    setLoadingPreview(true);
    setPreviewData([]);
    try {
      const res = await fetch(`${API_BASE}/api/import/preview?semester=${previewSem}&department=${dept}`);
      if(res.ok) {
        const data = await res.json();
        setPreviewData(data);
        setMessage(data.length > 0 ? `✅ Loaded ${data.length} draft results for ${dept}.` : `⚠️ No results found for ${dept} Sem ${previewSem}.`);
      } else {
        setMessage("❌ Could not fetch preview");
      }
    } catch(err) { setMessage("❌ Error fetching preview"); }
    setLoadingPreview(false);
  };

  // --- Publish Logic ---
  const handlePublish = async () => {
    if(!confirm(`Are you sure you want to PUBLISH ${dept} Semester ${previewSem} results?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/import/publish?semester=${previewSem}&department=${dept}`, { method: "POST" });
      const text = await res.text();
      setMessage(res.ok ? "🎉 " + text : "❌ Publish failed");
    } catch(err) { setMessage("❌ Error publishing"); }
  };

  // --- Download Logic ---
  const handleDownload = () => {
    const ws = XLSX.utils.json_to_sheet(previewData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Draft Results");
    XLSX.writeFile(wb, `Draft_Results_${dept}_Sem_${previewSem}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800">
      <header className="bg-white shadow px-6 py-4 flex justify-between items-center z-10 sticky top-0">
        <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
          🎓 UniScore Admin
        </h1>
        <button onClick={onLogout} className="text-sm text-red-500 font-medium hover:underline">
          Logout
        </button>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-6">
        
        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200 mb-6">
          <button onClick={() => setActiveTab("setup")} className={`pb-2 px-4 font-medium transition-colors ${activeTab === "setup" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}>1. Master Data</button>
          <button onClick={() => setActiveTab("internals")} className={`pb-2 px-4 font-medium transition-colors ${activeTab === "internals" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}>2. Upload Internals</button>
          <button onClick={() => setActiveTab("process")} className={`pb-2 px-4 font-medium transition-colors ${activeTab === "process" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}>3. Externals & Results</button>
        </div>

        {/* Feedback */}
        <AnimatePresence>
          {message && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`p-4 rounded-md mb-6 text-sm font-medium shadow-sm ${message.startsWith("✅") ? "bg-green-50 text-green-700 border border-green-200" : message.startsWith("⚠️") ? "bg-yellow-50 text-yellow-700 border border-yellow-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* === TAB 1: SETUP === */}
        {activeTab === "setup" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Target Department</label>
                <select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none">
                  {["CSE", "IT", "ECE", "EEE", "AIDS"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Target Semester</label>
                <select value={sem} onChange={(e) => setSem(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg mb-2 text-gray-700">Step 1: Upload Subjects</h3>
                <p className="text-xs text-gray-500 mb-4">Uploads subjects for <strong>{dept} - Semester {sem}</strong>.<br/>Required columns: <code>Subject Code</code>, <code>Subject Name</code>, <code>L</code>, <code>T</code>, <code>P</code>.</p>
                <input type="file" onChange={handleSubjectUpload} accept=".xlsx, .csv" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
              </div>

              {/* ✅ UPDATED: ROLE SELECTOR ADDED */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-lg text-gray-700">Step 2: Upload Logins</h3>
                  <select 
                    value={uploadRole} 
                    onChange={(e) => setUploadRole(e.target.value)}
                    className="text-xs border border-gray-300 rounded px-2 py-1 font-bold bg-gray-50 text-gray-700 outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="student">Role: Student</option>
                    <option value="hod">Role: HOD</option>
                  </select>
                </div>
                
                <p className="text-xs text-gray-500 mb-4">
                  Creating <strong>{uploadRole.toUpperCase()}</strong> accounts for <strong>{dept}</strong>.
                  <br/>Excel with: Register Number, Name, Password.
                </p>
                <input type="file" onChange={handleLoginUpload} accept=".xlsx, .csv" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
              </div>
            </div>
          </motion.div>
        )}

        {/* === TAB 2: INTERNALS (Unchanged) === */}
        {activeTab === "internals" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold mb-6 text-gray-800">Upload Internal Marks</h2>
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Department</label>
                <select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none">
                  {["CSE", "IT", "ECE", "EEE", "AIDS"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Semester</label>
                <select value={sem} onChange={(e) => setSem(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-8">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Select Paper Type</label>
              <div className="flex gap-4">
                <button onClick={() => fetchSubjects("THEORY")} className={`flex-1 py-3 rounded-lg border font-medium transition-all ${paperType === "THEORY" ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm ring-1 ring-blue-500" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>📘 Theory Paper</button>
                <button onClick={() => fetchSubjects("PRACTICAL")} className={`flex-1 py-3 rounded-lg border font-medium transition-all ${paperType === "PRACTICAL" ? "bg-green-50 border-green-500 text-green-700 shadow-sm ring-1 ring-green-500" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>🧪 Practical Paper</button>
                <button onClick={() => fetchSubjects("INTEGRATED")} className={`flex-1 py-3 rounded-lg border font-medium transition-all ${paperType === "INTEGRATED" ? "bg-purple-50 border-purple-500 text-purple-700 shadow-sm ring-1 ring-purple-500" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>🔀 Integrated Paper</button>
              </div>
            </div>
            {paperType && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 bg-slate-50 p-6 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select Subject</label>
                  <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md bg-white" disabled={subjectList.length === 0}>
                    <option value="">-- Select {paperType} Subject --</option>
                    {subjectList.map((s) => <option key={s.subjectCode} value={s.subjectCode}>{s.subjectCode} - {s.subjectName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Upload Excel File</label>
                  <input type="file" onChange={(e) => setInternalFile(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700" accept=".xlsx, .xls, .csv" />
                </div>
                <button onClick={handleInternalUpload} disabled={loading || !selectedSubject || !internalFile} className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition-all ${loading || !selectedSubject || !internalFile ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 active:scale-95"}`}>
                  {loading ? "Processing..." : "🚀 Upload & Calculate Internals"}
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* === TAB 3: PROCESS RESULTS (Unchanged) === */}
        {activeTab === "process" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-lg mb-2 text-gray-700">Step 1: Upload External Marks</h3>
              <p className="text-xs text-gray-500 mb-4">Required: Register No, Subject Code, Mark.</p>
              <input type="file" onChange={handleExternalUpload} accept=".xlsx, .csv" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100" />
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-lg mb-4 text-gray-800">Step 2: Generate & Publish Results</h3>
              <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                <div>
                  <h4 className="font-bold text-blue-900">A. Calculate Drafts</h4>
                  <p className="text-xs text-blue-700 mt-1">Computes grades for all students but keeps them <span className="font-bold bg-yellow-200 text-yellow-800 px-1 rounded">HIDDEN</span>.</p>
                </div>
                <button onClick={handleCalculate} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium shadow-sm transition-all active:scale-95 text-sm">
                  {loading ? "Running..." : "Run Calculation"}
                </button>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase">B. Preview & Publish</h4>
                <div className="flex flex-wrap gap-4 items-center mb-4">
                   <div className="flex items-center gap-2">
                     <span className="text-sm font-medium text-gray-500">Dept:</span>
                     <select value={dept} onChange={(e) => setDept(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm font-bold w-24 outline-none focus:ring-2 focus:ring-indigo-500">
                        {["CSE", "IT", "ECE", "EEE", "AIDS"].map(d => <option key={d} value={d}>{d}</option>)}
                     </select>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="text-sm font-medium text-gray-500">Sem:</span>
                     <select value={previewSem} onChange={(e) => setPreviewSem(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm font-bold w-16 outline-none focus:ring-2 focus:ring-indigo-500">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
                     </select>
                   </div>
                   <button onClick={handlePreview} disabled={loadingPreview} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded border border-gray-300 text-sm font-medium transition-colors">
                      {loadingPreview ? "Loading..." : "Check Drafts"}
                   </button>
                   {previewData.length > 0 && (
                     <div className="flex gap-2 ml-auto">
                        <button onClick={handleDownload} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-bold shadow-md transition-all active:scale-95 flex items-center gap-2">
                           <span>📥</span> Download
                        </button>
                        <button onClick={handlePublish} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold shadow-md transition-all active:scale-95 flex items-center gap-2">
                           <span>🚀</span> Publish Live
                        </button>
                     </div>
                   )}
                </div>

                {previewData.length > 0 ? (
                  <div className="overflow-hidden border border-gray-200 rounded-lg">
                    <div className="max-h-[500px] overflow-y-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold sticky top-0 shadow-sm z-10">
                          <tr>
                            <th className="px-4 py-3 bg-gray-50">Register No</th>
                            <th className="px-4 py-3 bg-gray-50">Subject</th>
                            <th className="px-4 py-3 text-center bg-gray-50">Marks</th>
                            <th className="px-4 py-3 text-center bg-gray-50">Grade</th>
                            <th className="px-4 py-3 text-center bg-gray-50">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {previewData.map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-mono text-gray-600">{r.registerNumber}</td>
                              <td className="px-4 py-2">{r.subjectCode}</td>
                              <td className="px-4 py-2 text-center">{r.finalMarks}</td>
                              <td className="px-4 py-2 text-center font-bold text-blue-600">{r.grade}</td>
                              <td className="px-4 py-2 text-center">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${r.result === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                  {r.result}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-gray-50 p-2 text-center text-xs text-gray-500 border-t border-gray-200">Showing all {previewData.length} records.</div>
                  </div>
                ) : (
                   <div className="text-center py-8 bg-slate-50 border border-dashed border-gray-300 rounded-lg text-gray-400 text-sm">Select Department & Semester then click "Check Drafts" to preview.</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
/* -------------------- STUDENT DASHBOARD -------------------- */
function StudentResultPage({ user, onLogout }) {
  const [profile, setProfile] = useState(null);

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

  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-lg p-8 border border-gray-100">
        <div className="flex items-center mb-6 border-b pb-4">
          <img src="/college-logo.jpg" alt="Logo" className="w-16 h-16 object-contain mr-4 rounded-full border" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">St. Peters College of Engineering</h1>
            <p className="text-gray-500 text-sm">Student Result Portal</p>
          </div>
        </div>

        <div className="bg-slate-50 border rounded-lg p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><span className="text-gray-500 text-xs uppercase font-bold block">Register Number</span><span className="font-mono text-lg font-semibold">{profile?.student?.registerNumber ?? user.registerNumber}</span></div>
          <div><span className="text-gray-500 text-xs uppercase font-bold block">Name</span><span className="text-lg font-semibold">{profile?.student?.name ?? user.name}</span></div>
          <div><span className="text-gray-500 text-xs uppercase font-bold block">Department</span><span className="text-lg font-semibold">{profile?.student?.department ?? user.department}</span></div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm text-left">
            <thead className="bg-indigo-600 text-white uppercase text-xs">
              <tr>
                <th className="px-6 py-3">Sem</th>
                <th className="px-6 py-3">Subject Code</th>
                <th className="px-6 py-3 text-center">Grade</th>
                <th className="px-6 py-3 text-center">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(profile?.results ?? []).map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{r.semester}</td>
                  <td className="px-6 py-4 font-medium">{r.subjectCode || r.subject}</td>
                  <td className="px-6 py-4 text-center font-bold text-indigo-700">{r.grade}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${r.result === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {r.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex justify-end">
          <button onClick={onLogout} className="px-6 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition-colors">Logout</button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- HOD Dashboard (UPDATED) -------------------- */
function HodDashboard({ user, onLogout }) {
  const [semester, setSemester] = useState("3");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState({}); // Map RegNo -> Name

  // 1. Fetch Student Names
  useEffect(() => {
    fetch(`${API_BASE}/api/import/logins`) // Needs backend endpoint to return student list
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

  // 2. Fetch Results when Sem/Dept changes
  useEffect(() => {
    async function fetchResults() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/import/preview?semester=${semester}&department=${user.department}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        } else {
          setResults([]);
        }
      } catch (e) {
        console.error(e);
        setResults([]);
      }
      setLoading(false);
    }
    if (user.department) fetchResults();
  }, [semester, user.department]);

  // 3. Pivot Data (Rows: Students, Cols: Subjects)
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

  // 4. Download Excel
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
          <p className="text-xs text-slate-500 mt-1">Manage Department Results</p>
        </div>
        <button onClick={onLogout} className="text-red-500 hover:text-red-700 text-sm font-medium">Logout</button>
      </div>

      <div className="max-w-6xl mx-auto w-full p-8">
        <div className="flex flex-wrap items-end gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select Semester</label>
            <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-32 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-700">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>Semester {n}</option>)}
            </select>
          </div>
          <div className="flex-1 text-sm text-gray-500 pb-2">
            {loading ? "Fetching data..." : `Showing ${rows.length} students found for Sem ${semester}`}
          </div>
          {rows.length > 0 && (
            <button onClick={handleDownload} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition-all active:scale-95 flex items-center gap-2">
              <span>📊</span> Download Report
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-400">Loading results...</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-gray-400">No results found for {user.department} Semester {semester}.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="p-4 text-left border-r border-slate-700 w-40">Register No</th>
                    <th className="p-4 text-left border-r border-slate-700 w-64">Student Name</th>
                    {subjects.map(sub => <th key={sub} className="p-4 text-center border-r border-slate-700 min-w-[100px]">{sub}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, i) => (
                    <tr key={row.registerNumber} className={`hover:bg-indigo-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                      <td className="p-3 border-r border-gray-100 font-mono text-slate-600 font-medium">{row.registerNumber}</td>
                      <td className="p-3 border-r border-gray-100 font-medium text-slate-800">{row.name}</td>
                      {subjects.map(sub => (
                        <td key={sub} className="p-3 text-center border-r border-gray-100">
                          {row.grades[sub] ? (
                            <span className={`inline-block w-8 py-1 rounded font-bold text-xs ${['RA', 'U', 'FAIL'].includes(row.grades[sub]) ? 'bg-red-100 text-red-700' : ['O', 'A+'].includes(row.grades[sub]) ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                              {row.grades[sub]}
                            </span>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- Main App -------------------- */
export default function App() {
  const [user, setUser] = useState(null);
  const handleLogout = () => setUser(null);

  if (!user) return <ThemedLogin onLogin={setUser} />;
  if (user.role === "admin") return <AdminDashboard onLogout={handleLogout} />;
  if (user.role === "hod") return <HodDashboard user={user} onLogout={handleLogout} />;
  if (user.role === "student") return <StudentResultPage user={user} onLogout={handleLogout} />;

  return <div className="p-10 text-center text-red-500 font-bold">Unknown role: {user.role}</div>;
}