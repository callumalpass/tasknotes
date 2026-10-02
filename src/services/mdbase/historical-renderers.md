# Historical TaskNotes type writers

Read-only extraction from shipped `src/services/MdbaseSpecService.ts`; no I/O or runtime plugin dependency. Settings and a locally constructed FieldMapper are the only inputs. Methods shared byte-for-byte by writers are deduplicated. Do not modernize these renderers: recognition requires historical output, including unquoted enum values.

First tag and SHA-256 of the tester-captured complete writer source:

- 4.3.1: `50668d0541360a4bfc5869f356f8a23c0799391f1b2cacb952d0593a84c3a1c0`
- 4.3.2: `bd80195198d1d1c63fa63caa01270bc1c493ecb5b44516976f4990f83567d998`
- 4.3.3: `5098f95f0308a45e1bf234622c6c8ed71f135082a0765cebd82bb694382a850d`
- 4.4.0: `fcd9143a2bd457af510d336715391994bd9fe1a288e78b4952d1912aa6f27305`
- 4.5.0: `53bf5ff2b8dd6bd4aca0220906774c60fde97e45546453415e5225f913e50e99`
- 4.6.0: `86f7a184e203256c97f9875e94b6cc3ea53f1f72a19dacfa69a451f80d0d1a0c`
- 4.7.0: `5f91c55a0bf6d5f9d3b337728ec6011f184ade72e849f0b8bfd4ebdb9816f261`
- 4.8.0: `df82bc277d8bbc65a5d16c08df5c76202c77cb34dd6d08c4baf9d9ab2bdf5a08`
- 4.9.1: `cf3a40aa3f5273b1e196602dff4f3130140e8985568a29d4468d00ae182ec79e`
- 4.10.0: `8afd253fc2ca7b6f45ca099a14cec5743328609f7bac91fbd7af3807c2cebc68`
- 4.12.0: `dd64a11742f79f3ad26ce98779c2c211019ade0103eb65c278a48a7cc8d7d08f`

4.12.0 writer is unchanged through 4.13.7. Earlier fingerprints and all tags were audited in the migration compatibility campaign. Recognition permits YAML mapping-key reordering, comments, CRLF and a leading BOM, but requires exact generated body and schema semantics. Invalid YAML is recognized only when the normalized complete bytes equal a frozen writer rendered with the saved settings. Unknown edits are preserved.
