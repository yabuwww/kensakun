const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

exports.handler = async function (event) {
  const API_KEY = process.env.VITE_GEMINI_API_KEY; // Netlifyの環境変数からキーを読み込む
  if (!API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "APIキーが設定されていません。" }) };
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // モデル名を指定

  const { ingredients, servings, mealPrep, allergies } = JSON.parse(event.body);

  // AIへの指示文（プロンプト）
  const prompt = `
    「${ingredients}」を使ったレシピを5つ提案してください。
    - 人数: ${servings}人前
    ${mealPrep ? '- 作り置きに適したレシピを優先してください。' : ''}
    ${allergies ? `- アレルギー/苦手な食材として「${allergies}」は絶対に使用しないでください。` : ''}
    - レシピは多様なジャンルのものを提案してください。
    - 料理の簡単な説明を必ずdescriptionに含めてください。
    - レスポンスは必ず指定したJSONスキーマに従ってください。
  `;

  try {
    const result = await model.generateContent({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
        // 安全設定（必要に応じて調整）
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ]
    });

    const responseText = result.response.text();
    // 成功したら、AIからの答えをサイト本体に送り返す
    return { statusCode: 200, body: responseText };

  } catch (error) {
    console.error("Gemini API call failed:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "レシピの取得中にエラーが発生しました。" }) };
  }
};
