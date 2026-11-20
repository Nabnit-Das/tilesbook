# Assumptions

- Board 2 was supplied. Board 1 screens are interpreted from the written brief.
- Stock quantities are converted to the product's base stock unit before ledger posting. For tiles this implementation currently uses whole boxes for ledger entries.
- Local demo OTP is enabled explicitly. Live SMS requires a provider.
- Printed bills use the prompt's invoice calculations, including round-off to the nearest rupee.