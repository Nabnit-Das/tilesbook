# Implementation assumptions

The separately pasted Supabase setup addendum specifies the database and authentication implementation. The application uses Supabase PostgreSQL, Auth and Storage. The supplied second board is the visual reference. The first board was unavailable and its written inventory guides those screens.

The delivery target is a local repository. Provider deployment and SMS onboarding require the shop owner’s accounts. Fixed OTP credentials are for local demo identities only. For computers without Docker, an explicit loopback-only demo mode uses embedded PostgreSQL and synthetic records.

Quantities are recorded in the product base unit (boxes, bags or pieces). Monetary values are integer paise. GST rates are configurable examples subject to CA review. INV-113 totals ₹90,421 after a negative four-paise adjustment.
