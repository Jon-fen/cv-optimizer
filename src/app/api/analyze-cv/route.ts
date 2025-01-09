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
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Convertir el archivo a ArrayBuffer y luego a texto
    const arrayBuffer = await file.arrayBuffer();
    const fileText = new TextDecoder().decode(arrayBuffer);

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