const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event) {
  // Netlifyの安全な場所（環境変数）からAPIキーを読み込む
  const API_KEY = process.env.VITE_GEMINI_API_KEY;

  // もしAPIキーが設定されていなければ、エラーを返す
  if (!API_KEY) {
      return { 
          statusCode: 500, 
          body: JSON.stringify({ error: "APIキーがサーバーに設定されていません。" }) 
      };
  }
  
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  // ユーザーのサイトから送られてきた食材のデータを受け取る
  const { ingredients } = JSON.parse(event.body);

  // AIに送る詳細な指示文（プロンプト）
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
    // AIに指示を送り、答えを待つ
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // 成功したら、AIからの答えをユーザーのサイトに送り返す
    return { 
        statusCode: 200, 
        body: JSON.stringify({ text }) 
    };
  } catch (error) {
    console.error(error);
    // もしAIとの通信でエラーが起きたら、エラーメッセージを返す
    return { 
        statusCode: 500, 
        body: JSON.stringify({ error: "AIからの応答取得中にエラーが発生しました。" }) 
    };
  }
};
