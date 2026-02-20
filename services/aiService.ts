import { GoogleGenAI, GenerateContentResponse, FunctionDeclaration, Type, createPartFromBase64, createPartFromText } from "@google/genai";
import { Message, AIProvider, AppSettings, GroundingMetadata } from "../types";

const getApiKey = (provider: AIProvider, settings: AppSettings): string | undefined => {
  switch (provider) {
    case 'google': return settings.googleApiKey || process.env.API_KEY;
    case 'openai': return settings.openaiApiKey;
    case 'groq': return settings.groqApiKey;
    case 'anthropic': return settings.anthropicApiKey;
    case 'xai': return settings.xaiApiKey;
    case 'local': return settings.localApiKey;
    default: return undefined;
  }
};

interface AIResponse {
  content: string;
  groundingMetadata?: GroundingMetadata;
}

const DEFAULT_IMAGE_MODEL = 'imagen-4.0-generate-001';
const DEFAULT_IMAGE_PROMPT = 'Extract all readable text from this image. If there is no text, describe the image clearly.';
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_LOCAL_BASE_URL = `${DEFAULT_OLLAMA_BASE_URL}/v1`;

const normalizeUrl = (value: string): string => {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
};

const normalizeOllamaBase = (value: string | undefined): string => {
  const raw = (value || '').trim();
  const base = raw || DEFAULT_OLLAMA_BASE_URL;
  const withProtocol = /^https?:\/\//i.test(base) ? base : `http://${base}`;
  const trimmed = withProtocol.replace(/\/+$/, '');
  return trimmed.replace(/\/v1$/i, '');
};

const normalizeBaseUrl = (value: string | undefined): string => {
  const base = normalizeOllamaBase(value);
  return base.endsWith('/v1') ? base : `${base}/v1`;
};

const createAbortError = () => {
  const err = new Error('Aborted');
  (err as any).name = 'AbortError';
  return err;
};

const extractHtmlFromProxy = (raw: string): string => {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.contents === 'string') return parsed.contents;
    if (typeof parsed.content === 'string') return parsed.content;
    if (typeof parsed.data === 'string') return parsed.data;
  } catch {
    // Not JSON, fall back to raw HTML
  }
  return raw;
};

const htmlToText = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove scripts, styles, nav, footer to focus on main content and save tokens
  const removeTargets = doc.querySelectorAll('script, style, svg, path, noscript, footer, nav, header');
  removeTargets.forEach(node => node.remove());

  let text = doc.body?.innerText || "";
  text = text.replace(/\s+/g, ' ').trim();
  return text;
};

const parseOllamaModelsFromOpenAI = (data: any): string[] => {
  if (!data || !Array.isArray(data.data)) return [];
  return data.data.map((m: any) => m?.id).filter(Boolean);
};

const parseOllamaModelsFromTags = (data: any): string[] => {
  if (!data || !Array.isArray(data.models)) return [];
  return data.models.map((m: any) => m?.name).filter(Boolean);
};

