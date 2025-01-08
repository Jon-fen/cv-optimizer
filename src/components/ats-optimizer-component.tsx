import React, { useState } from 'react';
import { Upload, FileText, BookOpen, AlertTriangle, Save, Download, History, Building } from 'lucide-react';

const ATSOptimizer = () => {
  const [cvContent, setCvContent] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [selectedATS, setSelectedATS] = useState('workday');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      setCvContent(text);
    } catch (error) {
      console.error('Error reading file:', error);
    }
    setLoading(false);
  };

  const analyzeCV = async () => {
    if (!cvContent) return;

    setLoading(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvContent,
          jobDescription,
          atsSystem: selectedATS,
        }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const result = await response.json();
      setAnalysis(result);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Optimizador de CV para ATS</h1>
      
      <div className="space-y-6">
        {/* File Upload Section */}
        <div className="border-2 border-dashed rounded-lg p-6">
          <input
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            id="cv-upload"
            accept=".doc,.docx,.pdf,.txt"
          />
          <label
            htmlFor="cv-upload"
            className="cursor-pointer text-blue-600 hover:text-blue-800"
          >
            Subir CV
          </label>
          {loading && <p className="mt-2">Cargando...</p>}
          {cvContent && (
            <div className="mt-4">
              <p className="font-medium">Contenido detectado:</p>
              <p className="text-sm text-gray-600 mt-2">
                {cvContent.slice(0, 200)}...
              </p>
            </div>
          )}
        </div>

        {/* ATS Selection */}
        <div className="space-y-2">
          <label className="block font-medium">Sistema ATS</label>
          <select
            value={selectedATS}
            onChange={(e) => setSelectedATS(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="workday">Workday</option>
            <option value="greenhouse">Greenhouse</option>
            <option value="lever">Lever</option>
            <option value="bamboohr">BambooHR</option>
          </select>
        </div>

        {/* Job Description */}
        <div className="space-y-2">
          <label className="block font-medium">Descripción del Trabajo</label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="w-full h-32 p-2 border rounded"
            placeholder="Pega aquí la descripción del trabajo..."
          />
        </div>

        <button
          onClick={analyzeCV}
          disabled={!cvContent || loading}
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Analizando...' : 'Analizar CV'}
        </button>

        {/* Analysis Results */}
        {analysis && (
          <div className="mt-6 p-4 border rounded">
            <h2 className="text-xl font-bold mb-4">Resultados del Análisis</h2>
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(analysis, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ATSOptimizer;