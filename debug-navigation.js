// Debug script to check navigation type
console.log('Navigation type:', performance.getEntriesByType('navigation')[0]?.type);
console.log('All navigation entries:', performance.getEntriesByType('navigation'));