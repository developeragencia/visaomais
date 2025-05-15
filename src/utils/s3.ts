import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

// Configurar cliente S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const bucketName = process.env.AWS_S3_BUCKET || '';

// Upload de arquivo para S3
export async function uploadToS3(
  base64Data: string,
  folder: string
): Promise<string> {
  try {
    // Converter base64 para buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Gerar nome único para o arquivo
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

    // Configurar parâmetros do upload
    const params = {
      Bucket: bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: 'image/jpeg',
      ContentEncoding: 'base64',
      ACL: 'public-read'
    };

    // Fazer upload
    await s3Client.send(new PutObjectCommand(params));

    // Retornar URL pública
    return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
  } catch (error) {
    console.error('Erro ao fazer upload para S3:', error);
    throw new Error('Falha ao fazer upload da imagem');
  }
}

// Excluir arquivo do S3
export async function deleteFromS3(imageUrl: string): Promise<void> {
  try {
    // Extrair nome do arquivo da URL
    const fileName = imageUrl.split('.com/')[1];

    // Configurar parâmetros da exclusão
    const params = {
      Bucket: bucketName,
      Key: fileName
    };

    // Excluir arquivo
    await s3Client.send(new DeleteObjectCommand(params));
  } catch (error) {
    console.error('Erro ao excluir arquivo do S3:', error);
    throw new Error('Falha ao excluir imagem');
  }
}

// Gerar URL assinada para acesso temporário
export async function generateSignedUrl(fileName: string, expiresIn = 3600): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error('Erro ao gerar URL assinada:', error);
    throw new Error('Falha ao gerar URL de acesso');
  }
}

// Validar URL do S3
export function isValidS3Url(url: string): boolean {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.endsWith('.amazonaws.com') &&
           urlObj.pathname.startsWith('/');
  } catch {
    return false;
  }
}

// Extrair nome do arquivo da URL do S3
export function extractFileNameFromUrl(url: string): string | null {
  if (!isValidS3Url(url)) return null;
  
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remove a barra inicial
  } catch {
    return null;
  }
}

// Verificar se arquivo existe no S3
export async function checkFileExists(fileName: string): Promise<boolean> {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    if ((error as any).name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

// Limpar arquivos antigos
export async function cleanupOldFiles(folder: string, maxAge: number): Promise<void> {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Prefix: folder
    });

    const response = await s3Client.send(command);
    const now = Date.now();

    for (const object of response.Contents || []) {
      if (object.LastModified && (now - object.LastModified.getTime()) > maxAge) {
        await deleteFromS3(object.Key || '');
      }
    }
  } catch (error) {
    console.error('Erro ao limpar arquivos antigos:', error);
    throw new Error('Falha ao limpar arquivos antigos');
  }
} 