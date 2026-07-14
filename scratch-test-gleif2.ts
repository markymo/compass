import { mapGleifPayloadToFieldCandidates } from "./src/services/kyc/normalization/GleifNormalizer";

const payload = {
  type: "lei-records",
  id: "213800SN8QHYGA7QUF79",
  attributes: {
    lei: "213800SN8QHYGA7QUF79",
    entity: {
      legalName: { name: "Diamond Transmission Partners Hornsea Two Limited" }
    }
  },
  gleifL2: {
    directParent: { legalName: "Direct Parent Name" }
  }
};

async function run() {
  const result = await mapGleifPayloadToFieldCandidates(payload, "test-ev");
  console.log("Field 3 (name):", result.filter(c => c.fieldNo === 3));
  console.log("Field 37 (direct parent name):", result.filter(c => c.fieldNo === 37));
}

run();
