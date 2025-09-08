// Test script to verify the separation of sample and full analytics data
const fs = require('fs');

// This would be the result after processing with the new logic
const result = {
  summary: {
    totalRows: 217402,
    totalRevenue: 26506.90,
    totalImpressions: 1439912,
    totalRequests: 3579941
  },
  sampleData: [], // Would have 100 rows
  fullAnalyticsData: [] // Would have ~70,000 rows (50k full + every 1000th after that)
};

console.log('Expected data structure:');
console.log('- sampleData: 100 rows (for preview in upload tab)');
console.log('- fullAnalyticsData: ~70,000 rows (for analytics)');
console.log('- Summary: Aggregated from all 217,402 rows');

// Simulate fill rate calculation with different data sizes
function calculateFillRateDistribution(data, totalRows) {
  if (!data || data.length === 0) {
    return [
      { range: '0-20%', count: 0 },
      { range: '20-40%', count: 0 },
      { range: '40-60%', count: 0 },
      { range: '60-80%', count: 0 },
      { range: '80-100%', count: 0 }
    ]
  }
  
  const ranges = [
    { min: 0, max: 20, label: '0-20%' },
    { min: 20, max: 40, label: '20-40%' },
    { min: 40, max: 60, label: '40-60%' },
    { min: 60, max: 80, label: '60-80%' },
    { min: 80, max: 100, label: '80-100%' }
  ]
  
  const useDirectCalculation = data.length >= 1000 || totalRows <= 10000;
  
  const distribution = ranges.map(range => {
    const count = data.filter(row => {
      const fillRate = row.fillRate !== undefined ? row.fillRate : 
                       (row.requests > 0 ? (row.impressions / row.requests * 100) : 0)
      return fillRate >= range.min && fillRate < range.max
    }).length
    
    if (useDirectCalculation) {
      return {
        range: range.label,
        count: count
      }
    } else {
      const percentage = count / data.length
      return {
        range: range.label,
        count: Math.round(percentage * totalRows)
      }
    }
  })
  
  return distribution
}

// Test scenarios
console.log('\nTest scenarios:');

// Scenario 1: Using sample data (100 rows)
console.log('\n1. Using sample data (100 rows):');
const sampleDist = calculateFillRateDistribution(Array(100).fill({}), 217402);
sampleDist.forEach(item => {
  console.log(`   ${item.range}: ${item.count} rows (projected)`);
});

// Scenario 2: Using full analytics data (~70,000 rows)
console.log('\n2. Using full analytics data (~70,000 rows):');
const fullDist = calculateFillRateDistribution(Array(70000).fill({}), 217402);
fullDist.forEach(item => {
  console.log(`   ${item.range}: ${item.count} rows (direct calculation)`);
});

console.log('\nSummary:');
console.log('- Upload tab will show 100 sample rows for preview');
console.log('- Analytics will use ~70,000 rows for accurate calculations');
console.log('- Fill rate distribution will be much more accurate with larger dataset');