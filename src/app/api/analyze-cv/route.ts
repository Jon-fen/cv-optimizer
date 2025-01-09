import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import PDFParser from 'pdf-parse';

// Tamaño máximo de archivo: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY no está configurada');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export async function POST(request: NextRequest) {
  try {
    console.log('Iniciando procesamiento...');
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
   
    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'El archivo excede el tamaño máximo permitido de 5MB' },
        { status: 400 }
      );
    }

    console.log('Archivo recibido:', file.name);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await PDFParser(buffer);
   
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      system: "Eres un experto en optimización de currículums para sistemas ATS (Applicant Tracking System). Tu tarea es analizar CVs y proporcionar recomendaciones específicas para mejorar su compatibilidad con sistemas ATS.",
      messages: [
        {
          role: "user",
          content: `Por favor, analiza este CV y proporciona recomendaciones específicas para mejorar su compatibilidad con sistemas ATS. Incluye:
1. Palabras clave faltantes o que deberían agregarse
2. Formato y estructura
3. Problemas de legibilidad para sistemas ATS
4. Sugerencias de mejora específicas

CV a analizar:
${pdfData.text}`
        }
      ]
    });

    if (!message.content || message.content.length === 0) {
      throw new Error('No se recibió respuesta del análisis');
    }

    return NextResponse.json({ 
      analysis: message.content[0].text 
    });

  } catch (error: any) {
    console.error('Error detallado:', error);
    
    // Manejo específico de errores comunes
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'Error de autenticación con la API' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Error al procesar el archivo: ' + (error.message || 'Error desconocido'),
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      },
      { status: 500 }
    );
  }
}