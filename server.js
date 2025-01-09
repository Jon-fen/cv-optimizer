const express = require('express');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const pdfParse = require('pdf-parse');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const app = express();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Verificar API key al inicio
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY no está configurada en el archivo .env.local');
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.use(express.static('public'));

app.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    console.log('Recibiendo archivo...');
    
    if (!req.file) {
      console.error('No se recibió ningún archivo');
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    console.log('Archivo recibido:', req.file.originalname, 'Tamaño:', req.file.size);

    let pdfData;
    try {
      console.log('Procesando PDF...');
      pdfData = await pdfParse(req.file.buffer);
      console.log('PDF procesado. Longitud del texto:', pdfData.text.length);
    } catch (pdfError) {
      console.error('Error al procesar el PDF:', pdfError);
      return res.status(400).json({ error: 'Error al procesar el archivo PDF. Asegúrate de que sea un PDF válido.' });
    }
    
    if (!pdfData || !pdfData.text) {
      console.error('No se pudo extraer texto del PDF');
      return res.status(400).json({ error: 'No se pudo extraer texto del archivo PDF' });
    }
    
    console.log('Enviando a API de Anthropic...');
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      system: "Eres un experto en optimización de currículums para sistemas ATS (Applicant Tracking System). Tu tarea es analizar CVs y proporcionar recomendaciones específicas para mejorar su compatibilidad con sistemas ATS.",
      messages: [{
        role: "user",
        content: `Analiza este CV y proporciona recomendaciones específicas para mejorar su compatibilidad con sistemas ATS. Incluye:
1. Palabras clave faltantes o que deberían agregarse
2. Formato y estructura
3. Problemas de legibilidad para sistemas ATS
4. Sugerencias de mejora específicas

CV a analizar:
${pdfData.text}`
      }]
    });

    console.log('Respuesta recibida de Anthropic');
    
    if (!message.content || message.content.length === 0) {
      console.error('La API no devolvió contenido');
      throw new Error('No se recibió respuesta del análisis');
    }

    res.json({ analysis: message.content[0].text });
  } catch (error) {
    console.error('Error detallado:', error);
    
    // Manejo específico de errores comunes
    if (error.status === 401) {
      return res.status(401).json({ 
        error: 'Error de autenticación con la API. Verifica tu API key.'
      });
    }
    
    if (error.status === 429) {
      return res.status(429).json({ 
        error: 'Se ha excedido el límite de la API. Intenta nuevamente más tarde.'
      });
    }

    // Error general
    res.status(500).json({ 
      error: 'Error al procesar el archivo: ' + (error.message || 'Error desconocido'),
      details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
    });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log('API Key configurada:', process.env.ANTHROPIC_API_KEY ? 'Sí' : 'No');
});
