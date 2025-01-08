import React, { useState } from 'react';
import { Upload } from 'lucide-react';

const ATSOptimizer = () => {
  const [cvContent, setCvContent] = useState('');
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

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Optimizador de CV para ATS</h1>
      
      <div className="space-y-6">
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
            <Upload className="inline-block mr-2" />
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
      </div>
    </div>
  );
};

export default ATSOptimizer;