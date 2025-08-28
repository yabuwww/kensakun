
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {GoogleGenAI, Type} from '@google/genai';

// --- DOM Element Selection ---
/** @type {HTMLFormElement | null} */
const form = document.querySelector('form');
/** @type {HTMLTextAreaElement | null} */
const input = document.querySelector('#ingredients');
/** @type {HTMLInputElement | null} */
const servingsInput = document.querySelector('#servings');
/** @type {HTMLButtonElement | null} */
const servingsDecrementBtn = document.querySelector('#servings-decrement');
/** @type {HTMLButtonElement | null} */
const servingsIncrementBtn = document.querySelector('#servings-increment');
/** @type {HTMLInputElement | null} */
const mealPrepToggle = document.querySelector('#meal-prep-toggle');
/** @type {HTMLInputElement | null} */
const allergiesInput = document.querySelector('#allergies');
/** @type {HTMLElement | null} */
const suggestionButtons = document.querySelector('#suggestions');
/** @type {HTMLButtonElement | null} */
const voiceInputBtn = document.querySelector('#voice-input-btn');
/** @type {HTMLElement | null} */
const voiceError = document.querySelector('#voice-error');
/** @type {HTMLButtonElement | null} */
const saveAllergiesBtn = document.querySelector('#save-allergies-btn');

/** @type {HTMLElement | null} */
const resultArea = document.querySelector('#result-area');
/** @type {HTMLElement | null} */
const resultsContainer = document.querySelector('#results');
/** @type {HTMLElement | null} */
const skeletonLoader = document.querySelector('#skeleton-loader');
/** @type {HTMLElement | null} */
const recipeListView = document.querySelector('#recipe-list-view');
/** @type {HTMLElement | null} */
const recipeDetailView = document.querySelector('#recipe-detail-view');

/** @type {HTMLElement | null} */
const paginationControls = document.querySelector('#pagination-controls');
/** @type {HTMLButtonElement | null} */
const prevPageBtn = document.querySelector('#prev-page-btn');
/** @type {HTMLButtonElement | null} */
const nextPageBtn = document.querySelector('#next-page-btn');
/** @type {HTMLElement | null} */
const pageIndicator = document.querySelector('#page-indicator');

/** @type {HTMLElement | null} */
const historyContainer = document.querySelector('#history-container');

/** @type {HTMLInputElement | null} */
const themeSwitcher = document.querySelector('#theme-switcher');

// Bottom Nav
const searchArea = document.getElementById('search-area');
const favoritesArea = document.getElementById('favorites-area');
const shoppingListArea = document.getElementById('shopping-list-area');
const navButtons = {
  search: document.getElementById('nav-search'),
  favorites: document.getElementById('nav-favorites'),
  shoppingList: document.getElementById('nav-shopping-list'),
};
const allContentAreas = [searchArea, favoritesArea, shoppingListArea];
const allNavButtons = Object.values(navButtons).filter(b => b !== null);

/** @type {HTMLElement | null} */
const favoritesContainer = document.querySelector('#favorites-container');
/** @type {HTMLElement | null} */
const shoppingListContainer = document.querySelector('#shopping-list-container');
/** @type {HTMLElement | null} */
const shoppingListActions = document.querySelector('#shopping-list-actions');
/** @type {HTMLButtonElement | null} */
const copyShoppingListBtn = document.querySelector('#copy-shopping-list');

/**
 * Displays an error message in the results container.
 * @param {string} message The error message to display.
 */
const showError = (message) => {
    if (!resultsContainer || !paginationControls || !skeletonLoader) return;
    resultsContainer.innerHTML = `<p class="error">${message}</p>`;
    paginationControls.classList.add('hidden');
    skeletonLoader.classList.add('hidden');
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
};

