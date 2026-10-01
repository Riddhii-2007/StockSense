const http = require('http');

async function testLogin() {
  console.log("Fetching http://localhost:5173/api/auth/login");
  const res = await fetch('http://localhost:5173/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@stocksense.com', password: 'admin123' })
  });
  
  const text = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Response text length: ${text.length}`);
  try {
    const data = JSON.parse(text);
    console.log("Success:", data.success);
    console.log("Token:", data.token);
    
    // Let's decode the token
    const token = data.token;
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const payload = JSON.parse(jsonPayload);
    
    console.log("Decoded payload:", payload);
    
  } catch(e) {
    console.error("Failed to parse response or token:", e);
    console.error(text.substring(0, 500));
  }
}

testLogin();
