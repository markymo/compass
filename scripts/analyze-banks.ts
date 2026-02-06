
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'docs/data/Bank Target List Feb 26.xlsx');

console.log(`Reading file: ${filePath}`);

if (!fs.existsSync(filePath)) {
    console.error('File not found!');
    process.exit(1);
}

const workbook = XLSX.readFile(filePath);
console.log('Sheet Names:', workbook.SheetNames);

// Assuming the first sheet is the one
const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];

// Convert to JSON array of arrays (rows)
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log(`\n--- Preview of '${firstSheetName}' (Rows 10-25) ---`);
rows.slice(10, 25).forEach((row: any, idx: number) => {
    console.log(`Row ${10 + idx}:`, JSON.stringify(row));
});

export { };
