const { Client } = require('pg');

async function tryConnect(host, port, user, password, database) {
  const client = new Client({ host, port, user, password, database, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    const res = await client.query('SELECT current_database(), version()');
    console.log(`✅ SUCCESS: ${user}:${password || '(empty)'}@${host}:${port}/${database}`);
    console.log(`   DB: ${res.rows[0].current_database}`);
    console.log(`   Ver: ${res.rows[0].version.split(' ').slice(0,2).join(' ')}`);
    try {
      const dbs = await client.query("SELECT datname FROM pg_database WHERE datistemplate=false ORDER BY datname");
      console.log(`   Databases: ${dbs.rows.map(r=>r.datname).join(', ')}`);
    } catch(e) {}
    await client.end();
    return true;
  } catch(e) {
    console.log(`❌ FAIL: ${user}:${password || '(empty)'}@${host}:${port}/${database} => ${e.message.split('\n')[0]}`);
    try { await client.end(); } catch(_) {}
    return false;
  }
}

async function main() {
  const ports = [5432, 5433, 5434];
  const passwords = ['postgres', 'password', '', 'admin', 'root', 'kinsh', 'bhoomisetu', '1234', 'postgres123'];
  
  for (const port of ports) {
    for (const pass of passwords) {
      const ok = await tryConnect('127.0.0.1', port, 'postgres', pass, 'template1');
      if (ok) {
        // Also try bhoomisetu db
        await tryConnect('127.0.0.1', port, 'postgres', pass, 'bhoomisetu');
        break;
      }
    }
  }
}

main().catch(console.error);
