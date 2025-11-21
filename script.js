// Script for Index page
document.addEventListener('DOMContentLoaded', () => {
  // Init Theme is handled by ui-components.js which is included in index.html
  
  // Render History Preview
  if(typeof renderHistoryList === 'function') {
      renderHistoryList('historyQuickList', 5);
  } else {
      console.warn('renderHistoryList not found');
  }
});
