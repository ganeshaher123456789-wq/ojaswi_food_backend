const baseUrl = "http://localhost:5000";

async function runTests() {
  console.log("==================================================");
  console.log("TESTING ALL OJASWI LOGIN TERMINAL FLOWS");
  console.log("==================================================");

  // Test 1: Fast 1-Click Login
  console.log("\n[TEST 1] Testing 1-Click Fast Customer Login...");
  const fastRes = await fetch(`${baseUrl}/api/auth/fast-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "7972483489", name: "Ganesh Sharma" })
  });
  const fastData = await fastRes.json();
  console.log("Fast Login Status:", fastRes.status, fastData.success ? "SUCCESS" : "FAILED", fastData.user?.name);
  if (!fastData.success) throw new Error("Fast login failed");

  // Test 2: Phone OTP Request & Verify
  console.log("\n[TEST 2] Testing Phone OTP Request & Verification...");
  const otpReqRes = await fetch(`${baseUrl}/api/auth/request-phone-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "9876543210" })
  });
  const otpReqData = await otpReqRes.json();
  console.log("OTP Request Status:", otpReqRes.status, "Code:", otpReqData.devOtp);
  if (!otpReqData.success) throw new Error("OTP request failed");

  const otpVerRes = await fetch(`${baseUrl}/api/auth/verify-phone-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "9876543210", otp: otpReqData.devOtp, name: "OTP Customer" })
  });
  const otpVerData = await otpVerRes.json();
  console.log("OTP Verify Status:", otpVerRes.status, otpVerData.success ? "SUCCESS" : "FAILED", otpVerData.user?.name);
  if (!otpVerData.success) throw new Error("OTP verify failed");

  // Test 3: Master Dev Code Verification
  console.log("\n[TEST 3] Testing Master Dev Code Verification (797248)...");
  const masterVerRes = await fetch(`${baseUrl}/api/auth/verify-phone-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "9876543210", otp: "797248", name: "Master Code Customer" })
  });
  const masterVerData = await masterVerRes.json();
  console.log("Master Code Verify Status:", masterVerRes.status, masterVerData.success ? "SUCCESS" : "FAILED");
  if (!masterVerData.success) throw new Error("Master code verify failed");

  // Test 4: Direct WhatsApp Login
  console.log("\n[TEST 4] Testing Direct WhatsApp Login...");
  const waRes = await fetch(`${baseUrl}/api/auth/whatsapp-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "7972483489", name: "WhatsApp Customer" })
  });
  const waData = await waRes.json();
  console.log("WhatsApp Login Status:", waRes.status, waData.success ? "SUCCESS" : "FAILED");
  if (!waData.success) throw new Error("WhatsApp login failed");

  // Test 5: Admin Terminal Login (admin / OjaswiAdmin@2026)
  console.log("\n[TEST 5] Testing Admin Terminal Login with username...");
  const adminRes = await fetch(`${baseUrl}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "OjaswiAdmin@2026" })
  });
  const adminData = await adminRes.json();
  console.log("Admin Login Status:", adminRes.status, adminData.success ? "SUCCESS" : "FAILED", adminData.admin?.role);
  if (!adminData.success) throw new Error("Admin login failed");

  // Test 6: Admin Terminal Login with Owner Phone (7972483489 / OjaswiAdmin@2026)
  console.log("\n[TEST 6] Testing Admin Terminal Login with owner phone number...");
  const adminPhoneRes = await fetch(`${baseUrl}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "7972483489", password: "OjaswiAdmin@2026" })
  });
  const adminPhoneData = await adminPhoneRes.json();
  console.log("Admin Phone Login Status:", adminPhoneRes.status, adminPhoneData.success ? "SUCCESS" : "FAILED");
  if (!adminPhoneData.success) throw new Error("Admin phone login failed");

  // Test 7: Verify /api/account with token
  console.log("\n[TEST 7] Testing Account Dashboard access with JWT token...");
  const accRes = await fetch(`${baseUrl}/api/account`, {
    headers: {
      "Authorization": `Bearer ${fastData.token}`,
      "Content-Type": "application/json"
    }
  });
  const accData = await accRes.json();
  console.log("Account Profile Fetch:", accRes.status, accData.profile?.name, "Orders count:", accData.recentOrders?.length);
  if (!accData.success) throw new Error("Account data fetch failed");

  console.log("\n==================================================");
  console.log("ALL 7 LOGIN TERMINAL FLOWS PASSED PERFECTLY!");
  console.log("==================================================");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
