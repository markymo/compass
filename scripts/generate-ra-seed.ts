import fs from 'fs';
import path from 'path';
import https from 'https';

interface Jurisdiction {
  country: string | null;
  countryCode: string | null;
  jurisdiction: string | null;
}

interface RAData {
  id: string;
  code: string;
  internationalName: string | null;
  localName: string | null;
  internationalOrganizationName: string | null;
  localOrganizationName: string | null;
  website: string | null;
  jurisdictions: Jurisdiction[];
}

function fetchPage(page: number): Promise<{ data: any[] }> {
  return new Promise((resolve, reject) => {
    const url = `https://api.gleif.org/api/v1/registration-authorities?page[size]=300&page[number]=${page}`;
    const options = {
      headers: {
        'Accept': 'application/vnd.api+json'
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('📡 Fetching Registration Authorities from GLEIF API...');
  
  const allData: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    console.log(`Fetching page ${page}...`);
    try {
      const response = await fetchPage(page);
      if (response && response.data && response.data.length > 0) {
        allData.push(...response.data);
        page++;
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      hasMore = false;
    }
  }

  console.log(`Fetched ${allData.length} records. Processing...`);

  const escapeSql = (val: string | null | undefined): string => {
    if (val === null || val === undefined) return 'NULL';
    return `'${val.replace(/'/g, "''")}'`;
  };

  const sqlLines: string[] = [];
  sqlLines.push('-- GLEIF Registration Authority seed — ' + allData.length + ' rows');
  sqlLines.push('-- Generated: ' + new Date().toISOString());
  sqlLines.push('-- Source: https://api.gleif.org/api/v1/registration-authorities');
  sqlLines.push('--');
  sqlLines.push('-- Safe to run on production: uses INSERT ... ON CONFLICT (id) DO UPDATE');
  sqlLines.push('-- Preserves: mappingSourceKey, lookupStrategy, apiType, baseUrl, isActive, notes');
  sqlLines.push('-- Updates:   name, countryCode, jurisdiction (only when value has changed)');
  sqlLines.push('');
  sqlLines.push('INSERT INTO registry_authorities (');
  sqlLines.push('  id,');
  sqlLines.push('  "registryKey",');
  sqlLines.push('  name,');
  sqlLines.push('  "countryCode",');
  sqlLines.push('  jurisdiction,');
  sqlLines.push('  "isActive",');
  sqlLines.push('  "createdAt",');
  sqlLines.push('  "updatedAt"');
  sqlLines.push(')');
  sqlLines.push('VALUES');

  const valueRows: string[] = [];

  for (const item of allData) {
    const id = item.id;
    const attr = item.attributes;
    
    // Extract primary jurisdiction
    const primaryJurisdiction = attr.jurisdictions?.[0];
    const country = primaryJurisdiction?.country || primaryJurisdiction?.countryCode || '';
    const countryCode = primaryJurisdiction?.countryCode || null;
    const jurisdictionName = primaryJurisdiction?.jurisdiction || null;

    // Extract names
    const orgName = attr.internationalOrganizationName || attr.localOrganizationName || '';
    const registerName = attr.internationalName || attr.localName || '';

    // Build concatenated name: Country | Organization | Register
    const nameParts = [country, orgName, registerName]
      .map(p => p?.trim())
      .filter(Boolean);

    // De-duplicate adjacent identical parts
    const uniqueParts: string[] = [];
    for (const part of nameParts) {
      if (uniqueParts.length === 0 || uniqueParts[uniqueParts.length - 1] !== part) {
        uniqueParts.push(part);
      }
    }

    let concatenatedName = uniqueParts.join(' | ');
    if (!concatenatedName) {
      concatenatedName = id;
    }

    // Format SQL values row
    // id, registryKey (matches id), name, countryCode, jurisdiction, isActive, createdAt, updatedAt
    const rowStr = `  (${escapeSql(id)}, ${escapeSql(id)}, ${escapeSql(concatenatedName)}, ${escapeSql(countryCode)}, ${escapeSql(jurisdictionName)}, true, NOW(), NOW())`;
    valueRows.push(rowStr);
  }

  sqlLines.push(valueRows.join(',\n'));
  sqlLines.push('ON CONFLICT (id) DO UPDATE SET');
  sqlLines.push('  name          = EXCLUDED.name,');
  sqlLines.push('  "countryCode" = COALESCE(EXCLUDED."countryCode", registry_authorities."countryCode"),');
  sqlLines.push('  jurisdiction  = COALESCE(EXCLUDED.jurisdiction,  registry_authorities.jurisdiction),');
  sqlLines.push('  "updatedAt"   = NOW()');
  sqlLines.push('WHERE');
  sqlLines.push('  registry_authorities.name != EXCLUDED.name');
  sqlLines.push('  OR registry_authorities."countryCode" IS DISTINCT FROM EXCLUDED."countryCode"');
  sqlLines.push('  OR registry_authorities.jurisdiction IS DISTINCT FROM EXCLUDED.jurisdiction;');
  sqlLines.push('');

  const outputSql = sqlLines.join('\n');
  const outputPath = path.join(__dirname, 'seed_registry_authorities.sql');
  fs.writeFileSync(outputPath, outputSql, 'utf8');
  console.log(`✅ SQL seed file generated at: ${outputPath} (${allData.length} records)`);
}

main().catch(console.error);
