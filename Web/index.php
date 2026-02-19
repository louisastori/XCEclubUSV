<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Maquette XCE – passer au serveur Node</title>
  <style>
    :root { --bg:#0b1220; --card:#11192a; --text:#e9efff; --accent:#45c4ff; --muted:#8ca0c2; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:radial-gradient(circle at 20% 20%, rgba(69,196,255,0.08), transparent 35%), radial-gradient(circle at 80% 10%, rgba(255,255,255,0.05), transparent 30%), var(--bg); color:var(--text); font-family: 'Segoe UI', system-ui, sans-serif; }
    .card { max-width:620px; width:90%; background:var(--card); border:1px solid rgba(255,255,255,0.06); border-radius:16px; padding:28px 26px; box-shadow:0 18px 50px rgba(0,0,0,0.35); }
    h1 { margin:0 0 10px; font-size:24px; letter-spacing:-0.3px; }
    p { margin:10px 0; color:var(--muted); }
    code { background:rgba(255,255,255,0.06); padding:4px 6px; border-radius:6px; }
    .btn { display:inline-flex; align-items:center; gap:8px; padding:10px 14px; border-radius:10px; text-decoration:none; background:var(--accent); color:#041122; font-weight:700; box-shadow:0 10px 25px rgba(69,196,255,0.35); }
  </style>
</head>
<body>
  <div class="card">
    <h1>Application déplacée côté Node/Express</h1>
    <p>Cette page PHP est désormais un simple relais. Lancez le serveur JS puis accédez à l’URL Express.</p>
    <p>Commande : <code>npm start</code></p>
    <p>URL : <a class="btn" href="http://localhost:8000">http://localhost:8000</a></p>
    <p>Si vous voyez encore cette page, vérifiez que le serveur Node est bien démarré et que vous ouvrez le port 8000.</p>
  </div>
  <script>
    // Redirection automatique vers le serveur JS s'il est joignable
    fetch('http://localhost:8000', { mode: 'no-cors' })
      .then(() => { window.location.href = 'http://localhost:8000'; })
      .catch(() => { /* On reste sur la page informative. */ });
  </script>
</body>
</html>
