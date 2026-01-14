import type { Handler, HandlerEvent } from "@netlify/functions";
import * as path from "path";
import * as fs from "fs/promises";

// Assuming products.json is at the project root, which is two levels up from netlify/functions
const PRODUCTS_PATH = path.join(__dirname, "..", "..", "products.json");

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  features: string[];
}

// Helper function to calculate cosine similarity between two vectors
const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
  const magB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
  
  // Handle cases where a vector's magnitude is zero to avoid division by zero
  if (magA === 0 || magB === 0) {
    return 0;
  }
  
  return dotProduct / (magA * magB);
};

// Function to get embeddings for a batch of texts from the Gemini API
const getEmbeddings = async (apiKey: string, texts: string[]): Promise<number[][]> => {
    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/embedding-001:batchEmbedContents";
    
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
            requests: texts.map(text => ({
                model: "models/embedding-001",
                content: {
                    parts: [{ text }],
                }
            }))
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Embedding API Error:", errorBody);
        throw new Error(`Failed to get embeddings: ${response.statusText}`);
    }

    const result = await response.json();
    return result.embeddings.map((e: { values: number[] }) => e.values);
};

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured" }) };
  }

  try {
    const { prompt } = JSON.parse(event.body || "{}");
    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: "Prompt is required" }) };
    }

    // 1. Load products from the JSON file
    const productsData = await fs.readFile(PRODUCTS_PATH, "utf-8");
    const { products } = JSON.parse(productsData) as { products: Product[] };

    // 2. Create structured documents for each product for embedding
    const productDocs = products.map(p => `Product: ${p.name}. Description: ${p.description}. Features: ${p.features.join(", ")}.`);
    
    // 3. Get embeddings for the user's query and all product documents in a single batch
    const allTexts = [prompt, ...productDocs];
    const embeddings = await getEmbeddings(apiKey, allTexts);
    
    const queryEmbedding = embeddings[0];
    const productEmbeddings = embeddings.slice(1);

    // 4. Calculate similarities and find the top N most relevant products
    const similarities = productEmbeddings.map(prodEmb => cosineSimilarity(queryEmbedding, prodEmb));
    const productsWithSimilarity = products.map((product, i) => ({ ...product, similarity: similarities[i] }));
    
    productsWithSimilarity.sort((a, b) => b.similarity - a.similarity);
    
    const topK = 3;
    const relevantProducts = productsWithSimilarity.slice(0, topK);

    // 5. Build an augmented prompt with context for the chat model
    const productContext = relevantProducts
      .map(p => `- ${p.name} ($${p.price}): ${p.description}`)
      .join("\n");
      
    const augmentedPrompt = `You are a helpful and enthusiastic AI assistant for "Gadgets and Those," an online tech store. Your goal is to help users discover the perfect gadgets for their needs.

Based on the user's query, here are some products from our catalog that seem like a good fit:
${productContext}

Now, answer the user's query conversationally. If the products are a good match, explain why. If they aren't a great match, you can say so and ask for more details.
User's query: "${prompt}"`;

    // 6. Call the Gemini chat model with the augmented prompt
    const chatEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
    const chatResponse = await fetch(chatEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: augmentedPrompt }] }],
        }),
    });

    if (!chatResponse.ok) {
        const errorBody = await chatResponse.text();
        console.error("Chat API Error:", errorBody);
        throw new Error(`Failed to get chat response: ${chatResponse.statusText}`);
    }

    const chatResult = await chatResponse.json();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chatResult),
    };

  } catch (error: any) {
    console.error("Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};
