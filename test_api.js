console.log("Testing API connection..."); fetch("http://localhost:8000/api/health").then(r => r.json()).then(d => console.log("Success:", d)).catch(e => console.log("Error:", e.message));
