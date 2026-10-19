import { Router, Request, Response } from 'express';
import { Horizon } from '@stellar/stellar-sdk';
import { z } from 'zod';

const router = Router();

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

const paymentsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
});

function getHorizonServer(): Horizon.Server {
  const horizonUrl = process.env.HORIZON_URL || 'https://horizon.stellar.org';
  return new Horizon.Server(horizonUrl);
}

router.get('/:username', async (req: Request, res: Response) => {
  const parsed = paymentsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid query parameters',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { cursor, limit } = parsed.data;
  const pageLimit = limit ?? DEFAULT_LIMIT;

  try {
    const server = getHorizonServer();

    const builder = server
      .payments()
      .forAccount(req.params.username)
      .order('desc')
      .limit(pageLimit);

    if (cursor) {
      builder.cursor(cursor);
    }

    const page = await builder.call();
    const records = page.records ?? [];

    const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : null;
    const prevCursor = records.length > 0 ? records[0].paging_token : null;

    return res.json({
      data: records,
      paging: {
        next_cursor: nextCursor,
        prev_cursor: prevCursor,
        has_more: records.length === pageLimit,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

export default router;
