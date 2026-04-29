# Riftbound Scanner Project

## Current State

- The app is an Expo/React Native Android app with camera capture and ML Kit OCR.
- The scan flow is photo-based: capture a photo, parse OCR text, ask RiftCodex for the matching card, then open Cardmarket automatically when the match is exact.
- Cardmarket links are resolved from a local generated database in `src/features/cardmarket/cardmarket-candidates.data.ts`, plus manual corrections in `src/features/cardmarket/cardmarket-overrides.data.ts`.
- The generated local database now also stores RiftCodex `imageUrl` values so scan results, search results, and collection entries can show the official card image.
- If the exact variant is uncertain, the app falls back to a clean Cardmarket name search. Variant labels such as `Alternate Art`, `Overnumbered`, `Signature`, and `Metal` are stripped from search text.
- The generated Cardmarket DB is rebuilt with `node scripts/generate-cardmarket-candidates.mjs`.
- The Collection screen is enabled and stores cards locally in a JSON file using `expo-file-system`.
- Collection quantities can be edited from the Collection screen. Direct `normal`/`foil` add buttons are temporarily hidden from scan/detail while matching is being stabilized.
- Scan results now include an image-assisted candidate strip, showing nearby variants from the local DB so the user can tap the right artwork before opening Cardmarket.

## Cleanup Decisions

- Keep `scripts/generate-cardmarket-candidates.mjs`; it is the useful repeatable generator for new sets.
- Keep `cardmarket-overrides.data.ts`; this is where odd Cardmarket URL exceptions belong.
- Keep the local Cardmarket DB in the app for fast direct links and offline lookup.
- The old starter `cards.data.ts`, fake scan service, and storage stub have been removed.
- Avoid browser scraping scripts. Cardmarket blocks aggressive fetching, and the result is fragile.
- Avoid live OCR scanning for now. The better MVP is fast photo scan plus a clear confirmation/manual fallback.

## Card Matching Rules

1. OCR first tries to read a known card name from the local Cardmarket/Riftbound names.
2. OCR also extracts the set code and collector number when visible.
3. RiftCodex lookup prefers a name-matching card with the exact scanned set and number.
4. If the set/number cannot be trusted, the app uses the card name only and opens Cardmarket search.
5. Direct Cardmarket URLs are only used when the match is exact or the scanned set and number match the returned card.
6. The scan screen now shows the candidate image first and waits for user confirmation before opening Cardmarket.
7. Manual `CHECK FIELDS` trusts exact local set/number matches before remote name matching, so typed collector data wins over suffix variants.
8. OCR has a targeted correction for the common `OPP` vs `OGN` misread when it can match a likely Origins collector variant locally.
9. Image validation is currently assisted/manual: the app shows likely local image candidates instead of doing full pixel similarity.

## Local Database Strategy

Short term, keep using RiftCodex at scan time because it gives card metadata, image URLs, and new-card updates without rebuilding every local object by hand.

Medium term, generate a local full-card database from RiftCodex, similar to the Cardmarket DB. The app can then search instantly and work mostly offline. RiftCodex becomes the upstream data source, not something the UI must depend on for every lookup.

Long term, move sync to a small backend:

- Pull RiftCodex data when a new set drops.
- Generate versioned card JSON and Cardmarket URL JSON.
- Let the app download the latest bundle.
- Keep manual Cardmarket exceptions in one editable override file.

## Price Strategy

Cardmarket exposes public downloadable data files for Riftbound:

- product catalog: `https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_22.json`
- price guide: `https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_22.json`

The app now refreshes both files automatically on launch when the local cache is older than 24 hours. The files are stored in the app document directory and reused offline if the refresh fails.

Startup behavior:

1. If the cache is younger than 24 hours, the app does nothing.
2. If the cache is old but available, the app keeps working and shows a small price-update message while refreshing in the background.
3. If there is no cache yet, the app shows a blocking loader while it downloads the first price files.
4. The Collection screen has a manual `REFRESH` button with a short cooldown so accidental taps do not repeatedly download the same Cardmarket files.

The price guide is keyed by Cardmarket `idProduct`, so the app bridges local card data to Cardmarket product IDs with the product catalog. Once a scan finds an exact variant, the scan UI shows low, trend, and average prices from the cached price guide and keeps the button for opening the exact Cardmarket product page.

This gives fast collection-wide price refresh later: instead of scraping one Cardmarket page per owned card, the app can update one price-guide file and recompute every owned card locally. It is still product-level guide pricing, not the live first listing for one language/condition.

## Next Implementation Steps

1. Improve scan results screen:
   - show detected card, image, confidence, and URL mode;
   - refine the image candidate picker for uncertain matches;
   - keep `See price`, `Retry OCR`, and manual edit.

2. Expand collection storage:
   - add condition and language controls;
   - add manual price and purchase price fields;
   - add import/export later.

3. Improve collection actions from scan:
   - edit quantity before saving;
   - keep a scan-session list so booster opening feels fast;
   - add undo for accidental adds.

4. Improve collection overview:
   - search/filter by set, name, rarity, missing/owned;
   - show owned quantities and quick edit controls.

5. Add price fields:
   - `See price` opens Cardmarket immediately;
   - cached price display comes later from a backend or accepted API source.

6. Improve recognition later:
   - use OCR as the fast path;
   - add image matching only for hard cards if OCR keeps failing;
   - image matching should probably live on a backend, not in the Expo app.
