#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

const RESULTS_DIR = path.join(process.cwd(), 'results');

async function checkAllFiles() {
  try {
    const resultFiles = await fs.readdir(RESULTS_DIR);
    const jsonFiles = resultFiles.filter(file => file.endsWith('.json'));
    
    console.log(`Checking ${jsonFiles.length} result files for empty detailedData...\n`);
    
    const emptyFiles = [];
    const validFiles = [];
    
    for (const jsonFile of jsonFiles) {
      const fileId = jsonFile.replace('.json', '');
      const filePath = path.join(RESULTS_DIR, jsonFile);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const result = JSON.parse(content);
        
        if (!result.detailedData || result.detailedData.length === 0) {
          emptyFiles.push(fileId);
          console.log(`❌ ${fileId}: detailedData is empty or missing`);
        } else {
          validFiles.push(fileId);
          console.log(`✅ ${fileId}: ${result.detailedData.length} records`);
        }
      } catch (error) {
        console.log(`⚠️  ${fileId}: Error reading file - ${error.message}`);
        emptyFiles.push(fileId);
      }
    }
    
    console.log(`\nSummary:`);
    console.log(`- Valid files: ${validFiles.length}`);
    console.log(`- Files with empty detailedData: ${emptyFiles.length}`);
    
    if (emptyFiles.length > 0) {
      console.log(`\nFiles that need regeneration:`);
      emptyFiles.forEach(fileId => console.log(`  - ${fileId}`));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAllFiles();