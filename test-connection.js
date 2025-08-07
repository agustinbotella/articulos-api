const Firebird = require('node-firebird-dev');

const options = {
  host: '', // Leave this empty for remote-style path
  database: '192.168.1.30:/var/lib/firebird/3.0/data/DBSIF.FDB',
  user: 'LECTURA',
  password: 'LECTURA'
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
