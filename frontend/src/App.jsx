import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, TrendingUp, BarChart3, AlertTriangle, 
  CheckCircle2, Download, BookOpen, Info, ChevronDown, 
  ChevronUp, ChevronRight, Cpu, RefreshCw, Database, GitMerge, FileSpreadsheet,
  Percent, Activity, Eye, ShieldAlert, Search, Lock, X,
  LogOut, Trash2, History
} from 'lucide-react';
import PlotlyChart from './components/PlotlyChart';

const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:8000/api"
  : "/api";

const ANALYSIS_STEPS = [
  "Parsing CSV file & checking data types",
  "Calculating missingness patterns & imputation strategies",
  "Auditing numeric features, skewness & kurtosis",
  "Detecting outliers via IQR and Z-Score distributions",
  "Computing Pearson correlation matrix & collinearity risk",
  "Structuring metrics payload for narration context",
  "Querying Groq API for plain-English interpretation",
  "Compiling finalized dashboard visualization plots"
];

const getNarrationSection = (text, number) => {
  if (!text) return "";
  const lines = text.split('\n');
  let sectionLines = [];
  let capturing = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const headingMatch = line.match(/^(?:#+\s+)?(\d+)\.\s+/);
    if (headingMatch) {
      const secNum = parseInt(headingMatch[1]);
      if (secNum === number) {
        capturing = true;
        sectionLines.push(line.replace(/^#+\s+/, ''));
        continue;
      } else if (capturing) {
        capturing = false;
        break;
      }
    }
    if (capturing) {
      sectionLines.push(lines[i]);
    }
  }
  
  return sectionLines.join('\n');
};

// Custom Markdown renderer designed to display McKinsey-style objective analyst reports
const MarkdownRenderer = ({ text }) => {
  if (!text) return null;
  
  const lines = text.split('\n');
  return (
    <div className="space-y-4 leading-relaxed font-sans text-sm md:text-base text-[var(--text-main)]">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;
        
        const parseInline = (str) => {
          let html = str;
          html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          html = html.replace(/`(.*?)`/g, '<code class="bg-[var(--bg-app)] border border-[var(--border-main)] px-1.5 py-0.5 rounded text-emerald-500 font-mono text-xs font-semibold">$1</code>');
          return <span dangerouslySetInnerHTML={{ __html: html }} />;
        };

        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={idx} className="text-xl md:text-2xl font-bold text-[var(--text-header)] mt-6 mb-3 pb-1 border-b border-[var(--border-main)]">
              {parseInline(trimmed.substring(2))}
            </h1>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-lg md:text-xl font-bold text-[var(--text-header)] mt-5 mb-2">
              {parseInline(trimmed.substring(3))}
            </h2>
          );
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-base md:text-lg font-semibold text-[var(--text-header)] mt-4 mb-2">
              {parseInline(trimmed.substring(4))}
            </h3>
          );
        }
        
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <li key={idx} className="list-disc ml-6 pl-1 my-1 text-[var(--text-main)]">
              {parseInline(trimmed.substring(2))}
            </li>
          );
        }
        
        const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex gap-2 ml-4 my-1">
              <span className="text-emerald-500 font-semibold font-mono">{numMatch[1]}.</span>
              <span className="text-[var(--text-main)]">{parseInline(numMatch[2])}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-[var(--text-main)]">
            {parseInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

// Expandable Accordion Card for the About Page (Emoji-free, professional styling)
const Accordion = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-[var(--border-main)] rounded-xl bg-[var(--bg-card)] overflow-hidden transition-all duration-300">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left font-semibold text-[var(--text-header)] hover:bg-[var(--bg-card-hover)] transition-colors"
      >
        <span className="pr-4">{question}</span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-emerald-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
      </button>
      <div 
        className={`transition-all duration-350 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-[1000px] border-t border-[var(--border-main)] p-5 bg-[var(--bg-inner)]' : 'max-h-0'
        }`}
      >
        <div className="text-[var(--text-main)] leading-relaxed border-l-2 border-emerald-500 pl-4 py-1 italic bg-[var(--bg-card)] rounded-r-md">
          {answer}
        </div>
      </div>
    </div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [dashboardTab, setDashboardTab] = useState('overview');
  
  // User Auth State
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')) || null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [authError, setAuthError] = useState(null);
  
  // Auth navigation overlays
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authReason, setAuthReason] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // History State
  const [historyList, setHistoryList] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // App State
  const [backendHealthy, setBackendHealthy] = useState(false);
  const [checkingBackend, setCheckingBackend] = useState(true);
  
  const [fileInfo, setFileInfo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState(0);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [narration, setNarration] = useState("");
  
  const [isExporting, setIsExporting] = useState(false);

  // Google OAuth Initialization
  useEffect(() => {
    const loadGoogleAuth = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/config`);
        if (!res.ok) throw new Error("Failed to load OAuth config");
        const data = await res.json();

        let attempts = 0;
        while (!window.google && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: data.client_id,
            callback: handleCredentialResponse
          });
        }
      } catch (e) {
        console.error("Google Auth init error:", e);
        setAuthError("Failed to initialize Google login.");
      }
    };

    loadGoogleAuth();
  }, []);

  // Render Google Login Button whenever modal is opened
  useEffect(() => {
    if (showLoginModal) {
      setTimeout(() => {
        const btnEl = document.getElementById("google-signin-btn");
        if (window.google && btnEl) {
          window.google.accounts.id.renderButton(
            btnEl,
            { 
              theme: "filled_blue", 
              size: "large", 
              shape: "pill",
              text: "continue_with"
            }
          );
        }
      }, 150);
    }
  }, [showLoginModal]);

  // Google login callback handler
  const handleCredentialResponse = async (response) => {
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ credential: response.credential })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed.");
      }

      setUser(data);
      setToken(response.credential);
      localStorage.setItem('user', JSON.stringify(data));
      localStorage.setItem('token', response.credential);
      setShowLoginModal(false);
      setAuthReason("");
    } catch (err) {
      console.error(err);
      setAuthError(err.message || "Google Authentication failed.");
    }
  };

  const handleSignOut = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    
    // Clear CSV state
    setFileInfo(null);
    setAnalysisResult(null);
    setNarration("");
    
    if (window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
    setActiveTab('upload');
  };

  // Fetch Report History for the user
  const fetchHistory = async () => {
    if (!token) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/history`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (err) {
      console.error("Failed to query history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showHistoryModal) {
      fetchHistory();
    }
  }, [showHistoryModal]);

  // Load a historical report
  const loadHistoryItem = async (historyId) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/history/${historyId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to load historical record.");
      const data = await res.json();
      
      setFileInfo({
        filename: data.filename,
        size_mb: 0,
        columns: Object.keys(data.analysis.distributions).concat(Object.keys(data.analysis.class_balance)),
        preview: []
      });
      setAnalysisResult(data.analysis);
      setNarration(data.narration);
      setShowHistoryModal(false);
      setActiveTab('dashboard');
      setDashboardTab('overview');
    } catch (err) {
      alert("Failed to load historical audit: " + err.message);
    }
  };

  // Delete a historical report
  const deleteHistoryItem = async (e, historyId) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this report from your history?")) return;
    try {
      const res = await fetch(`${API_BASE}/history/${historyId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to delete.");
      setHistoryList(prev => prev.filter(item => item.id !== historyId));
    } catch (err) {
      alert("Failed to delete report: " + err.message);
    }
  };

  // Trigger login modal programmatically
  const triggerLoginModal = (reason = "") => {
    setAuthReason(reason);
    setAuthError(null);
    setShowLoginModal(true);
  };

  // Check backend health on load
  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        setBackendHealthy(true);
      } else {
        setBackendHealthy(false);
      }
    } catch (e) {
      setBackendHealthy(false);
    } finally {
      setCheckingBackend(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  // Handle Drag & Drop / File Select Upload
  const handleFileUpload = async (file) => {
    if (!file) return;
    
    // Auth Gate check
    if (!user) {
      triggerLoginModal("Please sign in to upload datasets.");
      return;
    }
    
    if (!file.name.endsWith('.csv')) {
      setUploadError("Only CSV files are supported.");
      return;
    }
    
    if (file.size > 50 * 1024 * 1024) {
      setUploadError("File size exceeds the 50MB limit.");
      return;
    }
    
    setUploadError(null);
    setIsUploading(true);
    setFileInfo(null);
    setAnalysisResult(null);
    setNarration("");
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "Failed to upload file.");
      }
      
      setFileInfo(data);
    } catch (err) {
      setUploadError(err.message || "An error occurred during file upload.");
    } finally {
      setIsUploading(false);
    }
  };

  // Drag over handler
  const onDragOver = (e) => {
    e.preventDefault();
  };

  // Drop handler
  const onDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // File Input Selection
  const onFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Run Analysis Pipeline
  const runAnalysis = async () => {
    if (!fileInfo) return;
    
    // Auth Gate check
    if (!user) {
      triggerLoginModal("Please sign in to run analytical audits.");
      return;
    }
    
    setAnalysisError(null);
    setIsAnalyzing(true);
    setCurrentAnalysisStep(0);
    
    // Start progress step interval simulation
    const stepInterval = setInterval(() => {
      setCurrentAnalysisStep(prev => {
        if (prev < ANALYSIS_STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1250);
    
    try {
      const res = await fetch(`${API_BASE}/analyze/${fileInfo.file_id}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "Analysis failed.");
      }
      
      // Complete steps on success immediately
      setCurrentAnalysisStep(ANALYSIS_STEPS.length);
      await new Promise(resolve => setTimeout(resolve, 350));
      
      setAnalysisResult(data.analysis);
      setNarration(data.narration);
      
      // Auto switch to Dashboard tab after successful run
      setActiveTab('dashboard');
      setDashboardTab('overview');
    } catch (err) {
      setAnalysisError(err.message || "An error occurred during analysis.");
    } finally {
      clearInterval(stepInterval);
      setIsAnalyzing(false);
    }
  };

  // Export PDF Report
  const exportPDF = async () => {
    if (!analysisResult || !narration) return;
    setIsExporting(true);
    
    try {
      const res = await fetch(`${API_BASE}/export-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          analysis: analysisResult,
          narration: narration
        })
      });
      
      if (!res.ok) {
        throw new Error("Failed to generate PDF");
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Smart_EDA_Report_${fileInfo?.filename.replace('.csv', '') || 'report'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error exporting PDF: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Professional indicators coloring helper
  const getBadgeColors = (level) => {
    if (level === 2) return { text: "text-red-600 dark:text-red-400", border: "border-red-200 dark:border-red-950", bg: "bg-red-50 dark:bg-red-950/20", tag: "Critical" };
    if (level === 1) return { text: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-950", bg: "bg-amber-50 dark:bg-amber-950/20", tag: "Caution" };
    return { text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-950", bg: "bg-emerald-50 dark:bg-emerald-950/20", tag: "Optimal" };
  };

  const getSeverityBadgeClass = (severity) => {
    if (severity === 'Red') return "bg-red-500/10 text-red-500 border border-red-500/20";
    if (severity === 'Yellow') return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
    return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-app)] text-[var(--text-main)] transition-colors duration-200">
      
      {/* 1. Header (Premium glassmorphic navbar) */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[var(--bg-nav)]/90 border-b border-[var(--border-main)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 pulse-glow text-emerald-500">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg md:text-xl tracking-tight text-[var(--text-header)]">
                Data<span className="text-emerald-500 font-bold">Lens</span>
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Main Tabs */}
            <nav className="flex space-x-2">
              <button 
                onClick={() => setActiveTab('upload')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  activeTab === 'upload' 
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-sm shadow-emerald-500/10' 
                    : 'text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)]'
                }`}
              >
                <Upload className="w-3.5 h-3.5 shrink-0" />
                Upload
              </button>
              
              {/* Only show Dashboard tab if analysis is complete */}
              {analysisResult && (
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    activeTab === 'dashboard' 
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-sm shadow-emerald-500/10' 
                      : 'text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)]'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                  Dashboard
                </button>
              )}

              <button 
                onClick={() => setActiveTab('about')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  activeTab === 'about' 
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-sm shadow-emerald-500/10' 
                    : 'text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                About
              </button>
            </nav>

            {/* Auth section */}
            {user ? (
              /* Profile Avatar Icon & Dropdown Menu */
              <div className="relative">
                <button 
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-8 h-8 rounded-full border border-[var(--border-main)] hover:border-emerald-500 hover:scale-105 transition-all shrink-0 cursor-pointer overflow-hidden focus:outline-none flex items-center justify-center bg-[var(--bg-inner)]"
                  title="User Profile Menu"
                >
                  <img 
                    src={user.picture} 
                    alt={user.name} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                </button>
                
                {showDropdown && (
                  <>
                    {/* Invisible overlay to close dropdown on clicking outside */}
                    <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                    
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] shadow-xl z-50 p-2 space-y-1 animate-fade-in">
                      <div className="px-3 py-2.5">
                        <p className="text-xs font-bold text-[var(--text-header)] truncate leading-none">{user.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)] truncate leading-none mt-1.5">{user.email}</p>
                      </div>
                      
                      <div className="border-t border-[var(--border-main)] my-1" />
                      
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          setShowHistoryModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] rounded-xl transition-all cursor-pointer text-left"
                      >
                        <History className="w-4 h-4 text-emerald-500 shrink-0" />
                        Analysis History
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          handleSignOut();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer text-left"
                      >
                        <LogOut className="w-4 h-4 text-red-500 shrink-0" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Curvy Log In / Sign Up buttons when logged out */
              <div className="flex items-center space-x-2 border-l border-[var(--border-main)] pl-3">
                <button 
                  onClick={() => triggerLoginModal()}
                  className="text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] px-4 py-2 border border-[var(--border-main)] rounded-full transition-all cursor-pointer"
                >
                  Log In
                </button>
                <button 
                  onClick={() => triggerLoginModal()}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold px-4 py-2 rounded-full transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-start">
        
        {/* Backend health check warning */}
        {!checkingBackend && !backendHealthy && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center justify-between text-red-700 dark:text-red-200 text-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <span>
                <strong>System API Offline:</strong> Connection could not be established on port 8000. Please start the FastAPI backend server.
              </span>
            </div>
            <button onClick={checkHealth} className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/30 transition-colors">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        )}

        {/* Tab 1: Upload Page (Visible by default) */}
        {activeTab === 'upload' && (
          <div className="space-y-6 max-w-4xl mx-auto w-full">
            <div className="text-center space-y-2 py-6">
              <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--text-header)] tracking-tight">Structured Exploratory Data Analysis</h1>
              <p className="text-[var(--text-muted)] max-w-xl mx-auto text-sm md:text-base">
                Upload any tabular dataset to generate an automated data quality audit and a natural language audit report.
              </p>
            </div>

            {/* Drag and drop Area */}
            {!fileInfo && (
              <div 
                onDragOver={onDragOver}
                onDrop={onDrop}
                className="border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 bg-[var(--bg-card)] relative group border-[var(--border-main)] hover:border-emerald-500/50 hover:bg-[var(--bg-card-hover)]"
              >
                <input 
                  type="file" 
                  id="csv-file-input" 
                  accept=".csv" 
                  onChange={onFileSelect} 
                  className="hidden" 
                />
                
                <label 
                  htmlFor="csv-file-input"
                  className="flex flex-col items-center justify-center space-y-4 cursor-pointer"
                >
                  {isUploading ? (
                    <div className="bg-emerald-500/10 p-4 rounded-full border border-emerald-500/35 animate-spin text-emerald-500">
                      <RefreshCw className="w-8 h-8" />
                    </div>
                  ) : (
                    <div className="bg-[var(--bg-inner)] p-4 rounded-full border border-[var(--border-main)] group-hover:border-emerald-500/30 transition-colors">
                      <Upload className="w-8 h-8 text-[var(--text-muted)] group-hover:text-emerald-500 transition-colors" />
                    </div>
                  )}
                  
                  <div>
                    <span className="text-base md:text-lg font-semibold text-[var(--text-header)] group-hover:text-emerald-500 transition-colors">
                      {isUploading ? "Uploading file..." : "Drag & drop CSV file, or browse"}
                    </span>
                  </div>
                </label>
              </div>
            )}

            {/* Upload Error Banner */}
            {uploadError && (
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* File Info & 10-Row Preview or loading spinner */}
            {fileInfo && (
              isAnalyzing ? (
                <div className="border border-[var(--border-main)] rounded-2xl p-8 bg-[var(--bg-card)] max-w-lg mx-auto w-full space-y-6 animate-fade-in shadow-xl relative overflow-hidden text-left">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
                  
                  <div className="text-center space-y-2">
                    <div className="inline-flex bg-emerald-500/10 p-3.5 rounded-full border border-emerald-500/20 text-emerald-500 animate-spin mb-2">
                      <RefreshCw className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-extrabold text-[var(--text-header)]">Processing DataLens Pipeline</h3>
                    <p className="text-xs text-[var(--text-muted)]">Running statistical algorithms & Groq narration engines</p>
                  </div>

                  <div className="space-y-3 bg-[var(--bg-inner)] p-5 rounded-xl border border-[var(--border-main)] font-sans">
                    {ANALYSIS_STEPS.map((step, idx) => {
                      const isDone = idx < currentAnalysisStep;
                      const isActive = idx === currentAnalysisStep;
                      
                      return (
                        <div key={idx} className="flex items-center gap-3 text-xs transition-all duration-300">
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : isActive ? (
                            <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-[var(--border-main)] flex items-center justify-center shrink-0">
                              <div className="w-1.5 h-1.5 rounded-full bg-[var(--border-main)]" />
                            </div>
                          )}
                          <span className={`${
                            isDone 
                              ? 'text-[var(--text-muted)] line-through decoration-emerald-500/20' 
                              : isActive 
                              ? 'text-emerald-500 font-bold animate-pulse' 
                              : 'text-[var(--text-muted)] opacity-60'
                          }`}>
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-fade-in border border-[var(--border-main)] rounded-2xl p-6 bg-[var(--bg-card)]">
                  
                  {/* Meta details */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-main)] pb-4">
                    <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                      <div className="flex items-center space-x-3">
                        <FileSpreadsheet className="w-6 h-6 text-emerald-500 shrink-0" />
                        <div>
                          <h3 className="font-bold text-[var(--text-header)] text-base md:text-lg">{fileInfo.filename}</h3>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            File Size: <span className="font-semibold text-[var(--text-main)]">{fileInfo.size_mb} MB</span>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setFileInfo(null);
                          setAnalysisResult(null);
                          setNarration("");
                        }}
                        className="text-xs font-semibold text-emerald-500 hover:text-emerald-600 transition-colors underline cursor-pointer ml-3 bg-[var(--bg-inner)] px-3 py-1 rounded-full border border-[var(--border-main)]"
                      >
                        Upload Different File
                      </button>
                    </div>
                    
                    <button 
                      onClick={runAnalysis}
                      disabled={isAnalyzing || !backendHealthy}
                      className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-[var(--border-main)] disabled:text-[var(--text-muted)] text-slate-950 font-bold px-6 py-2.5 rounded-xl transition-all duration-200 text-sm md:text-base shadow-sm cursor-pointer"
                    >
                      <Search className="w-4 h-4 shrink-0" />
                      Run Analysis Pipeline
                    </button>
                  </div>

                  {/* Analysis Error */}
                  {analysisError && (
                    <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                      <span>{analysisError}</span>
                    </div>
                  )}

                  {/* Row / Col Stats */}
                  <div className="grid grid-cols-2 gap-4 max-w-sm">
                    <div className="bg-[var(--bg-inner)] p-4 rounded-xl border border-[var(--border-main)]">
                      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider block font-semibold">Columns</span>
                      <span className="text-xl md:text-2xl font-black text-emerald-500 mt-1 block">{fileInfo.columns.length}</span>
                    </div>
                    <div className="bg-[var(--bg-inner)] p-4 rounded-xl border border-[var(--border-main)]">
                      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider block font-semibold">Preview Rows</span>
                      <span className="text-xl md:text-2xl font-black text-emerald-500 mt-1 block">10 rows</span>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="space-y-2">
                    <span className="text-sm font-bold text-[var(--text-header)]">Dataset Preview</span>
                    <div className="overflow-x-auto rounded-xl border border-[var(--border-main)] bg-[var(--bg-inner)]">
                      <table className="min-w-full divide-y divide-[var(--border-main)] text-left text-xs md:text-sm">
                        <thead className="bg-[var(--bg-card)] text-[var(--text-muted)] font-semibold">
                          <tr>
                            {fileInfo.columns.map((col, idx) => (
                              <th key={idx} className="px-4 py-3 whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-main)] text-[var(--text-main)]">
                          {fileInfo.preview.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-[var(--bg-card-hover)]/30">
                              {fileInfo.columns.map((col, colIdx) => (
                                <td key={colIdx} className="px-4 py-2.5 whitespace-nowrap">
                                  {row[col] === null || row[col] === undefined ? (
                                    <span className="text-red-500 font-mono text-xs italic bg-red-550/5 px-1 py-0.5 rounded">null</span>
                                  ) : (
                                    String(row[col])
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Tab 2: Dashboard Page */}
        {activeTab === 'dashboard' && analysisResult && (
          <div className="space-y-6">
            
            {/* Dashboard Subheader Control Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-card)] p-4 border border-[var(--border-main)] rounded-2xl">
              <div>
                <h2 className="text-lg font-extrabold text-[var(--text-header)]">Dataset Exploratory Dashboard</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  File: <span className="font-semibold text-[var(--text-main)]">{fileInfo?.filename || 'dataset'}</span>
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Sub-tabs menu */}
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setDashboardTab('overview')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      dashboardTab === 'overview' 
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-sm shadow-emerald-500/10' 
                        : 'text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)]'
                    }`}
                  >
                    Summary & Report
                  </button>
                  <button 
                    onClick={() => setDashboardTab('anomalies')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      dashboardTab === 'anomalies' 
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-sm shadow-emerald-500/10' 
                        : 'text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)]'
                    }`}
                  >
                    Quality & Anomalies
                  </button>
                  <button 
                    onClick={() => setDashboardTab('distributions')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      dashboardTab === 'distributions' 
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-sm shadow-emerald-500/10' 
                        : 'text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)]'
                    }`}
                  >
                    Distributions
                  </button>
                  <button 
                    onClick={() => setDashboardTab('correlations')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      dashboardTab === 'correlations' 
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-sm shadow-emerald-500/10' 
                        : 'text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)]'
                    }`}
                  >
                    Correlations
                  </button>

                </div>

                <button 
                  onClick={exportPDF}
                  disabled={isExporting}
                  className="flex items-center justify-center gap-2 bg-[var(--bg-inner)] border border-[var(--border-main)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] font-semibold px-4 py-2 rounded-xl transition-all duration-200 text-xs shrink-0 cursor-pointer"
                >
                  {isExporting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export PDF
                </button>
              </div>
            </div>

            {/* Subtab 1: Executive Narration & Overview */}
            {dashboardTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-5 flex items-center space-x-4">
                    <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/10 text-emerald-500 shrink-0">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block font-bold">Total Records</span>
                      <span className="text-xl md:text-2xl font-black text-[var(--text-header)] mt-0.5 block">{analysisResult.overview.rows.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-5 flex items-center space-x-4">
                    <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/10 text-emerald-500 shrink-0">
                      <GitMerge className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block font-bold">Columns Audit</span>
                      <span className="text-xl md:text-2xl font-black text-[var(--text-header)] mt-0.5 block">{analysisResult.overview.cols.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-5 flex items-center space-x-4">
                    <div className={`p-3 rounded-xl border shrink-0 ${
                      analysisResult.missing_values.total_missing_cells > 0 
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
                        : 'bg-emerald-500/10 border-emerald-500/10 text-emerald-500'
                    }`}>
                      <Percent className="w-5 h-5 font-bold" />
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block font-bold">Missing Values</span>
                      <span className={`text-xl md:text-2xl font-black mt-0.5 block ${
                        analysisResult.missing_values.total_missing_cells > 0 ? 'text-amber-500' : 'text-emerald-500'
                      }`}>
                        {analysisResult.missing_values.overall_missing_pct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-5 flex items-center space-x-4">
                    <div className={`p-3 rounded-xl border shrink-0 ${
                      analysisResult.outliers.total_flagged_rows > 0 
                        ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                        : 'bg-emerald-500/10 border-emerald-500/10 text-emerald-500'
                    }`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block font-bold">Outlier Records</span>
                      <span className={`text-xl md:text-2xl font-black mt-0.5 block ${
                        analysisResult.outliers.total_flagged_rows > 0 ? 'text-red-500' : 'text-emerald-500'
                      }`}>
                        {analysisResult.outliers.total_flagged_percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: AI Executive Analysis Report */}
                  <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-6 relative overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-[var(--border-main)] pb-3 mb-4">
                      <Eye className="w-5 h-5 text-emerald-500" />
                      <h3 className="font-extrabold text-[var(--text-header)] text-base">Analyst Interpretation Report</h3>
                    </div>
                    
                    <div className="prose dark:prose-invert max-w-none">
                      <MarkdownRenderer text={getNarrationSection(narration, 1)} />
                    </div>
                  </div>

                  {/* Right: Clean list of Audit Warnings */}
                  <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-6 flex flex-col">
                    <div className="flex items-center gap-2 border-b border-[var(--border-main)] pb-3 mb-4">
                      <ShieldAlert className="w-5 h-5 text-amber-500" />
                      <h3 className="font-extrabold text-[var(--text-header)] text-base">Statistical Quality Flags</h3>
                    </div>
                    
                    <div className="space-y-4 flex-1 overflow-y-auto max-h-[550px] pr-1">
                      {/* Missing data */}
                      {analysisResult.missing_values.total_missing_cells > 0 ? (
                        <div className="border-l-4 border-amber-500 bg-amber-500/5 rounded-r-xl p-3.5 space-y-1">
                          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Null Values Detected</span>
                          <p className="text-xs text-[var(--text-main)] leading-relaxed">
                            Identified <strong>{analysisResult.missing_values.total_missing_cells.toLocaleString()} empty fields</strong> representing {analysisResult.missing_values.overall_missing_pct.toFixed(2)}% of the total dataset matrix.
                          </p>
                        </div>
                      ) : (
                        <div className="border-l-4 border-emerald-500 bg-emerald-500/5 rounded-r-xl p-3.5">
                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Data Completeness</span>
                          <p className="text-xs text-[var(--text-main)] leading-relaxed mt-0.5">No missing values detected. Feature integrity is optimal.</p>
                        </div>
                      )}

                      {/* Multicollinearity */}
                      {analysisResult.correlation.warnings && analysisResult.correlation.warnings.length > 0 ? (
                        <div className="border-l-4 border-red-500 bg-red-500/5 rounded-r-xl p-3.5 space-y-2">
                          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">Multicollinearity Risks</span>
                          <div className="divide-y divide-[var(--border-main)] space-y-1.5">
                            {analysisResult.correlation.warnings.map((w, idx) => (
                              <div key={idx} className="text-xs text-[var(--text-main)] pt-1.5 first:pt-0 leading-relaxed">
                                <span className="font-semibold">{w.col1}</span> and <span className="font-semibold">{w.col2}</span> correlate at <strong>r = {w.correlation.toFixed(2)}</strong>.
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="border-l-4 border-emerald-500 bg-emerald-500/5 rounded-r-xl p-3.5">
                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Collinearity Audit</span>
                          <p className="text-xs text-[var(--text-main)] leading-relaxed mt-0.5">No features exceed collinearity limits (|r| &lt; 0.8).</p>
                        </div>
                      )}

                      {/* Highly Skewed Distributions */}
                      {Object.entries(analysisResult.distributions).some(([_, colData]) => colData.flags.skewness_alert_level === 2) ? (
                        <div className="border-l-4 border-amber-500 bg-amber-500/5 rounded-r-xl p-3.5 space-y-2">
                          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Highly Skewed Features</span>
                          <div className="space-y-1 text-xs text-[var(--text-main)] leading-relaxed">
                            {Object.entries(analysisResult.distributions)
                              .filter(([_, colData]) => colData.flags.skewness_alert_level === 2)
                              .map(([colName, colData], idx) => (
                                <div key={idx} className="flex justify-between items-center bg-[var(--bg-inner)] p-1.5 rounded mt-1 border border-[var(--border-main)]">
                                  <span className="font-mono text-xs text-[var(--text-main)]">{colName}</span>
                                  <span className="text-red-500 font-semibold text-xs">Skew: {colData.stats.skewness.toFixed(1)}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Imbalance warnings */}
                      {Object.entries(analysisResult.class_balance).some(([_, colData]) => colData.flags.imbalance_alert_level > 0) ? (
                        <div className="border-l-4 border-amber-500 bg-amber-500/5 rounded-r-xl p-3.5 space-y-2">
                          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Imbalanced Categoricals</span>
                          <div className="space-y-1 text-xs text-[var(--text-main)] leading-relaxed">
                            {Object.entries(analysisResult.class_balance)
                              .filter(([_, colData]) => colData.flags.imbalance_alert_level > 0)
                              .map(([colName, colData], idx) => (
                                <div key={idx} className="bg-[var(--bg-inner)] p-2 rounded mt-1 border border-[var(--border-main)]">
                                  <div className="flex justify-between font-mono text-xs">
                                    <span>{colName}</span>
                                    <span className={colData.flags.imbalance_alert_level === 2 ? 'text-red-500 font-semibold' : 'text-amber-500 font-semibold'}>
                                      {colData.flags.imbalance_alert_level === 2 ? 'High' : 'Moderate'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{colData.flags.imbalance_flag}</p>
                                </div>
                              ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Subtab 2: Quality & Anomalies (Nulls + Outliers) */}
            {dashboardTab === 'anomalies' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in text-left">
                {/* Left Column: AI Quality Audit Interpretation */}
                <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-6 relative overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-[var(--border-main)] pb-3 mb-4">
                    <ShieldAlert className="w-5 h-5 text-emerald-500" />
                    <h3 className="font-extrabold text-[var(--text-header)] text-base">Quality & Anomalies Interpretation</h3>
                  </div>
                  <div className="prose dark:prose-invert max-w-none">
                    <MarkdownRenderer text={getNarrationSection(narration, 2)} />
                  </div>
                </div>

                {/* Right Column: Simplified Stats Cards */}
                <div className="space-y-6">
                  {/* Data Completeness Card */}
                  <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-2.5">
                      <span className="text-xs font-bold text-[var(--text-header)] uppercase tracking-wider">Completeness Stats</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                        analysisResult.missing_values.total_missing_cells > 0 
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                      }`}>
                        {analysisResult.missing_values.overall_missing_pct.toFixed(2)}% Missing
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center text-xs">
                      <div className="bg-[var(--bg-inner)] p-3 rounded-xl border border-[var(--border-main)]">
                        <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider block">Null Cells</span>
                        <span className="text-lg font-black text-[var(--text-header)] mt-0.5 block font-mono">
                          {analysisResult.missing_values.total_missing_cells.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-[var(--bg-inner)] p-3 rounded-xl border border-[var(--border-main)]">
                        <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider block">Completeness</span>
                        <span className="text-lg font-black text-emerald-500 mt-0.5 block font-mono">
                          {(100 - analysisResult.missing_values.overall_missing_pct).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Imputation Action Plan snippet */}
                    <div className="bg-[var(--bg-inner)] p-3 border border-[var(--border-main)] rounded-xl overflow-y-auto max-h-[160px] space-y-2">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block border-b border-[var(--border-main)] pb-1">Auto-Imputation Actions</span>
                      {Object.entries(analysisResult.missing_values.columns).some(([_, details]) => details.count > 0) ? (
                        Object.entries(analysisResult.missing_values.columns)
                          .filter(([_, details]) => details.count > 0)
                          .map(([col, details], idx) => (
                            <div key={idx} className="text-[11px] leading-tight">
                              <span className="font-semibold text-[var(--text-main)] block">{col} ({details.count} nulls)</span>
                              <span className="text-[var(--text-muted)]">{details.suggestion}</span>
                            </div>
                          ))
                      ) : (
                        <p className="text-[10px] text-[var(--text-muted)] text-center py-2">No missing values to impute. Excellent data completeness.</p>
                      )}
                    </div>
                  </div>

                  {/* Outlier Contamination Card */}
                  <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-2.5">
                      <span className="text-xs font-bold text-[var(--text-header)] uppercase tracking-wider">Outlier Contamination</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                        analysisResult.outliers.total_flagged_rows > 0 
                          ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                      }`}>
                        {analysisResult.outliers.total_flagged_percentage.toFixed(1)}% Flagged
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center text-xs">
                      <div className="bg-[var(--bg-inner)] p-3 rounded-xl border border-[var(--border-main)]">
                        <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider block">Flagged Rows</span>
                        <span className="text-lg font-black text-[var(--text-header)] mt-0.5 block font-mono">
                          {analysisResult.outliers.total_flagged_rows.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-[var(--bg-inner)] p-3 rounded-xl border border-[var(--border-main)]">
                        <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider block">Clean Rows</span>
                        <span className="text-lg font-black text-emerald-500 mt-0.5 block font-mono">
                          {(analysisResult.overview.rows - analysisResult.outliers.total_flagged_rows).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Top 3 outlier features list */}
                    <div className="bg-[var(--bg-inner)] p-3 border border-[var(--border-main)] rounded-xl space-y-2">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block border-b border-[var(--border-main)] pb-1">Top Outlier Columns</span>
                      {Object.keys(analysisResult.outliers.columns).length > 0 ? (
                        Object.entries(analysisResult.outliers.columns)
                          .sort((a, b) => b[1].total_distinct_count - a[1].total_distinct_count)
                          .slice(0, 3)
                          .map(([col, data], idx) => (
                            <div key={idx} className="flex justify-between items-center text-[11px]">
                              <span className="font-mono text-[var(--text-main)] truncate max-w-[130px]">{col}</span>
                              <span className="text-red-500 font-semibold">{data.total_distinct_count.toLocaleString()} ({data.percentage.toFixed(1)}%)</span>
                            </div>
                          ))
                      ) : (
                        <p className="text-[10px] text-[var(--text-muted)] text-center py-2">No outlier records detected.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Subtab 3: Numerical Distributions */}
            {dashboardTab === 'distributions' && (
              <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-6 relative overflow-hidden text-left animate-fade-in w-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
                <div className="flex items-center gap-2 border-b border-[var(--border-main)] pb-3 mb-4">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-extrabold text-[var(--text-header)] text-base">Distribution & Skewness Interpretation</h3>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <MarkdownRenderer text={getNarrationSection(narration, 3)} />
                </div>
              </div>
            )}

            {/* Subtab 4: Correlations */}
            {dashboardTab === 'correlations' && (
              <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-6 relative overflow-hidden text-left animate-fade-in w-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
                <div className="flex items-center gap-2 border-b border-[var(--border-main)] pb-3 mb-4">
                  <BarChart3 className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-extrabold text-[var(--text-header)] text-base">Correlation & Relationship Interpretation</h3>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <MarkdownRenderer text={getNarrationSection(narration, 4)} />
                </div>
              </div>
            )}


          </div>
        )}

        {/* Tab 3: About Page */}
        {activeTab === 'about' && (
          <div className="max-w-4xl mx-auto space-y-10 py-4 w-full">
            
            <div className="border border-[var(--border-main)] rounded-2xl p-6 md:p-8 bg-[var(--bg-card)] space-y-6 relative overflow-hidden">
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-emerald-500">
                  <Info className="w-5 h-5" />
                  <span className="text-xs uppercase tracking-wider font-bold">Project Details</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-header)] tracking-tight">DataLens</h1>
              </div>

              <div className="space-y-3 border-t border-[var(--border-main)] pt-5">
                <h3 className="font-bold text-[var(--text-header)] text-base md:text-lg">What This Project Does</h3>
                <p className="text-[var(--text-main)] leading-relaxed text-sm md:text-base">
                  Upload any CSV and get an instant AI-narrated exploratory data analysis report. Instead of just showing statistics, it interprets them — flagging skewness, multicollinearity risks, class imbalance, outlier patterns, and missing data strategies — all explained in plain English powered by Gemini API.
                </p>
              </div>

              <div className="space-y-3 border-t border-[var(--border-main)] pt-5">
                <h3 className="font-bold text-[var(--text-header)] text-base md:text-lg">Why This Was Built</h3>
                <p className="text-[var(--text-main)] leading-relaxed text-sm md:text-base">
                  Existing tools like Pandas Profiling, SweetViz, and D-Tale give you statistics. This project gives you interpretation. The goal was to bridge the gap between raw analytical output and actionable understanding — especially useful for non-technical stakeholders who need to understand data without writing a single line of code.
                </p>
              </div>
            </div>

            {/* Visual Architecture Flowchart */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden text-left animate-fade-in">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
              
              <div className="space-y-1.5 border-l-4 border-emerald-500 pl-4">
                <h3 className="text-lg font-extrabold text-[var(--text-header)] uppercase tracking-tight">System Architecture</h3>
                <p className="text-xs text-[var(--text-muted)]">Data flow pipeline from CSV ingestion to AI-interpreted dashboard delivery</p>
              </div>

              {/* Ingest -> Auditing -> AI Narration -> Dashboard Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative pt-2 font-sans text-xs">
                {/* Node 1: Ingest */}
                <div className="bg-[var(--bg-inner)] border border-[var(--border-main)] rounded-xl p-4 flex flex-col items-center text-center space-y-2.5 relative group hover:border-emerald-500/35 transition-all">
                  <div className="bg-emerald-500/10 p-2.5 rounded-lg text-emerald-500 border border-emerald-500/20">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-[var(--text-header)] text-xs">1. File Ingest</h4>
                  <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">CSV upload processed under secure Google OAuth token authorization headers.</p>
                  
                  {/* Connection arrow */}
                  <div className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 bg-[var(--bg-card)] border border-[var(--border-main)] p-0.5 rounded-full text-emerald-500">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Node 2: Auditing Engine */}
                <div className="bg-[var(--bg-inner)] border border-[var(--border-main)] rounded-xl p-4 flex flex-col items-center text-center space-y-2.5 relative group hover:border-emerald-500/35 transition-all">
                  <div className="bg-emerald-500/10 p-2.5 rounded-lg text-emerald-500 border border-emerald-500/20">
                    <Database className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-[var(--text-header)] text-xs">2. Statistical Audit</h4>
                  <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">FastAPI computes numerical distributions, IQR/Z-score outliers, skewness, and collinearity.</p>
                  
                  {/* Connection arrow */}
                  <div className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 bg-[var(--bg-card)] border border-[var(--border-main)] p-0.5 rounded-full text-emerald-500">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Node 3: LLM & Database Sync */}
                <div className="bg-[var(--bg-inner)] border border-[var(--border-main)] rounded-xl p-4 flex flex-col items-center text-center space-y-2.5 relative group hover:border-emerald-500/35 transition-all">
                  <div className="bg-emerald-500/10 p-2.5 rounded-lg text-emerald-500 border border-emerald-500/20">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-[var(--text-header)] text-xs">3. AI Narration & Sync</h4>
                  <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">Aggregated metadata is narrated via Groq API. Metadata/reports save securely to Supabase PostgreSQL.</p>
                  
                  {/* Connection arrow */}
                  <div className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 bg-[var(--bg-card)] border border-[var(--border-main)] p-0.5 rounded-full text-emerald-500">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Node 4: Dashboard & Export */}
                <div className="bg-[var(--bg-inner)] border border-[var(--border-main)] rounded-xl p-4 flex flex-col items-center text-center space-y-2.5 group hover:border-emerald-500/35 transition-all">
                  <div className="bg-emerald-500/10 p-2.5 rounded-lg text-emerald-500 border border-emerald-500/20">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-[var(--text-header)] text-xs">4. Interactive Audit</h4>
                  <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">Vite frontend displays Plotly charts, AI summaries, history list, and exports to PDF.</p>
                </div>
              </div>
            </div>

            {/* FAQ section */}
            <div className="space-y-6 text-left">
              <div className="space-y-1.5 border-l-4 border-emerald-500 pl-4">
                <h2 className="text-xl md:text-2xl font-black text-[var(--text-header)] uppercase tracking-tight">Frequently Asked Questions</h2>
                <p className="text-xs text-[var(--text-muted)]">Common questions regarding analytical methodologies, AI safety, and platform capabilities</p>
              </div>

              <div className="space-y-4">
                <Accordion 
                  question="How does DataLens differ from traditional statistical profiling tools?"
                  answer="Standard profiles (like Pandas Profiling or SweetViz) output raw statistics without context. DataLens bridges this gap by interpreting findings in plain English — for example, explaining how two highly correlated columns cause multicollinearity risk, or suggesting transformation tactics for highly skewed variables."
                />
                
                <Accordion 
                  question="Is DataLens just an AI wrapper, or is there offline computation?"
                  answer="The AI is used only for narration. The heavy lifting is done entirely by a localized Python auditing engine that calculates skewness, kurtosis, Z-score thresholds, IQR outliers, and Pearson correlation matrices before passing structured statistics to the model."
                />

                <Accordion 
                  question="Is my dataset secure?"
                  answer="Yes. Your raw dataset is processed locally inside the FastAPI container and is never sent to the LLM. Only aggregated, privacy-compliant statistical summaries (e.g. outlier counts, correlation coefficients) are sent to the model for interpretation."
                />

                <Accordion 
                  question="Who is the primary audience for this platform?"
                  answer="It is designed for data analysts, product managers, and decision-makers who need to perform quick, first-pass audits on new datasets or share clear, jargon-free reports with non-technical business stakeholders."
                />

                <Accordion 
                  question="How does the platform prevent AI hallucinations of data insights?"
                  answer="Since the LLM only receives pre-calculated numerical aggregates rather than raw data, it is constrained to report on verified facts. Prompt rules strictly enforce that the model only narrates calculated metrics, preventing it from inventing insights."
                />

                <Accordion 
                  question="Why should I use DataLens instead of uploading a CSV to general AI chat?"
                  answer="General AI chats suffer from token size limits, lack persistent history database storage, and produce random layouts. DataLens enforces a reproducible pipeline, persists results to Supabase, and outputs structured, downloadable PDF report sheets."
                />

                <Accordion 
                  question="What language models power the natural language narration?"
                  answer="The platform is model-agnostic, currently configured to use Groq API endpoints. Swap-out configurations permit easy routing to Gemini, OpenAI, or local Llama models with minimal code adjustments."
                />
              </div>
            </div>
          </div>
        )}
      </main>



      {/* 4. Google Login Modal Overlay */}
      {showLoginModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-8 text-center max-w-sm w-full relative shadow-2xl space-y-6 animate-fade-in">
            
            {/* Close button */}
            <button 
              onClick={() => { setShowLoginModal(false); setAuthReason(""); }}
              className="absolute top-4 right-4 p-1.5 rounded-lg border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex justify-center">
              <div className="bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-500/20 text-emerald-500 pulse-glow">
                <Lock className="w-6 h-6" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-[var(--text-header)]">Sign In to DataLens</h2>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {authReason || "Please authenticate to access full dataset analysis features."}
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-lg border border-red-500/25 bg-red-500/5 text-red-500 text-xs">
                {authError}
              </div>
            )}

            <div className="flex flex-col items-center justify-center pt-2">
              {/* Google Sign-in Placeholder container */}
              <div id="google-signin-btn" className="w-full flex justify-center h-[40px]"></div>
            </div>
          </div>
        </div>
      )}

      {/* 5. History Modal Overlay */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-6 max-w-xl w-full relative shadow-2xl space-y-5 flex flex-col max-h-[85vh] animate-fade-in">
            
            {/* Close button */}
            <button 
              onClick={() => setShowHistoryModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 border-b border-[var(--border-main)] pb-3">
              <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 text-emerald-500">
                <History className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-extrabold text-[var(--text-header)]">Analysis History</h2>
                <p className="text-xs text-[var(--text-muted)]">Select a past dataset audit to reload details</p>
              </div>
            </div>

            {/* List of past analyses */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
                  <span className="text-xs text-[var(--text-muted)] font-semibold">Loading history reports...</span>
                </div>
              ) : historyList.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <Database className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-40 animate-pulse" />
                  <p className="text-xs text-[var(--text-muted)]">No historical audits found. Start by running an analysis!</p>
                </div>
              ) : (
                historyList.map((item, idx) => (
                  <div 
                    key={idx}
                    onClick={() => loadHistoryItem(item.id)}
                    className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-main)] hover:border-emerald-500/40 bg-[var(--bg-inner)] hover:bg-[var(--bg-card-hover)]/30 transition-all cursor-pointer group text-left"
                  >
                    <div className="space-y-1.5 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="font-bold text-xs md:text-sm text-[var(--text-header)] truncate block">{item.filename}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-mono">
                        <span>{item.row_count.toLocaleString()} rows</span>
                        <span>•</span>
                        <span>{item.col_count} cols</span>
                        <span>•</span>
                        <span className={item.missing_pct > 0 ? "text-amber-500 font-semibold" : "text-emerald-500"}>
                          {item.missing_pct.toFixed(1)}% nulls
                        </span>
                        <span>•</span>
                        <span className={item.outlier_pct > 0 ? "text-red-500 font-semibold" : "text-emerald-500"}>
                          {item.outlier_pct.toFixed(1)}% outliers
                        </span>
                      </div>
                      
                      <span className="text-[10px] text-[var(--text-muted)] block pt-0.5">
                        Analyzed on: {new Date(item.upload_time).toLocaleString()}
                      </span>
                    </div>

                    <button
                      onClick={(e) => deleteHistoryItem(e, item.id)}
                      className="p-2 rounded-lg border border-[var(--border-main)] hover:border-red-500/30 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors cursor-pointer shrink-0"
                      title="Delete Report"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
