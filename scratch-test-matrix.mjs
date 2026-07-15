async function fetchJson(url) {
    try {
        const res = await fetch(url, { headers: { 'Accept': 'application/vnd.api+json' } });
        const is404 = res.status === 404;
        let data = null;
        if (!is404) {
            try { data = await res.json(); } catch(e) {}
        }
        return { status: res.status, data };
    } catch(e) {
        return { status: 'error', data: null, error: e };
    }
}

async function inspect(lei) {
    console.log(`\n\n=== Inspecting LEI: ${lei} ===`);
    const main = await fetchJson(`https://api.gleif.org/api/v1/lei-records/${lei}`);
    const dp = await fetchJson(`https://api.gleif.org/api/v1/lei-records/${lei}/direct-parent`);
    const dpre = await fetchJson(`https://api.gleif.org/api/v1/lei-records/${lei}/direct-parent-reporting-exception`);

    console.log(`Main HTTP Status: ${main.status}`);
    const links = main.data?.data?.relationships?.['direct-parent']?.links;
    console.log(`Main Links:`, links);

    console.log(`\nDirect Parent Endpoint HTTP Status: ${dp.status}`);
    console.log(`Direct Parent Payload Data:`, JSON.stringify(dp.data?.data, null, 2));

    console.log(`\nDirect Parent Reporting Exception Endpoint HTTP Status: ${dpre.status}`);
    console.log(`Direct Parent Exception Payload Data:`, JSON.stringify(dpre.data?.data, null, 2));
}

async function main() {
    await inspect("5493006MHB84DD0ZWV18"); // Alphabet Inc (Exception)
    await inspect("7ZW8QJWVPR4P1J1KQY45"); // Google LLC (Direct Parent)
    await inspect("2549007H0J602H3GBQ16"); // Missing
}
main();
