import { spawn } from "child_process";
import http from "http";

async function runBrowserTest() {
  console.log("Checking Chrome or running CDP simulation...");
  // Let's do a complete simulation of what the browser does with cookies and localStorage
  const baseUrl = "http://localhost:5000";

  // Request OTP
  const reqRes = await fetch(`${baseUrl}/api/auth/request-phone-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "7620098478" })
  });
  const reqData = await reqRes.json();
  console.log("1. OTP Sent:", reqData);

  // Verify OTP
  const verRes = await fetch(`${baseUrl}/api/auth/verify-phone-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "7620098478", otp: reqData.devOtp, name: "Ganesh" })
  });
  const cookie = verRes.headers.get("set-cookie");
  const verData = await verRes.json();
  console.log("2. Verified:", verData, "Cookie:", cookie);

  // Now simulate account.html request with Authorization header
  const accRes = await fetch(`${baseUrl}/api/account`, {
    headers: {
      "Authorization": `Bearer ${verData.token}`,
      "Cookie": cookie || ""
    }
  });
  const accData = await accRes.json();
  console.log("3. Account Page Data:", accData);
}

runBrowserTest().catch(console.error);
