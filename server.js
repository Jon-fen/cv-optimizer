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

// Sistemas ATS por defecto
const defaultSystems = [
    "Workday",
    "Greenhouse",
    "Lever",
    "iCIMS",
    "Jobvite",
    "Taleo",
    "LinkedIn",
    "Trabajando.com",
    "Laborum.com",
    "SAP SuccessFactors",
    "JazzHR",
    "BambooHR",
    "Recruitee",
    "GetOnBoard"
];

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

// Función para generar el prompt
function generatePrompt(text, selectedSystems = [], jobDescription = null) {
    const allSystems = [...new Set([...selectedSystems, ...defaultSystems])];
    
    let prompt = `Analiza este CV para compatibilidad con sistemas ATS (${allSystems.join(', ')}). 

CV:
${text}
`;

    if (jobDescription) {
        prompt += `
Descripción del trabajo:
${jobDescription}

Por favor, considera la descripción del trabajo al analizar el CV y destaca:
1. Coincidencias entre las palabras clave del trabajo y el CV
2. Habilidades requeridas que están presentes en el CV
3. Habilidades o requisitos faltantes
`;
    }

    prompt += `
Instrucciones:
1. Analiza la compatibilidad con los sistemas ATS mencionados
2. Evalúa estructura, palabras clave, formato y contenido
3. Asigna una puntuación inicial (0-100)
4. Proporciona recomendaciones específicas y accionables
5. Calcula una puntuación proyectada después de aplicar las mejoras

Formato de respuesta:
<analysis_report>
[Tu análisis detallado aquí, usando ✅ para aspectos positivos, ⚠️ para mejoras sugeridas, y ❌ para problemas críticos]
</analysis_report>

<initial_score>
[Puntuación inicial del CV, número entre 0 y 100]
</initial_score>

<projected_score>
[Puntuación proyectada del CV después de las mejoras, número entre 0 y 100]
</projected_score>`;

    return prompt;
}

// Ruta para servir el archivo CSS
app.get('/styles.css', (req, res) => {
    res.type('text/css').send(`
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.8;
            color: #333;
            background-color: #f0f2f5;
            background-image: 
                radial-gradient(#e2e8f0 1px, transparent 1px),
                radial-gradient(#e2e8f0 1px, transparent 1px);
            background-size: 20px 20px;
            background-position: 0 0, 10px 10px;
            position: relative;
        }
        body::before {
            content: "";
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            backdrop-filter: blur(1px);
            z-index: -1;
        }
        .container {
            max-width: 800px;
            margin: 40px auto;
            padding: 40px;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
            color: #2563eb;
        }
        .scores {
            display: flex;
            justify-content: space-around;
            margin: 30px 0;
            padding: 20px;
            background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
            border-radius: 12px;
            box-shadow: inset 0 2px 4px 0 rgba(0,0,0,0.06);
        }
        .score {
            text-align: center;
            padding: 20px;
            transition: transform 0.2s;
        }
        .score:hover {
            transform: translateY(-2px);
        }
        .score-value {
            font-size: 32px;
            font-weight: bold;
            background: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }
        .score-label {
            font-size: 14px;
            color: #666;
            margin-top: 8px;
        }
        .analysis {
            margin-top: 40px;
            line-height: 1.8;
        }
        .analysis-line {
            margin: 20px 0;
            padding: 15px;
            border-radius: 8px;
            background: #f8fafc;
            transition: all 0.2s;
            box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1);
        }
        .analysis-line:hover {
            background: #f1f5f9;
            transform: translateX(5px);
        }
        .analysis-line strong {
            font-weight: 600;
            color: #1e40af;
        }
        .positive {
            color: #16a34a;
            border-left: 4px solid #16a34a;
            background: linear-gradient(to right, #dcfce7 0%, #f8fafc 100%);
        }
        .warning {
            color: #ca8a04;
            border-left: 4px solid #ca8a04;
            background: linear-gradient(to right, #fef9c3 0%, #f8fafc 100%);
        }
        .critical {
            color: #dc2626;
            border-left: 4px solid #dc2626;
            background: linear-gradient(to right, #fee2e2 0%, #f8fafc 100%);
        }
    `);
});

