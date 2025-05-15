import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Configuração do pool de conexões
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Testar conexão
pool.connect((err, client, release) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
    return;
  }
  console.log('Conectado ao banco de dados PostgreSQL');
  release();
});

// Criar tabelas se não existirem
async function createTables() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Tabela de medições
    await client.query(`
      CREATE TABLE IF NOT EXISTS measurements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        dp DECIMAL(5,2) NOT NULL,
        dpn_left DECIMAL(5,2) NOT NULL,
        dpn_right DECIMAL(5,2) NOT NULL,
        ap_left DECIMAL(5,2) NOT NULL,
        ap_right DECIMAL(5,2) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('manual', 'digital')),
        notes TEXT,
        image_url TEXT,
        landmarks JSONB,
        quality VARCHAR(10) CHECK (quality IN ('high', 'medium', 'low')),
        confidence DECIMAL(4,3),
        warnings TEXT[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Índices
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_measurements_user_id ON measurements(user_id);
      CREATE INDEX IF NOT EXISTS idx_measurements_created_at ON measurements(created_at);
      CREATE INDEX IF NOT EXISTS idx_measurements_type ON measurements(type);
    `);

    // Trigger para atualizar updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_measurements_updated_at ON measurements;
      CREATE TRIGGER update_measurements_updated_at
        BEFORE UPDATE ON measurements
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query('COMMIT');
    console.log('Tabelas criadas/atualizadas com sucesso');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar tabelas:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Executar criação das tabelas
createTables().catch(console.error);

export { pool }; 