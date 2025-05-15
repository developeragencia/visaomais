import { Express } from "express";

/**
 * Configuração para suportar o domínio redevisaomais.com
 */
export function setupDomainConfig(app: Express) {
  // Middleware para verificar o domínio e definir configurações específicas
  app.use((req, res, next) => {
    const host = req.get('host') || '';
    const originalUrl = req.originalUrl;
    
    // Inicializa um log específico para o host
    const logDomainInfo = (message: string) => {
      console.log(`[DOMAIN-CONFIG] [${host}] ${message}`);
    };
    
    // Verificar se é um dos domínios que precisam ser atualizados
    const domainsThatNeedSpecialHandling = ['redevisaomais.com', 'replit.app', 'redevisaomais'];
    const isDomainThatNeedsSpecialHandling = domainsThatNeedSpecialHandling.some(domain => host.includes(domain));
    
    if (isDomainThatNeedsSpecialHandling) {
      logDomainInfo(`Requisição recebida no domínio especial: ${host}, path: ${originalUrl}`);
      
      // Configurações específicas para o domínio personalizado
      res.setHeader('X-Custom-Domain', host);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      
      // Definir cabeçalhos de cache agressivos para forçar atualização
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '-1');
      res.setHeader('Surrogate-Control', 'no-store');
      
      // Adiciona timestamp para invalidar caches baseados em ETag
      const timestamp = Date.now();
      res.setHeader('X-Timestamp', timestamp.toString());
      res.setHeader('ETag', `W/"${timestamp.toString(36)}${Math.random().toString(36).slice(2, 5)}"`);
      res.setHeader('Vary', '*');
      
      logDomainInfo('Cabeçalhos anti-cache configurados');
      
      // Verificar se é uma página HTML (não API ou recurso estático)
      const isHtmlRequest = !originalUrl.startsWith('/api/') && 
                           !originalUrl.includes('.') && 
                           req.method === 'GET';
      
      const isDirectRoot = (originalUrl === '/' || originalUrl === '' || originalUrl === '/index.html');
      
      if (isHtmlRequest) {
        logDomainInfo('Página HTML detectada, garantindo versão mais recente');
        
        // Forçar a versão mais recente para todas as rotas de navegação HTML
        res.setHeader('Clear-Site-Data', '"cache", "storage"');
        
        // Verificar parâmetros de consulta específicos para forçar atualização
        const hasForceParam = req.query.force === 'true' || req.query.nocache !== undefined;
        
        // Se for a página raiz ou tiver parâmetros de força
        if (isDirectRoot || hasForceParam) {
          logDomainInfo('Página principal ou requisição com força detectada');
          
          // Adicionar parâmetros específicos para limpeza de cache
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private, post-check=0, pre-check=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', 'Thu, 01 Jan 1970 00:00:00 GMT');
          res.setHeader('Clear-Site-Data', '"cache", "storage", "executionContexts"');
          
          // Se for a rota raiz sem parâmetros, considerar redirecionamento para página de limpeza
          if (isDirectRoot && !hasForceParam) {
            const referrer = req.get('referer') || '';
            const hasReferrer = referrer && referrer.length > 0;
            
            // Detectar se o usuário acabou de ser redirecionado
            const wasForcedBefore = req.query.forced === 'true';
            
            if (!hasReferrer && !wasForcedBefore) {
              logDomainInfo('Acesso direto à página principal, considerar redirecionamento para limpeza');
            }
          }
        }
      }
    }
    
    next();
  });
  
  // Middleware para redirecionar automaticamente para a página inicial no domínio redevisaomais.com
  app.get('/redevisaomais', (req, res) => {
    const host = req.get('host') || '';
    const timestamp = Date.now();
    
    // Garantir que o cache seja limpo
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Clear-Site-Data', '"cache", "storage"');
    
    console.log(`[DOMAIN-REDIRECT] Redirecionando para página inicial com parâmetro de timestamp: ${timestamp}`);
    
    // Redirecionar para a raiz com timestamp para evitar cache
    res.redirect(`/?nocache=${timestamp}`);
  });
  
  // Adicionar rota para limpar cache
  app.get('/api/clear-cache', (req, res) => {
    // Gerar um timestamp para invalidar caches baseados em versão
    const timestamp = Date.now();
    const host = req.get('host') || '';
    const isRedeVisaoMais = host.includes('redevisaomais.com');
    
    // Gerar um hash para o controle de versão de recursos
    const versionHash = timestamp.toString(36) + Math.random().toString(36).substring(2, 5);
    
    // Verificar se é apenas uma checagem de versão
    const isCheck = req.query.check === 'true';
    const forceClean = req.query.force === 'true';
    
    // Log da solicitação
    console.log(`[CACHE-API] Requisição de ${isCheck ? 'verificação' : 'limpeza'} de cache de ${host}`);
    
    // Se for apenas uma verificação de versão, não enviar cabeçalhos de limpeza
    if (!isCheck || forceClean) {
      // Configurar cabeçalhos específicos para limpeza de cache
      res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
      res.setHeader('Cache-Control', 'no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Cache-Invalidate', 'true');
      
      if (isRedeVisaoMais || forceClean) {
        // Cabeçalhos adicionais para garantir renovação em domínios personalizados
        res.setHeader('Surrogate-Control', 'no-store');
        res.setHeader('X-Accel-Expires', '0');
        console.log('[CACHE-API] Aplicando limpeza agressiva de cache para domínio personalizado');
      }
    }
    
    // Sempre enviar o hash de versão
    res.setHeader('X-Version-Hash', versionHash);
    
    // Responder com informações do cache
    res.status(200).json({ 
      success: true, 
      message: isCheck ? 'Verificação de versão' : 'Cache limpo com sucesso',
      timestamp: timestamp,
      versionHash: versionHash,
      domain: host,
      isRedeVisaoMais: isRedeVisaoMais,
      isCheck: isCheck,
      forceClean: forceClean
    });
  });
  
  // Rota adicional especificamente para o domínio redevisaomais.com
  app.get('/api/redevisaomais/refresh', (req, res) => {
    const host = req.get('host') || '';
    const isRedeVisaoMais = host.includes('redevisaomais.com');
    const timestamp = Date.now();
    
    console.log(`[DOMAIN-REFRESH] Solicitação de atualização para ${host}`);
    
    if (isRedeVisaoMais) {
      console.log('[DOMAIN-REFRESH] Aplicando atualização para domínio redevisaomais.com');
      
      // Aplicar headers de limpeza agressiva
      res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      res.setHeader('X-Accel-Expires', '0');
      
      res.status(200).json({
        success: true,
        message: 'Domínio redevisaomais.com atualizado com sucesso',
        timestamp: timestamp,
        domain: host
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Esta rota é específica para o domínio redevisaomais.com',
        timestamp: timestamp,
        domain: host
      });
    }
  });
}