# AI Wijzer

Webapp die de beste AI-tool aanbeveelt voor wat je wilt maken. De app combineert:

- **Onafhankelijke benchmarkdata** van [Artificial Analysis](https://artificialanalysis.ai/) (tekst, code, beeld, video, spraak);
- **Live webzoekresultaten** via de OpenAI API (web search) voor actuele prijzen en beschikbaarheid;
- **Jouw situatie**: bestaande abonnementen, studentenstatus en budget.

## Vereisten

- Node.js 20 of nieuwer
- Een OpenAI API-sleutel en een Artificial Analysis API-sleutel (zie hieronder)

## Installatie

```bash
npm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

Vul daarna `.env` in.

## API-sleutels ophalen

**OpenAI (ChatGPT API)**
1. Ga naar <https://platform.openai.com/api-keys> en log in.
2. Klik op *Create new secret key* en kopieer de sleutel naar `OPENAI_API_KEY`.
3. De API wordt los van een ChatGPT-abonnement betaald (per gebruik); zet eerst tegoed op je account onder *Billing*.

**Artificial Analysis**
1. Maak een gratis account op <https://artificialanalysis.ai/>.
2. Vraag een API-sleutel aan via <https://artificialanalysis.ai/api-reference> en kopieer die naar `ARTIFICIAL_ANALYSIS_API_KEY`.
3. De gratis API is beperkt tot 1.000 verzoeken per dag. AI Wijzer haalt elk dataset maar één keer per 24 uur op (6 verzoeken per dag).
4. Vermelding van Artificial Analysis is verplicht; dat doet de app onder elk resultaat.

## `.env` instellen

```env
OPENAI_API_KEY=jouw_openai_sleutel
ARTIFICIAL_ANALYSIS_API_KEY=jouw_aa_sleutel
OPENAI_MODEL=gpt-5-mini
PORT=3001
```

`OPENAI_MODEL` kun je aanpassen zonder codewijzigingen, bijvoorbeeld naar `gpt-5` of `gpt-4.1`. Kies een model dat web search en gestructureerde uitvoer ondersteunt; zie <https://platform.openai.com/docs/models>. De sleutels blijven op de server en komen nooit in de browser.

## De app starten

```bash
npm run dev
```

Dit start de API (poort 3001) en de frontend (<http://localhost:5173>) tegelijk. Vite stuurt `/api` door naar de server.

Andere commando's:

| Commando | Wat het doet |
| --- | --- |
| `npm run typecheck` | Controleert alle TypeScript (client en server) |
| `npm run build` | Bouwt de frontend naar `dist/` |

## Hoe het werkt

1. **Classificatie** – een goedkope OpenAI-call (zonder tools) bepaalt de categorie en of er een verduidelijkende vraag nodig is.
2. **Benchmarkdata** – uit de cache (geheugen + `server/cache/*.json`, 24 uur geldig) wordt de top 15 van de categorie gekozen. Faalt de API, dan wordt de laatste cache gebruikt en gemarkeerd als "mogelijk verouderd".
3. **Advies** – de hoofdcall gebruikt de OpenAI web search-tool met gestructureerde JSON-uitvoer (zod-schema in `shared/schemas.ts`). Het model kiest alleen het model-id; de scores en rangschikking komen van de server, dus worden niet verzonnen.
4. **Bronnen** – URLs uit de web search-citaten (`url_citation`) en uit het JSON-veld `sources` worden samengevoegd en ontdubbeld.

Voor categorieën zonder benchmarkdata (muziek, presentaties, websitebouwers, 3D) vertrouwt het model op web search en meldt de app dat er geen onafhankelijke benchmarkdata is gebruikt.

## Kosten en limieten

- `/api/recommend` heeft een limiet van 15 verzoeken per 10 minuten per IP.
- Identieke verzoeken (zelfde tekst en instellingen) worden 1 uur uit het geheugen beantwoord.
- Tokengebruik per aanroep verschijnt in de serverconsole (`[openai] … tokens: input=… output=…`).

## Mappenstructuur

```
client/   React + Tailwind frontend
server/   Express API (routes, services, cache)
shared/   Gedeelde types en zod-schema's
```

## Problemen oplossen

- **"De server mist een OPENAI_API_KEY"** – controleer of `.env` bestaat in de hoofdmap en herstart `npm run dev`.
- **Geen benchmarkdata** – controleer `ARTIFICIAL_ANALYSIS_API_KEY`; de serverconsole toont `[aa]`-meldingen.
- **Modelfout van OpenAI** – controleer of `OPENAI_MODEL` een bestaande modelnaam is.