// --- State Management ---
const RECIPE_HISTORY_STORAGE_KEY = 'recipe-app-history';
const FAVORITES_STORAGE_KEY = 'recipe-app-favorites';
const SHOPPING_LIST_STORAGE_KEY = 'recipe-app-shopping-list';
const ALLERGIES_STORAGE_KEY = 'recipe-app-allergies';

/**
 * @typedef {{
 *   id: string;
 *   query: { ingredients: string; servings: string; mealPrep: boolean; allergies: string; };
 *   pages: any[][];
 *   currentPageIndex: number;
 * }} HistoryItem
 */

/** @type {HistoryItem[]} */
let history = [];
/** @type {HistoryItem | null} */
let currentHistoryItem = null;
/** @type {Set<string>} */
let favorites = new Set();
/** @type {Map<string, { recipeInfo: {id: string, recipeName: string}, items: Set<string> }>} */
let shoppingList = new Map();
/** @type {any} */
let recognition = null;


// --- API Initialization ---
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  showError('APIキーが設定されていません。');
  throw new Error('API_KEY is not set');
}
const ai = new GoogleGenAI({apiKey: API_KEY});

// --- Local Storage Management ---
const loadStateFromLocalStorage = () => {
    try {
        const storedHistory = localStorage.getItem(RECIPE_HISTORY_STORAGE_KEY);
        if (storedHistory) history = JSON.parse(storedHistory);

        const storedFavorites = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (storedFavorites) favorites = new Set(JSON.parse(storedFavorites));

        const storedShoppingList = localStorage.getItem(SHOPPING_LIST_STORAGE_KEY);
        if (storedShoppingList) {
            /** @type {[string, { recipeInfo: any; items: string[] }][]} */
            const parsed = JSON.parse(storedShoppingList);
            // Convert items back to a Set
            parsed.forEach((item) => {
                // @ts-ignore
                item[1].items = new Set(item[1].items);
            });
            // @ts-ignore
            shoppingList = new Map(parsed);
        }

        const storedAllergies = localStorage.getItem(ALLERGIES_STORAGE_KEY);
        if (storedAllergies && allergiesInput) {
            allergiesInput.value = storedAllergies;
        }

        // Theme
        const theme = localStorage.getItem('recipe-app-theme');
        if (theme === 'dark') {
            document.documentElement.classList.add('dark-mode');
            if(themeSwitcher) themeSwitcher.checked = true;
        } else if (theme === 'light') {
            document.documentElement.classList.remove('dark-mode');
            if(themeSwitcher) themeSwitcher.checked = false;
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            if(themeSwitcher) themeSwitcher.checked = true;
        }

    } catch (e) {
        console.error("Error loading state from local storage:", e);
    }
};

const saveHistory = () => {
    localStorage.setItem(RECIPE_HISTORY_STORAGE_KEY, JSON.stringify(history));
};
const saveFavorites = () => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
};
const saveShoppingList = () => {
    // Convert Map to array and Set to array for JSON serialization
    const arrayRepresentation = Array.from(shoppingList.entries()).map(([key, value]) => {
        return [key, { ...value, items: Array.from(value.items) }];
    });
    localStorage.setItem(SHOPPING_LIST_STORAGE_KEY, JSON.stringify(arrayRepresentation));
};
/** @param {string} value */
const saveAllergies = (value) => {
    localStorage.setItem(ALLERGIES_STORAGE_KEY, value);
};

// --- Rendering Functions ---

/** 
 * Creates the HTML for a single recipe card.
 * @param {any} recipe The recipe object.
 * @param {string} origin The view where the card is created ('search' or 'favorites').
 * @returns {HTMLButtonElement}
 */
