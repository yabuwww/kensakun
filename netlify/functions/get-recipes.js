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
    あなたは、冷蔵庫の残り物から献立のアイデアを出すのが得意な、フレンドリーな料理アシスタントです。
    ユーザーが入力した「${ingredients}」という食材から作れそうな料理のアイデアを、最大3つまで提案してください。

    # 絶対に守るべきルール
    - あなた自身はレシピを考えてはいけません。役割はアイデアの提案と、信頼できるレシピサイトへの橋渡しのみです。
    - 提案する各料理について、必ず以下のフォーマットに従ってMarkdown形式で出力してください。

    # 出力フォーマット
    ### 🍳 [ここに料理名]
    * [クックパッドで「[ここに料理名]」のレシピを探す](https://cookpad.com/search/[ここに料理名])
    * [クラシルで「[ここに料理名]」のレシピを探す](https://www.kurashiru.com/search?query=[ここに料理名])
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
