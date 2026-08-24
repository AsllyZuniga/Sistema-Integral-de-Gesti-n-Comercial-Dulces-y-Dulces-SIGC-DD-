const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => console.log('Conectado a PostgreSQL'))
  .then(() => client.query('SELECT NOW()'))
  .then(res => console.log('Hora del servidor:', res.rows[0].now))
  .then(() => client.end())
  .then(() => console.log('Conexión cerrada'))
  .catch(err => console.error('Error:', err));
