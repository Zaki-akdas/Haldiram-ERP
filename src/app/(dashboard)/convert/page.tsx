'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

export default function ConvertPage() {
  const { authFetch } = useAuth();
  
  const [file, setFile] = useState<File | null>(null);
  const [sourceFormat, setSourceFormat] = useState('');
  const [targetFormat, setTargetFormat] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ content: string; format: string } | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('Preview');
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-primary');
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-primary');
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-primary');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };
  
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };
  
  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setError('');
    setResult(null);
    setTargetFormat('');
    
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      setSourceFormat('PDF');
      setTargetFormat('CSV');
    } else if (ext === 'xlsx' || ext === 'xls') {
      setSourceFormat('Excel');
      setTargetFormat('CSV');
    } else if (ext === 'csv') {
      setSourceFormat('CSV');
      setTargetFormat('JSON');
    } else {
      setError('Unsupported file format. Please upload PDF, Excel, or CSV.');
      setFile(null);
      setSourceFormat('');
    }
  };
  
  const getAvailableTargets = () => {
    if (sourceFormat === 'PDF') return ['CSV', 'JSON', 'Text'];
    if (sourceFormat === 'Excel') return ['CSV', 'JSON'];
    if (sourceFormat === 'CSV') return ['JSON'];
    return [];
  };
  
  const handleConvert = async () => {
    if (!file || !targetFormat) return;
    
    setLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetFormat', targetFormat.toLowerCase());

      const res = await authFetch('/api/convert', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Conversion failed');
      }

      let contentStr = '';
      if (typeof data.result === 'object') {
        contentStr = JSON.stringify(data.result, null, 2);
      } else {
        contentStr = String(data.result);
      }

      setResult({
        content: contentStr,
        format: data.format || targetFormat
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Conversion failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const downloadResult = () => {
    if (!result) return;
    
    const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted_${file?.name || 'file'}.${result.format.toLowerCase()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.content);
    alert('Copied to clipboard!');
  };

  const renderPreview = () => {
    if (!result) return null;
    
    if (result.format === 'JSON') {
      return (
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono shadow-inner max-h-96">
          {result.content}
        </pre>
      );
    }
    
    if (result.format === 'CSV' && activeTab === 'Preview') {
      const rows = result.content.split('\n').filter((r: string) => r.trim());
      if (rows.length === 0) return <p className="text-gray-400">Empty output</p>;
      
      const headers = rows[0].split(',');
      const data = rows.slice(1).map((r: string) => r.split(','));
      
      return (
        <div className="overflow-x-auto max-h-96 border border-gray-700 rounded-lg">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-900 sticky top-0 text-gray-300">
              <tr>
                {headers.map((h: string, i: number) => (
                  <th key={i} className="p-3 font-semibold border-b border-gray-700">{h.replace(/^"|"$/g, '')}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-200">
              {data.map((row: string[], i: number) => (
                <tr key={i} className="hover:bg-slate-800/50">
                  {row.map((cell: string, j: number) => (
                    <td key={j} className="p-3">{cell.replace(/^"|"$/g, '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    return (
      <pre className="bg-slate-900 text-gray-200 p-4 rounded-lg overflow-x-auto text-sm max-h-96 whitespace-pre-wrap border border-gray-700">
        {result.content}
      </pre>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Document File Converter</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Convert between document formats (PDF, Excel, CSV)</p>
        </div>
        <button
          onClick={() => {
            setFile(null);
            setResult(null);
            setError('');
          }}
          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Converter
        </button>
      </div>

      <div 
        className="glass-card border-dashed border-2 border-gray-300 dark:border-gray-700 p-10 text-center hover:border-primary transition-colors cursor-pointer relative mb-6"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
          onChange={handleFileInput}
          accept=".pdf,.xlsx,.xls,.csv"
        />
        
        <svg className="w-16 h-16 mx-auto text-primary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
        <h3 className="text-xl font-bold mb-2">Drag & drop or click to browse file</h3>
        <p className="text-gray-500">Supported: PDF, Excel (.xlsx, .xls), CSV</p>
      </div>
      
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-900/30 text-red-300 border border-red-800 flex items-start">
          <svg className="w-5 h-5 mr-2 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {error}
        </div>
      )}

      {file && (
        <div className="glass-card p-6 mb-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold">
                {sourceFormat}
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-xs">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm font-medium">To:</span>
                <select 
                  className="bg-slate-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm outline-none min-w-[120px]"
                  value={targetFormat}
                  onChange={(e) => setTargetFormat(e.target.value)}
                >
                  <option value="" disabled>Select...</option>
                  {getAvailableTargets().map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              
              <button 
                className="btn-primary py-2 px-6 flex items-center gap-2"
                onClick={handleConvert}
                disabled={!targetFormat || loading}
              >
                {loading ? 'Converting...' : 'Convert File'}
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="glass-card overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="border-b border-gray-700 px-6 py-4 flex justify-between items-center bg-slate-900/60">
            <div className="flex gap-4">
              <button 
                className={`font-medium pb-1 ${activeTab === 'Preview' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
                onClick={() => setActiveTab('Preview')}
              >
                Preview
              </button>
              <button 
                className={`font-medium pb-1 ${activeTab === 'Raw' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
                onClick={() => setActiveTab('Raw')}
              >
                Raw Text
              </button>
            </div>
            
            <div className="flex gap-2">
              <button onClick={copyToClipboard} className="p-2 text-gray-400 hover:text-primary transition-colors" title="Copy to clipboard">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              </button>
              <button onClick={downloadResult} className="p-2 text-gray-400 hover:text-primary transition-colors" title="Download">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              </button>
            </div>
          </div>
          <div className="p-6">
            {renderPreview()}
          </div>
        </div>
      )}
    </div>
  );
}
