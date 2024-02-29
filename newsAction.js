// src/store/actions/newsActions.js

export const fetchArticles = () => {
  return async (dispatch) => {
    try {
      const response = await fetch('/articles');
      if (!response.ok) {
        throw new Error('Failed to fetch articles');
      }
      const data = await response.json();
      dispatch({ type: 'FETCH_ARTICLES_SUCCESS', payload: data.articles });
    } catch (error) {
      dispatch({ type: 'FETCH_ARTICLES_FAILURE', payload: error.message });
    }
  };
};
