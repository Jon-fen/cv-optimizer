import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';
import { join } from 'path';
import formidable from 'formidable';
import pdfParse from 'pdf-parse';

// Configurar Anthropic
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Prompts según idioma
const PROMPTS = {
    es: {
        system: "Eres un experto en análisis de CVs y sistemas ATS (Applicant Tracking Systems). Tu tarea es analizar CVs y proporcionar retroalimentación detallada para mejorar su compatibilidad con sistemas ATS.",
        user: `Por favor, analiza el siguiente CV para los sistemas ATS: {atsSystems}.

{jobDescriptionSection}

<CV>
{cvText}
</CV>

Proporciona un análisis detallado que incluya:

1. Análisis General:
   - Formato y estructura
   - Legibilidad para ATS
   - Palabras clave importantes
   - Problemas detectados

2. Puntos Específicos:
   - Secciones faltantes o mal estructuradas
   - Formato de fechas y datos
   - Uso de tablas o elementos problemáticos{jobMatchSection}

3. Recomendaciones:
   - Mejoras específicas de formato
   - Palabras clave sugeridas{jobSkillsSection}
   - Cambios prioritarios

Por favor, estructura tu respuesta en el siguiente formato:

<initial_score>
[Puntuación inicial de 0-100]
</initial_score>

<analysis_report>
[Tu análisis detallado aquí]
</analysis_report>

<projected_score>
[Puntuación proyectada después de implementar las mejoras, de 0-100]
</projected_score>`
    }
};

export async function POST(request: Request) {
    console.log('📝 Nueva solicitud de análisis recibida');
    
    try {
        // Verificar API key
        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('❌ API key no configurada');
            return NextResponse.json(
                { error: 'Servicio no disponible - Error de configuración' },
                { status: 500 }
            );
        }

        // Obtener el formulario
        const formData = await request.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            return NextResponse.json(
                { error: 'No se ha subido ningún archivo' },
                { status: 400 }
            );
        }

        // Validar archivo
        if (file.type !== 'application/pdf') {
            return NextResponse.json(
                { error: 'Por favor, sube un archivo PDF' },
                { status: 400 }
            );
        }

        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'El archivo excede el tamaño máximo (5MB)' },
                { status: 400 }
            );
        }

        // Leer el archivo
        const buffer = Buffer.from(await file.arrayBuffer());
        const data = await pdfParse(buffer);
        const text = data.text;

        if (!text || text.trim().length === 0) {
            return NextResponse.json(
                { error: 'No se pudo extraer texto del PDF' },
                { status: 400 }
            );
        }

        // Obtener sistemas ATS
        const atsSystemsStr = formData.get('atsSystems') as string;
        let atsSystems: string[];
        try {
            atsSystems = JSON.parse(atsSystemsStr);
            if (!Array.isArray(atsSystems) || atsSystems.length === 0) {
                return NextResponse.json(
                    { error: 'Selecciona al menos un sistema ATS' },
                    { status: 400 }
                );
            }
        } catch (e) {
            return NextResponse.json(
                { error: 'Formato inválido de sistemas ATS' },
                { status: 400 }
            );
        }

        // Preparar prompt
        const language = formData.get('language') as string || 'es';
        const prompt = PROMPTS[language] || PROMPTS.es;
        
        // Preparar secciones condicionales
        const jobDescription = formData.get('jobDescription') as string || '';
        const jobDescriptionSection = jobDescription ? `
<JOB_DESCRIPTION>
${jobDescription}
</JOB_DESCRIPTION>` : '';

        const jobMatchSection = jobDescription ? `
   - Coincidencia con la descripción del trabajo
   - Palabras clave faltantes del trabajo` : '';

        const jobSkillsSection = jobDescription ? `
   - Alineación con requisitos del trabajo
   - Habilidades requeridas vs. presentadas` : '';

        // Llamar a la API de Anthropic
        console.log('🚀 Enviando a Anthropic...');
        const message = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 4096,
            messages: [{
                role: "user",
                content: prompt.user
                    .replace('{cvText}', text)
                    .replace('{atsSystems}', atsSystems.join(", "))
                    .replace('{jobDescriptionSection}', jobDescriptionSection)
                    .replace('{jobMatchSection}', jobMatchSection)
                    .replace('{jobSkillsSection}', jobSkillsSection)
            }],
            system: prompt.system
        });

        if (!message || !message.content) {
            throw new Error('No se recibió respuesta del análisis');
        }

        // Procesar respuesta
        console.log('✅ Análisis completado');
        const content = message.content[0].text;
        
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

        return NextResponse.json({ analysis });

    } catch (error) {
        console.error('❌ Error:', error);
        
        if (error.status === 401) {
            return NextResponse.json(
                { error: 'Error de autenticación con la API' },
                { status: 401 }
            );
        }
        
        if (error.status === 429) {
            return NextResponse.json(
                { error: 'Límite de API excedido' },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { 
                error: 'Error al procesar el archivo',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            },
            { status: 500 }
        );
    }
}