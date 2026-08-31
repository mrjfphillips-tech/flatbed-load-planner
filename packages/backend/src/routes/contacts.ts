import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { requireAnyRole } from '../middleware/auth.js';

export async function contactRoutes(app: FastifyInstance): Promise<void> {

  // POST /contacts/ocr-image — AI-powered business card OCR using OpenAI Vision
  app.post<{ Body: { imageBase64: string; mimeType?: string } }>(
    '/ocr-image', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { imageBase64, mimeType } = request.body;
      if (!imageBase64) {
        return reply.status(400).send({ error: 'imageBase64 is required' });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return reply.status(503).send({ error: 'OpenAI API key not configured' });
      }

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Extract ALL text from this business card image. Return the text exactly as it appears on the card, with each line on a new line. Include the person\'s name, title, company, phone numbers, email, and address. If the image is rotated, still read the text correctly. Return ONLY the extracted text, nothing else.',
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`,
                    },
                  },
                ],
              },
            ],
            max_tokens: 500,
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          console.error('[OCR] OpenAI error:', response.status, errBody);
          return reply.status(500).send({ error: 'OpenAI Vision request failed', detail: errBody.substring(0, 500) });
        }

        const data = await response.json() as any;
        const text = data.choices?.[0]?.message?.content?.trim() || '';
        return { text };
      } catch (err) {
        console.error('[OCR] Error:', err);
        return reply.status(500).send({ error: 'OCR processing failed' });
      }
    }
  );

  // GET /contacts?accountId=xxx
  app.get<{ Querystring: { accountId?: string } }>('/', { preHandler: [requireAnyRole] }, async (request) => {
    const { accountId } = request.query;
    let contacts;
    if (accountId) {
      contacts = await db.select().from(schema.contacts).where(eq(schema.contacts.accountId, accountId));
    } else {
      contacts = await db.select().from(schema.contacts);
    }
    return { contacts };
  });

  // GET /contacts/:id
  app.get<{ Params: { id: string } }>('/:id', { preHandler: [requireAnyRole] }, async (request, reply) => {
    const { id } = request.params;
    const [contact] = await db.select().from(schema.contacts).where(eq(schema.contacts.id, id));
    if (!contact) return reply.status(404).send({ error: 'Contact not found' });
    return contact;
  });

  // POST /contacts
  app.post<{ Body: { accountId: string; name: string; title?: string; email?: string; phone?: string } }>(
    '/', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { accountId, name, title, email, phone } = request.body;
      if (!accountId || !name?.trim()) {
        return reply.status(400).send({ error: 'accountId and name are required' });
      }
      const [contact] = await db.insert(schema.contacts).values({
        accountId,
        fullName: name.trim(),
        jobTitle: title || null,
        email: email || null,
        phone: phone || null,
      }).returning();
      return reply.status(201).send(contact);
    }
  );

  // PUT /contacts/:id
  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>('/:id', { preHandler: [requireAnyRole] }, async (request, reply) => {
    const { id } = request.params;
    const body = request.body;
    const updates: Record<string, unknown> = {};
    if (body.name) updates.fullName = body.name;
    if (body.title !== undefined) updates.jobTitle = body.title;
    if (body.email !== undefined) updates.email = body.email;
    if (body.phone !== undefined) updates.phone = body.phone;
    updates.updatedAt = new Date();

    const [updated] = await db.update(schema.contacts).set(updates).where(eq(schema.contacts.id, id)).returning();
    if (!updated) return reply.status(404).send({ error: 'Contact not found' });
    return updated;
  });

  // DELETE /contacts/:id
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: [requireAnyRole] }, async (request, reply) => {
    const { id } = request.params;
    const [deleted] = await db.delete(schema.contacts).where(eq(schema.contacts.id, id)).returning();
    if (!deleted) return reply.status(404).send({ error: 'Contact not found' });
    return { message: 'Contact deleted' };
  });
}
