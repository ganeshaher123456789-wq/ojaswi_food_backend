import http from "http";
import app from "../server.js";

async function runPhoneValidationTests() {
  console.log("==================================================");
  console.log("📱 TESTING MOBILE NUMBER VALIDATION & OTP VERIFICATION");
  console.log("==================================================");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const BASE_URL = `http://127.0.0.1:${port}`;

  const randPhone = () => "98" + Math.floor(10000000 + Math.random() * 90000000);
  const p1 = randPhone();
  const p2 = randPhone();
  const p3 = randPhone();
  const p4 = randPhone();
  const p5 = randPhone();
  const p6 = randPhone();

  const testNumbers = [
    { input: `+91 ${p1.slice(0, 5)} ${p1.slice(5)}`, expected: p1, desc: "+91 with spaces" },
    { input: `+91${p2}`, expected: p2, desc: "+91 without spaces" },
    { input: `0${p3}`, expected: p3, desc: "Leading 0 prefix" },
    { input: `${p4.slice(0, 5)}-${p4.slice(5)}`, expected: p4, desc: "Hyphenated 10 digits" },
    { input: `  ${p5}  `, expected: p5, desc: "Spaces padded" },
    { input: p6, expected: p6, desc: "Standard 10-digit number" },
    { input: "12345", expected: null, desc: "Too short (invalid)" },
    { input: "9198765432100", expected: null, desc: "Too long (invalid)" },
    { input: "abcdefghij", expected: null, desc: "Non-numeric (invalid)" }
  ];

  try {
    for (const t of testNumbers) {
      const res = await fetch(`${BASE_URL}/api/auth/request-phone-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: t.input })
      });
      const data = await res.json();

      if (t.expected) {
        if (res.status === 200 && data.success && data.devOtp) {
          console.log(`✅ PASS: [${t.desc}] "${t.input}" -> accepted as 10-digit, devOtp received: ${data.devOtp}`);
          
          // Test verify OTP
          const vRes = await fetch(`${BASE_URL}/api/auth/verify-phone-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: t.input, otp: data.devOtp })
          });
          const vData = await vRes.json();
          if (vRes.status === 200 && vData.success && vData.token) {
            console.log(`   └─ ✅ OTP Verified! User authenticated (Phone: ${vData.user.phone})`);
          } else {
            console.error(`   └─ ❌ Failed to verify OTP for ${t.input}:`, vData);
            process.exit(1);
          }
        } else {
          console.error(`❌ FAIL: Expected success for ${t.input} (${t.desc}), got:`, data);
          process.exit(1);
        }
      } else {
        if (res.status === 400 && !data.success) {
          console.log(`✅ PASS: [${t.desc}] "${t.input}" -> correctly rejected (400 Bad Request: ${data.error})`);
        } else {
          console.error(`❌ FAIL: Expected rejection for ${t.input} (${t.desc}), got:`, data);
          process.exit(1);
        }
      }
    }

    console.log("==================================================");
    console.log("🎉 ALL PHONE VALIDATION & OTP TESTS PASSED!");
    console.log("==================================================");
  } finally {
    server.close();
  }
}

runPhoneValidationTests().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
