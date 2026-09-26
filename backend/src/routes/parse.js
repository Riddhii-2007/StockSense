import express from 'express';
import { parseIntent } from '../services/nlp.js';
import { validateOperation } from '../services/validation.js';

const router = express.Router();

/**
 * POST /api/parse
 * Natural language -> structured intent -> the SAME validator the forms use.
 *
 * This endpoint never writes. It returns the intent plus a dry-run validation
 * so the UI can show a before/after preview and require human confirmation.
 * The wording is deliberately "untrusted input, exactly like a form post".
 */
router.post('/', async (req, res) => {
  const text = req.body?.text ?? '';
  if (!String(text).trim()) {
    return res.status(400).json({ success: false, message: 'text is required' });
  }

  const intent = await parseIntent(text);

  const validation =
    intent.type && intent.quantity != null && (intent.product || intent.sourceLocation || intent.destLocation)
      ? await validateOperation({
          type: intent.type,
          product: intent.product,
          sourceLocation: intent.sourceLocation,
          destLocation: intent.destLocation,
          lines: [{ quantity: intent.quantity, direction: intent.direction ?? 'IN' }],
        })
      : null;

  res.json({
    success: true,
    intent,
    validation,
    message: validation
      ? validation.ok
        ? 'Understood. Review the preview, then confirm to post.'
        : 'Understood, but it cannot be posted yet.'
      : 'Could not build a complete operation from that sentence. Rephrase or use the form.',
    note: 'Model output is untrusted input. It is validated by the same rules as the forms and never writes to stock.',
  });
});

export default router;