const createRecipeCard = (recipe, origin) => {
    const card = document.createElement('button');
    card.className = 'result-card';
    card.dataset.recipeId = recipe.id;

    card.innerHTML = `
        <div class="result-card-image" style="background-image: url('https://placehold.jp/30/cccccc/ffffff/300x200.png?text=${encodeURIComponent(recipe.recipeName)}')"></div>
        <div class="result-card-summary">
            <div class="result-card-text">
                <h3>${recipe.recipeName}</h3>
                <div class="recipe-meta">
                    <span>${recipe.cookingTime}</span>
                    <span>${recipe.servings}</span>
                </div>
            </div>
            <button class="like-btn" aria-label="お気に入りに追加" data-recipe-id="${recipe.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
            </button>
        </div>
    `;
    /** @type {HTMLButtonElement | null} */
    const likeBtn = card.querySelector('.like-btn');
    if (favorites.has(recipe.id)) {
        likeBtn?.classList.add('liked');
    }

    // --- Event Listeners ---
    likeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(recipe.id);
        likeBtn.classList.toggle('liked');
        renderFavorites(); // Update favorites tab
        updateNavBadges(); // Update nav badge
    });

    const openDetailView = () => {
        switchView('search-area');
        showRecipeDetailView(recipe, origin);
    };

    card.addEventListener('click', openDetailView);
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            openDetailView();
        }
    });

    return card;
};

/** Renders the current page of recipes. */
const renderResultsPage = () => {
    if (!currentHistoryItem || !resultsContainer) return;
    const recipes = currentHistoryItem.pages[currentHistoryItem.currentPageIndex];

    resultsContainer.innerHTML = ''; // Clear previous results
    if (recipes && recipes.length > 0) {
        recipes.forEach((recipe) => {
            resultsContainer.appendChild(createRecipeCard(recipe, 'search'));
        });
    } else {
        resultsContainer.innerHTML = '<p class="placeholder">レシピが見つかりませんでした。</p>';
    }
    updatePagination();
};

/** Updates the pagination controls. */
const updatePagination = () => {
    if (!currentHistoryItem || !paginationControls || !pageIndicator || !prevPageBtn || !nextPageBtn) return;

    const { currentPageIndex, pages } = currentHistoryItem;
    const totalPages = pages.length;

    if (totalPages > 1) {
        paginationControls.classList.remove('hidden');
        pageIndicator.textContent = `${currentPageIndex + 1} / ${totalPages}`;
        prevPageBtn.disabled = currentPageIndex === 0;
        nextPageBtn.disabled = currentPageIndex === totalPages - 1;
    } else {
        paginationControls.classList.add('hidden');
    }
};

/** Renders the search history list. */
const renderHistory = () => {
    if (!historyContainer) return;
    historyContainer.innerHTML = '';
    if (history.length === 0) {
        historyContainer.innerHTML = '<p class="placeholder">まだ履歴はありません。</p>';
        return;
    }

    history.slice().reverse().forEach(item => { // Show most recent first
        const historyItemEl = document.createElement('button');
        historyItemEl.className = 'history-item';
        historyItemEl.dataset.historyId = item.id;
        historyItemEl.innerHTML = `
            <span class="history-ingredients">${item.query.ingredients}</span>
            <div class="history-meta">
                <span>${item.query.servings}人分</span>
                ${item.query.mealPrep ? '<span>作り置き</span>' : ''}
                ${item.query.allergies ? `<span>除外: ${item.query.allergies}</span>` : ''}
            </div>
        `;
        historyItemEl.addEventListener('click', () => handleHistoryClick(item.id));
        historyContainer.appendChild(historyItemEl);
    });
};

/** 
 * Toggles a recipe in the favorites list. 
 * @param {string} recipeId
 */
const toggleFavorite = (recipeId) => {
    if (favorites.has(recipeId)) {
        favorites.delete(recipeId);
    } else {
        favorites.add(recipeId);
    }
    saveFavorites();
};

