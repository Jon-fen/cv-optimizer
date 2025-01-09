# Analyze This! - Optimizador de CV para ATS

Una aplicación web moderna que ayuda a optimizar CVs para sistemas de seguimiento de candidatos (ATS) utilizando IA.

## Características

### Versión 2.0 (Actual)
- Análisis detallado de CV con IA
- Puntuación de compatibilidad ATS
- Soporte para múltiples sistemas ATS
- Exportación a PDF y Word
- Soporte multiidioma (Español/Inglés)
- Sistema de características premium
- Análisis con descripción del trabajo (Premium)

### Próximas Características (Planificadas)
- Diseño responsivo mejorado
- Sugerencias específicas por industria
- Dashboard de seguimiento de mejoras
- Más sistemas ATS soportados
- Vista previa de cómo el ATS lee tu CV
- Estadísticas de uso
- Temas personalizables

## Tecnologías

- Frontend: HTML5, TailwindCSS, JavaScript
- Backend: Node.js, Express
- IA: Anthropic Claude API
- Exportación: html-pdf, docx
- Despliegue: Vercel

## Instalación Local

1. Clona el repositorio:
```bash
git clone https://github.com/Jon-fen/cv-optimizer.git
cd cv-optimizer
```

2. Instala las dependencias:
```bash
npm install
```

3. Crea un archivo `.env.local` con tu clave API de Anthropic:
```
ANTHROPIC_API_KEY=tu-clave-api
```

4. Inicia el servidor:
```bash
npm start
```

5. Abre http://localhost:3002 en tu navegador

## Características Premium

El sistema incluye características premium que se pueden desbloquear con un código de activación. Los códigos son generados diariamente usando un algoritmo seguro basado en HMAC-SHA256.

## Contribuir

Las contribuciones son bienvenidas. Por favor, abre un issue primero para discutir los cambios que te gustaría hacer.

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Autor

**Jonathan Friz B.**
- GitHub: [@Jon-fen](https://github.com/Jon-fen/)

## Agradecimientos

- Anthropic por proporcionar la API de Claude
- La comunidad de código abierto por las herramientas utilizadas
