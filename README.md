# CV ATS Optimizer

Una aplicación web que analiza CVs y proporciona recomendaciones para mejorar su compatibilidad con sistemas ATS (Applicant Tracking System) utilizando la API de Anthropic Claude.

## Hito 1: Análisis Básico de CV (Actual)

### Características Actuales
- **Interfaz Web Simple**: Interfaz minimalista y fácil de usar con Tailwind CSS
- **Subida de CV**: Soporte para archivos PDF de hasta 5MB
- **Análisis ATS**: Análisis básico del CV usando Anthropic Claude API
- **Recomendaciones**: Sugerencias sobre:
  - Palabras clave faltantes
  - Formato y estructura
  - Problemas de legibilidad
  - Sugerencias de mejora específicas

### Tecnologías Utilizadas
- **Backend**: Express.js
- **Frontend**: HTML + Tailwind CSS
- **APIs**: Anthropic Claude API
- **Procesamiento PDF**: pdf-parse
- **Gestión de Archivos**: multer

### Estructura del Proyecto
```
cv-optimizer/
├── public/
│   └── index.html      # Interfaz de usuario
├── server.js           # Servidor Express y lógica principal
├── .env.local          # Variables de entorno (API keys)
└── package.json        # Dependencias
```

### Configuración
1. Clonar el repositorio
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Crear archivo `.env.local` con:
   ```
   ANTHROPIC_API_KEY=tu_api_key
   ```
4. Iniciar el servidor:
   ```bash
   node server.js
   ```

## Mejoras Planificadas

### 1. Mejoras en el Análisis
- [ ] Personalización del análisis según la descripción del puesto
- [ ] Detección automática de secciones del CV
- [ ] Análisis de formato y diseño
- [ ] Extracción y validación de datos de contacto
- [ ] Detección de inconsistencias temporales

### 2. Mejoras en el Prompt de IA
- [ ] Prompt más estructurado y detallado
- [ ] Análisis de competencias técnicas vs soft skills
- [ ] Comparación con mejores prácticas de la industria
- [ ] Sugerencias específicas por sector/industria
- [ ] Detección de buzzwords y términos obsoletos

### 3. Mejoras en la Interfaz
- [ ] Diseño más profesional y responsive
- [ ] Vista previa del CV
- [ ] Editor de texto integrado para modificaciones
- [ ] Historial de análisis
- [ ] Exportación de recomendaciones en PDF

### 4. Funcionalidades Adicionales
- [ ] Soporte para múltiples formatos (DOCX, RTF, etc.)
- [ ] Comparación con descripción de trabajo
- [ ] Generación de versiones optimizadas del CV
- [ ] Análisis de palabras clave por industria
- [ ] Integración con LinkedIn

### 5. Mejoras Técnicas
- [ ] Caché de análisis
- [ ] Optimización de procesamiento PDF
- [ ] Manejo de errores más robusto
- [ ] Tests automatizados
- [ ] Documentación API
- [ ] Monitoreo y analytics

### 6. Seguridad y Privacidad
- [ ] Encriptación de datos
- [ ] Autenticación de usuarios
- [ ] Cumplimiento GDPR
- [ ] Política de retención de datos
- [ ] Auditoría de seguridad

## Contribuir
Las contribuciones son bienvenidas. Por favor, abre un issue para discutir los cambios propuestos.

## Licencia
Este proyecto está bajo la Licencia MIT.
