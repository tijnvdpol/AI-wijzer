import express from 'express';
import { config } from './config';
import { recommendRouter } from './routes/recommend';
import { initArtificialAnalysis } from './services/artificialAnalysis';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: config.openaiModel });
});
app.use('/api', recommendRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Onbekend endpoint.' });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const isBadJson = err instanceof SyntaxError;
  if (!isBadJson) console.error('[server] fout:', err);
  res.status(isBadJson ? 400 : 500).json({ error: isBadJson ? 'Ongeldig verzoek.' : 'Er ging iets mis op de server.' });
});

app.listen(config.port, () => {
  console.log(`[server] AI Wijzer API draait op http://localhost:${config.port} (model: ${config.openaiModel})`);
  void initArtificialAnalysis();
});
