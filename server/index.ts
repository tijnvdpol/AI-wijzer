import { app } from './app.js';
import { config } from './config.js';
import { initArtificialAnalysis } from './services/artificialAnalysis.js';

app.listen(config.port, () => {
  console.log(`[server] AI Wijzer API draait op http://localhost:${config.port} (model: ${config.openaiModel})`);
  void initArtificialAnalysis();
});