/** Renders the list of favorite recipes. */
const renderFavorites = () => {
    if (!favoritesContainer) return;
    favoritesContainer.innerHTML = '';
    if (favorites.size === 0) {
        favoritesContainer.innerHTML = '<p class="placeholder">お気に入りレシピはありません。</p>';
        return;
    }

    const allRecipes = history.flatMap(h => h.pages).flat();
    const favoriteRecipes = allRecipes.filter(r => favorites.has(r.id));

    favoriteRecipes.forEach(recipe => {
        favoritesContainer.appendChild(createRecipeCard(recipe, 'favorites'));
    });
};


/** Renders the shopping list. */
const renderShoppingList = () => {
    if (!shoppingListContainer || !shoppingListActions) return;
    shoppingListContainer.innerHTML = '';

    if (shoppingList.size === 0) {
        shoppingListContainer.innerHTML = '<p class="placeholder">買い物リストは空です。</p>';
        shoppingListActions.classList.add('hidden');
        return;
    }

    shoppingListActions.classList.remove('hidden');

    for (const [recipeId, listItem] of shoppingList.entries()) {
        const groupEl = document.createElement('div');
        groupEl.className = 'shopping-list-group';

        const allIngredients = Array.from(listItem.items).map(item => `<li>${item}</li>`).join('');

        groupEl.innerHTML = `
            <div class="shopping-list-group-header">
                <h3>${listItem.recipeInfo.recipeName}</h3>
                <button class="remove-recipe-btn" data-recipe-id="${recipeId}">リストから削除</button>
            </div>
            <ul>${allIngredients}</ul>
        `;
        shoppingListContainer.appendChild(groupEl);
    }
};

/** Renders suggestion buttons based on search history. */
const renderSuggestionButtons = () => {
    if (!suggestionButtons) return;

    const ingredientCounts = new Map();

    // 1. Extract and count ingredients from history
    history.forEach(item => {
        const ingredients = item.query.ingredients
            .split(/,|、|\s+/) // Split by comma, Japanese comma, or space
            .map((ing) => ing.trim())
            .filter((ing) => ing); // Remove empty strings
        
        ingredients.forEach((ingredient) => {
            ingredientCounts.set(ingredient, (ingredientCounts.get(ingredient) || 0) + 1);
        });
    });
    
    // 2. Sort by frequency and get the top 7
    const sortedIngredients = Array.from(ingredientCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0])
        .slice(0, 7);

    // 3. Update UI
    suggestionButtons.innerHTML = ''; // Clear existing buttons

    if (sortedIngredients.length > 0) {
        sortedIngredients.forEach(ingredient => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'suggestion-btn';
            button.textContent = ingredient;
            suggestionButtons.appendChild(button);
        });
    } else {
        // Fallback to default suggestions if history is empty
        const defaultSuggestions = ['鶏肉', '豚肉', '玉ねぎ', 'じゃがいも', 'にんじん', 'キャベツ', '卵'];
        defaultSuggestions.forEach(ingredient => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'suggestion-btn';
            button.textContent = ingredient;
            suggestionButtons.appendChild(button);
        });
    }
};


// --- View Management ---

