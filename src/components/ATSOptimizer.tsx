import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader, Upload } from 'lucide-react';

export default function ATSOptimizer() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const analyzePDF = async (file) => {
    try {
      setIsAnalyzing(true);
      setError('');
      
      // Crear FormData y añadir el archivo
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/analyze-cv', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Error al analizar el CV');
      }

      const data = await response.json();
      setResult(data.analysis);
    } catch (err) {
      console.error('Error:', err);
      setError('Error al procesar el archivo. Por favor, intenta de nuevo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (file.type !== 'application/pdf') {
      setError('Por favor, sube un archivo PDF.');
      return;
    }

    // Validar tamaño (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo es demasiado grande. Máximo 10MB.');
      return;
    }

    await analyzePDF(file);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Optimizador de CV para ATS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Área de carga */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
          <div className="flex flex-col items-center">
            <input
              type="file"
              id="cv-upload"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="cv-upload"
              className="flex flex-col items-center cursor-pointer"
            >
              <Upload className="w-12 h-12 text-gray-400 mb-4" />
              <span className="text-lg font-medium text-gray-600">
                Sube tu CV en PDF
              </span>
              <span className="text-sm text-gray-500 mt-2">
                Máximo 10MB
              </span>
            </label>
          </div>
        </div>

        {/* Estado de carga */}
        {isAnalyzing && (
          <div className="flex items-center justify-center space-x-2">
            <Loader className="w-5 h-5 animate-spin" />
            <span>Analizando CV...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Resultados */}
        {result && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Análisis del CV</h3>
            <div className="prose max-w-none">
              {result}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}