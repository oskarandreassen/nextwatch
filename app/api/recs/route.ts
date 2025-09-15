// app/api/recs/route.ts
// Vidarebefordra allt till nya implementationen under /api/recs/for-you
export { GET, runtime, dynamic } from "./for-you/route";