const showRecipeListView = () => {
    if(!recipeListView || !recipeDetailView) return;
    recipeDetailView.classList.add('hidden');
    recipeListView.classList.remove('hidden');
    resultsContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/**
 * @param {any} recipe
 * @param {string} origin
 */
const showRecipeDetailView = (recipe, origin) => {
    if(!recipeListView || !recipeDetailView) return;
    recipeListView.classList.add('hidden');
    recipeDetailView.classList.remove('hidden');

    const ingredientsHTML = recipe.ingredients.map((group) => `
        ${group.subHeading ? `<h4 class="material-subheading">${group.subHeading}</h4>` : ''}
        ${group.items.map((item) => `<li><label><input type="checkbox" data-ingredient="${item}"> ${item}</label></li>`).join('')}
    `).join('');

    const instructionsHTML = recipe.instructions.map((step, index) => `<li><div class="step-number">${index + 1}</div><p>${step}</p></li>`).join('');

    recipeDetailView.innerHTML = `
        <div class="recipe-detail-header">
             <button id="back-to-list-btn">◀ リストに戻る</button>
             <button id="detail-like-btn" class="like-btn ${favorites.has(recipe.id) ? 'liked' : ''}" aria-label="お気に入りに追加" data-recipe-id="${recipe.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
            </button>
        </div>
        <h2 class="recipe-detail-title">${recipe.recipeName}</h2>
        <div class="recipe-meta">
            <span>${recipe.cookingTime}</span>
            <span>${recipe.servings}</span>
        </div>
        ${recipe.description ? `<p class="recipe-description">${recipe.description}</p>` : ''}

        <h4>材料</h4>
        <p class="pantry-check-instruction">買い物リストに追加する材料にチェック！</p>
        <ul class="ingredient-list">${ingredientsHTML}</ul>

        <h4>作り方</h4>
        <ol class="instructions-list">${instructionsHTML}</ol>

        <div class="detail-actions">
            <button id="add-to-shopping-list-from-detail">チェックした材料を買い物リストへ追加</button>
        </div>
    `;

    document.getElementById('back-to-list-btn')?.addEventListener('click', () => {
        if (origin === 'favorites') {
            switchView('favorites-area');
        } else {
            showRecipeListView();
        }
    });
    
    document.getElementById('detail-like-btn')?.addEventListener('click', (e) => {
        /** @type {HTMLButtonElement} */
        const button = e.currentTarget;
        toggleFavorite(recipe.id);
        button.classList.toggle('liked');

        // Sync with the list view card's like button
        const listCardLikeBtn = recipeListView?.querySelector(`.result-card[data-recipe-id="${recipe.id}"] .like-btn`);
        listCardLikeBtn?.classList.toggle('liked', favorites.has(recipe.id));

        renderFavorites();
        updateNavBadges();
    });

    document.getElementById('add-to-shopping-list-from-detail')?.addEventListener('click', () => {
        /** @type {NodeListOf<HTMLInputElement>} */
        const checkboxes = recipeDetailView.querySelectorAll('.ingredient-list input[type="checkbox"]:checked');
        const selectedItems = Array.from(checkboxes).map(cb => cb.dataset.ingredient || '');
        
        /** @type {HTMLButtonElement | null} */
        const button = document.getElementById('add-to-shopping-list-from-detail');
        
        if (button) {
            if (selectedItems.length > 0) {
                const recipeInfo = { id: recipe.id, recipeName: recipe.recipeName };
                const existingEntry = shoppingList.get(recipe.id) || { recipeInfo, items: new Set() };
                selectedItems.forEach(item => existingEntry.items.add(item));
                shoppingList.set(recipe.id, existingEntry);
                saveShoppingList();
                renderShoppingList();
                updateNavBadges();
                
                button.textContent = '追加しました！';
                button.disabled = true;
                setTimeout(() => {
                    button.textContent = 'チェックした材料を買い物リストへ追加';
                    button.disabled = false;
                }, 2000);
            } else {
                button.textContent = '追加する材料を選択してください';
                button.disabled = true;
                setTimeout(() => {
                    button.textContent = 'チェックした材料を買い物リストへ追加';
                    button.disabled = false;
                }, 2000);
            }
        }
    });

    recipeDetailView.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/** 
 * Switches the main content view.
 * @param {string} targetAreaId 
 */
const switchView = (targetAreaId) => {
    allContentAreas.forEach(area => area?.classList.add('hidden'));
    allNavButtons.forEach(button => button?.classList.remove('active'));

    const targetArea = document.getElementById(targetAreaId);
    targetArea?.classList.remove('hidden');

    const targetButton = navButtons[targetAreaId.replace('-area', '')];
    targetButton?.classList.add('active');

    // If switching to the search area, always reset to the list view.
    if (targetAreaId === 'search-area') {
        showRecipeListView();
    }
};


// --- Gemini API ---
/**
 * @param {any} query
 */
const callGeminiAPI = async (query) => {
    const { ingredients, servings, mealPrep, allergies } = query;
    const prompt = `
        「${ingredients}」を使ったレシピを5つ提案してください。
        - 人数: ${servings}人前
        ${mealPrep ? '- 作り置きに適したレシピを優先してください。' : ''}
        ${allergies ? `- アレルギー/苦手な食材として「${allergies}」は絶対に使用しないでください。` : ''}
        - レシピは多様なジャンルのものを提案してください。
        - 料理の簡単な説明を必ずdescriptionに含めてください。
        - レスポンスは必ず指定したJSONスキーマに従ってください。
    `;
    
     const recipeResponseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            recipeName: { type: Type.STRING, description: '料理名' },
            description: { type: Type.STRING, description: '料理の簡単な説明(2-3文)' },
            servings: { type: Type.STRING, description: '何人前かを示す文字列 (例: "2人分")' },
            cookingTime: { type: Type.STRING, description: '調理時間 (例: "約20分")' },
            ingredients: {
              type: Type.ARRAY,
              description: '材料のリスト。肉や野菜などの主要な材料と、調味料などを分けるためにsubHeadingを使用する。',
              items: {
                type: Type.OBJECT,
                properties: {
                  subHeading: { type: Type.STRING, description: '材料の小見出し (例: "豚バラ肉", "合わせ調味料")。不要な場合は省略。' },
                  items: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING, description: '材料とその分量 (例: "豚バラ薄切り肉 200g")' }
                  }
                },
                required: ['items']
              }
            },
            instructions: {
              type: Type.ARRAY,
              description: '作り方の手順リスト',
              items: { type: Type.STRING }
            }
          },
          required: ['recipeName', 'servings', 'cookingTime', 'ingredients', 'instructions', 'description']
        }
    };


    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: recipeResponseSchema,
            },
        });
        
        const responseText = response.text;
        const recipes = JSON.parse(responseText);
        
        // Add unique IDs to each recipe
        return recipes.map((recipe) => ({ ...recipe, id: `recipe-${Date.now()}-${Math.random()}` }));

    } catch (error) {
        console.error("Gemini API call failed:", error);
        showError("レシピの取得中にエラーが発生しました。時間をおいて再試行してください。");
        return null;
    }
};

