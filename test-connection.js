const Firebird = require('node-firebird-dev');

const options = {
  host: '192.168.1.30',
  database: '/var/lib/firebird/3.0/data/DBSIF.FDB',
  user: 'LECTURA',
  password: 'LECTURA'
};

Firebird.attach(options, (err, db) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    return;
  }

  console.log('✅ Connected to Firebird');
  db.detach();
});
