// Test the improved fill rate distribution calculation
const result = JSON.parse(require('fs').readFileSync('./results/0b6e4165-d6f0-41ca-911e-d5e574c2d370.json', 'utf8'));

function calculateFillRateDistributionFromSample(sampleData, totalRows) {
  if (!sampleData || sampleData.length === 0) {
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
  
  // Calculate sample distribution
  const sampleDistribution = ranges.map(range => {
    const count = sampleData.filter(row => {
      const fillRate = row.fillRate !== undefined ? row.fillRate : 
                       (row.requests > 0 ? (row.impressions / row.requests * 100) : 0)
      return fillRate >= range.min && fillRate < range.max
    }).length
    
    return {
      range: range.label,
      sampleCount: count,
      percentage: count / sampleData.length
    }
  })
  
  // Project to full dataset
  const distribution = sampleDistribution.map(item => ({
    range: item.range,
    count: Math.round(item.percentage * totalRows)
  }))
  
  return { sampleDistribution, distribution }
}

const { sampleDistribution, distribution } = calculateFillRateDistributionFromSample(
  result.sampleData, 
  result.summary.totalRows
);

console.log('Sample Distribution:');
sampleDistribution.forEach(item => {
  console.log(`${item.range}: ${item.sampleCount} samples (${(item.percentage * 100).toFixed(1)}%)`);
});

console.log('\nProjected Distribution for Full Dataset:');
distribution.forEach(item => {
  console.log(`${item.range}: ${item.count.toLocaleString()} rows (${(item.count / result.summary.totalRows * 100).toFixed(1)}%)`);
});

// Calculate total to verify it's close to totalRows
const totalProjected = distribution.reduce((sum, item) => sum + item.count, 0);
console.log(`\nTotal projected: ${totalProjected.toLocaleString} (should be close to ${result.summary.totalRows.toLocaleString()})`);
console.log(`Difference: ${Math.abs(totalProjected - result.summary.totalRows).toLocaleString()} rows`);