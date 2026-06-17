function applyMasterDataProjection(value: any, path: string | null | undefined): any {
    if (!path || value === null || value === undefined) return value;
    
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
    
    let current = value;
    for (const key of keys) {
        if (current === null || current === undefined) {
            return null;
        }
        current = current[key];
    }
    
    return current ?? null;
}

console.log(applyMasterDataProjection({ locality: 'London' }, 'locality') === 'London');
console.log(applyMasterDataProjection({ address: { locality: 'London' } }, 'address.locality') === 'London');
console.log(applyMasterDataProjection({ address: { country: { code: 'UK' } } }, 'address.country.code') === 'UK');
console.log(applyMasterDataProjection({ addressLines: ['A', 'B'] }, 'addressLines[0]') === 'A');
console.log(applyMasterDataProjection({ addresses: [{ postalCode: '123' }] }, 'addresses[0].postalCode') === '123');
console.log(applyMasterDataProjection({ dateOfBirth: { year: 1990 } }, 'dateOfBirth.year') === 1990);
console.log(applyMasterDataProjection({ a: null }, 'a.b') === null);
console.log(applyMasterDataProjection({ }, 'a.b') === null);
