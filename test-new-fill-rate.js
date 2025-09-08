// Test the new fill rate distribution calculation
const result = JSON.parse(require('fs').readFileSync('./results/0b6e4165-d6f0-41ca-911e-d5e574c2d370.json', 'utf8'));

// Calculate overall fill rate
const overallFillRate = (result.summary.totalImpressions / result.summary.totalRequests) * 100;
console.log('Overall fill rate:', overallFillRate.toFixed(2) + '%');
console.log('Total rows:', result.summary.totalRows);

// Test the new distribution function
function calculateFillRateDistributionFromSummary(summary) {
  if (!summary || !summary.totalRequests || summary.totalRequests === 0) {
    return [
      { range: '0-20%', count: 0 },
      { range: '20-40%', count: 0 },
      { range: '40-60%', count: 0 },
      { range: '60-80%', count: 0 },
      { range: '80-100%', count: 0 }
    ]
  }
  
  const overallFillRate = (summary.totalImpressions / summary.totalRequests) * 100;
  console.log('\nUsing overall fill rate:', overallFillRate.toFixed(2) + '%');
  
  const ranges = [
    { min: 0, max: 20, label: '0-20%' },
    { min: 20, max: 40, label: '20-40%' },
    { min: 40, max: 60, label: '40-60%' },
    { min: 60, max: 80, label: '60-80%' },
    { min: 80, max: 100, label: '80-100%' }
  ];
  
  const distribution = ranges.map(range => {
    let count = 0;
    
    if (overallFillRate >= range.min && overallFillRate < range.max) {
      // Main range gets 60%
      count = Math.floor(summary.totalRows * 0.6);
    } else {
      // Other ranges share the remaining 40%
      const remainingRanges = ranges.length - 1;
      count = Math.floor(summary.totalRows * 0.4 / remainingRanges);
    }
    
    return {
      range: range.label,
      count
    };
  });
  
  return distribution;
}

const newDistribution = calculateFillRateDistributionFromSummary(result.summary);
console.log('\nNew distribution based on summary:');
newDistribution.forEach(item => {
  console.log(`${item.range}: ${item.count.toLocaleString()} rows (${(item.count / result.summary.totalRows * 100).toFixed(1)}%)`);
});

// Compare with actual sample distribution
console.log('\nActual sample distribution:');
const sampleDistribution = [
  { range: '0-20%', count: 0 },
  { range: '20-40%', count: 0 },
  { range: '40-60%', count: 54 },
  { range: '60-80%', count: 43 },
  { range: '80-100%', count: 3 }
];
sampleDistribution.forEach(item => {
  const projected = (item.count / 100) * result.summary.totalRows;
  console.log(`${item.range}: ${projected.toLocaleString()} rows (${item.count}%)`);
});