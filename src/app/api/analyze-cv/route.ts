import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Inicializar el cliente de Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Convertir el archivo a texto
    const fileText = await file.text();

    // Analizar con Claude
    const analysis = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Analiza este CV y proporciona recomendaciones para optimizarlo para sistemas ATS: ${fileText}`
      }]
    });

    return NextResponse.json({
      message: 'CV analyzed successfully',
      analysis: analysis.content
    });
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error processing the CV' },
      { status: 500 }
    );
  }
}