// Función para formatear el análisis con negritas
function formatAnalysis(text) {
    return text
        .split('\n')
        .map(line => {
            // Agregar negritas a las secciones principales
            line = line.replace(/(^[^:]+:)/, '<strong>$1</strong>');
            
            let className = '';
            if (line.includes('✅')) className = 'positive';
            if (line.includes('⚠️')) className = 'warning';
            if (line.includes('❌')) className = 'critical';
            
            // Agregar saltos de línea HTML
            return `<div class="analysis-line ${className}">${line}</div>`;
        })
        .join('\n');
}

// Ruta para exportar a PDF
app.post(['/export-pdf', '/api/export-pdf'], express.json(), async (req, res) => {
    try {
        const { analysis, scores } = req.body;
        const puppeteer = require('puppeteer-core');
        const chrome = require('@sparticuz/chromium');
        
        const browser = await puppeteer.launch({
            args: chrome.args,
            defaultViewport: chrome.defaultViewport,
            executablePath: await chrome.executablePath(),
            headless: true,
        });
        
        const page = await browser.newPage();
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { 
                        font-family: Arial, sans-serif;
                        line-height: 1.8;
                        color: #333;
                        padding: 40px;
                        background-color: #f8fafc;
                    }
                    .container {
                        background: white;
                        padding: 40px;
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 40px;
                        padding-bottom: 20px;
                        border-bottom: 2px solid #f0f0f0;
                        color: #2563eb;
                    }
                    .scores {
                        display: flex;
                        justify-content: space-around;
                        margin: 30px 0;
                        padding: 20px;
                        background: #f8f9fa;
                        border-radius: 12px;
                    }
                    .score {
                        text-align: center;
                        padding: 20px;
                    }
                    .score-value {
                        font-size: 32px;
                        font-weight: bold;
                        color: #4f46e5;
                    }
                    .score-label {
                        font-size: 14px;
                        color: #666;
                    }
                    .analysis {
                        margin-top: 40px;
                    }
                    .analysis-line {
                        margin: 15px 0;
                        padding: 15px;
                        border-radius: 8px;
                        background: #f8fafc;
                    }
                    .positive { 
                        color: #16a34a; 
                        border-left: 4px solid #16a34a;
                        background: #dcfce7;
                    }
                    .warning { 
                        color: #ca8a04; 
                        border-left: 4px solid #ca8a04;
                        background: #fef9c3;
                    }
                    .critical { 
                        color: #dc2626; 
                        border-left: 4px solid #dc2626;
                        background: #fee2e2;
                    }
                    strong {
                        font-weight: 600;
                        color: #1e40af;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Análisis de CV</h1>
                        <p>Generado por CV Optimizer</p>
                    </div>
                    
                    <div class="scores">
                        <div class="score">
                            <div class="score-label">Puntuación Actual:</div>
                            <div class="score-value">${scores.initial}/100</div>
                        </div>
                        <div class="score">
                            <div class="score-label">Puntuación Proyectada:</div>
                            <div class="score-value">${scores.projected}/100</div>
                        </div>
                    </div>

                    <div class="analysis">
                        ${formatAnalysis(analysis)}
                    </div>
                </div>
            </body>
            </html>
        `;

        await page.setContent(htmlContent);
        const pdf = await page.pdf({
            format: 'A4',
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            }
        });

        await browser.close();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=analisis-cv.pdf');
        res.send(pdf);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al generar el PDF' });
    }
});

// Ruta para exportar a Word
app.post(['/export-word', '/api/export-word'], express.json(), async (req, res) => {
    try {
        const { analysis, scores } = req.body;
        
        const doc = new docx.Document({
            sections: [{
                properties: {},
                children: [
                    new docx.Paragraph({
                        text: "Análisis de CV",
                        heading: docx.HeadingLevel.TITLE,
                        spacing: { before: 300, after: 300 },
                        alignment: docx.AlignmentType.CENTER
                    }),
                    
                    new docx.Paragraph({
                        text: "Generado por CV Optimizer",
                        alignment: docx.AlignmentType.CENTER,
                        spacing: { before: 100, after: 400 }
                    }),
                    
                    new docx.Table({
                        width: {
                            size: 100,
                            type: docx.WidthType.PERCENTAGE,
                        },
                        rows: [
                            new docx.TableRow({
                                children: [
                                    new docx.TableCell({
                                        children: [new docx.Paragraph("Puntuación Actual")],
                                        width: { size: 50, type: docx.WidthType.PERCENTAGE }
                                    }),
                                    new docx.TableCell({
                                        children: [new docx.Paragraph("Puntuación Proyectada")],
                                        width: { size: 50, type: docx.WidthType.PERCENTAGE }
                                    })
                                ]
                            }),
                            new docx.TableRow({
                                children: [
                                    new docx.TableCell({
                                        children: [new docx.Paragraph(`${scores.initial}/100`)],
                                        width: { size: 50, type: docx.WidthType.PERCENTAGE }
                                    }),
                                    new docx.TableCell({
                                        children: [new docx.Paragraph(`${scores.projected}/100`)],
                                        width: { size: 50, type: docx.WidthType.PERCENTAGE }
                                    })
                                ]
                            })
                        ]
                    }),
                    
                    new docx.Paragraph({
                        text: "Análisis Detallado",
                        heading: docx.HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 }
                    }),
                    
                    ...analysis.split('\n').filter(line => line.trim()).map(line => {
                        let textColor = "000000"; // Negro por defecto
                        if (line.includes('✅')) textColor = '228B22'; // Verde oscuro
                        if (line.includes('⚠️')) textColor = 'FFA500'; // Naranja
                        if (line.includes('❌')) textColor = 'DC143C'; // Rojo

                        // Hacer el título en negrita
                        const parts = line.split(':');
                        if (parts.length > 1) {
                            return new docx.Paragraph({
                                children: [
                                    new docx.TextRun({
                                        text: parts[0] + ':',
                                        bold: true,
                                        color: textColor
                                    }),
                                    new docx.TextRun({
                                        text: parts.slice(1).join(':'),
                                        color: textColor
                                    })
                                ],
                                spacing: { before: 120, after: 120 }
                            });
                        }

                        return new docx.Paragraph({
                            children: [
                                new docx.TextRun({
                                    text: line.trim(),
                                    color: textColor
                                })
                            ],
                            spacing: { before: 120, after: 120 }
                        });
                    })
                ]
            }]
        });

        const buffer = await docx.Packer.toBuffer(doc);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', 'attachment; filename="analisis-cv.docx"');
        res.send(buffer);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al generar el documento Word' });
    }
});

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

        // Obtener descripción del trabajo
        const jobDescription = req.body.jobDescription;

        // Preparar análisis
        console.log(' Preparando prompt para análisis...');
        const prompt = generatePrompt(data.text, atsSystems, jobDescription);
        console.log(' Longitud del prompt:', prompt.length);

        console.log(' Enviando a Anthropic...');
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

// Función para analizar descripción de trabajo
async function analyzeJobDescription(description) {
    const prompt = `Analiza la siguiente descripción de trabajo y extrae:
1. Palabras clave importantes que los sistemas ATS buscarían
2. Habilidades técnicas requeridas
3. Habilidades blandas valoradas
4. Requisitos de experiencia
5. Certificaciones o educación requerida

Descripción:
${description}

Por favor, estructura tu respuesta en el siguiente formato:

<keywords>
[Lista de palabras clave importantes, separadas por comas]
</keywords>

<technical_skills>
[Lista de habilidades técnicas]
</technical_skills>

<soft_skills>
[Lista de habilidades blandas]
</soft_skills>

<experience>
[Requisitos de experiencia]
</experience>

<education>
[Requisitos de educación y certificaciones]
</education>`;

    const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
        messages: [{
            role: "user",
            content: prompt
        }]
    });

    return response.content[0].text;
}

// Función para comparar CV con descripción de trabajo
function compareWithJob(cvAnalysis, jobAnalysis) {
    // Extraer palabras clave del análisis del trabajo
    const jobKeywords = extractSection(jobAnalysis, 'keywords').split(',').map(k => k.trim().toLowerCase());
    
    // Extraer texto del CV
    const cvText = cvAnalysis.toLowerCase();
    
    // Encontrar coincidencias y palabras faltantes
    const matches = jobKeywords.filter(keyword => cvText.includes(keyword));
    const missing = jobKeywords.filter(keyword => !cvText.includes(keyword));
    
    return {
        matches,
        missing,
        matchRate: (matches.length / jobKeywords.length) * 100
    };
}

// Ruta para analizar descripción de trabajo
app.post(['/analyze-job', '/api/analyze-job'], express.json(), async (req, res) => {
    try {
        const { description } = req.body;
        const analysis = await analyzeJobDescription(description);
        res.json({ analysis });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al analizar la descripción del trabajo' });
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
