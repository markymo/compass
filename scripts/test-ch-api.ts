
import { fetchCompanyOfficers } from "@/lib/companies-house";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    const companyNumber = "00048839"; // Barclays PLC
    console.log(`Testing Companies House API for Company Number: ${companyNumber}`);
    console.log(`API Key present: ${!!process.env.COMPANIES_HOUSE_API_KEY}`);

    try {
        const officers = await fetchCompanyOfficers(companyNumber);
        console.log(`Fetched ${officers.length} officers.`);
        if (officers.length > 0) {
            console.log("First officer:", officers[0]);
        }
    } catch (error) {
        console.error("Test failed:", error);
    }
}

main();
