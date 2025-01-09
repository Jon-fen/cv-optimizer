'use client';
import React, { useState } from 'react';

export default function ATSOptimizer() {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar el tipo de archivo
    if (file.type !== 'application/pdf') {
      setError('Por favor, sube un archivo PDF');
      return;
    }

    // Validar el tamaño del archivo (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo no debe superar los 5MB');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setAnalysis(null);
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/analyze-cv', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Error al procesar el CV');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Error al procesar el archivo');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Optimizador de CV para ATS
          </h1>
          <p className="mt-3 text-lg text-gray-500">
            Sube tu CV en PDF y obtén recomendaciones para mejorar su compatibilidad con sistemas ATS
          </p>
        </div>

        <div className="mt-10">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 
                         file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 
                         hover:file:bg-blue-100 cursor-pointer"
              />
              <p className="mt-2 text-sm text-gray-500">
                PDF hasta 5MB
              </p>
            </div>

            {isLoading && (
              <div className="mt-6 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                <p className="mt-2 text-blue-600">Analizando CV...</p>
              </div>
            )}

            {error && (
              <div className="mt-6 bg-red-50 text-red-600 p-4 rounded-lg">
                {error}
              </div>
            )}

            {analysis && (
              <div className="mt-6 bg-green-50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Análisis del CV
                </h2>
                <div className="prose prose-blue max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700">
                    {analysis}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}