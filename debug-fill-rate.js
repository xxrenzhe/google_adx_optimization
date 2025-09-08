// Test script to analyze fill rate distribution
const fs = require('fs');

// Read the result file
const result = JSON.parse(fs.readFileSync('./results/0b6e4165-d6f0-41ca-911e-d5e574c2d370.json', 'utf8'));

console.log('Sample data length:', result.sampleData.length);

// Calculate fill rate distribution
const ranges = [
  { min: 0, max: 20, label: '0-20%' },
  { min: 20, max: 40, label: '20-40%' },
  { min: 40, max: 60, label: '40-60%' },
  { min: 60, max: 80, label: '60-80%' },
  { min: 80, max: 100, label: '80-100%' }
];

console.log('\nFill Rate Distribution:');
const distribution = ranges.map(range => {
  const count = result.sampleData.filter(row => {
    const fillRate = row.fillRate !== undefined ? row.fillRate : 
                     (row.requests > 0 ? (row.impressions / row.requests * 100) : 0);
    return fillRate >= range.min && fillRate < range.max;
  }).length;
  
  console.log(`${range.label}: ${count} rows`);
  return {
    range: range.label,
    count
  };
});

// Show some sample fill rate values
console.log('\nSample fill rate values:');
result.sampleData.slice(0, 10).forEach((row, i) => {
  console.log(`Row ${i + 1}: ${row.fillRate?.toFixed(2)}% (requests: ${row.requests}, impressions: ${row.impressions})`);
});

// Check if all values are in similar range
const fillRates = result.sampleData.map(row => row.fillRate);
const min = Math.min(...fillRates);
const max = Math.max(...fillRates);
const avg = fillRates.reduce((a, b) => a + b, 0) / fillRates.length;

console.log(`\nFill Rate Stats:`);
console.log(`Min: ${min.toFixed(2)}%`);
console.log(`Max: ${max.toFixed(2)}%`);
console.log(`Avg: ${avg.toFixed(2)}%`);