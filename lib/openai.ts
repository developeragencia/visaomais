import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Analisa uma imagem facial para obter medições ópticas
 * @param base64Image Imagem em base64 da face do cliente
 * @returns Medições ópticas como DP (Distância Pupilar), etc.
 */
export async function analyzeFacialMeasurements(base64Image: string): Promise<{
  dp: number;
  dpnLeft: number;
  dpnRight: number;
  apLeft: number;
  apRight: number;
  confidence: number;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Você é um especialista em medições ópticas. Analise a imagem facial e forneça as seguintes medidas com precisão: \n" +
            "1. DP (Distância Pupilar total em mm)\n" +
            "2. DPL (Distância Pupilar até o nariz à esquerda em mm)\n" +
            "3. DPR (Distância Pupilar até o nariz à direita em mm)\n" +
            "4. APL (Altura Pupilar à esquerda em mm)\n" +
            "5. APR (Altura Pupilar à direita em mm)\n" +
            "Também forneça um valor de confiança de 0 a 1 para a precisão da medida. Responda com JSON neste formato: { \"dp\": número, \"dpnLeft\": número, \"dpnRight\": número, \"apLeft\": número, \"apRight\": número, \"confidence\": número }"
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Por favor, forneça medições ópticas precisas com base nesta imagem facial:"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content);

    return {
      dp: parseFloat(result.dp) || 62.0, // Valor médio padrão se não for possível determinar
      dpnLeft: parseFloat(result.dpnLeft) || 31.0,
      dpnRight: parseFloat(result.dpnRight) || 31.0,
      apLeft: parseFloat(result.apLeft) || 30.0,
      apRight: parseFloat(result.apRight) || 30.0,
      confidence: parseFloat(result.confidence) || 0.7,
    };
  } catch (error) {
    console.error("Erro ao analisar medições faciais:", error);
    // Retorna valores médios em caso de erro
    return {
      dp: 62.0,
      dpnLeft: 31.0,
      dpnRight: 31.0,
      apLeft: 30.0,
      apRight: 30.0,
      confidence: 0.5,
    };
  }
}

/**
 * Analisa uma imagem facial para verificar posicionamento e enquadramento
 * @param base64Image Imagem em base64 da face do cliente
 * @returns Feedback sobre o posicionamento facial
 */
export async function analyzeFacialPosition(base64Image: string): Promise<{
  isCorrect: boolean;
  feedback: string;
  suggestions: string[];
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Você é um especialista em análise de enquadramento facial para medições ópticas. " +
            "Avalie se o rosto está bem posicionado para medições ópticas precisas: " +
            "1. O rosto deve estar olhando diretamente para a câmera (sem inclinação) " +
            "2. Boa iluminação, sem sombras fortes sobre os olhos " +
            "3. Ambos os olhos devem estar bem visíveis e abertos " +
            "4. Enquadramento deve incluir o rosto completo " +
            "5. Sem obstruções (como cabelo) cobrindo os olhos " +
            "Responda com JSON no formato: { \"isCorrect\": boolean, \"feedback\": string, \"suggestions\": [array de strings com sugestões de melhoria] }"
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analise se esta imagem facial está bem posicionada para medições ópticas precisas:"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Erro ao analisar posicionamento facial:", error);
    return {
      isCorrect: false,
      feedback: "Não foi possível analisar a imagem. Por favor, tente novamente.",
      suggestions: ["Verifique sua conexão com a internet", "Tente outra foto com melhor iluminação"],
    };
  }
}