import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No se ha subido ningún archivo' },
        { status: 400 }
      );
    }

    // Leer el archivo como ArrayBuffer
    const buffer = await file.arrayBuffer();
    const pdfContent = new TextDecoder().decode(buffer);

    // Enviar a Claude para análisis
    const analysis = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Eres un experto en optimización de CVs para sistemas ATS (Applicant Tracking Systems). 
        Analiza el siguiente CV y proporciona:
        1. Un resumen de las fortalezas y debilidades del CV
        2. Recomendaciones específicas para mejorar la compatibilidad con sistemas ATS
        3. Sugerencias de palabras clave faltantes que son comunes en la industria
        4. Consejos para mejorar el formato y la estructura
        
        CV a analizar:
        ${pdfContent}`
      }]
    });

    return NextResponse.json({
      message: 'CV analizado exitosamente',
      analysis: analysis.content[0].text
    });
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error al procesar el CV' },
      { status: 500 }
    );
  }
}