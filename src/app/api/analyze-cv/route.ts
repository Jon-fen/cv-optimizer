import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convertir el archivo a base64 para enviarlo a Claude
    const arrayBuffer = await file.arrayBuffer();
    const base64File = Buffer.from(arrayBuffer).toString('base64');

    // Analizar con Claude
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [{
          type: "text",
          text: "Analiza este CV y proporciona recomendaciones específicas para mejorarlo y optimizarlo para sistemas ATS. Incluye palabras clave faltantes, sugerencias de formato y áreas de mejora."
        }, {
          type: "image",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64File
          }
        }]
      }]
    });

    return NextResponse.json({
      analysis: message.content[0].text
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error analyzing CV' },
      { status: 500 }
    );
  }
}