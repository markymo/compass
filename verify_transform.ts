import { applyTransform } from './src/services/kyc/normalization/transforms';

const officer = {
    name: 'SMITH, John Robert',
    officer_role: 'director',
    address: {
        premises: "10",
        address_line_1: "Street Name",
        locality: "London",
        country: "England",
        postal_code: "SW1A 1AA"
    }
};

const BASE_CONFIG = {
    fullNamePath: 'name',
    roleTitlePath: 'officer_role',
};

const res = applyTransform(officer, 'TO_PARTY_VALUE', BASE_CONFIG);
console.log(JSON.stringify(res.value, null, 2));
