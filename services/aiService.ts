import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

export const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Interface for the raw data returned by AI (simplified structure)
interface RawNode {
  label: string;
  description: string;
  children?: RawNode[];
}

export const expandMindMapNode = async (topic: string, path: string[] = []): Promise<RawNode[]> => {
  const ai = getAIClient();
  
  // Construct the context string from the path
  const pathContext = path.length > 0 ? path.join(' > ') : 'Root';

  const baseInstruction = `你是一位专业的思维导图构建专家。
  任务：基于给定的“当前节点”和“完整路径上下文”，生成下一层级的子节点。
  
  规则：
  1. **严格相关性**：生成的子节点必须严格属于“当前节点”的范畴，同时必须符合“完整路径”的逻辑流。不要生成与上级节点重复的内容。
  2. **深度生成**：请尝试一次性生成 2 层结构（即：子节点及其关键的下一级节点），以便用户能快速看到知识脉络。
  3. **MECE原则**：子节点之间应相互独立且完全穷尽。
  4. **简洁性**：节点名称控制在 8 个字以内，描述控制在 15 个字以内。

  请直接返回 JSON 数据。`;

  const prompt = `当前节点："${topic}"
完整路径上下文：${pathContext} > ${topic}

请为 "${topic}" 生成 4-6 个核心子方向，并为每个子方向预生成 2-3 个关键细分点（如果有）。`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: baseInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          children: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, description: "节点名称" },
                description: { type: Type.STRING, description: "简要说明" },
                children: {
                  type: Type.ARRAY,
                  description: "该节点的子节点（预生成下一层）",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                       label: { type: Type.STRING },
                       description: { type: Type.STRING }
                    },
                    required: ["label", "description"]
                  }
                }
              },
              required: ["label", "description"]
            }
          }
        }
      }
    }
  });

  if (response.text) {
    try {
      const data = JSON.parse(response.text);
      return data.children || [];
    } catch (e) {
      console.error("Failed to parse JSON", e);
      return [];
    }
  }
  return [];
};

export const generateImage = async (prompt: string, size: string): Promise<GenerateContentResponse> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [
        {
          text: prompt,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: size,
      },
    },
  });
  return response;
};

export const editImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<GenerateContentResponse> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType,
          },
        },
        {
          text: prompt,
        },
      ],
    },
  });
  return response;
};