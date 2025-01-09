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

console.log(' Iniciando servidor...');
console.log(' Configuración:', {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'Configurada' : 'No configurada'
});

// Función para sanitizar la API key
function sanitizeApiKey(key) {
    if (!key || typeof key !== 'string') return null;
    // Remover espacios y caracteres no válidos
    key = key.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    // Verificar formato correcto
    if (!key.startsWith('sk-ant')) return null;
    return key;
}

const app = express();

// Configuración de middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para logging
app.use((req, res, next) => {
    console.log(` ${req.method} ${req.path}`);
    console.log(' Headers:', JSON.stringify(req.headers, null, 2));
    next();
});

// Servir archivos estáticos solo si no estamos en Vercel
if (process.env.VERCEL !== '1') {
    app.use(express.static('public'));
}

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

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

// Ruta para analizar CV
app.post(['/analyze', '/api/analyze', '/api/analyze-cv'], upload.single('file'), async (req, res) => {
    console.log('\n Nueva solicitud de análisis recibida');
    
    try {
        // Verificar y sanitizar API key
        const apiKey = sanitizeApiKey(process.env.ANTHROPIC_API_KEY);
        if (!apiKey) {
            console.error(' API key no válida');
            return res.status(500).json({
                error: 'Error de configuración - API key no válida'
            });
        }

        console.log(' API key verificada');

        // Crear cliente Anthropic con configuración específica
        console.log(' Creando cliente Anthropic...');
        const anthropic = new Anthropic({
            apiKey,
            defaultHeaders: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey,
                'anthropic-version': '2023-06-01'
            }
        });
        console.log(' Cliente Anthropic creado');

        // Verificar archivo
        if (!req.file) {
            throw new Error('No se ha subido ningún archivo');
        }

        const file = req.file;
        console.log(' Archivo recibido:', {
            nombre: file.originalname,
            tipo: file.mimetype,
            tamaño: file.size
        });

        // Procesar PDF
        console.log(' Procesando PDF...');
        const data = await pdfParse(file.buffer);
        console.log(' PDF procesado, longitud del texto:', data.text.length);

        if (!data.text || data.text.trim().length === 0) {
            throw new Error('No se pudo extraer texto del PDF');
        }

        // Obtener sistemas ATS
        console.log(' Procesando sistemas ATS...');
        const atsSystems = JSON.parse(req.body.atsSystems || '[]');
        console.log(' Sistemas ATS seleccionados:', atsSystems);

        if (!Array.isArray(atsSystems) || atsSystems.length === 0) {
            throw new Error('Sistemas ATS no válidos');
        }

        // Preparar análisis
        console.log(' Preparando prompt para análisis...');
        const prompt = `Por favor, analiza el siguiente CV para optimizarlo para los sistemas ATS: ${atsSystems.join(", ")}.

<CV>
${data.text}
</CV>

Por favor, estructura tu respuesta en el siguiente formato detallado:

<initial_score>
[Puntuación inicial numérica de 0-100]
</initial_score>

<analysis_report>
# Resumen Ejecutivo
[Breve resumen del CV y su compatibilidad actual con ATS]

# Análisis Detallado

## Fortalezas (✓)
- [Lista de puntos fuertes]

## Áreas de Mejora (!)
- [Lista de áreas que necesitan mejora]

## Palabras Clave
- Detectadas: [Lista de palabras clave importantes encontradas]
- Faltantes: [Lista de palabras clave sugeridas para agregar]

## Formato y Estructura
- [Análisis del formato actual]
- [Problemas específicos de formato]
- [Recomendaciones de estructura]

## Recomendaciones Específicas por Sistema ATS
${atsSystems.map(ats => `
### ${ats}
- [Recomendaciones específicas para este ATS]
- [Problemas específicos detectados]
- [Mejoras sugeridas]`).join('\n')}

## Plan de Acción
1. [Paso 1 con explicación]
2. [Paso 2 con explicación]
3. [Paso 3 con explicación]

## Impacto Estimado
- [Explicación de cómo estas mejoras aumentarán la puntuación]
- [Áreas específicas donde se verá el mayor impacto]
</analysis_report>

<projected_score>
[Puntuación proyectada numérica de 0-100 después de implementar las mejoras]
</projected_score>`;

        console.log(' Enviando a Anthropic...');
        console.log(' Longitud del prompt:', prompt.length);

        const response = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 4096,
            messages: [{
                role: "user",
                content: prompt
            }],
            system: "Eres un experto en análisis de CVs y sistemas ATS (Applicant Tracking Systems). Tu objetivo es proporcionar un análisis detallado y práctico que ayude a mejorar significativamente la compatibilidad del CV con los sistemas ATS. Debes ser específico, detallado y proporcionar ejemplos concretos cuando sea posible. Usa formato Markdown para estructurar tu respuesta."
        });

        console.log(' Respuesta recibida de Anthropic');
        console.log(' Estructura de la respuesta:', {
            tieneContenido: !!response?.content,
            longitudContenido: response?.content?.[0]?.text?.length || 0
        });

        if (!response?.content?.[0]?.text) {
            throw new Error('Respuesta inválida de Anthropic');
        }

        const content = response.content[0].text;
        console.log(' Procesando respuesta...');

        // Extraer secciones
        const analysisMatch = content.match(/<analysis_report>([\s\S]*?)<\/analysis_report>/m);
        const initialMatch = content.match(/<initial_score>([\s\S]*?)<\/initial_score>/m);
        const projectedMatch = content.match(/<projected_score>([\s\S]*?)<\/projected_score>/m);

        if (!analysisMatch) {
            throw new Error('Formato de respuesta inválido');
        }

        const analysis = {
            report: analysisMatch[1].trim(),
            initialScore: initialMatch ? parseFloat(initialMatch[1]) : 0,
            projectedScore: projectedMatch ? parseFloat(projectedMatch[1]) : 0,
            atsSystems: atsSystems
        };

        console.log(' Análisis completado con éxito');
        return res.json({ analysis });

    } catch (error) {
        console.error(' Error:', error);
        console.error('Stack:', error.stack);
        
        return res.status(500).json({ 
            error: 'Error al procesar el archivo',
            details: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack
            } : undefined
        });
    }
});

// Ruta para exportar a PDF
app.post(['/export-pdf', '/api/export-pdf'], express.json(), async (req, res) => {
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
app.post(['/export-word', '/api/export-word'], express.json(), async (req, res) => {
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

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error(' Error:', err);
  
  // Si ya se envió una respuesta, no hacer nada
  if (res.headersSent) {
    return next(err);
  }

  // Enviar respuesta de error
  res.status(500).json({ 
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Ruta catch-all para manejar todas las demás rutas
app.get('*', (req, res) => {
  if (process.env.VERCEL === '1') {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
  console.log('API Key configurada:', process.env.ANTHROPIC_API_KEY ? 'Sí' : 'No');
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
