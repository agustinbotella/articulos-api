const Firebird = require('node-firebird-dev');

const options = {
  host: '192.168.1.30',
  database: '/var/lib/firebird/3.0/data/DBSIF.FDB',
  user: 'SYSDBA',
  password: 'masterkey' // test with this user!
};

Firebird.attach(options, (err, db) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    return;
  }

  console.log('✅ Connected to Firebird');
  db.detach();
});
