import React, { useState } from 'react';

export default function ATSOptimizer() {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setError('');
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/analyze-cv', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Error al procesar el CV');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (err) {
      setError('Error al analizar el CV. Por favor intenta de nuevo.');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-center mb-8">
        Optimizador de CV para ATS
      </h1>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileUpload}
          className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {isLoading && (
        <div className="text-center">
          Analizando CV...
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {analysis && (
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Análisis del CV</h2>
          <div className="whitespace-pre-wrap">
            {analysis}
          </div>
        </div>
      )}
    </div>
  );
}