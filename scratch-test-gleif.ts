import { mapGleifPayloadToFieldCandidates } from "./src/services/kyc/normalization/GleifNormalizer";

const payload = {
  data: {
    attributes: {
      entity: {
        legalName: {
          name: "Test Name"
        }
      }
    }
  }
};

async function run() {
  const result = await mapGleifPayloadToFieldCandidates(payload, "test-ev");
  console.log("Candidates:", result.filter(c => c.fieldNo === 3)); // 3 is usually legal name
}

run();
