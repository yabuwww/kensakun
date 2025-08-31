// --- DOM Element Selection (変更なし) ---
/** @type {HTMLFormElement | null} */
const form = document.querySelector('form');
/** @type {HTMLTextAreaElement | null} */
const input = document.querySelector('#ingredients');
// ... (あなたがお持ちの、この他のDOM選択のコードはすべてこのエリアにそのまま残してください) ...
const copyShoppingListBtn = document.querySelector('#copy-shopping-list');


// --- showError (変更なし) ---
const showError = (message) => {
    if (!resultsContainer || !paginationControls || !skeletonLoader) return;
    resultsContainer.innerHTML = `<p class="error">${message}</p>`;
    paginationControls.classList.add('hidden');
    skeletonLoader.classList.add('hidden');
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
};

// --- State Management (変更なし) ---
// ... (あなたがお持ちの、State Management関連のコードはすべてこのエリアにそのまま残してください) ...
let recognition = null;


// --- ★★★ ここからが修正箇所です ★★★ ---

/**
 * GASのウェブアプリと通信してレシピを取得する関数
 * @param {any} query ユーザーが入力した検索条件
 */
const callApiViaGas = async (query) => {
  // 【重要】GASをデプロイした時に発行されたウェブアプリのURLをここに貼り付けてください
  const GAS_WEB_APP_URL = 'ここにあなたのGASのウェブアプリURLを貼り付け';

  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      mode: 'cors', // CORSモードを指定
      credentials: 'omit', // 認証情報は含めない
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // GASではtext/plainを指定
      },
      body: JSON.stringify(query), // ユーザーの入力情報を送信
      redirect: 'follow' // リダイレクトに従う
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    
    // GASから返ってきたAIの応答（JSON文字列）を、さらにJavaScriptのオブジェクトに変換
    const recipes = JSON.parse(data.candidates[0].content.parts[0].text);
    
    // 各レシピにユニークなIDを追加
    return recipes.map((recipe) => ({ ...recipe, id: `recipe-${Date.now()}-${Math.random()}` }));

  } catch (error) {
    console.error("API call via GAS failed:", error);
    showError(error.message || "GASとの通信中に不明なエラーが発生しました。");
    return null;
  }
};

// --- Local Storage Management (変更なし) ---
const loadStateFromLocalStorage = () => {
    // ...(あなたの元のコードのまま)...
};
// ...(この他のあなたのコードも、最後まで変更なしです)...


// --- Event Handlers ---
/**
 * フォームが送信されたときの処理
 * @param {Event} event
 */
const handleFormSubmit = async (event) => {
    event.preventDefault();
    if (!form || !input || !servingsInput || !mealPrepToggle || !allergiesInput || !skeletonLoader || !resultsContainer || !resultArea) return;

    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) return;
    const ingredientsValue = input.value.trim();
    if (!ingredientsValue) {
        input.classList.add('invalid');
        showError('食材を入力してください。');
        return;
    }
    input.classList.remove('invalid');
    
    // ローディング表示
    submitButton.disabled = true;
    submitButton.textContent = '考え中...';
    resultsContainer.innerHTML = '';
    paginationControls?.classList.add('hidden');
    skeletonLoader.classList.remove('hidden');
    resultArea.scrollIntoView({ behavior: 'smooth' });

    const query = {
        ingredients: ingredientsValue,
        servings: servingsInput.value,
        mealPrep: mealPrepToggle.checked,
        allergies: allergiesInput.value.trim(),
    };

    // ★★★ 呼び出す関数を、新しく作ったGAS連携用の関数に変更 ★★★
    const recipes = await callApiViaGas(query);
    
    if (recipes) {
        const newHistoryItem = {
            id: `history-${Date.now()}`,
            query,
            pages: [recipes],
            currentPageIndex: 0,
        };
        history.push(newHistoryItem);
        currentHistoryItem = newHistoryItem;
        saveHistory();
        renderHistory();
        renderSuggestionButtons();
        renderResultsPage();
        showRecipeListView();
    }

    // ローディング表示を終了
    skeletonLoader.classList.add('hidden');
    submitButton.disabled = false;
    submitButton.textContent = '提案してもらう';
};

// ... (この他のあなたのコードも、最後まで変更なしです) ...

// --- App Start ---
document.addEventListener('DOMContentLoaded', init);
