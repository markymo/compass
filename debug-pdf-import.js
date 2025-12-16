
const PDFParser = require("pdf2json");

try {
    console.log("Imported PDFParser:", PDFParser);
    const pdfParser = new PDFParser(null, 1);
    console.log("Instantiated PDFParser:", pdfParser);
    console.log("Success");
} catch (e) {
    console.error("Error:", e);
}
