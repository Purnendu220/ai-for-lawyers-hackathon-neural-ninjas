# Seed data

Everything here is fictional and labelled as such. Never add real client documents.

| File | Purpose |
|---|---|
| `samples/sample-order.pdf` | The blueprint §9 court order, ABC Traders v. XYZ Supplies, for demos and extraction tests |
| `samples/sample-order.docx` | The same order as a Word file, for DOCX extraction tests |
| `samples/blank-page.pdf` | A PDF with no text, for the "needs OCR" warning |

Regenerate the files after editing `samples/generate.mjs`:

```bash
npm run generate-samples -w @casepilot/seed
```
