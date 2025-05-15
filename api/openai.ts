import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Function to analyze facial image and calculate optical measurements
export async function analyzeImage(base64Image: string): Promise<{
  dp: number;
  dpnLeft: number;
  dpnRight: number;
  apLeft: number;
  apRight: number;
  confidence: number;
}> {
  try {
    // Prepare prompt for analyzing facial measurements
    const prompt = `
      You are a professional optical measurement system. I'll provide you with a facial photo.
      
      Your task is to analyze this photo and determine the following measurements:
      1. DP (Pupillary Distance): The distance between the centers of the pupils in millimeters.
      2. DPN Left (Left Naso-Pupillary Distance): Distance from the center of the bridge of the nose to the center of the left pupil in millimeters.
      3. DPN Right (Right Naso-Pupillary Distance): Distance from the center of the bridge of the nose to the center of the right pupil in millimeters.
      4. AP Left (Left Pupillary Height): Vertical distance from the center of the left pupil to a horizontal line passing through the bottom of the frame in millimeters.
      5. AP Right (Right Pupillary Height): Same as AP Left but for the right pupil.
      
      Please use standard adult facial proportions and facial landmarks to estimate these measurements as accurately as possible. 
      
      Respond with ONLY a JSON object containing these measurements as numbers (no units) and a confidence score between 0 and 1. 
      The structure should be:
      { 
        "dp": number, 
        "dpnLeft": number, 
        "dpnRight": number, 
        "apLeft": number, 
        "apRight": number, 
        "confidence": number 
      }
    `;

    // Make the API call to OpenAI's GPT-4o model
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    // Parse the response
    const measurements = JSON.parse(response.choices[0].message.content);

    // Validate the results
    if (!measurements.dp || !measurements.dpnLeft || !measurements.dpnRight || 
        !measurements.apLeft || !measurements.apRight || !measurements.confidence) {
      throw new Error("A análise da imagem não retornou todas as medidas necessárias");
    }

    // Ensure the confidence is within 0-1 range
    const confidence = Math.max(0, Math.min(1, measurements.confidence));

    // Return the measurements
    return {
      dp: parseFloat(measurements.dp.toFixed(1)),
      dpnLeft: parseFloat(measurements.dpnLeft.toFixed(1)),
      dpnRight: parseFloat(measurements.dpnRight.toFixed(1)),
      apLeft: parseFloat(measurements.apLeft.toFixed(1)),
      apRight: parseFloat(measurements.apRight.toFixed(1)),
      confidence
    };
  } catch (error) {
    console.error("Error in OpenAI image analysis:", error);
    throw new Error(`Erro na análise da imagem: ${error.message || "Falha no processamento"}`);
  }
}
