#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Create a test CSV file with more realistic data
const testData = `Date,Website,Country,Device,Ad Format,Ad Unit,Requests,Impressions,Clicks,CTR,eCPM,Revenue,Viewable Impressions,Viewability Rate,Measurable Impressions,Fill Rate,ARPU
2025-01-01,example.com,US,Desktop,Banner,leaderboard,10000,8500,170,2.00%,6.50,55.25,7500,88.24%,8000,85.00%,0.0055
2025-01-01,test.com,UK,Mobile,Interstitial,interstitial,15000,12000,360,3.00%,8.50,102.00,10500,87.50%,11500,80.00%,0.0068
2025-01-01,demo.com,CA,Tablet,Video,preroll,8000,6000,120,2.00%,9.20,55.20,5200,86.67%,5800,75.00%,0.0069
2025-01-02,example.com,US,Mobile,Banner,leaderboard,12000,10000,250,2.50%,7.20,72.00,8800,88.00%,9500,83.33%,0.0060
2025-01-02,test.com,UK,Desktop,Interstitial,interstitial,18000,15000,450,3.00%,9.80,147.00,13200,88.00%,14500,83.33%,0.0082
2025-01-02,demo.com,CA,Mobile,Banner,leaderboard,9000,7500,150,2.00%,6.80,51.00,6600,88.00%,7200,83.33%,0.0057
2025-01-03,example.com,US,Tablet,Video,preroll,11000,8500,170,2.00%,10.50,89.25,7400,87.06%,8000,77.27%,0.0081
2025-01-03,test.com,UK,Mobile,Banner,leaderboard,14000,11500,287,2.50%,7.50,86.25,10000,86.96%,10800,82.14%,0.0062
2025-01-03,demo.com,CA,Desktop,Interstitial,interstitial,16000,13000,390,3.00%,11.20,145.60,11500,88.46%,12500,81.25%,0.0091
2025-01-04,example.com,US,Mobile,Banner,leaderboard,13000,11000,275,2.50%,6.90,75.90,9700,88.18%,10500,84.62%,0.0058
2025-01-04,test.com,UK,Tablet,Video,preroll,10000,8000,160,2.00%,12.30,98.40,7000,87.50%,7600,80.00%,0.0098
2025-01-04,demo.com,CA,Mobile,Interstitial,interstitial,17000,14000,420,3.00%,10.80,151.20,12400,88.57%,13500,82.35%,0.0089`;

// Write the test file
fs.writeFileSync(path.join(__dirname, 'Detail_report.csv'), testData);

console.log('✅ Created Detail_report.csv with test data');