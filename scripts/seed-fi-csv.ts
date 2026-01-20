
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
    const csvPath = path.join(process.cwd(), 'docs/data/FinancialInstitutions.csv')

    if (!fs.existsSync(csvPath)) {
        console.error(`File not found: ${csvPath}`)
        return
    }

    const content = fs.readFileSync(csvPath, 'utf-8')
    const lines = content.split('\n')

    // Header: bank_name,domain,country_hq,description,source
    const headers = lines[0].split(',') // Simple split works if headers don't have commas
    console.log(`Found headers: ${headers.join(', ')}`)

    let successCount = 0
    let failCount = 0

    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        // Quick and dirty CSV parsing supporting quoted fields with commas
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || []
        // The above simple regex might fail on complex cases, trying a robust split approach
        // Or manual state machine for "

        const parseCSVLine = (text: string) => {
            const result = []
            let current = ''
            let inQuote = false
            for (let j = 0; j < text.length; j++) {
                const char = text[j]
                if (char === '"') {
                    inQuote = !inQuote
                } else if (char === ',' && !inQuote) {
                    result.push(current)
                    current = ''
                } else {
                    current += char
                }
            }
            result.push(current)
            return result.map(s => s.trim().replace(/^"|"$/g, '').replace(/""/g, '"'))
        }

        const cols = parseCSVLine(line)

        if (cols.length < 2) continue

        const bankName = cols[0]
        const domain = cols[1]
        const country = cols[2]
        const description = cols[3]

        // Generate Logo URL
        // Using Google Favicon service
        const logoUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null

        console.log(`Processing: ${bankName} (${domain})`)

        try {
            // Find valid OrgType enum
            // Ideally we check if "FI" exists in database logic or just pass string if using Prisma types

            // Check if exists by name
            const existing = await prisma.organization.findFirst({
                where: { name: bankName }
            })

            const data = {
                name: bankName,
                domain: domain,
                description: description || `Headquarters: ${country}`,
                logoUrl: logoUrl,
                types: ['FI'] // This will be cast roughly, let's hope prisma handles the array update correctly
            }

            if (existing) {
                // Update
                // We need to ensure 'FI' is in types
                const currentTypes = existing.types || []
                const newTypes = currentTypes.includes('FI') ? currentTypes : [...currentTypes, 'FI']

                await prisma.organization.update({
                    where: { id: existing.id },
                    data: {
                        ...data,
                        types: newTypes as any // Cast to any to bypass strict enum array typing in script
                    }
                })
            } else {
                await prisma.organization.create({
                    data: {
                        ...data,
                        types: ['FI'] as any
                    }
                })
            }
            successCount++
        } catch (e) {
            console.error(`Failed to process ${bankName}:`, e)
            failCount++
        }
    }

    console.log(`Finished. Success: ${successCount}, Failed: ${failCount}`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
