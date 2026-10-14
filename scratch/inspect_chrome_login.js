import { spawn } from "child_process";
import http from "http";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9223;

async function launchAndTest() {
  console.log("Launching Headless Chrome...");
  const chromeProc = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    "--user-data-dir=C:\\Users\\Ganesh\\AppData\\Local\\Temp\\chrome-test-profile-" + Date.now(),
    "--no-first-run",
    "--no-default-browser-check"
  ]);

  try {
    let pages = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
      pages = await listRes.json();
      if (pages && pages.length > 0) break;
    } catch (e) {}
  }
  if (!pages || !pages.length) throw new Error("Could not connect to Chrome CDP");
  const wsUrl = pages[0].webSocketDebuggerUrl;
  console.log("Connected to Chrome via WS:", wsUrl);

  const ws = new globalThis.WebSocket(wsUrl);

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const reqId = id++;
        const handler = (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.id === reqId) {
            ws.off("message", handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        ws.on("message", handler);
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    await new Promise(r => ws.on("open", r));

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.method === "Runtime.consoleAPICalled") {
        console.log(`[Browser Console ${msg.params.type}]:`, ...msg.params.args.map(a => a.value || a.description));
      }
      if (msg.method === "Runtime.exceptionThrown") {
        console.error("[Browser Exception]:", msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description);
      }
    });

    await send("Runtime.enable");
    await send("Page.enable");
    await send("DOM.enable");

    console.log("Navigating to http://localhost:5000/login ...");
    await send("Page.navigate", { url: "http://localhost:5000/login" });
    await new Promise(r => setTimeout(r, 1500));

    // Type phone number in #inputPhone
    console.log("Entering phone number...");
    await send("Runtime.evaluate", {
      expression: `
        document.getElementById("inputPhone").value = "7620098478";
        document.getElementById("inputPhone").dispatchEvent(new Event("input", { bubbles: true }));
        document.getElementById("inputName").value = "Ganesh Sharma";
      `
    });

    console.log("Clicking SEND VERIFICATION CODE...");
    await send("Runtime.evaluate", {
      expression: `
        document.getElementById("btnSendOtp").click();
      `
    });

    await new Promise(r => setTimeout(r, 1500));

    // Check DOM state
    const stepState1 = await send("Runtime.evaluate", {
      expression: `
        ({
          stepRequestDisplay: document.getElementById("stepRequestOtp")?.style.display,
          stepVerifyDisplay: document.getElementById("stepVerifyOtp")?.style.display,
          devOtp: document.getElementById("devOtpVal")?.textContent,
          otpBoxes: Array.from(document.querySelectorAll(".otp-box")).map(b => b.value).join("")
        })
      `,
      returnByValue: true
    });
    console.log("State after Send OTP:", stepState1.result.value);

    // Now click VERIFY & LOGIN
    console.log("Clicking VERIFY & LOGIN...");
    await send("Runtime.evaluate", {
      expression: `
        document.getElementById("btnVerifyOtp").click();
      `
    });

    await new Promise(r => setTimeout(r, 2500));

    // Check location and state
    const afterVerify = await send("Runtime.evaluate", {
      expression: `
        ({
          location: window.location.href,
          stepSuccessDisplay: document.getElementById("stepLoginSuccess")?.style.display,
          token: localStorage.getItem("ojaswi_token"),
          user: localStorage.getItem("ojaswi_user")
        })
      `,
      returnByValue: true
    });
    console.log("State after Verify & Login:", afterVerify.result.value);

    // Wait another 2 seconds to see if navigation to account succeeded
    await new Promise(r => setTimeout(r, 2000));
    const finalState = await send("Runtime.evaluate", {
      expression: `
        ({
          location: window.location.href,
          title: document.title,
          unauthDisplay: document.getElementById("unauthenticatedView")?.style.display,
          authDisplay: document.getElementById("authenticatedView")?.style.display,
          greeting: document.getElementById("accountHeadingName")?.textContent
        })
      `,
      returnByValue: true
    });
    console.log("Final Page State:", finalState.result.value);

  } catch (err) {
    console.error("Test error:", err);
  } finally {
    chromeProc.kill();
  }
}

launchAndTest();
