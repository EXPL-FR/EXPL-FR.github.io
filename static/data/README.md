# Explorer data

The project page's interactive explorer reads `signatures.json` from this folder.

**It is not in the repository yet** — the page falls back to the static figure from
the paper until it is added. Publishing this file means publishing your prompt
vocabulary and the per-row similarity values, so choose a subset you are happy to
release; a handful of identities and one or two cases is plenty.

## Generating it

Run `explain.py` as usual, then convert its output:

```bash
python explain.py \
  --images images \
  --prompts prompts/signature_prompts.txt \
  --target vitb_wf4m \
  --fr-ckpt /path/to/fr_checkpoint

python tools/make_web_data.py \
  --signatures outputs/signatures.csv \
  --prompts    prompts/signature_prompts.txt \
  --target     vitb_wf4m \
  --out        docs/static/data/signatures.json
```

`--identity-limit N` keeps only the first N identities if the pool is large.

## Shape

```json
{
  "target": "vitb_wf4m",
  "n_prompts": 100,
  "prompts": [{"t": "A photo of a person with blond hair.", "c": "hair color"}],
  "rows": [
    {"level": "identity", "group": "person_a", "item": "mean", "n": 3, "v": [0.0121]},
    {"level": "case", "group": "case_01", "item": "reference", "v": [0.0312]}
  ]
}
```

`v` is parallel to `prompts`. Identity rows are the mean over that identity's images,
matching the identity level in `explain.py`'s figure; case rows are single images and
the explorer computes differences client-side.

## signatures.dev.json

A **synthetic** fixture with made-up numbers, used only to develop and preview the
explorer's layout. It loads only at `index.html?dev=1`, never on the default page, and
its caption says so. Delete it once real data is in place.
