const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ── NCR CLASSIFICATION ───────────────────────────────────────────────────────
/**
 * Classify NCR based on description using GPT-4o
 * @param {string} description - NCR description
 * @param {string} material - Material type (optional)
 * @param {string} process - Process type (optional)
 * @returns {Object} Classification result with category, severity, and suggested actions
 */
async function classifyNCR(description, material = '', process = '') {
  try {
    const systemPrompt = `You are a quality management expert specializing in oil & gas, fabrication, and NDT inspection.
Classify the Non-Conformance Report (NCR) based on the description.

Return a JSON object with:
{
  "category": "Welding|Material|Dimensional|Surface|Documentation|Process",
  "subcategory": "Specific subcategory (e.g., Porosity, Crack, Dimensional Deviation)",
  "severity": "Minor|Major|Critical",
  "confidence": 0.0-1.0,
  "suggested_actions": ["Action 1", "Action 2", "Action 3"],
  "root_cause_hints": ["Hint 1", "Hint 2"]
}`;

    const userPrompt = `NCR Description: ${description}
${material ? `Material: ${material}` : ''}
${process ? `Process: ${process}` : ''}

Classify this NCR and provide recommendations.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content);
    return { success: true, data: result };
  } catch (error) {
    console.error('NCR Classification Error:', error);
    return {
      success: false,
      error: error.message,
      data: {
        category: 'Unclassified',
        subcategory: 'Unknown',
        severity: 'Minor',
        confidence: 0,
        suggested_actions: [],
        root_cause_hints: [],
      },
    };
  }
}

// ── NATURAL LANGUAGE QUERY ───────────────────────────────────────────────────
/**
 * Convert natural language query to SQL for data exploration
 * @param {string} query - Natural language query
 * @param {string} schema - Database schema description
 * @returns {Object} SQL query and explanation
 */
async function naturalLanguageToSQL(query, schema) {
  try {
    const systemPrompt = `You are a SQL expert for a Quality Management System database.
Convert natural language queries to PostgreSQL queries.

Available tables and columns:
${schema}

Return JSON with:
{
  "sql": "SELECT ...",
  "explanation": "Brief explanation of what the query does",
  "confidence": 0.0-1.0
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 800,
    });

    const result = JSON.parse(response.choices[0].message.content);
    return { success: true, data: result };
  } catch (error) {
    console.error('Natural Language Query Error:', error);
    return {
      success: false,
      error: error.message,
      data: { sql: '', explanation: '', confidence: 0 },
    };
  }
}

// ── CONTENT GENERATION ───────────────────────────────────────────────────────
/**
 * Generate marketing content using GPT-4o
 * @param {string} contentType - Type of content (email, blog, case_study, etc.)
 * @param {string} topic - Content topic
 * @param {Object} context - Additional context (industry, audience, etc.)
 * @returns {Object} Generated content
 */
async function generateContent(contentType, topic, context = {}) {
  try {
    const prompts = {
      email: {
        system: 'You are a B2B marketing copywriter for a Quality Management System SaaS platform.',
        instruction: 'Write a professional, engaging email that highlights benefits and includes a clear call-to-action.',
      },
      blog: {
        system: 'You are a technical content writer specializing in quality management and industrial processes.',
        instruction: 'Write a comprehensive blog post with introduction, body paragraphs, and conclusion. Include industry insights.',
      },
      case_study: {
        system: 'You are a B2B case study writer for quality management solutions.',
        instruction: 'Write a compelling case study with: Challenge, Solution, Results, and Testimonial sections.',
      },
      onboarding: {
        system: 'You are a customer onboarding specialist for a SaaS platform.',
        instruction: 'Write a personalized onboarding email that guides new users through key features.',
      },
    };

    const promptConfig = prompts[contentType] || prompts.email;
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: promptConfig.system },
        {
          role: 'user',
          content: `${promptConfig.instruction}\n\nTopic: ${topic}\n${contextStr ? `\nContext:\n${contextStr}` : ''}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    return {
      success: true,
      data: {
        content: response.choices[0].message.content,
        contentType,
        topic,
      },
    };
  } catch (error) {
    console.error('Content Generation Error:', error);
    return {
      success: false,
      error: error.message,
      data: { content: '', contentType, topic },
    };
  }
}

// ── ITP GENERATION FROM REQUIREMENTS ───────────────────────────────────────
/**
 * Generate ITP items from project requirements
 * @param {string} requirements - Project requirements text
 * @param {string} projectType - Type of project (fabrication, pipeline, etc.)
 * @returns {Object} Generated ITP items
 */
async function generateITPItems(requirements, projectType = 'general') {
  try {
    const systemPrompt = `You are a quality management expert specializing in Inspection and Test Plans (ITP).
Generate ITP items based on project requirements.

Return JSON with:
{
  "items": [
    {
      "activity": "Activity name",
      "acceptance_criteria": "Specific criteria",
      "responsibility": "Role responsible",
      "is_hold_point": true/false,
      "is_witness_point": true/false
    }
  ]
}`;

    const userPrompt = `Project Type: ${projectType}
Requirements: ${requirements}

Generate appropriate ITP items for this project. Include 5-10 key activities.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 1000,
    });

    const result = JSON.parse(response.choices[0].message.content);
    return { success: true, data: result };
  } catch (error) {
    console.error('ITP Generation Error:', error);
    return {
      success: false,
      error: error.message,
      data: { items: [] },
    };
  }
}

// ── DOCUMENT ANALYSIS ───────────────────────────────────────────────────────
/**
 * Analyze uploaded document for key information extraction
 * @param {string} documentText - Extracted text from document
 * @param {string} documentType - Type of document (spec, drawing, report, etc.)
 * @returns {Object} Extracted information
 */
async function analyzeDocument(documentText, documentType = 'general') {
  try {
    const systemPrompt = `You are a document analysis expert for quality management in industrial settings.
Extract key information from the provided document text.

Return JSON with:
{
  "title": "Document title",
  "key_points": ["Point 1", "Point 2"],
  "requirements": ["Requirement 1", "Requirement 2"],
  "standards_referenced": ["Standard 1", "Standard 2"],
  "summary": "Brief summary"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Document Type: ${documentType}\n\nText: ${documentText}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 800,
    });

    const result = JSON.parse(response.choices[0].message.content);
    return { success: true, data: result };
  } catch (error) {
    console.error('Document Analysis Error:', error);
    return {
      success: false,
      error: error.message,
      data: {
        title: '',
        key_points: [],
        requirements: [],
        standards_referenced: [],
        summary: '',
      },
    };
  }
}

module.exports = {
  classifyNCR,
  naturalLanguageToSQL,
  generateContent,
  generateITPItems,
  analyzeDocument,
};
