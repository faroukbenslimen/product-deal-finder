import { Request, Response } from 'express';
import { getAiClient, IS_TEST } from '../config';
import { isInCooldown, getClientIp } from '../services/rateLimitService';
import { consumeDailyModelBudget } from '../services/usageService';

/**
 * Identify Product from Image.
 */
export async function handleIdentifyProduct(req: Request, res: Response) {
  const ip = getClientIp(req);
  const imageBase64 = typeof req.body?.image === 'string' ? req.body.image.trim() : '';
  
  if (!imageBase64) return res.status(400).json({ error: 'An image is required.' });

  // 1. IP Cooldown Check
  const cooldown = isInCooldown(ip, 'identify');
  if (cooldown.blocked) {
    return res.status(429).json({ 
      error: `Please wait ${Math.ceil(cooldown.retryAfterMs / 1000)}s before analyzing another image.` 
    });
  }

  if (IS_TEST) return res.json({ productName: 'Test product' });

  try {
    // 2. Daily Budget Check
    if (!consumeDailyModelBudget(1)) {
      return res.status(429).json({ error: 'Daily AI budget reached. Please try again tomorrow.' });
    }

    // 3. Perform AI analysis
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const result = await getAiClient().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
        { text: 'Identify the product in this image. Return ONLY the product name or type in a single line.' },
      ],
    });

    const productName = result.text?.trim();
    if (!productName) throw new Error('Failed to identify product.');
    
    return res.json({ productName });
  } catch (error: any) {
    console.error('[Identify Error]', error);
    return res.status(500).json({ error: error.message || 'Image identification failed.' });
  }
}
