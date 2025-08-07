const Firebird = require('node-firebird');

const options = {
  host: '192.168.1.30',
  database: '/var/lib/firebird/3.0/data/DBSIF.FDB',
  user: 'LECTURA',
  password: 'LECTURA',
  port: 3050,
  lowercase_keys: false,
  role: null,
  pageSize: 4096,
  retryConnectionInterval: 1000
};

Firebird.attach(options, (err, db) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    return;
  }

  console.log('✅ Connected to Firebird');

  db.query('SELECT FIRST 1 * FROM articulos', (err, result) => {
    db.detach();

    if (err) {
      console.error('❌ Query failed:', err.message);
    } else {
      console.log('✅ Sample data:', result);
    }
  });
});