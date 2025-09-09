#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

const RESULTS_DIR = path.join(process.cwd(), 'results');

async function checkFile(fileId) {
  try {
    const filePath = path.join(RESULTS_DIR, `${fileId}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    const result = JSON.parse(content);
    
    console.log(`\nChecking file: ${fileId}`);
    console.log(`- File exists: ✅`);
    console.log(`- detailedData length: ${result.detailedData ? result.detailedData.length : 'undefined'}`);
    console.log(`- summary.totalRows: ${result.summary ? result.summary.totalRows : 'undefined'}`);
    
    if (result.detailedData && result.detailedData.length > 0) {
      console.log(`- First record:`, JSON.stringify(result.detailedData[0], null, 2));
    }
    
    return result;
  } catch (error) {
    console.error(`Error checking file ${fileId}:`, error.message);
    return null;
  }
}

async function main() {
  // Check the first few files
  const resultFiles = await fs.readdir(RESULTS_DIR);
  const jsonFiles = resultFiles.filter(file => file.endsWith('.json')).slice(0, 3);
  
  console.log(`Checking first ${jsonFiles.length} files...\n`);
  
  for (const jsonFile of jsonFiles) {
    const fileId = jsonFile.replace('.json', '');
    await checkFile(fileId);
  }
}

main();