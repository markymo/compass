
import { PrismaClient } from '@prisma/client'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

import fs from 'fs'
import path from 'path'

// Load env manually
try {
    const envPath = path.join(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8')
        envContent.split('\n').forEach(line => {
            const [key, ...val] = line.split('=')
            if (key && val) {
                const value = val.join('=').trim().replace(/^"|"$/g, '')
                if (!process.env[key.trim()]) {
                    process.env[key.trim()] = value
                }
            }
        })
    }
} catch (e) {
    console.log('Error loading .env', e)
}

const prisma = new PrismaClient()

async function main() {
    console.log('Starting FI Enrichment...')

    if (!process.env.OPENAI_API_KEY) {
        console.error('ERROR: OPENAI_API_KEY not found in env')
        return
    }

    const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })

    // Fetch FIs that need enrichment
    // We can target ones with the default "Headquarters:" description or empty
    const fis = await prisma.organization.findMany({
        where: {
            types: { has: 'FI' },
            // OR: [
            //     { description: { contains: 'Headquarters:' } }, 
            //     { description: null }
            // ]
            // Actually, let's just do all of them but maybe skip ones we've manually edited?
            // For now, let's just process the top 5 to test, or all if user wants.
            // User asked to run it, let's do batches.
        },
        take: 120 // Cover all imported ones
    })

    console.log(`Found ${fis.length} FIs to process`)

    for (const fi of fis) {
        // Skip if it looks like a good description (arbitrary length check > 50 chars and not the default format or generic text)
        if (fi.description && fi.description.length > 50 &&
            !fi.description.startsWith('Headquarters:') &&
            !fi.description.includes('Equator Principles')) {
            console.log(`Skipping ${fi.name} (already enriched?)`)
            continue
        }

        console.log(`Enriching ${fi.name}...`)

        try {
            const prompt = `Write a short, professional 2-sentence description for the financial institution "${fi.name}" (Domain: ${fi.domain || 'Unknown'}). 
            Focus on their primary region, size, and key services (Retail, Corporate, Investment). 
            Do not include marketing fluff. Keep it factual.`

            const { text } = await generateText({
                model: openai('gpt-4o'),
                prompt: prompt,
                temperature: 0.3
            })

            await prisma.organization.update({
                where: { id: fi.id },
                data: { description: text.trim() }
            })

            console.log(`> Updated: ${text.substring(0, 50)}...`)

            // Sleep slightly to avoid strict rate limits if serial
            await new Promise(r => setTimeout(r, 200))

        } catch (e) {
            console.error(`Failed to enrich ${fi.name}:`, e)
        }
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
