import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authenticateToken } from '../middleware/auth';
import { uploadToS3 } from '../utils/s3';
import { detectFacialLandmarks, analyzeMeasurements } from '../services/measurementService';
import { validateImageQuality } from '../utils/imageProcessing';

const router = Router();

// Schema de validação para medições
const measurementSchema = z.object({
  dp: z.number().min(50).max(80),
  dpnLeft: z.number().min(25).max(40),
  dpnRight: z.number().min(25).max(40),
  apLeft: z.number().min(20).max(35),
  apRight: z.number().min(20).max(35),
  type: z.enum(['manual', 'digital']),
  notes: z.string().optional(),
  imageUrl: z.string().optional(),
  landmarks: z.object({
    leftEye: z.object({ x: z.number(), y: z.number() }),
    rightEye: z.object({ x: z.number(), y: z.number() }),
    nose: z.object({ x: z.number(), y: z.number() }),
    confidence: z.number()
  }).optional(),
  quality: z.enum(['high', 'medium', 'low']).optional(),
  confidence: z.number().optional(),
  warnings: z.array(z.string()).optional()
});

// Verificar qualidade da imagem
router.post('/check-quality', authenticateToken, async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ 
        isGood: false, 
        message: "Imagem não fornecida" 
      });
    }

    const qualityCheck = await validateImageQuality(image);
    
    return res.json(qualityCheck);
  } catch (error) {
    console.error('Erro ao verificar qualidade:', error);
    return res.status(500).json({ 
      isGood: false, 
      message: "Erro ao processar imagem" 
    });
  }
});

// Detectar landmarks faciais
router.post('/detect-landmarks', authenticateToken, async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ 
        error: "Imagem não fornecida" 
      });
    }

    const landmarks = await detectFacialLandmarks(image);
    
    return res.json(landmarks);
  } catch (error) {
    console.error('Erro ao detectar landmarks:', error);
    return res.status(500).json({ 
      error: "Erro ao detectar pontos faciais" 
    });
  }
});

// Analisar medições avançadas
router.post('/analyze-advanced', authenticateToken, async (req, res) => {
  try {
    const { image, landmarks } = req.body;
    
    if (!image || !landmarks) {
      return res.status(400).json({ 
        error: "Dados incompletos" 
      });
    }

    const measurements = await analyzeMeasurements(image, landmarks);
    
    // Validar medições
    const validatedMeasurements = measurementSchema.parse({
      ...measurements,
      type: 'digital'
    });

    return res.json(validatedMeasurements);
  } catch (error) {
    console.error('Erro na análise avançada:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Medições fora dos limites aceitáveis",
        details: error.errors
      });
    }
    return res.status(500).json({ 
      error: "Erro ao analisar medições" 
    });
  }
});

// Salvar medição
router.post('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const validatedData = measurementSchema.parse(req.body);
    
    // Se houver imagem, fazer upload para S3
    let imageUrl = validatedData.imageUrl;
    if (imageUrl && imageUrl.startsWith('data:')) {
      const base64Data = imageUrl.split(',')[1];
      imageUrl = await uploadToS3(base64Data, 'measurements');
    }

    // Inserir medição no banco
    const result = await client.query(
      `INSERT INTO measurements (
        user_id, dp, dpn_left, dpn_right, ap_left, ap_right,
        type, notes, image_url, landmarks, quality, confidence, warnings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        req.user.id,
        validatedData.dp,
        validatedData.dpnLeft,
        validatedData.dpnRight,
        validatedData.apLeft,
        validatedData.apRight,
        validatedData.type,
        validatedData.notes,
        imageUrl,
        validatedData.landmarks,
        validatedData.quality,
        validatedData.confidence,
        validatedData.warnings
      ]
    );

    await client.query('COMMIT');
    
    return res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao salvar medição:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Dados inválidos",
        details: error.errors
      });
    }
    
    return res.status(500).json({ 
      error: "Erro ao salvar medição" 
    });
  } finally {
    client.release();
  }
});

// Listar medições do usuário
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM measurements 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    
    return res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar medições:', error);
    return res.status(500).json({ 
      error: "Erro ao buscar medições" 
    });
  }
});

// Excluir medição
router.delete('/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Verificar se a medição pertence ao usuário
    const checkResult = await client.query(
      'SELECT image_url FROM measurements WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: "Medição não encontrada" 
      });
    }

    // Se houver imagem, excluir do S3
    const measurement = checkResult.rows[0];
    if (measurement.image_url) {
      await deleteFromS3(measurement.image_url);
    }

    // Excluir medição
    await client.query(
      'DELETE FROM measurements WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    await client.query('COMMIT');
    
    return res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro ao excluir medição:', error);
    return res.status(500).json({ 
      error: "Erro ao excluir medição" 
    });
  } finally {
    client.release();
  }
});

export default router; 