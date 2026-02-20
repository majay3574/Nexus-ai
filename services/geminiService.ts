import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Message } from "../types";

// Initialize the client with the environment variable API key.
// IMPORTANT: We use process.env.API_KEY directly as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Creates a chat session and sends a message, returning a stream of responses.
 * This is stateless in terms of keeping the `Chat` object alive across React renders
 * for simplicity in this demo, but reconstructs history context.
 */
export const streamGeminiResponse = async (
  model: string,
  systemInstruction: string,
  history: Message[],
  newMessage: string,
  onChunk: (text: string) => void
): Promise<string> => {
  try {
    // Transform our app's Message type to the API's Content format
    // The API expects history to be alternating user/model parts.
    // However, the `chat.sendMessageStream` manages internal state if we keep the instance.
    // Since React components re-render, we will initialize a new chat with history each time
    // OR we can just rely on the API's ability to handle context if we were persisting the `chat` object.
    // For a robust "stateless" REST-like approach in a simple React app, we often pass full history 
    // or rely on the SDK's chat helper. 
    
    // Here we will use the `chats.create` with history to restore context.
    const validHistory = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));

    const chat: Chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: systemInstruction,
      },
      history: validHistory
    });

    const resultStream = await chat.sendMessageStream({ message: newMessage });

    let fullText = "";
    
    for await (const chunk of resultStream) {
      const c = chunk as GenerateContentResponse;
      const text = c.text;
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }

    return fullText;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
