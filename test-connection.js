const Firebird = require('node-firebird-dev');

const options = {
  database: '192.168.1.30:/var/lib/firebird/3.0/data/DBSIF.FDB',
  user: 'SYSDBA',
  password: 'masterkey'
};

Firebird.attach(options, (err, db) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    return;
  }

  console.log('✅ Connected to Firebird');
  db.detach();
});
