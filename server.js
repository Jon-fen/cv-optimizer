// Configuración básica
const express = require('express');
const multer = require('multer');
const { Anthropic } = require('@anthropic-ai/sdk');
const pdfParse = require('pdf-parse');
const pdf = require('html-pdf');
const docx = require('docx');
const { Document, Paragraph, TextRun, HeadingLevel } = docx;
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
require('dotenv').config({ path: '.env.local' });

console.log('Iniciando servidor...');
console.log('Variables de entorno disponibles:', Object.keys(process.env));
console.log('¿ANTHROPIC_API_KEY está definida?:', !!process.env.ANTHROPIC_API_KEY);
console.log('Longitud de ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0);

const app = express();

// Configuración de middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Lista de sistemas ATS comunes
const DEFAULT_ATS_SYSTEMS = [
  "Workday",
  "Greenhouse",
  "Lever",
  "iCIMS",
  "Jobvite",
  "Taleo"
].join(", ");

// Prompts en diferentes idiomas
const PROMPTS = {
  es: {
    system: "Eres una IA especializada en análisis y optimización de CVs. Tu tarea es analizar currículums, proporcionar sugerencias detalladas para mejorarlos, considerar la compatibilidad con sistemas ATS específicos y generar informes completos. Debes adaptar tus recomendaciones según los sistemas ATS seleccionados y, si está disponible, la descripción del trabajo.",
    user: `Analiza este CV y proporciona un informe detallado siguiendo esta estructura:

1. Procesamiento de entrada:
<CV_TEXT>
{cvText}
</CV_TEXT>

<ATS_SYSTEMS>
{atsSystems}
</ATS_SYSTEMS>

{jobDescriptionSection}

2. Genera un informe detallado con:
a) Resumen Ejecutivo
   - Evaluación general del CV
   - Compatibilidad específica con cada sistema ATS seleccionado
   {jobMatchSection}

b) Análisis de Contenido
   - Palabras clave relevantes
   - Logros y métricas
   - Habilidades destacadas
   {jobSkillsSection}

c) Análisis de Estructura y Formato
   - Compatibilidad con ATS
   - Formato y legibilidad
   - Problemas específicos por sistema ATS

d) Análisis de Compatibilidad ATS
   [Para cada sistema ATS seleccionado:]
   - Problemas específicos
   - Recomendaciones particulares
   - Tasa de compatibilidad estimada

e) Mejoras Sugeridas
   [Organizadas por sistema ATS y prioridad]

Para cada sugerencia, categoriza como:
- Crítico (debe implementarse)
- Importante (muy recomendado)
- Menor (mejoras opcionales)

Incluye el porcentaje de impacto estimado para cada sugerencia.

3. Puntuación:
- Puntuación inicial del CV (0-100, donde 100 es la máxima puntuación posible)
- Puntuación proyectada después de las mejoras (0-100)
- Desglose de puntuación por sistema ATS
- Explicación de los criterios de puntuación

Por favor, proporciona tu análisis en este formato:

<analysis_report>
[Tu informe detallado aquí]
</analysis_report>

<initial_score>
[Puntuación inicial del CV, número entre 0 y 100]
</initial_score>

<projected_score>
[Puntuación proyectada del CV después de las mejoras, número entre 0 y 100]
</projected_score>`
  },
  en: {
    system: "You are an advanced CV analysis and optimization AI. Your task is to analyze CVs, provide detailed suggestions for improvement, consider compatibility with specific ATS systems, and generate comprehensive reports. You must adapt your recommendations based on the selected ATS systems and, if available, the job description.",
    user: `Analyze this CV and provide a detailed report following this structure:

1. Input Processing:
<CV_TEXT>
{cvText}
</CV_TEXT>

<ATS_SYSTEMS>
{atsSystems}
</ATS_SYSTEMS>

{jobDescriptionSection}

2. Generate a detailed report with:
a) Executive Summary
   - Overall CV assessment
   - Specific compatibility with each selected ATS system
   {jobMatchSection}

b) Content Analysis
   - Relevant keywords
   - Achievements and metrics
   - Highlighted skills
   {jobSkillsSection}

c) Structure and Formatting Analysis
   - ATS compatibility
   - Format and readability
   - ATS-specific issues

d) ATS Compatibility Analysis
   [For each selected ATS system:]
   - Specific issues
   - Particular recommendations
   - Estimated compatibility rate

e) Suggested Improvements
   [Organized by ATS system and priority]

For each suggestion, categorize as:
- Critical (must be implemented)
- Important (strongly recommended)
- Minor (optional enhancements)

Include estimated impact percentage for each suggestion.

3. Scoring:
- Initial CV score (0-100, where 100 is the highest possible score)
- Projected score after improvements (0-100)
- Score breakdown by ATS system
- Explanation of scoring criteria

Please provide your analysis in this format:

<analysis_report>
[Your detailed report here]
</analysis_report>

<initial_score>
[Initial CV score, number between 0 and 100]
</initial_score>

<projected_score>
[Projected CV score after improvements, number between 0 and 100]
</projected_score>`
  }
};

// Verificar API key al inicio
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('⚠️ ANTHROPIC_API_KEY no está configurada en las variables de entorno');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Ruta para analizar CV
app.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    console.log('Nueva solicitud de análisis recibida');
    console.log('API Key disponible:', !!process.env.ANTHROPIC_API_KEY);

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('API key no configurada. Por favor, contacta al administrador.');
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo' });
    }

    const file = req.file;
    const language = req.body.language || 'es';
    const atsSystems = JSON.parse(req.body.atsSystems || '[]');
    const jobDescription = req.body.jobDescription;

    if (!file.buffer) {
      return res.status(400).json({ error: 'El archivo está vacío' });
    }

    // Verificar el tipo de archivo
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Por favor, sube un archivo PDF' });
    }

    // Verificar el tamaño del archivo (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'El archivo excede el tamaño máximo permitido (5MB)' });
    }

    try {
      const data = await pdfParse(file.buffer);
      const text = data.text;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: 'No se pudo extraer texto del PDF' });
      }

      let prompt = PROMPTS[language] || PROMPTS.es;

      // Obtener sistemas ATS seleccionados
      let atsSystemsList;
      try {
        atsSystemsList = JSON.parse(req.body.atsSystems || '[]');
        if (!Array.isArray(atsSystemsList) || atsSystemsList.length === 0) {
          return res.status(400).json({ error: 'Debes seleccionar al menos un sistema ATS' });
        }
      } catch (e) {
        return res.status(400).json({ error: 'Formato inválido de sistemas ATS' });
      }

      // Preparar secciones condicionales del prompt
      let jobDescriptionSection = '';
      let jobMatchSection = '';
      let jobSkillsSection = '';

      if (req.body.jobDescription) {
        jobDescriptionSection = `
<JOB_DESCRIPTION>
${req.body.jobDescription}
</JOB_DESCRIPTION>`;
        
        jobMatchSection = `
   - Coincidencia con la descripción del trabajo
   - Palabras clave faltantes del trabajo`;
        
        jobSkillsSection = `
   - Alineación con requisitos del trabajo
   - Habilidades requeridas vs. presentadas`;
      }

      prompt = prompt.user
        .replace('{cvText}', text)
        .replace('{atsSystems}', atsSystemsList.join(", "))
        .replace('{jobDescriptionSection}', jobDescriptionSection)
        .replace('{jobMatchSection}', jobMatchSection)
        .replace('{jobSkillsSection}', jobSkillsSection);

      const message = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 4096,
        system: prompt.system,
        messages: [{
          role: "user",
          content: prompt
        }]
      });

      if (!message || !message.content) {
        throw new Error('No se recibió una respuesta válida del análisis');
      }

      // Extraer las diferentes secciones del análisis
      const content = message.content[0].text;
      console.log('Contenido recibido:', content.substring(0, 200) + '...'); // Log para debug

      // Expresiones regulares mejoradas con flags multiline
      const analysisMatch = content.match(/<analysis_report>([\s\S]*?)<\/analysis_report>/m);
      const initialMatch = content.match(/<initial_score>([\s\S]*?)<\/initial_score>/m);
      const projectedMatch = content.match(/<projected_score>([\s\S]*?)<\/projected_score>/m);

      if (!analysisMatch) {
        console.error('No se encontró la sección de análisis en la respuesta');
        throw new Error('Formato de respuesta inválido: falta el análisis');
      }

      const analysisReport = analysisMatch[1].trim();
      const initialScore = initialMatch ? parseFloat(initialMatch[1]) : 0;
      const projectedScore = projectedMatch ? parseFloat(projectedMatch[1]) : 0;

      console.log('Análisis extraído:', analysisReport.substring(0, 100) + '...');
      console.log('Puntuaciones:', { inicial: initialScore, proyectada: projectedScore });

      if (!analysisReport) {
        throw new Error('El análisis está vacío');
      }

      res.json({
        analysis: {
          report: analysisReport,
          initialScore: initialScore,
          projectedScore: projectedScore,
          atsSystems: atsSystemsList
        }
      });
    } catch (error) {
      console.error('Error al procesar el archivo:', error);
      res.status(500).json({ 
        error: 'Error al procesar el archivo',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).json({ 
      error: 'Error en el servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Ruta para exportar a PDF
app.post('/export-pdf', express.json(), async (req, res) => {
  try {
    const { analysis, scores, fileName } = req.body;
    
    // Crear el contenido HTML para el PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 30px; }
          .scores { display: flex; justify-content: space-around; margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
          .score { text-align: center; }
          .score-value { font-size: 24px; font-weight: bold; }
          .score-label { font-size: 14px; color: #666; }
          .analysis { margin-top: 30px; }
          h1 { color: #2563eb; }
          h2 { color: #1e40af; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Análisis de CV</h1>
          <p>Generado por Analyze This!</p>
        </div>
        
        <div class="scores">
          <div class="score">
            <div class="score-label">Puntuación Actual</div>
            <div class="score-value">${scores.initial}/100</div>
          </div>
          <div class="score">
            <div class="score-label">Puntuación Proyectada</div>
            <div class="score-value">${scores.projected}/100</div>
          </div>
        </div>

        <div class="analysis">
          ${analysis}
        </div>
      </body>
      </html>
    `;

    // Generar PDF
    pdf.create(htmlContent, {
      format: 'Letter',
      border: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      header: {
        height: '15mm',
        contents: '<div style="text-align: center; font-size: 10px;">Análisis generado por Analyze This!</div>'
      },
      footer: {
        height: '15mm',
        contents: {
          default: '<div style="text-align: center; font-size: 10px;">Página {{page}} de {{pages}}</div>'
        }
      }
    }).toBuffer((err, buffer) => {
      if (err) {
        console.error('Error al generar PDF:', err);
        return res.status(500).json({ error: 'Error al generar el PDF' });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
      res.send(buffer);
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al generar el PDF' });
  }
});

// Ruta para exportar a Word
app.post('/export-word', express.json(), async (req, res) => {
  try {
    const { analysis, scores, fileName } = req.body;
    
    // Crear documento Word
    const doc = new docx.Document({
      sections: [{
        properties: {},
        children: [
          new docx.Paragraph({
            text: "Análisis de CV",
            heading: docx.HeadingLevel.TITLE,
            spacing: { before: 300, after: 300 }
          }),
          
          new docx.Paragraph({
            text: "Generado por Analyze This!",
            spacing: { before: 300, after: 300 }
          }),
          
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: `Puntuación Actual: ${scores.initial}/100`,
                bold: true
              })
            ],
            spacing: { before: 300, after: 100 }
          }),
          
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: `Puntuación Proyectada: ${scores.projected}/100`,
                bold: true
              })
            ],
            spacing: { before: 100, after: 300 }
          }),
          
          new docx.Paragraph({
            text: "Análisis Detallado",
            heading: docx.HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 300 }
          }),
          
          new docx.Paragraph({
            text: analysis,
            spacing: { before: 200, after: 200 }
          })
        ]
      }]
    });

    // Generar el archivo
    const buffer = await docx.Packer.toBuffer(doc);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.docx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al generar el documento Word' });
  }
});

// Función auxiliar para convertir HTML a texto plano
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
  console.log('API Key configurada:', process.env.ANTHROPIC_API_KEY ? 'Sí' : 'No');
});
