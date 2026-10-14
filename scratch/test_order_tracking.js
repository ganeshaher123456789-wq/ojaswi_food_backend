const baseUrl = "http://localhost:5000";

async function testTracking() {
  console.log("--- 1. Testing Search by Phone 7845121455 ---");
  const phoneRes = await fetch(`${baseUrl}/api/orders?search=7845121455`);
  const phoneData = await phoneRes.json();
  console.log("Phone search count:", phoneData.orders?.length);

  console.log("--- 2. Testing Search by ID OJ5B5BBE (without hash) ---");
  const idRes1 = await fetch(`${baseUrl}/api/orders?search=OJ5B5BBE`);
  const idData1 = await idRes1.json();
  console.log("ID search without hash count:", idData1.orders?.length);

  console.log("--- 3. Testing Search by ID #OJ5B5BBE (with hash) ---");
  const idRes2 = await fetch(`${baseUrl}/api/orders?search=%23OJ5B5BBE`);
  const idData2 = await idRes2.json();
  console.log("ID search with hash count:", idData2.orders?.length);

  console.log("--- 4. Testing GET /api/orders/OJ5B5BBE (without hash) ---");
  const singleRes1 = await fetch(`${baseUrl}/api/orders/OJ5B5BBE`);
  const singleData1 = await singleRes1.json();
  console.log("GET /api/orders/OJ5B5BBE status:", singleRes1.status, singleData1.success);

  console.log("--- 5. Testing GET /api/orders/%23OJ5B5BBE (with hash) ---");
  const singleRes2 = await fetch(`${baseUrl}/api/orders/%23OJ5B5BBE`);
  const singleData2 = await singleRes2.json();
  console.log("GET /api/orders/%23OJ5B5BBE status:", singleRes2.status, singleData2.success);

  console.log("--- 6. Testing GET /api/orders/ORD-20261006-945 ---");
  const singleRes3 = await fetch(`${baseUrl}/api/orders/ORD-20261006-945`);
  const singleData3 = await singleRes3.json();
  console.log("GET /api/orders/ORD-20261006-945 status:", singleRes3.status, singleData3.success, singleData3.error);
}

testTracking().catch(console.error);