export const fetchLocalModels = async (baseUrl?: string): Promise<string[]> => {
  const base = normalizeOllamaBase(baseUrl);
  const baseV1 = `${base}/v1`;

  const tryOpenAI = async () => {
    const res = await fetch(`${baseV1}/models`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    const models = parseOllamaModelsFromOpenAI(data);
    if (models.length === 0) throw new Error('No models returned');
    return models;
  };

  const tryTags = async () => {
    const res = await fetch(`${base}/api/tags`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    const models = parseOllamaModelsFromTags(data);
    if (models.length === 0) throw new Error('No models returned');
    return models;
  };

  try {
    return await tryOpenAI();
  } catch (err) {
    try {
      return await tryTags();
    } catch (err2) {
      // Fallback to local proxy if direct fetch is blocked by CORS
      try {
        const proxyUrl = `http://localhost:3001/api/ollama/models?baseUrl=${encodeURIComponent(base)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`Proxy status ${res.status}`);
        const data = await res.json();
        const models = Array.isArray(data?.models) ? data.models : [];
        if (models.length === 0) throw new Error('No models returned');
        return models;
      } catch (proxyErr: any) {
        const message = proxyErr?.message || 'Failed to fetch Ollama models';
        throw new Error(`Ollama models not available. ${message}`);
      }
    }
  }
};

const parseOllamaPullStatus = (text: string): string => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]);
      if (obj?.status) return obj.status;
      if (obj?.error) return obj.error;
    } catch {
      continue;
    }
  }
  return text.slice(0, 200);
};

export const pullLocalModel = async (baseUrl: string | undefined, name: string): Promise<{ status: string }> => {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Model name is required.');

  const base = normalizeOllamaBase(baseUrl);
  const body = JSON.stringify({ name: trimmedName });

  const tryDirect = async () => {
    const res = await fetch(`${base}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || `Status ${res.status}`);
    }
    return { status: parseOllamaPullStatus(text) || 'Download started' };
  };

  try {
    return await tryDirect();
  } catch (err) {
    try {
      const proxyUrl = `http://localhost:3001/api/ollama/pull?baseUrl=${encodeURIComponent(base)}`;
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Proxy status ${res.status}`);
      }
      const data = await res.json();
      if (data?.status) return { status: data.status };
      return { status: 'Download started' };
    } catch (proxyErr: any) {
      const message = proxyErr?.message || 'Failed to download model';
      throw new Error(`Ollama download failed. ${message}`);
    }
  }
};

// --- Tool Definitions (MCP) ---

const browserToolDeclaration: FunctionDeclaration = {
  name: "visit_website",
  description: "REQUIRED TOOL: Visits a website and retrieves its text content. You MUST use this when user asks to open, launch, browse, visit, or view any website. Also use when user wants information from a specific URL. This is your primary way to access web content.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: "The complete URL to visit (must include https://). Examples: https://google.com, https://amazon.com/s?k=shoes",
      },
    },
    required: ["url"],
  },
};

// Helper to fetch and parse website content (Client-side MCP)
async function executeBrowserTool(url: string): Promise<string> {
  const normalizedUrl = normalizeUrl(url);
  // Try Playwright backend first
  try {
    const response = await fetch('http://localhost:3001/api/browse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: normalizedUrl })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) return data.content;
    }
  } catch (e) {
    console.log('Playwright backend not available, using CORS proxy fallback');
  }

  // Fallback to CORS proxy
  // 15 second timeout to prevent infinite loading
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    // Use multiple CORS proxy options for reliability
    const proxies = [
      `https://api.allorigins.win/get?url=${encodeURIComponent(normalizedUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(normalizedUrl)}`
    ];
    
    let lastError: unknown;
    
    for (const proxyUrl of proxies) {
      try {
        const response = await fetch(proxyUrl, { signal: controller.signal });
        if (!response.ok) {
          lastError = new Error(`Status ${response.status}`);
          continue;
        }

        const raw = await response.text();
        const html = extractHtmlFromProxy(raw);
        if (!html) {
          lastError = new Error('Empty response');
          continue;
        }

        const text = htmlToText(html);

        // Check for common bot detection text (Amazon, Cloudflare, etc.)
        const lowerText = text.toLowerCase();
        if (lowerText.includes("captcha") || lowerText.includes("robot") || lowerText.includes("unusual traffic") || lowerText.includes("verify you are a human")) {
           return "Error: The website blocked the automated request (CAPTCHA/Bot detection). Tell the user you cannot browse this specific site directly due to bot protection, but provide them the direct link to click.";
        }

        if (text.length < 50) {
          lastError = new Error('Page content seems empty or protected by bot detection');
          continue;
        }

        // Truncate to avoid token limits (approx 20k chars)
        return text.slice(0, 20000);
      } catch (e) {
        lastError = e;
        if (controller.signal.aborted) break;
      }
    }

    if (controller.signal.aborted) return "Error: Website request timed out (15s limit).";
    const errorMessage = lastError instanceof Error ? lastError.message : 'Network error';
    return `Error: Failed to fetch URL (${errorMessage}).`;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const imageToText = async (
  provider: AIProvider,
  model: string,
  settings: AppSettings,
  base64Image: string,
  mimeType: string,
  prompt?: string
): Promise<string> => {
  const apiKey = getApiKey(provider, settings);
  if (!apiKey) {
    throw new Error(`Missing API Key for ${provider}. Please configure it in settings.`);
  }
  if (provider !== 'google') {
    throw new Error('Image-to-text is currently supported only for Google Gemini.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const parts = [
    createPartFromText(prompt || DEFAULT_IMAGE_PROMPT),
    createPartFromBase64(base64Image, mimeType)
  ];

  const response = await ai.models.generateContent({
    model,
    contents: parts
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('No text returned for this image.');
  }
  return text;
};

export const textToImage = async (
  provider: AIProvider,
  settings: AppSettings,
  prompt: string,
  imageModel: string = DEFAULT_IMAGE_MODEL
): Promise<{ dataUrl: string; mimeType: string }> => {
  const apiKey = getApiKey(provider, settings);
  if (!apiKey) {
    throw new Error(`Missing API Key for ${provider}. Please configure it in settings.`);
  }
  if (provider !== 'google') {
    throw new Error('Text-to-image is currently supported only for Google Gemini.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateImages({
    model: imageModel,
    prompt
  });

  const image = response.generatedImages?.[0]?.image;
  if (!image?.imageBytes) {
    throw new Error('No image data returned from the model.');
  }
  const mimeType = image.mimeType || 'image/png';
  const dataUrl = `data:${mimeType};base64,${image.imageBytes}`;
  return { dataUrl, mimeType };
};

export const streamAIResponse = async (
  provider: AIProvider,
  model: string,
  systemInstruction: string,
  history: Message[],
  newMessage: string,
  settings: AppSettings,
  tools: string[] = [], 
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<AIResponse> => {
  const apiKey = getApiKey(provider, settings);
  if (!apiKey && provider !== 'local') {
    throw new Error(`Missing API Key for ${provider}. Please configure it in settings.`);
  }

  if (provider === 'google') {
    return streamGoogleResponse(apiKey, model, systemInstruction, history, newMessage, tools, onChunk, signal);
  } else if (provider === 'openai' || provider === 'xai' || provider === 'groq' || provider === 'local') {
    let baseUrl = 'https://api.openai.com/v1';
    if (provider === 'groq') baseUrl = 'https://api.groq.com/openai/v1';
    if (provider === 'xai') baseUrl = 'https://api.x.ai/v1';
    if (provider === 'local') baseUrl = normalizeBaseUrl(settings.localBaseUrl);

    const content = await streamOpenAICompatible(baseUrl, apiKey, model, systemInstruction, history, newMessage, onChunk, signal);
    return { content };
  } else if (provider === 'anthropic') {
     const content = await streamAnthropicResponse(apiKey, model, systemInstruction, history, newMessage, onChunk, signal);
     return { content };
  }

  throw new Error("Provider not supported yet");
};

// --- Google Implementation with Tool Loop ---
async function streamGoogleResponse(
  apiKey: string,
  model: string,
  systemInstruction: string,
  history: Message[],
  newMessage: string,
  tools: string[],
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<AIResponse> {
  const ai = new GoogleGenAI({ apiKey });
  if (signal?.aborted) {
    throw createAbortError();
  }
  
  const validHistory = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));

  const toolConfig: any = { tools: [] };
  
  if (tools.includes('googleSearch')) {
    toolConfig.tools.push({ googleSearch: {} });
  }
  
  // Add Function Declarations (MCP)
  const functionDeclarations: FunctionDeclaration[] = [];
  if (tools.includes('browser')) {
    functionDeclarations.push(browserToolDeclaration);
  }

  if (functionDeclarations.length > 0) {
    toolConfig.tools.push({ functionDeclarations });
  }

  // Inject specific instructions for the browser tool to override refusal behavior
  let finalSystemInstruction = systemInstruction;
  if (tools.includes('browser')) {
    finalSystemInstruction += `\n\n[CRITICAL BROWSER TOOL INSTRUCTIONS]: You MUST use the 'visit_website' function when:
    - User says "open [website]", "launch [website]", "go to [website]", "browse [website]", "visit [website]"
    - User asks "what's on [website]" or "show me [website]"
    - User wants to search a specific site (construct the URL: https://site.com/search?q=query)
    - NEVER say you cannot open websites or apps - you CAN and MUST use visit_website
    - Always call visit_website with full URLs including https://
    - After getting content, summarize what you found on the page`;
  }

  const chat = ai.chats.create({
    model: model,
    config: { 
      systemInstruction: finalSystemInstruction,
      ...toolConfig
    },
    history: validHistory
  });

  // Main interaction loop (handles potential multiple tool turns)
  let fullText = "";
  let capturedMetadata: GroundingMetadata | undefined = undefined;

  async function processStream(stream: any): Promise<void> {
    for await (const chunk of stream) {
      if (signal?.aborted) {
        throw createAbortError();
      }
      const c = chunk as GenerateContentResponse;
      
      // 1. Check for Grounding (Search)
      if (c.candidates?.[0]?.groundingMetadata) {
        capturedMetadata = c.candidates[0].groundingMetadata as unknown as GroundingMetadata;
      }

      // 2. Check for Function Calls (MCP)
      const parts = c.candidates?.[0]?.content?.parts || [];
      const functionCalls = parts.filter(p => p.functionCall).map(p => p.functionCall);
      
      if (functionCalls.length > 0) {
        if (signal?.aborted) {
          throw createAbortError();
        }
        onChunk(" *Browsing web...* ");
        
        const functionResponses = [];
        for (const call of functionCalls) {
          if (signal?.aborted) {
            throw createAbortError();
          }
          if (call.name === 'visit_website' && call.args) {
             const url = call.args['url'] as string;
             // Execute tool
             const content = await executeBrowserTool(url);
             
             functionResponses.push({
               id: call.id, // Important for correlation
               name: call.name,
               response: { content: content }
             });
          }
        }

        // Send tool output back to model
        if (functionResponses.length > 0) {
          try {
            // FIX: Use 'message' property to pass parts back to the model
            const nextStream = await chat.sendMessageStream({
                message: functionResponses.map(fr => ({ functionResponse: fr }))
            });
            await processStream(nextStream);
          } catch (err: any) {
            onChunk(`\n\n[System Error: Failed to send tool response - ${err.message}]\n\n`);
          }
          return; // Stop processing this stream, the recursion handles the rest
        }
      }

      // 3. Normal Text
      const text = c.text;
      if (text) {
        if (signal?.aborted) {
          throw createAbortError();
        }
        fullText += text;
        onChunk(text);
      }
    }
  }

  try {
      const resultStream = await chat.sendMessageStream({ message: newMessage });
      await processStream(resultStream);
  } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      throw new Error(`Gemini API Error: ${e.message}`);
  }

  return { 
    content: fullText,
    groundingMetadata: capturedMetadata
  };
}

// --- OpenAI / Groq / xAI Implementation ---
async function streamOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemInstruction: string,
  history: Message[],
  newMessage: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const messages = [
    { role: 'system', content: systemInstruction },
    ...history.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content })),
    { role: 'user', content: newMessage }
  ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model,
      messages: messages,
      stream: true
    }),
    signal
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API Error: ${response.status} - ${err}`);
  }

  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  let doneEarly = false;

  while (true) {
    if (signal?.aborted) {
      try { await reader.cancel(); } catch (e) {}
      throw createAbortError();
    }
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const data = trimmed.replace(/^data:\s*/, '');
      if (data === '[DONE]') {
        doneEarly = true;
        break;
      }

      try {
        const json = JSON.parse(data);
        const content = json.choices?.[0]?.delta?.content || '';
        if (content) {
          fullText += content;
          onChunk(content);
        }
      } catch (e) {
        console.warn("Error parsing chunk", e);
      }
    }

    if (doneEarly) break;
  }
  return fullText;
}

// --- Anthropic Implementation ---
async function streamAnthropicResponse(
  apiKey: string,
  model: string,
  systemInstruction: string,
  history: Message[],
  newMessage: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const messages = [
    ...history.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content })),
    { role: 'user', content: newMessage }
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true' 
    },
    body: JSON.stringify({
      model: model,
      system: systemInstruction,
      messages: messages,
      max_tokens: 4096,
      stream: true
    }),
    signal
  });

   if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API Error: ${response.status} - ${err}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  let doneEarly = false;

  while(true) {
    if (signal?.aborted) {
      try { await reader.cancel(); } catch (e) {}
      throw createAbortError();
    }
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const dataLine = trimmed.replace(/^data:\s*/, '');
      if (dataLine === '[DONE]') {
        doneEarly = true;
        break;
      }

      try {
        const data = JSON.parse(dataLine);
        if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
          const text = data.delta.text;
          fullText += text;
          onChunk(text);
        }
        if (data.type === 'message_stop') {
          doneEarly = true;
          break;
        }
      } catch (e) {}
    }

    if (doneEarly) break;
  }
  return fullText;
}

export const fetchGroqModels = async (apiKey: string): Promise<string[]> => {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if(!response.ok) return [];
        const data = await response.json();
        return data.data.map((m: any) => m.id);
    } catch (e) {
        console.error("Failed to fetch Groq models", e);
        return [];
    }
}

// Agent-to-Agent Conversation Streaming
export const streamAgentToAgentConversation = async (
  speaker: any, // AgentConfig
  listener: any, // AgentConfig
  topic: string,
  previousMessages: any[],
  settings: AppSettings,
  onChunk: (chunk: string) => void
): Promise<void> => {
  const speakerId = speaker.id;
  const speakerName = speaker.name;
  
  // Build message history in the correct format for streamAIResponse
  const messageHistory: Message[] = previousMessages.map((msg) => ({
    id: msg.id,
    role: msg.agentId === speakerId ? 'model' : 'user',
    content: msg.content,
    timestamp: msg.timestamp,
  }));

  // Generate initial prompt based on conversation state
  let userPrompt = '';
  if (previousMessages.length === 0) {
    userPrompt = `Start a discussion about: ${topic}`;
  } else {
    userPrompt = `${listener.name} just said: "${previousMessages[previousMessages.length - 1].content}". Now respond as ${speakerName} to continue the discussion about ${topic}. Keep your response concise and focused.`;
  }

  // Create message object for tracking
  const newMessage: any = {
    id: `msg-${Date.now()}-${Math.random()}`,
    conversationId: '',
    agentId: speakerId,
    agentName: speakerName,
    content: '',
    timestamp: Date.now(),
    turnNumber: Math.floor(previousMessages.length / 2) + 1,
  };

  previousMessages.push(newMessage);

  try {
    await streamAIResponse(
      speaker.provider as AIProvider,
      speaker.model,
      speaker.systemInstruction,
      messageHistory,
      userPrompt,
      settings,
      speaker.tools || [],
      (chunk: string) => {
        newMessage.content += chunk;
        onChunk(chunk);
      }
    );
  } catch (error) {
    console.error(`Stream error for ${speakerName}:`, error);
    throw error;
  }
};
