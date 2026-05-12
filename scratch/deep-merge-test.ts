const userPrefs = {
  homePage: {
    collapsedTreeNodes: { 'org:1': true, 'le:1': true }
  }
};
const dataPrefs = {
  homePage: {
    collapsedTreeNodes: { 'org:1': false }
  }
};

const shallowMerged = { ...userPrefs, ...dataPrefs };
console.log("Shallow:", JSON.stringify(shallowMerged, null, 2));

function deepMerge(target: any, source: any) {
    const isObject = (obj: any) => obj && typeof obj === 'object' && !Array.isArray(obj);
    const result = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) Object.assign(result, { [key]: source[key] });
                else result[key] = deepMerge(target[key], source[key]);
            } else {
                Object.assign(result, { [key]: source[key] });
            }
        });
    }
    return result;
}
console.log("Deep:", JSON.stringify(deepMerge(userPrefs, dataPrefs), null, 2));