// --- Event Handlers ---
/**
 * @param {Event} event
 */
const handleFormSubmit = async (event) => {
    event.preventDefault();
    if (!form || !input || !servingsInput || !mealPrepToggle || !allergiesInput || !skeletonLoader || !resultsContainer || !resultArea) return;

    /** @type {HTMLButtonElement | null} */
    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) return;
    const ingredientsValue = input.value.trim();
    if (!ingredientsValue) {
        input.classList.add('invalid');
        showError('食材を入力してください。');
        return;
    }
    input.classList.remove('invalid');
    
    // Show loading state
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

    const recipes = await callGeminiAPI(query);
    
    if (recipes) {
        /** @type {HistoryItem} */
        const newHistoryItem = {
            id: `history-${Date.now()}`,
            query,
            pages: [recipes], // For now, we only get one page of results
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

    // Hide loading state
    skeletonLoader.classList.add('hidden');
    submitButton.disabled = false;
    submitButton.textContent = 'レシピを探す';
};

/**
 * @param {string} historyId
 */
const handleHistoryClick = (historyId) => {
    const item = history.find(h => h.id === historyId);
    if (item) {
        currentHistoryItem = item;
        // Populate form with historical data
        if(input) input.value = item.query.ingredients;
        if(servingsInput) servingsInput.value = item.query.servings;
        if(mealPrepToggle) mealPrepToggle.checked = item.query.mealPrep;
        if(allergiesInput) allergiesInput.value = item.query.allergies;

        renderResultsPage();
        showRecipeListView();
        switchView('search-area');
        resultsContainer?.scrollIntoView({ behavior: 'smooth' });
    }
};

const updateNavBadges = () => {
    const favBadge = navButtons.favorites?.querySelector('.badge');
    const listBadge = navButtons.shoppingList?.querySelector('.badge');

    if (favBadge) {
        if (favorites.size > 0) {
            favBadge.textContent = String(favorites.size);
            favBadge.classList.remove('hidden');
        } else {
            favBadge.classList.add('hidden');
        }
    }
    if (listBadge) {
        if (shoppingList.size > 0) {
            listBadge.textContent = String(shoppingList.size);
            listBadge.classList.remove('hidden');
        } else {
            listBadge.classList.add('hidden');
        }
    }
};

// --- Initialization ---

const init = () => {
    loadStateFromLocalStorage();
    renderHistory();
    renderSuggestionButtons();
    renderFavorites();
    renderShoppingList();
    updateNavBadges();
    
    // Add event listeners
    form?.addEventListener('submit', handleFormSubmit);

    servingsDecrementBtn?.addEventListener('click', () => {
        servingsInput?.stepDown();
    });
    servingsIncrementBtn?.addEventListener('click', () => {
        servingsInput?.stepUp();
    });

    suggestionButtons?.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        if (target.classList.contains('suggestion-btn')) {
            if (input) {
                const currentVal = input.value.trim();
                input.value = currentVal ? `${currentVal}、${target.textContent}` : target.textContent || '';
            }
        }
    });
    
    saveAllergiesBtn?.addEventListener('click', () => {
        if (allergiesInput && saveAllergiesBtn) {
            saveAllergies(allergiesInput.value);
            saveAllergiesBtn.textContent = '保存済み';
            saveAllergiesBtn.classList.add('saved');
            saveAllergiesBtn.disabled = true;
            setTimeout(() => {
                saveAllergiesBtn.textContent = '保存';
                saveAllergiesBtn.classList.remove('saved');
                saveAllergiesBtn.disabled = false;
            }, 2000);
        }
    });
    
    prevPageBtn?.addEventListener('click', () => {
        if (currentHistoryItem && currentHistoryItem.currentPageIndex > 0) {
            currentHistoryItem.currentPageIndex--;
            renderResultsPage();
        }
    });

    nextPageBtn?.addEventListener('click', () => {
        if (currentHistoryItem && currentHistoryItem.currentPageIndex < currentHistoryItem.pages.length - 1) {
            currentHistoryItem.currentPageIndex++;
            renderResultsPage();
        }
    });

    // Bottom Nav
    allNavButtons.forEach(button => {
        button?.addEventListener('click', () => {
            const target = button.id.replace('nav-', '');
            switchView(`${target}-area`);
        });
    });

    shoppingListContainer?.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        if (target.classList.contains('remove-recipe-btn')) {
            const recipeId = target.dataset.recipeId;
            if (recipeId) {
                shoppingList.delete(recipeId);
                saveShoppingList();
                renderShoppingList();
                updateNavBadges();
            }
        }
    });

    copyShoppingListBtn?.addEventListener('click', () => {
        let textToCopy = "買い物リスト\n==========\n\n";
        shoppingList.forEach((item) => {
            textToCopy += `■ ${item.recipeInfo.recipeName}\n`;
            item.items.forEach((ingredient) => {
                textToCopy += `- ${ingredient}\n`;
            });
            textToCopy += '\n';
        });

        navigator.clipboard.writeText(textToCopy).then(() => {
            if(copyShoppingListBtn) {
                copyShoppingListBtn.textContent = 'コピーしました！';
                copyShoppingListBtn.disabled = true;
                setTimeout(() => {
                    copyShoppingListBtn.textContent = 'リストをコピー';
                    copyShoppingListBtn.disabled = false;
                }, 2000);
            }
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            if (copyShoppingListBtn) {
                copyShoppingListBtn.textContent = 'コピー失敗';
            }
        });
    });
    
    // Theme Switcher
    themeSwitcher?.addEventListener('change', () => {
        if (themeSwitcher.checked) {
            document.documentElement.classList.add('dark-mode');
            localStorage.setItem('recipe-app-theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark-mode');
            localStorage.setItem('recipe-app-theme', 'light');
        }
    });
    
    // Voice Input
    // @ts-ignore
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
        recognition = new SpeechRecognitionAPI();
        recognition.continuous = false;
        recognition.lang = 'ja-JP';
        recognition.interrimResults = false;

        /** @param {string} message */
        const showVoiceError = (message) => {
            if (voiceError) {
                voiceError.textContent = message;
                voiceError.classList.remove('hidden');
            }
        };
        const hideVoiceError = () => {
            if (voiceError) voiceError.classList.add('hidden');
        };

        const setUIAccessDenied = () => {
            showVoiceError('マイクがブロックされています。ブラウザの設定で、このサイトへのマイクアクセスを許可してください。');
            if (voiceInputBtn) {
                voiceInputBtn.disabled = true;
                voiceInputBtn.setAttribute('aria-label', '音声入力 (マイクがブロックされています)');
                voiceInputBtn.setAttribute('title', 'マイクへのアクセスがブロックされています');
            }
        };

        const setUIAccessGranted = () => {
            hideVoiceError();
            if (voiceInputBtn) {
                voiceInputBtn.disabled = false;
                voiceInputBtn.setAttribute('aria-label', '音声入力');
                voiceInputBtn.setAttribute('title', '音声入力');
            }
        };

        // Proactively check permissions if API is available
        if (navigator.permissions) {
             // @ts-ignore
             navigator.permissions.query({ name: 'microphone' }).then((permissionStatus) => {
                const updateUIForPermission = () => {
                    if (permissionStatus.state === 'denied') {
                        setUIAccessDenied();
                    } else {
                        setUIAccessGranted();
                    }
                };
                updateUIForPermission(); // Initial check
                permissionStatus.onchange = updateUIForPermission; // Listen for changes
            }).catch(err => {
                console.warn('Could not query microphone permissions. Relying on onerror.', err);
                setUIAccessGranted(); // Assume granted and let onerror catch it if not.
            });
        } else {
            // If Permissions API is not supported, enable button by default and rely on onerror.
            setUIAccessGranted();
        }


        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.replace(/。/g, ''); //句点を削除
            if (input) {
                const currentVal = input.value.trim();
                input.value = currentVal ? `${currentVal}、${transcript}` : transcript;
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            let errorMessage = '音声認識中にエラーが発生しました。';
            if (event.error === 'not-allowed') {
                setUIAccessDenied();
            } else if (event.error === 'no-speech') {
                errorMessage = '音声が聞き取れませんでした。もう一度お試しください。';
                showVoiceError(errorMessage);
            } else if (event.error === 'network') {
                errorMessage = 'ネットワークエラーが発生しました。接続を確認してください。';
                showVoiceError(errorMessage);
            } else if (event.error === 'service-not-allowed') {
                 errorMessage = 'セキュリティ上の理由により、音声認識は利用できません。サイトがHTTPSで提供されていることを確認してください。';
                 showVoiceError(errorMessage);
                 if (voiceInputBtn) voiceInputBtn.disabled = true;
            } else {
                showVoiceError(errorMessage);
            }
        };

        recognition.onend = () => {
            voiceInputBtn?.classList.remove('is-listening');
        };

        voiceInputBtn?.addEventListener('click', () => {
            if (recognition && voiceInputBtn && !voiceInputBtn.disabled) {
                 hideVoiceError();
                 voiceInputBtn.classList.add('is-listening');
                 recognition.start();
            }
        });

    } else {
        console.warn('Speech Recognition API not supported.');
        voiceInputBtn?.remove();
    }

};

// --- App Start ---
document.addEventListener('DOMContentLoaded', init);
