import { bootstrapRegistryAuthorities } from "./src/domain/registry/bootstrapRegistry";
bootstrapRegistryAuthorities().then(() => console.log("Done")).catch(console.error);
