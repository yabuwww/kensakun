// 最初のimport文はそのまま残します
import {GoogleGenAI, Type} from '@google/genai';

// --- DOM Element Selection (変更なし) ---
const form = document.querySelector('form');
// ...(あなたの元のコードのまま)...
const copyShoppingListBtn = document.querySelector('#copy-shopping-list');

// --- showError (変更なし) ---
const showError = (message) => {
    // ...(あなたの元のコードのまま)...
};

// --- State Management (変更なし) ---
// ...(あなたの元のコードのまま)...
let recognition = null;

// --- ★★★ ここからが修正箇所 ★★★ ---

// --- API Initialization ---
// APIキーとGoogleGenAIの初期化は不要なので、まるごと削除します。

// --- Gemini API ---
const callGeminiAPI = async (query) => {
    try {
        // Netlify上の「秘密のメッセンジャー」にリクエストを送信
        const response = await fetch('/.netlify/functions/get-recipes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(query), // クエリ情報をそのまま送る
        });

        const responseText = await response.text();
        if (!response.ok) {
            // エラーの場合は、メッセンジャーからのエラーメッセージを解読して表示
            const errorData = JSON.parse(responseText);
            throw new Error(errorData.error || '不明なエラーが発生しました。');
        }

        const recipes = JSON.parse(responseText);

        // 各レシピにユニークなIDを追加
        return recipes.map((recipe) => ({ ...recipe, id: `recipe-${Date.now()}-${Math.random()}` }));

    } catch (error) {
        console.error("API call failed:", error);
        showError(error.message);
        return null;
    }
};

// --- ★★★ ここまでの修正 ★★★ ---

// --- Local Storage Management (変更なし) ---
const loadStateFromLocalStorage = () => {
    // ...(あなたの元のコードのまま)...
};
// ...(以下、ファイルの最後まで変更なし)...
const init = () => {
    // ...(あなたの元のコードのまま)...
};
document.addEventListener('DOMContentLoaded', init);
