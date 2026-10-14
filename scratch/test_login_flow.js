const baseUrl = "http://localhost:5000";

async function testFlow() {
  console.log("--- 1. Testing Phone OTP Request ---");
  const phone = "9123456789";
  const reqRes = await fetch(`${baseUrl}/api/auth/request-phone-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone })
  });
  const reqData = await reqRes.json();
  console.log("Req Status:", reqRes.status, reqData);

  if (!reqData.success) {
    console.error("Failed OTP request!");
    return;
  }

  const otp = reqData.devOtp;
  console.log("--- 2. Testing Verify OTP & Login ---");
  const verRes = await fetch(`${baseUrl}/api/auth/verify-phone-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otp, name: "Ganesh Customer" })
  });
  const verData = await verRes.json();
  console.log("Ver Status:", verRes.status, verData);

  if (!verData.success) {
    console.error("Failed Verify OTP!");
    return;
  }

  console.log("--- 3. Testing /api/account with Token ---");
  const accRes = await fetch(`${baseUrl}/api/account`, {
    headers: {
      "Authorization": `Bearer ${verData.token}`,
      "Content-Type": "application/json"
    }
  });
  const accData = await accRes.json();
  console.log("Account Status:", accRes.status, accData);

  console.log("--- 4. Testing /api/auth/me with Token ---");
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      "Authorization": `Bearer ${verData.token}`
    }
  });
  const meData = await meRes.json();
  console.log("Auth Me Status:", meRes.status, meData);

  console.log("--- 5. Testing Admin Login ---");
  const admRes = await fetch(`${baseUrl}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "OjaswiAdmin@2026" })
  });
  const admData = await admRes.json();
  console.log("Admin Status:", admRes.status, admData);
}

testFlow().catch(console.error);
